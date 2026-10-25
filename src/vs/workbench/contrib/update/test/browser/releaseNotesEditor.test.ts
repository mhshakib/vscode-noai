/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { spy } from 'sinon';
import { $, addDisposableListener, getWindow } from '../../../../../base/browser/dom.js';
import { mainWindow } from '../../../../../base/browser/window.js';
import { DeferredPromise, timeout } from '../../../../../base/common/async.js';
import { toDisposable } from '../../../../../base/common/lifecycle.js';
import { upcastPartial } from '../../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { initializeReleaseNotesNavigation } from '../../browser/releaseNotesEditor.js';


suite('Release notes navigation', () => {
	for (const serialized of [false, true]) {
		suite(serialized ? 'serialized' : 'direct', () => {
			const store = ensureNoDisposablesAreLeakedInTestSuite();
			let targetDocument: Document;
			let targetWindow: Window & typeof globalThis;
			let navigationWindow: Window & typeof globalThis;
			let links: HTMLAnchorElement[];
			let frames: Map<number, FrameRequestCallback>;
			let resizeObservers: Set<() => void>;

			setup(async () => {
				// WebKit replaces about:blank documents when following fragment links.
				const url = mainWindow.URL.createObjectURL(new Blob(['<!DOCTYPE html><html><head></head><body></body></html>'], { type: 'text/html' }));
				store.add(toDisposable(() => mainWindow.URL.revokeObjectURL(url)));
				const iframe = $<HTMLIFrameElement>('iframe', { src: url });
				const loaded = new DeferredPromise<void>();
				store.add(addDisposableListener(iframe, 'load', () => { loaded.complete(); }));
				iframe.style.position = 'fixed';
				iframe.style.top = '0';
				iframe.style.left = '0';
				iframe.style.width = '600px';
				iframe.style.height = '300px';
				mainWindow.document.body.appendChild(iframe);
				store.add(toDisposable(() => iframe.remove()));
				await loaded.p;
				targetDocument = iframe.contentDocument!;
				targetWindow = getWindow(targetDocument.body);
				frames = new Map();
				resizeObservers = new Set();
				let nextFrame = 0;
				navigationWindow = upcastPartial<Window & typeof globalThis>({
					Node: targetWindow.Node,
					console: targetWindow.console,
					ResizeObserver: class implements ResizeObserver {
						private readonly notify: () => void;
						constructor(callback: ResizeObserverCallback) {
							this.notify = () => callback([], this);
							resizeObservers.add(this.notify);
						}
						observe(): void { }
						unobserve(): void { }
						disconnect(): void { resizeObservers.delete(this.notify); }
					},
					requestAnimationFrame: callback => {
						frames.set(++nextFrame, callback);
						return nextFrame;
					},
					cancelAnimationFrame: handle => { frames.delete(handle); },
					addEventListener: (...args: Parameters<Window['addEventListener']>) => targetWindow.addEventListener(...args),
					removeEventListener: (...args: Parameters<Window['removeEventListener']>) => targetWindow.removeEventListener(...args),
				});
				targetDocument.documentElement.style.overflowAnchor = 'none';
				targetDocument.body.style.margin = '0';
				const nav = $('nav', { id: 'toc-nav' });
				nav.style.position = 'fixed';
				links = ['first', 'second', 'last'].map(id => {
					const link = $<HTMLAnchorElement>('a', { href: `#${id}` }, id);
					nav.appendChild(link);
					return link;
				});
				const introduction = $('div');
				introduction.style.height = '120px';
				const content = $('div.notes-main');
				for (const id of ['first', 'subsection', 'second', 'last']) {
					const heading = $(id === 'subsection' ? 'h3' : 'h2', { id }, id);
					heading.style.margin = '0';
					heading.style.height = '30px';
					const paragraph = $('p');
					paragraph.style.margin = '0';
					paragraph.style.height = id === 'last' ? '100px' : '350px';
					content.append(heading, paragraph);
				}
				targetDocument.body.append(nav, introduction, content);
			});

			function initialize(): void {
				const initializer: typeof initializeReleaseNotesNavigation = serialized
					? new Function(`return (${initializeReleaseNotesNavigation.toString()});`)()
					: initializeReleaseNotesNavigation;
				store.add(toDisposable(initializer(targetDocument, navigationWindow)));
			}

			async function render(): Promise<void> {
				await timeout(0);
				for (const notify of resizeObservers) {
					notify();
				}
				const callbacks = [...frames.values()];
				frames.clear();
				callbacks.forEach(callback => callback(0));
			}

			async function scrollTo(id: string): Promise<void> {
				const target = targetDocument.getElementById(id)!;
				targetWindow.scrollTo(0, target.getBoundingClientRect().top + targetWindow.scrollY - 24);
				targetWindow.dispatchEvent(new targetWindow.Event('scroll'));
				await render();
			}

			function current(): string[] {
				return links.filter(link => link.getAttribute('aria-current') === 'location').map(link => link.textContent!);
			}

			test('tracks major sections in both directions without moving focus or changing the URL', async () => {
				initialize();
				links[0].focus();
				const url = targetWindow.location.href;
				const states: string[][] = [];
				await render();
				states.push(current());
				for (const id of ['first', 'subsection', 'second', 'first']) {
					await scrollTo(id);
					states.push(current());
				}
				targetWindow.scrollTo(0, 0);
				await render();
				states.push(current());
				assert.deepStrictEqual({
					states,
					focused: targetDocument.activeElement === links[0],
					url: targetWindow.location.href,
				}, {
					states: [[], ['first'], ['first'], ['second'], ['first'], []],
					focused: true,
					url,
				});
			});

			test('uses restored scroll positions and keeps the final section current at the bottom', async () => {
				await scrollTo('second');
				initialize();
				await render();
				const restored = current();
				targetWindow.scrollTo(0, targetDocument.documentElement.scrollHeight);
				await render();
				assert.deepStrictEqual({ restored, bottom: current() }, { restored: ['second'], bottom: ['last'] });
			});

			test('tracks native anchor jumps and encoded fragments', async () => {
				targetDocument.getElementById('second')!.id = 'second: section';
				links[1].setAttribute('href', '#second%3A%20section');
				initialize();
				const navigated = new DeferredPromise<void>();
				store.add(addDisposableListener(targetWindow, 'hashchange', () => { navigated.complete(); }));
				links[1].click();
				await navigated.p;
				await render();
				assert.deepStrictEqual({ current: current(), hash: targetWindow.location.hash }, {
					current: ['second'],
					hash: '#second%3A%20section',
				});
			});

			test('bounds heading layout reads for a long table of contents', async () => {
				const headings = Array.from({ length: 128 }, (_, index) => {
					const heading = $('h2', { id: `section-${index}` }, `Section ${index}`);
					heading.style.margin = '0';
					heading.style.height = '100px';
					return heading;
				});
				links = headings.map(heading => $<HTMLAnchorElement>('a', { href: `#${heading.id}` }, heading.id));
				targetDocument.getElementById('toc-nav')!.replaceChildren(...links);
				targetDocument.querySelector('.notes-main')!.replaceChildren(...headings);
				await scrollTo('section-96');
				const layoutReads = headings.map(heading => {
					const read = spy(heading, 'getBoundingClientRect');
					store.add(toDisposable(() => read.restore()));
					return read;
				});
				initialize();
				await render();
				assert.deepStrictEqual({
					current: current(),
					layoutReads: layoutReads.reduce((count, read) => count + read.callCount, 0),
				}, {
					current: ['section-96'],
					layoutReads: 7,
				});
			});

			test('updates when content above the reading position changes height', async () => {
				initialize();
				await scrollTo('second');
				targetDocument.getElementById('first')!.nextElementSibling!.setAttribute('style', 'height: 700px; margin: 0');
				await render();
				assert.deepStrictEqual(current(), ['first']);
			});

			test('updates the bottom boundary when the viewport is resized', async () => {
				targetDocument.getElementById('last')!.nextElementSibling!.setAttribute('style', 'height: 600px; margin: 0');
				initialize();
				await scrollTo('second');
				targetWindow.frameElement!.setAttribute('style', 'position: fixed; top: 0; left: 0; width: 600px; height: 1600px');
				await render();
				assert.deepStrictEqual(current(), ['last']);
			});

			test('handles missing targets and duplicate links without multiple current entries', async () => {
				targetDocument.getElementById('second')!.remove();
				const duplicate = $<HTMLAnchorElement>('a', { href: '#first' }, 'duplicate');
				links.push(duplicate);
				targetDocument.getElementById('toc-nav')!.appendChild(duplicate);
				initialize();
				await scrollTo('subsection');
				assert.deepStrictEqual(current(), ['first']);
			});

			test('allows documents without a TOC or without matching targets', async () => {
				links.forEach(link => link.setAttribute('href', '#missing'));
				initialize();
				targetDocument.getElementById('toc-nav')!.remove();
				initialize();
				await render();
				assert.deepStrictEqual(current(), []);
			});

			test('stops pending and future updates when the document is hidden', async () => {
				initialize();
				await scrollTo('first');
				targetWindow.dispatchEvent(new targetWindow.Event('resize'));
				targetWindow.dispatchEvent(new targetWindow.PageTransitionEvent('pagehide'));
				await scrollTo('second');
				targetWindow.dispatchEvent(new targetWindow.Event('resize'));
				targetDocument.getElementById('first')!.nextElementSibling!.setAttribute('style', 'height: 700px; margin: 0');
				await render();
				assert.deepStrictEqual({ current: current(), frames: frames.size, observers: resizeObservers.size }, {
					current: ['first'], frames: 0, observers: 0,
				});
			});
		});
	}
});
