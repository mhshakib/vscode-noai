/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/scm.css';
import { localize } from '../../../../nls.js';
import { ViewPane, IViewPaneOptions } from '../../../browser/parts/views/viewPane.js';
import { append, $ } from '../../../../base/browser/dom.js';
import { IListVirtualDelegate, IIdentityProvider } from '../../../../base/browser/ui/list/list.js';
import { IAsyncDataSource, ITreeEvent, ITreeContextMenuEvent } from '../../../../base/browser/ui/tree/tree.js';
import { WorkbenchCompressibleAsyncDataTree } from '../../../../platform/list/browser/listService.js';
import { ISCMRepository, ISCMService, ISCMViewService } from '../common/scm.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Disposable, DisposableMap, DisposableStore } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { RepositoryActionRunner, RepositoryRenderer } from './scmRepositoryRenderer.js';
import { collectContextMenuActions, getActionViewItemProvider, isSCMRepository } from './util.js';
import { Orientation } from '../../../../base/browser/ui/sash/sash.js';
import { Iterable } from '../../../../base/common/iterator.js';
import { MenuId } from '../../../../platform/actions/common/actions.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { observableConfigValue } from '../../../../platform/observable/common/platformObservableUtils.js';
import { autorun, IObservable, observableSignalFromEvent, runOnChange } from '../../../../base/common/observable.js';
import { Sequencer, Throttler } from '../../../../base/common/async.js';
import { SCMViewService } from './scmViewService.js';
import { ResourceTree } from '../../../../base/common/resourceTree.js';
import { IAsyncDataTreeViewState, ITreeCompressionDelegate } from '../../../../base/browser/ui/tree/asyncDataTree.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

type TreeElement = ISCMRepository;

class ListDelegate implements IListVirtualDelegate<ISCMRepository> {

	getHeight(): number {
		return 22;
	}

	getTemplateId(element: TreeElement): string {
		if (isSCMRepository(element)) {
			return RepositoryRenderer.TEMPLATE_ID;
		} else {
			throw new Error('Invalid tree element');
		}
	}
}

class RepositoryTreeDataSource extends Disposable implements IAsyncDataSource<ISCMViewService, TreeElement> {
	constructor(@ISCMViewService private readonly scmViewService: ISCMViewService) {
		super();
	}

	async getChildren(inputOrElement: ISCMViewService | TreeElement): Promise<Iterable<TreeElement>> {
		if (this.scmViewService.explorerEnabledConfig.get() === false) {
			const parentId = isSCMRepository(inputOrElement)
				? inputOrElement.provider.id
				: undefined;

			const repositories = this.scmViewService.repositories
				.filter(r => r.provider.parentId === parentId);

			return repositories;
		}

		// Explorer mode
		if (inputOrElement instanceof SCMViewService) {
			// Get all top level repositories
			const repositories = this.scmViewService.repositories
				.filter(r => r.provider.parentId === undefined);

			// Check whether there are any child repositories
			if (repositories.length !== this.scmViewService.repositories.length) {
				for (const repository of repositories) {
					const childRepositories = this.scmViewService.repositories
						.filter(r => r.provider.parentId === repository.provider.id);

					if (childRepositories.length === 0) {
						continue;
					}

					// Insert child repositories right after the parent
					const repositoryIndex = repositories.indexOf(repository);
					repositories.splice(repositoryIndex + 1, 0, ...childRepositories);
				}
			}

			return repositories;
		} else if (isSCMRepository(inputOrElement)) {
			return [];
		}

		return [];
	}

	hasChildren(inputOrElement: ISCMViewService | TreeElement): boolean {
		if (this.scmViewService.explorerEnabledConfig.get() === false) {
			const parentId = isSCMRepository(inputOrElement)
				? inputOrElement.provider.id
				: undefined;

			const repositories = this.scmViewService.repositories
				.filter(r => r.provider.parentId === parentId);

			return repositories.length > 0;
		}

		// Explorer mode
		if (inputOrElement instanceof SCMViewService) {
			return this.scmViewService.repositories.length > 0;
		} else if (isSCMRepository(inputOrElement)) {
			return true;
		} else {
			return false;
		}
	}
}

class RepositoryTreeIdentityProvider implements IIdentityProvider<TreeElement> {
	getId(element: TreeElement): string {
		if (isSCMRepository(element)) {
			return `repo:${element.provider.id}`;
		} else {
			throw new Error('Invalid tree element');
		}
	}
}

class RepositoriesTreeCompressionDelegate implements ITreeCompressionDelegate<TreeElement> {
	isIncompressible(element: TreeElement): boolean {
		if (ResourceTree.isResourceNode(element)) {
			return element.childrenCount > 1;
		} else {
			return true;
		}
	}
}

export class SCMRepositoriesViewPane extends ViewPane {

	private tree!: WorkbenchCompressibleAsyncDataTree<ISCMViewService, TreeElement>;
	private treeDataSource!: RepositoryTreeDataSource;
	private treeIdentityProvider!: RepositoryTreeIdentityProvider;
	private readonly treeOperationSequencer = new Sequencer();
	private readonly updateChildrenThrottler = new Throttler();

	private readonly visibleCountObs: IObservable<number>;
	private readonly providerCountBadgeObs: IObservable<'hidden' | 'auto' | 'visible'>;

	private readonly visibilityDisposables = new DisposableStore();
	private readonly repositoryDisposables = new DisposableMap<ISCMRepository>();

	constructor(
		options: IViewPaneOptions,
		@ISCMService private readonly scmService: ISCMService,
		@ISCMViewService private readonly scmViewService: ISCMViewService,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IConfigurationService configurationService: IConfigurationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super({ ...options, titleMenuId: MenuId.SCMSourceControlTitle }, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);

		this.visibleCountObs = observableConfigValue('scm.repositories.visible', 10, this.configurationService);
		this.providerCountBadgeObs = observableConfigValue<'hidden' | 'auto' | 'visible'>('scm.providerCountBadge', 'hidden', this.configurationService);

		this.storageService.onWillSaveState(() => {
			this.storeTreeViewState();
		}, this, this._store);

		this._register(this.updateChildrenThrottler);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		const treeContainer = append(container, $('.scm-view.scm-repositories-view'));

		// scm.providerCountBadge setting
		this._register(autorun(reader => {
			const providerCountBadge = this.providerCountBadgeObs.read(reader);
			treeContainer.classList.toggle('hide-provider-counts', providerCountBadge === 'hidden');
			treeContainer.classList.toggle('auto-provider-counts', providerCountBadge === 'auto');
		}));

		const viewState = this.loadTreeViewState();
		this.createTree(treeContainer, viewState);

		this.onDidChangeBodyVisibility(async visible => {
			if (!visible) {
				this.visibilityDisposables.clear();
				return;
			}

			this.treeOperationSequencer.queue(async () => {
				// Initial rendering
				await this.tree.setInput(this.scmViewService, viewState);

				// scm.repositories.visible setting
				this.visibilityDisposables.add(autorun(reader => {
					const visibleCount = this.visibleCountObs.read(reader);
					this.updateBodySize(this.tree.contentHeight, visibleCount);
				}));

				// scm.repositories.explorer setting
				this.visibilityDisposables.add(runOnChange(this.scmViewService.explorerEnabledConfig, async () => {
					await this.updateChildren();
					this.updateBodySize(this.tree.contentHeight);

					// If we only have one repository, expand it
					if (this.scmViewService.repositories.length === 1) {
						await this.treeOperationSequencer.queue(() =>
							this.tree.expand(this.scmViewService.repositories[0]));
					}
				}));

				// Update tree selection
				const onDidChangeVisibleRepositoriesSignal = observableSignalFromEvent(
					this, this.scmViewService.onDidChangeVisibleRepositories);

				this.visibilityDisposables.add(autorun(async reader => {
					onDidChangeVisibleRepositoriesSignal.read(reader);
					await this.treeOperationSequencer.queue(() => this.updateTreeSelection());
				}));

				// Add/Remove event handlers
				this.scmService.onDidAddRepository(this.onDidAddRepository, this, this.visibilityDisposables);
				this.scmService.onDidRemoveRepository(this.onDidRemoveRepository, this, this.visibilityDisposables);
				for (const repository of this.scmService.repositories) {
					this.onDidAddRepository(repository);
				}

				// Expand repository if there is only one
				this.visibilityDisposables.add(autorun(async reader => {
					const explorerEnabledConfig = this.scmViewService.explorerEnabledConfig.read(reader);
					const didFinishLoadingRepositories = this.scmViewService.didFinishLoadingRepositories.read(reader);

					if (viewState === undefined && explorerEnabledConfig && didFinishLoadingRepositories && this.scmViewService.repositories.length === 1) {
						await this.treeOperationSequencer.queue(() =>
							this.tree.expand(this.scmViewService.repositories[0]));
					}
				}));
			});
		}, this, this._store);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
		this.tree.layout(height, width);
	}

	override focus(): void {
		super.focus();
		this.tree.domFocus();
	}

	private createTree(container: HTMLElement, viewState?: IAsyncDataTreeViewState): void {
		this.treeIdentityProvider = new RepositoryTreeIdentityProvider();
		this.treeDataSource = this.instantiationService.createInstance(RepositoryTreeDataSource);
		this._register(this.treeDataSource);

		this.tree = this.instantiationService.createInstance(
			WorkbenchCompressibleAsyncDataTree,
			'SCM Repositories',
			container,
			new ListDelegate(),
			new RepositoriesTreeCompressionDelegate(),
			[
				this.instantiationService.createInstance(RepositoryRenderer, MenuId.SCMSourceControlInline, getActionViewItemProvider(this.instantiationService))
			],
			this.treeDataSource,
			{
				identityProvider: this.treeIdentityProvider,
				horizontalScrolling: false,
				collapseByDefault: (e: unknown) => {
					if (this.scmViewService.explorerEnabledConfig.get() === false) {
						if (isSCMRepository(e) && e.provider.parentId === undefined) {
							return false;
						}
						return true;
					}

					// Explorer mode
					if (viewState?.expanded && isSCMRepository(e)) {
						// Only expand repositories that were expanded before
						return viewState.expanded.indexOf(this.treeIdentityProvider.getId(e)) === -1;
					} else {
						return true;
					}
				},
				compressionEnabled: true,
				overrideStyles: this.getLocationBasedColors().listOverrideStyles,
				multipleSelectionSupport: this.scmViewService.selectionModeConfig.get() === 'multiple',
				expandOnDoubleClick: true,
				expandOnlyOnTwistieClick: true,
				accessibilityProvider: {
					getAriaLabel(element: TreeElement): string {
						if (isSCMRepository(element)) {
							return element.provider.label;
						} else {
							return '';
						}
					},
					getWidgetAriaLabel() {
						return localize('scm', "Source Control Repositories");
					}
				}
			}
		) as WorkbenchCompressibleAsyncDataTree<ISCMViewService, TreeElement>;
		this._register(this.tree);

		this._register(autorun(reader => {
			const selectionMode = this.scmViewService.selectionModeConfig.read(reader);
			this.tree.updateOptions({ multipleSelectionSupport: selectionMode === 'multiple' });
		}));

		this._register(this.tree.onDidChangeSelection(this.onTreeSelectionChange, this));
		this._register(this.tree.onDidChangeFocus(this.onTreeDidChangeFocus, this));
		this._register(this.tree.onDidFocus(this.onDidTreeFocus, this));
		this._register(this.tree.onContextMenu(this.onTreeContextMenu, this));
		this._register(this.tree.onDidChangeContentHeight(this.onTreeContentHeightChange, this));
	}

	private async onDidAddRepository(repository: ISCMRepository): Promise<void> {
		const disposables = new DisposableStore();

		// HistoryItemRef changed
		disposables.add(autorun(async reader => {
			const historyProvider = repository.provider.historyProvider.read(reader);
			if (!historyProvider) {
				return;
			}

			reader.store.add(runOnChange(historyProvider.historyItemRef, async () => {
				await this.updateRepository(repository);
			}));
		}));

		await this.updateRepository(repository);
		this.repositoryDisposables.set(repository, disposables);
	}

	private async onDidRemoveRepository(repository: ISCMRepository): Promise<void> {
		await this.updateRepository(repository);
		this.repositoryDisposables.deleteAndDispose(repository);
	}


	private onTreeContextMenu(e: ITreeContextMenuEvent<TreeElement>): void {
		if (!e.element) {
			return;
		}

		if (isSCMRepository(e.element)) {
			// Repository
			const provider = e.element.provider;
			const menus = this.scmViewService.menus.getRepositoryMenus(provider);
			const menu = menus.getRepositoryContextMenu(e.element);
			const actions = collectContextMenuActions(menu);

			const disposables = new DisposableStore();
			const actionRunner = new RepositoryActionRunner(() => {
				return this.getTreeSelection();
			});
			disposables.add(actionRunner);
			disposables.add(actionRunner.onWillRun(() => this.tree.domFocus()));

			this.contextMenuService.showContextMenu({
				actionRunner,
				getAnchor: () => e.anchor,
				getActions: () => actions,
				getActionsContext: () => provider,
				onHide: () => disposables.dispose()
			});
		}
	}

	private onTreeSelectionChange(e: ITreeEvent<TreeElement>): void {
		if (e.browserEvent && e.elements.length > 0) {
			const scrollTop = this.tree.scrollTop;

			if (e.elements.every(e => isSCMRepository(e))) {
				this.scmViewService.visibleRepositories = e.elements;
			}

			this.tree.scrollTop = scrollTop;
		}
	}

	private onTreeDidChangeFocus(e: ITreeEvent<TreeElement>): void {
		if (e.browserEvent && e.elements.length > 0) {
			if (isSCMRepository(e.elements[0])) {
				this.scmViewService.focus(e.elements[0]);
			}
		}
	}

	private onDidTreeFocus(): void {
		const focused = this.tree.getFocus();
		if (focused.length > 0) {
			if (isSCMRepository(focused[0])) {
				this.scmViewService.focus(focused[0]);
			}
		}
	}

	private onTreeContentHeightChange(height: number): void {
		this.updateBodySize(height);

		// Refresh the selection
		this.treeOperationSequencer.queue(() => this.updateTreeSelection());
	}

	private async updateChildren(element?: TreeElement): Promise<void> {
		return this.updateChildrenThrottler.queue(
			() => this.treeOperationSequencer.queue(async () => {
				if (element && this.tree.hasNode(element)) {
					await this.tree.updateChildren(element, true);
				} else {
					await this.tree.updateChildren(undefined, true);
				}
			})
		);
	}

	private async expand(element: TreeElement): Promise<void> {
		await this.treeOperationSequencer.queue(() => this.tree.expand(element, true));
	}

	private async updateRepository(repository: ISCMRepository): Promise<void> {
		if (this.scmViewService.explorerEnabledConfig.get() === false) {
			if (repository.provider.parentId === undefined) {
				await this.updateChildren();
				return;
			}

			await this.updateParentRepository(repository);
		}

		// Explorer mode
		await this.updateChildren();
	}

	private async updateParentRepository(repository: ISCMRepository): Promise<void> {
		const parentRepository = this.scmViewService.repositories
			.find(r => r.provider.id === repository.provider.parentId);
		if (!parentRepository) {
			return;
		}

		await this.updateChildren(parentRepository);
		await this.expand(parentRepository);
	}

	private updateBodySize(contentHeight: number, visibleCount?: number): void {
		if (this.orientation === Orientation.HORIZONTAL) {
			return;
		}

		if (this.scmViewService.explorerEnabledConfig.get() === false) {
			visibleCount = visibleCount ?? this.visibleCountObs.get();
			const empty = this.scmViewService.repositories.length === 0;
			const size = Math.min(contentHeight / 22, visibleCount) * 22;

			this.minimumBodySize = visibleCount === 0 ? 22 : size;
			this.maximumBodySize = visibleCount === 0 ? Number.POSITIVE_INFINITY : empty ? Number.POSITIVE_INFINITY : size;
		} else {
			this.minimumBodySize = 120;
			this.maximumBodySize = Number.POSITIVE_INFINITY;
		}
	}

	private async updateTreeSelection(): Promise<void> {
		const oldSelection = this.getTreeSelection();
		const oldSet = new Set(oldSelection);

		const set = new Set(this.scmViewService.visibleRepositories);
		const added = new Set(Iterable.filter(set, r => !oldSet.has(r)));
		const removed = new Set(Iterable.filter(oldSet, r => !set.has(r)));

		if (added.size === 0 && removed.size === 0) {
			return;
		}

		const selection = oldSelection.filter(repo => !removed.has(repo));

		for (const repo of this.scmViewService.repositories) {
			if (added.has(repo)) {
				selection.push(repo);
			}
		}

		const visibleSelection = selection
			.filter(s => this.tree.hasNode(s));

		this.tree.setSelection(visibleSelection);

		if (visibleSelection.length > 0 && !this.tree.getFocus().includes(visibleSelection[0])) {
			this.tree.setAnchor(visibleSelection[0]);
			this.tree.setFocus([visibleSelection[0]]);
		}
	}

	private getTreeSelection(): ISCMRepository[] {
		return this.tree.getSelection()
			.map(e => {
				if (isSCMRepository(e)) {
					return e;
				} else {
					throw new Error('Invalid tree element');
				}
			});
	}

	private loadTreeViewState(): IAsyncDataTreeViewState | undefined {
		const storageViewState = this.storageService.get('scm.repositoriesViewState', StorageScope.WORKSPACE);
		if (!storageViewState) {
			return undefined;
		}

		try {
			const treeViewState = JSON.parse(storageViewState);
			return treeViewState;
		} catch {
			return undefined;
		}
	}

	private storeTreeViewState(): void {
		if (this.tree) {
			this.storageService.store('scm.repositoriesViewState', JSON.stringify(this.tree.getViewState()), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		}
	}

	override dispose(): void {
		this.visibilityDisposables.dispose();
		this.repositoryDisposables.dispose();
		super.dispose();
	}
}
