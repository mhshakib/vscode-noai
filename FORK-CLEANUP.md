# Fork Cleanup Progress — kibvex-ai

Upstream: microsoft/vscode @ 4b40f12604553b3b4c1edb01d1d5f9d78ca71c77 (shallow clone)
Branch: fork-cleanup

## Product decisions (locked)

- **Ship Claude + Codex only.** Remove the copilot agent backing and ALL
  GitHub-Copilot auth/entitlement/proxy code.
- Claude/codex become **BYO-credential only**: the CAPI proxy transport
  (GitHub-token-authenticated, the current default) is removed; native
  transport (claude login / ANTHROPIC_API_KEY, codex CLI auth) remains.
- GitHub *sign-in* is fully removed (see Phase 5): no `github` or
  `github-enterprise` auth provider exists. GitHub *repo hosting* code
  (PR/merge/sync via `agentHostGitHubService` + `GITHUB_REPO_PROTECTED_RESOURCE`,
  `src/vs/platform/github`, `vscode.github` proposed API) remains structurally
  but has no auth source — authenticated operations fail closed; anonymous
  reads still work. Rewire to `gh` CLI / PAT / dynamic OAuth in a later phase
  if repo ops are revived.

## Done

- **Phase 1** `63926752` — Removed `extensions/copilot` (GitHub.copilot-chat),
  `copilot_shim/`, packaging, npm scripts, CI jobs, product.json entries.
- **Phase 2a** `9a9cf8d` — `defaultChatAgent` made optional in
  IProductConfiguration; removed from product.json + default product.
- **Phase 2b** `36f95df` — Unregistered Copilot provider contributions.
- **Phase 2c** `aa0be50d` — Deleted chatGettingStarted.ts, chatStatusEntry.ts.
- **Phase 2d** `666a2e63` — Deleted `chatSetup/*` (dialog, providers, runner,
  controller, Microsoft probe, growth session), `chatStatusPromo`,
  `chatPromoNotification`, `chatQuotaNotification`, `sessionsSignInDialog`,
  `agentHostSignedOutModelsNotification`, `chatAnonymousRateLimitedPart`,
  onboarding SignIn step (+test, css), sessions sign-in fixture. Unwired all
  `workbench.action.chat.triggerSetup` callers (~20 sites): `agentHostAuth`
  now uses `authenticationService.createSession` (generic interactive OAuth),
  `sessionsSetUpService` is a plain first-launch welcome + AI-disabled guard,
  account menu / SCM / model pickers / chat tips / continue-in / getting-
  started sign-in affordances removed. SDK-setup banner drops GitHub route
  (agent-owned sign-in like Codex remains).
- **Phase 3a** — Removed `chat.closedPromoNotification` setting + enum.
- **Phase 5** — Removed `extensions/github` (publish/share/clone/history/
  credential provider), `extensions/github-authentication` (`github` +
  `github-enterprise` providers, `github-enterprise.uri(s)` +
  `github-authentication.*` settings), and `extensions/tunnel-forwarding`
  (fully GitHub-auth dependent). Consumers unwired: configuration-editing
  gist profile handler + `github` proposal/`onProfile:github`, pluginGit
  services made anonymous-only (auth fallback + `pluginGitHubAuthentication`
  deleted), chatSpeechToText GitHub session tracking removed (cloud dictation
  now reports `connect.noauth`), `CROSS_APP_SHARED_SECRET_KEYS` emptied,
  `secrets.ts`/`webClientServer`/`mainThread*` extension-id references,
  browser workbench `github.auth` seeding + dummy-URI workaround,
  `services/accounts/common/githubEnterprise.ts` trimmed to issuer-derived
  `getGitHubEnterpriseUri`, `code-oss-launcher` GitHub-session preflight,
  test-integration suites, launch.json, eslint, pipelines, CredScan, codeql,
  CODENOTIFY, `trustedExtensionAuthAccess` product entry.

## Remaining

- **Phase 6 remove all agents + agent host + model install system**
  (decision: everything agent-related goes; repo ops stay dead from Phase 5;
  execute as reviewable commits in this order)
  **IN PROGRESS — deleted so far:** `agentHost/node/{claude,codex,copilot}/`,
  `build/agent-sdk/`, `build/codex/`, `src/vs/platform/agentHost/**`,
  `src/vs/sessions/`, `test/integration/agentHost/`,
  `src/vs/platform/agentPlugins/`,
  `workbench/contrib/chat/{browser,test/browser}/{agentSessions,remoteAgentHost}/`,
  `workbench/services/agentHost/`,
  `workbench/test/browser/componentFixtures/{chat,sessions}/`,
  `workbench/contrib/chat/test/browser/agentHost/`;
  SDK deps uninstalled (`@anthropic-ai/sdk`, `claude-agent-sdk`,
  `@github/copilot-sdk`, `@vscode/copilot-api`, `@openai/codex`,
  `foundry-local-sdk`).
  **Also done:** npm scripts (`test-agent-host-e2e*`, `codex:*-protocol`),
  `copilotRuntimeVersion`; `agentHostCrypto`+`devTunnels` lanes + files
  removed from `build/gulpfile.ts` + `build/next/index.ts`; all sessions/
  agentHost entry points removed from `build/next/index.ts`;
  `workbench.desktop.main.ts` + `workbench.common.main.ts` agent imports +
  `IAgentHostMcpOAuthMetadataService` singleton + agentSessions/
  remoteAgentHost contribution imports removed.
  **Next (typecheck baseline shrunk: 1366 → ~515 errors):**
  ALSO deleted since: `contrib/{chat,inlineChat,mcp,agentsVoice,canvases,
  remoteCodingAgents,welcomeAgentSessions,editTelemetry}`,
  `platform/{mcp,localTranscription,chat,customizationMarketplace}`,
  `services/{chat,mcp,agentEditorComments,browserView,localTranscription}`,
  `contrib/browserView`, terminalContrib `chat/`+`chatAgentTools/`
  (rest of terminalContrib restored via git), `server/node/{agentHostChannel,
  serverAgentHostManager}`, api chat/mcp/lm/agentEditorComments main+ext+tests,
  `windows/electron-main/agentsWindow.ts`, notebook chat contrib,
  `vscode.proposed.chatSessionCustomizationProvider.d.ts`.
  Unwired: workbench mains, app.ts, sharedProcessMain, serverServices +
  `agent-host-*` CLI args + `VSCODE_AGENT_HOST_BRIDGE_CONNECTION_TOKEN`,
  windowsMainService (openAgentsWindow/isSessionsWindow/handleChatRequest),
  windowImpl (sessions.html/ico), environment agentSessionsWorkspace,
  window.ts AgentsWindow* types + isSessionsWindow, terminal chat surface.
  **Also unwired/deleted:** `platform/onboarding` + `contrib/onboarding`
  (tryout engine — agents-window handoff), `native.ts`/`nativeHostMainService`
  `openAgentsWindow`+invitations+agentHostEditorState, `windows.ts` iface,
  launchMainService `--agents`, workspacesHistoryMainService task,
  `diffEditorTryout`, `releaseNotesTryouts`, `releaseNotesEditor` tryout
  plumbing, `cliProcessMain` MCP services + `--add-mcp`, `common/argv.ts` +
  `node/argv.ts` agent args (`agents`, `agent-plugins-dir`,
  `agents-user-data-dir`, `agents-extensions-dir`, `add-mcp`,
  `share-secrets-with-agents-app`), `workbenchTestServices` electron stubs.
  **Also deleted/unwired:** `extHost{AiRelatedInformation,AiSettingsSearch,
  ChatArtifactIntegrations,ChatDebug,ChatInputNotification,ChatOutputRenderer,
  ChatQuota,ChatStatus,GitHub}`, `mainThreadChatArtifactIntegrations`,
  `mainThreadGitHub`; `extHost.api.impl.ts` chat/lm/speech/github/ai/
  interactive namespaces + all rpcProtocol.set + window chat members removed;
  `common/argv.ts` + `node/argv.ts` fully cleaned of agent args.
  **extHost.protocol.ts:** RESTORED from HEAD then cleanly stripped
  113 chat/lm/mcp/agent/github/artifact decls + createProxyIdentifier
  registrations + dead imports (now ~0 errors). Also deleted:
  `extHost/mainThread` {Browsers,BrowserTunnelProxy,AiEmbeddingVector,
  AiRelatedInformation,AiSettingsSearch,Embeddings,Speech,Interactive},
  `extHost{AiRelatedInformation,AiSettingsSearch,EmbeddingVector,Embedding,
  AgentEditorComments,GitHub,Chat*}`, `mainThread{GitHub,
  ChatArtifactIntegrations}`, `services/{aiEmbeddingVector,
  aiRelatedInformation,aiSettingsSearch}`, `terminalContrib/voice`,
  `contrib/onboarding`, `platform/onboarding`, 44 dead `vscode.proposed.*`
  .d.ts (chat/lm/mcp/ai/speech/agent/github/artifact/scmArtifactProvider/
  remoteCodingAgents/embeddings), `searchChatContext`, `markersChatContext`,
  `manageTrustedMcpServersForAccountAction`, `policyDiagnosticsMarkdown`+test,
  `diffEditorTryout`, `releaseNotesTryouts`, agent-window plumbing across
  native/windows/launch/workspacesHistory/environment/argv, `terminal`
  chat surface, `app.ts` MCP+agent-host, `sharedProcessMain` MCP+agentHost,
  `serverServices`/`cliProcessMain`/`server.main`/`serverEnvironment` agent
  args+services.
  **Also done since:** `developerActions` agent sections stripped
  (`policyDiagnosticsMarkdown` restored from HEAD + agent parts removed,
  `policyDiagnosticsReport` signature simplified), `globalCompositeBar`
  codex account menu removed, `extensionsActions` 4 AI-feature action
  classes deleted + test suite removed, `workspaceTrust.ts`
  AGENT_HOST_SCHEME/agentSessionsWorkspace refs fixed, `extHost.api.impl`
  (imports + rpcProtocol sets + GitHubError + browserTabs window members),
  `extHostEditorTabs`/`mainThreadEditorTabs` ChatEditorInput,
  `mainThreadEditorTabs` chat block, `storageDataCleaner`, `app.ts`
  MCP services/channels, `sharedProcessMain` MCP regs,
  `workspacesHistoryMainService` agent tasks+workspace methods,
  `nativeHostMainService`/`native.ts`/`windowsMainService`/`windowImpl`/
  `updateRelaunchArguments`/`cli.ts`/`server.main`/`serverServices`
  agent leftovers, `extensionHost.contribution` dead side-effect imports,
  `search.contribution`/`markers.contribution`/`authentication.contribution`
  chat-context registrations, `extHost.api.impl` browserTabs.
  **Also done:** `workspaceTrust.test` agent-host tests removed,
  `fixtureUtils` sessions imports + all agent stubs (IAgentFeedbackService,
  IChatEditingService, ISessionsManagementService, ISessionsService,
  ISessionChangesStatsCache, ICodeReviewService, IChatPhoneInputPresenter,
  IChatPasteTargetService) removed.
  **SCM artifact feature removed:** `common/artifact.ts`,
  `platform/artifactIntegrations`, extHostSCM/mainThreadSCM artifact
  surface, `scm.ts`/`menus.ts`/`util.ts` artifact refs, workbench.main
  registry, `extensionsRegistry` onChatArtifactIntegration,
  47 dead proposal entries in `extensionsApiProposals.ts` (regenerate via
  `npm run gulp compile-api-proposal-names`), Copilot/GitHub assignment
  filters (`assignmentFilters.ts`+test, `assignmentService` unwired),
  `accountPolicyService.test` agent test, `TestChatWidgetService`/
  `TestChatEntitlementService` stubs. **`scmRepositoriesViewPane.ts`
  artifact strip IN PROGRESS** — file restored from HEAD; delete by line
  ranges (from HEAD): imports L24 edit + L32 + L50(fromNow); L51 union;
  L62-65 templateId; L72-135 ArtifactGroupTemplate+Renderer;
  L137-269 ArtifactTemplate+Renderer; L311-317 isSCMRepository->'return []';
  L318-371 artifactGroup/artifactNode getChildren branches; ~391-396
  hasChildren; ~407-413 getId; ~567-568 renderers; ~583-590
  collapseByDefault; ~600-605 accessibility; ~634-642 autorun;
  ~669-673 onTreeDidOpen; ~702-714 contextMenu; ~428,449,557-562
  selection/focus/getTreeSelection; ~854-856 trailing. Delete bottom-up.
  **extHostTypes.ts** restored from HEAD + stripped 98 chat/lm/mcp/
  speech decls (now clean); **extHost.api.impl** removed 105 dead
  `extHostTypes.X` vscode-object entries (now clean);
  **vscode.proposed.browser.d.ts** deleted; `extHostSpeech.ts` deleted.
  **Remaining ~402 errors** (typecheck-driven cleanup):
  `developerActions`(49 — deeper policy-diag damage),
  `extHostTypes`(44 — chat/agent type stubs), `workbenchTestServices`(21),
  `extHostTypeConverters`(20), `extensionsActions.test`(14),
  `assignmentFilters.test`(13), `accountPolicyService.test`(12),
  `releaseNotesEditor`(12)+test(8), `extHostSCM`(7)+test(9),
  `extHostSpeech`(9 — file still exists? delete), `extHost.api.impl`(6),
  `mainThreadSCM`(5), `mainThreadAuthentication`(4),
  `userDataProfile` electron-main(4), `workspacesHistoryMainService`(5),
  `emptyTextEditorHint`(5), `gettingStarted`(4), `commandsQuickAccess`(5),
  `settingsTree*`/`settingsTreeModels.test`, `abstractTaskService`,
  `notebookCellDiagnostics.test`, `editorDictation`, `workbench.common.main`(3),
  `windowImpl`/`window.test`/`native*`/`updateRelaunchArguments`/
  `userDataProfile.common`/`storageDataCleaner`/`sharedProcessMain`/
  `electronRemoteResourceLoader.test` strays, `workbenchTestServices` `workbenchTestServices`
  (21 chat service stubs), `assignmentFilters.test`, `accountPolicyService.test`,
  `releaseNotesEditor`, `terminalVoice.test`, `emptyTextEditorHint`,
  `settingsTree*` tests, `mainThreadAuthentication` MCP auth refs,
  `mainThreadSCM`/`extHostSCM` SCMArtifact, `extHostTypeConverters` strays,
  `mainThreadPower`/`mainThreadDataChannels`/`mainThreadSecretState`/
  `mainThreadUrls`/`mainThreadUriOpeners`/`mainThreadSearch`/`mainThreadLanguageFeatures`
  (hover/IAiEditTelemetry refs), `extHostPower`/`extHostDataChannels`/
  `extHostSearch`/`extHostUrls`/`extHostUriOpener`/`extHostProfileContentHandler`/
  `extHostLocalizationService`/`extHostSCM`, `mainThreadWebviewManager`
  chatOutputRenderer, `interactive` contrib chat refs, `quickaccess`/
  `windowActions`/`contextkeys`/`layout`/`commandCenterControl`/
  `settingsLayout`/`settingsEditor2`/`preferences*`, `explorerService`,
  `issue` contrib, `standaloneServices`, `managedSettingsUpdate`,
  `extensionEnablementService`, `userDataProfile` agentsWindowProfile,
  `defaultAccount`/`accounts`, `update`/`updateTitleBarEntry`,
  `terminalProfileConfigurationTelemetry`, `terminalAccessibilityHelp`,
  `terminalInstallActions.test`(deleted), `testing.contribution`,
  `scm.contribution`/`scmHistoryViewPane`/`quickDiffModel`,
  `notebook*`/`interactive*`/`replNotebook`/`accessibility*`/`editSessions`,
  `remote`/`search`/`dialogs`/`configurationService` tests,
  `electronRemoteResourceLoader.test`, `userDataProfile` electron-main+common.
  Then: typecheck green → build-fast → launch verify → Phase 6e github
  signin (services/github, platform/github, defaultAccount, accounts UI,
  product fields).
  **Remaining ~92 errors + tail:** storageDataCleaner,
  extHost API surface
  (api.impl/protocol/types/TypeConverters/ApiCommands/common+node.services/
  telemetry/extensionService/extensionHost.contribution/mainThread*),
  workbenchTestServices, fixtureUtils, workbench.*.main leftovers,
  userDataProfile agentsWindowProfile, policies/accountPolicy/assignment
  github signin (6e), services/github + platform/github + githubCredential
  Provider, and ~100 files w/ 1-2 errs (notebook/scm/search/preferences/
  interactive/accessibility/extensions/explorer/issue/quickAccess/
  contextkeys/layout/commandCenter/settingsLayout/windowActions/standalone).
  - **6a SDK + providers**: `npm uninstall` agent SDK deps
    (`@anthropic-ai/sdk`, `@anthropic-ai/claude-agent-sdk`,
    `@github/copilot-sdk`, `@vscode/copilot-api`, `@openai/codex`,
    `foundry-local-sdk`), delete `build/agent-sdk/`, `build/codex/`,
    npm scripts `codex:gen-protocol`/`codex:check-protocol`/
    `test-agent-host-e2e*`, `copilotRuntimeVersion`, provider dirs
    `agentHost/node/{claude,codex,copilot}/`, + registrations in
    `agentHostMain`/`agentHostServerMain`.
  - **6b model provider install system**: plugin/customization marketplace
    install machinery (`pluginGitCommandService`, marketplace services,
    plugin Git ops) — remove.
  - **6c agentHost core**: `src/vs/platform/agentHost/**` (node/common/
    electron-*/test), entry points `agentHostMain`/`agentHostServerMain`,
    channels/IPC/service registrations, `--inspect-agenthost`, AHP protocol,
    `agentHostCrypto` build lane.
  - **6d sessions + chat agent UI**: `src/vs/sessions/`, agent-session
    workbench contribs (`agentSessions/`, remoteAgentHost, cloudSandbox*,
    pluginGit, agentHostAuth*), sessions entries in `workbench.desktop.main`,
    `build/next` sessions entry points + html.
  - **6e github signin fully** (stops api.github.com log spam):
    `defaultAccount` GitHub paths, accounts UI, workbench github service +
    credential provider, `getOrActivateProviderIdForServer` github callers,
    `agentHostAuthenticationService`, `services/github/**`, platform
    `github/**` — keep only what non-GitHub features still need.
- **Phase 3b settings**: `github.copilot.*` context keys/settings and
  `chat.customizations.copilotConnectors.enabled` (live consumers:
  newChatConnectorRecommendations, sessionsChatAccessibilityHelp,
  agentHostAuth `preferConnectorScopedSession`, copilotAgent) — remove WITH
  the connector feature in Phase 4, not standalone.
- **Phase 4a in progress** (uncommitted baseline: CopilotAgent registration
  removed from `agentHostMain.ts` + `agentHostServerMain.ts`; typecheck green):
  - Delete `src/vs/platform/agentHost/node/copilot/` (~70 files incl
    `localModelBridge/`). Importers to unwire first:
    `agentHostServices.ts` (ByokLmProxyService + LocalModelSetupService
    registrations — swap to Null or drop), `agentHostBootstrap.ts`
    (registerPendingEditContentProvider + BYOK channel),
    `agentHostAutomationCustomizations.ts` (`toChildCustomizations` — check if
    claude/codex share; move to shared/ if so), `localModelSetupChannel.ts`
    (delete — localModel feature is copilot-scoped). `claudeAgent.ts` util
    dependency resolved: `copilotGitProject.ts` moved to
    `shared/gitProject.ts` (claude + tests repointed).
  - Delete `src/vs/platform/agentHost/test/node/copilot*.test.ts`,
    `providerIntegration/copilot*.ts`, `localModelBridge/`, copilot e2e
    snapshots, `test/node/agentHostPrompt*.test.ts` copilot refs.
  - Delete `src/vs/sessions/contrib/providers/copilotChatSessions/` provider
    and workbench `localModel.contribution.ts`, `localModelSetupFlow.ts`,
    `localModelSetupProgress.ts`, `agentHostByokLmHandler.ts` (check other
    byok consumers: `common/agentHostByokLm.ts`,
    `agentHostClientByokLmChannel.ts`, `byokLmBridgeRegistry.ts`,
    `agentHostUtilityModelService.ts`).
  - `pendingEditContentStore`: check if claude/codex emit pendingEditContent
    URIs (`common/pendingEditContentUri.ts`, `protocolServerHandler.ts`)
    before dropping copilot's registration.
- **Phase 4b proxy/auth stack**:
  - `claudeAgent.ts`: remove `claudeProxyService` (Copilot-routed transport,
    currently the DEFAULT) + copilot-resource `authenticate()` paths; keep
    native transport only. Delete `claudeProxyService.ts`.
  - `codexAgent.ts`: same for `getCopilotResource()` auth paths; keep
    repo-resource (PR ops) + native auth.
  - `agentHostAuthenticationService.ts`/`agentHostAuthenticationScope.ts`:
    drop copilot-resource token forwarding; keep repo + MCP resources.
  - `agentHostGitHubEndpointService.getCopilotResource()` — remove copilot
    resource; keep `getRepoResource()`.
  - `chatEntitlementService.ts`: `ChatEntitlementRequests` (GitHub API
    signIn/signUp/entitlement fetch — now dead, only `service.update()` calls
    it), quota fetching, `ChatEntitlement` plan tiers, `chatStatusDashboard.ts`
    (still holds dead triggerSetup refs at ~L624), `chatQuotaExceededPart`,
    `upgradePlan` command in chatActions.ts, `copilotConfigSlashSubmitHandler`.
    Service interface is load-bearing (223 files read sentiment/quota/context
    keys incl. sessionsSetUpService) — keep shell, strip GitHub internals, or
    remove entirely in a follow-up.
  - `SessionTypeAuthRequirement`/`resolveAgentAuthRequirement`/
    `authRequirement`/`canInitializeWithoutGitHub`/`sessionsAuthGate.ts` —
    vestigial once providers stop advertising the copilot protected resource.
  - `modelRequiresAgentAuthentication` + `GITHUB_COPILOT_PROTECTED_RESOURCE`
    advertising in claude/codex agent definitions.
- **Phase 6 branding**: product.json names/icons, voiceWsUrl, marketplace,
  telemetry (voiceSessionController is GitHub-auth'd voice — evaluate).

## Build notes

- Node pinned: use `I:\node_project\tools\node-v24.22.1-win-x64` on PATH
  (.nvmrc requires >= 24.22.1; yarn unsupported — npm only, npm < 13).
- `ELECTRON_RUN_AS_NODE=1` is set globally and breaks electron launches;
  launch with `env -u ELECTRON_RUN_AS_NODE ".build/electron/Code - OSS.exe" .`
- Verify: `npm run typecheck-client` (green at every commit so far),
  `npm run build-fast`, then launch dev build.

### CURRENT STATE (latest continuation)
- `scmRepositoriesViewPane.ts` COMPLETE; `extensionsApiProposals.ts` at HEAD
  (563 lines, dead entries harmless; gulp regen broken: build/agent-sdk missing)
- extHostTypes/api.impl/protocol/typeConverters cleaned; AITextSearch removed;
  agentPluginsHome removed from IUserDataProfile (4 test files +
  userDataProfileImportExportService still reference it); browser.d.ts +
  extHostSpeech + node extHostBrowserTunnelProxy deleted.
- ~330 errors in ~90 files remain (run: `npm run typecheck-client 2>&1 | grep "error TS" > .tsc-errors.tmp`):
  storageDataCleaner+test, native.ts/nativeHostMainService UriComponents,
  electronRemoteResourceLoader.test (agentHostUri), userDataProfile
  electron-main unused imports, window.test (parse fn), workspacesHistory
  (chatSettings/canonicalizeAgentSessionsWorkspaces), serverServices unused,
  mainThreadAuthentication (MCP auth bits + IAuthenticationGetSessionsOptions
  export), mainThreadLanguageFeatures (_aiEditTelemetryService),
  mainThreadSCM ($resolveHistoryItemChatContext + decorator ~569),
  mainThreadSearch (Constants unused + missing return), mainThreadWebviewManager
  (chatOutputRenderer), extHost.common.services (extHostLanguageModels/extHostMcp/
  tunnelProxy), extHost.protocol (artifactIntegration/aiRelatedInformation/
  aiSettingsSearch imports + unused), extHostApiCommands (IExtensionPromptFileResult),
  agentPluginsHome tests, extHostSearch.test, extHost.api.impl (tunnelProxy import
  L65, shape L177, isAgentSessionsWorkspace L1091, typeof mismatch L1625),
  emptyTextEditorHint, commandsQuickAccess, settingsTree* tests, gettingStarted,
  abstractTaskService, notebook*/interactive*/accessibility*/editorDictation,
  extensions.contribution/extensionsActions.test, quickaccess files,
  quickDiffModel, settingsEditor2/preferencesRenderers, managedSettingsUpdate.test,
  accountPolicyGateContribution.test, extensionEnablementService+test,
  defaultAccount.test, remote/search/dialogs/configurationService tests.
- NEXT: fix per file → typecheck green → build-fast → launch (VSCODE_DEV=1,
  unset ELECTRON_RUN_AS_NODE) → Phase 6e github signin (services/github,
  platform/github, defaultAccount, accounts UI, product fields).

### LATEST (typecheck tail)
- ~238 errors in ~85 files remain (from 1366 at peak). All big files cleaned
  (extHost.protocol/types/api.impl/typeConverters, SCM artifact feature,
  scmRepositoriesViewPane, developerActions, globalCompositeBar,
  extensionsActions, workspaceTrust, fixtureUtils, workbenchTestServices,
  assignmentService, emptyTextEditorHint, commandsQuickAccess,
  releaseNotesEditor+test, fileSystemFileSearchProvider.test,
  mainThreadAuthentication/Search/LanguageFeatures/WebviewManager,
  extHost.common.services/node.services, extHostExtensionService/EditorTabs/
  LanguageFeatures/SCM/apiCommands, editorDictation DELETED+contrib import,
  settingsTree tests, IChatEntitlementService/ChatAIDisabledSettingId gates,
  windowActions, defaultAccount.test, extensionEnablementService+test,
  accountPolicyGateContribution.test, configurationService.test,
  agentPluginsHome, AITextSearch, MCP auth, EnableDropDownAction restored).
- Remaining tail (per .tsc-errors.tmp): mainThreadSCM (missing
  MainThreadSCMShape member ~572 — check which decl), extHost.api.impl
  vscode typeof mismatch ~1618 (missing vscode.X member),
  extHostTypeConverters/extHostTypes unused imports, workspacesHistory
  configurationService, plus ~80 files with <=3 errors each (mostly unused
  imports + dead test refs).
- Method: `npm run typecheck-client 2>&1 | grep "error TS" > .tsc-errors.tmp`;
  fix per file; re-run. Then: build-fast → launch (VSCODE_DEV=1, unset
  ELECTRON_RUN_AS_NODE) → Phase 6e github signin (services/github,
  platform/github, defaultAccount, accounts UI, product fields).

### LATEST (typecheck tail — ~138 errors remain)
- Down from 1366 peak to ~138 errors across ~45 files. All big files cleaned:
  extHost.protocol/types/api.impl/typeConverters, SCM artifact feature,
  scmRepositoriesViewPane, developerActions, globalCompositeBar,
  extensionsActions (AI-features classes removed), workspaceTrust,
  fixtureUtils, workbenchTestServices, assignmentService,
  emptyTextEditorHint, commandsQuickAccess, releaseNotesEditor+test,
  fileSystemFileSearchProvider.test, mainThreadAuthentication/Search/
  LanguageFeatures/WebviewManager, extHost.common.services/node.services,
  extHostExtensionService/EditorTabs/LanguageFeatures/SCM/apiCommands,
  editorDictation DELETED+contrib import, settingsTree tests,
  IChatEntitlementService/ChatAIDisabledSettingId gates, windowActions,
  defaultAccount.test, extensionEnablementService+test (chat-enablement
  migration + unification + sessions-window removed),
  accountPolicyGateContribution.test, configurationService.test,
  agentPluginsHome, AITextSearch, MCP auth, EnableDropDownAction restored.
- Remaining tail (per .tsc-errors.tmp): mostly unused imports + dead-symbol
  refs in ~45 files (mainThreadSCM shape member, extHost.api.impl vscode
  typeof mismatch at 1618, ChatContextKeys refs, IInlineChatSessionService,
  InlineChatController, SCMHistoryItemTransferData,
  SCMHistoryItemContextContribution, MarkerChatContextContribution,
  DebugChatContextContribution, EditorDictation, CTX_INLINE_CHAT_FOCUSED,
  getDefaultModelPolicyDescription, IChatEntitlementService,
  agentHostPolicySupport, IQuickChatService, INLINE_CHAT_ID,
  ctxHasEditorModification, ctxHasRequestInProgress,
  ManageAccountPreferencesForMcpServerAction, Schemas, session/e params,
  unreachable code, dead side-effect imports).
- Method: `npm run typecheck-client 2>&1 | grep "error TS" > .tsc-errors.tmp`;
  fix per file with surgical edits (NOT line filters — they destroy code);
  re-run. Then: build-fast → launch (VSCODE_DEV=1, unset
  ELECTRON_RUN_AS_NODE) → Phase 6e github signin (services/github,
  platform/github, defaultAccount, accounts UI, product fields).

### LATEST (runtime: app launches, workbench bundle blocked by missing-module imports)
- `out/` transpiled (5145 files) + `npm run gulp compile-extensions` clean
  (0 errors). App launches via `scripts/code-oss-launcher/launch.ts`
  (ELECTRON_RUN_AS_NODE must be unset). Renderer fails:
  `Failed to fetch dynamically imported module: workbench.desktop.main.js`
  — dead `.js` imports of deleted files break the module graph at runtime.
- Extensions-side agent surface removed: mermaid chatOutputRenderer +
  languageModelTools, markdown-language-features #wireComments/agent-
  comments + protocol, git artifactProvider + artifact* commands +
  isAgentSessionsWorkspace + scm/artifact menus + agent proposals,
  vscode-api-tests dead API tests (browser*, chat*, lm), TS quickFix
  Copilot "Fix with AI" block + isAI.
- Build-side: gulpfile.reh/vscode agentSdk stamping removed.
- Workbench-side remaining (~90 tsc errors, all dead-symbol refs):
  terminalInitialHint.test (agent mocks), gettingStarted/contribution
  (agents banner/graphic/entitlement), terminal.initialHint
  (Copilot CLI hint removed — aria-label stragglers),
  extensionsActions (productService refs), releaseNotesEditor
  (tryout refs), cellDiagnosticsActions (chat refs), decorationAddon
  (chat-attach — method removed, DI/instantiation stragglers),
  symbolsQuickAccess/anythingQuickAccess (chat DI + quick-chat),
  quickDiffModel (chatEditingService), issueReporterController
  (title-gen Copilot), policyExport (agentHostPolicySupport),
  interactive.contribution/editor (InlineChatController/INLINE_CHAT_ID),
  developerActions (unused), mainThreadSCM (decorator + shape member),
  extHost.api.impl (vscode typeof mismatch at 1618), layout.ts
  (unreachable), ~25 files with 1-2 dead refs.
- Method: fix surgically per file (NO line-filters — they destroy code),
  `npm run typecheck-client > .tsc-errors.tmp`, then re-transpile
  `node build/next/index.ts transpile` + relaunch.

### RUNTIME GREEN — workbench loads (2026-10-25)
- `typecheck-client`: 0 errors (was ~1366 at peak). The full tail was
  closed out: SCM artifact protocol surface (`$resolveHistoryItemChatContext`,
  `resolveHistoryItemChangeRangeChatContext`, `$onDidChangeArtifacts`,
  `SCMHistoryItemTransferData`), AI settings-search (EmbeddingsSearchProvider/
  AiSearchProvider/IAiSearchProvider/getAiSearchProvider + settingsEditor2
  showAiResultsAction/aiSearchPromise/doAiSearch/LLM plumbing +
  SearchResultIdx.AiSelected/Embeddings consumers left as dead enum),
  agents-window welcome banner/graphic, Copilot utility title-gen,
  AI quick-fix/quick-access attach handlers, inline-chat DI params,
  dictation, agentHostPolicySupport, MCP marker renderer.
- `out/` transpiled clean (5145 files), `compile-extensions` clean
  (all tsconfigs 0 errors, incl. markdown-editor-src comment surface).
- `Code - OSS.exe` launches via `scripts/code-oss-launcher/launch.ts`
  (ELECTRON_RUN_AS_NODE unset) — PID 22856, CDP 50363. No
  `Failed to fetch dynamically imported module` / `ERR_FAILED`.
- Remaining benign console noise:
  * `Missing proxy instance MainThreadEmbeddings` / `ExtHostSpeech` —
    dead proxy identifiers in `extHost.protocol.ts` (~lines 1397/1407/
    1466 shapes, ~3382/3413/3506 identifiers); no src callers — an
    extension still hits the deleted `vscode.speech`/`vscode.embeddings`
    namespace at runtime. Remove the identifiers + shapes to silence.
  * `vscode.vscode-api-tests` proposal warnings for `interactive`,
    `mcpServerDefinitions`, `languageModelProxy`, `agentSessionsWorkspace`
    — dead entries in `extensions/vscode-api-tests/package.json`
    `enabledApiProposals` + `interactiveSession` contribution.
  * `[DefaultAccount] Authentication provider is not available` —
    expected (github auth removed).

### EXT HOST INIT BLOCKER — contrib/speech deleted (2026-10-25)
- `Missing proxy instance ExtHostSpeech` thrown inside
  `ExtHostExtensionService._beforeAlmostReadyToRunExtensions` → ext host
  init aborts → extensions never deliver → empty Extensions view.
- `Missing proxy instance MainThreadEmbeddings` at
  `ExtensionHostManager._createExtensionHostCustomers`.
- Deleted `src/vs/workbench/contrib/speech/` + removed
  `MainThreadSpeechShape`/`ExtHostSpeechShape`/`MainThreadEmbeddingsShape`/
  `ExtHostEmbeddingsShape` + identifiers from `extHost.protocol.ts`.
- Remaining ~21 errors: dead menu/config entries —
  `menusExtensionPoint.ts` (contribSourceControlArtifactGroup/Menu,
  chatParticipantPrivate, chatSessionsProvider,
  chatSessionCustomizationProvider, contribChatEditorInlineGutterMenu,
  chatParticipantAdditions), `viewsExtensionPoint.ts` (agentSessions
  chatSessionsProvider gate), `configurationExtensionPoint.ts`
  (agentsWindowConfiguration check), `accessibility.contribution.ts`
  (DynamicSpeechAccessibilityConfiguration + SpeechAccessibilitySignal
  imports).

### EXT HOST INIT FIXED — extensions deliver (2026-10-25)
- Root cause: `Missing proxy instance` thrown inside
  `ExtHostExtensionService._beforeAlmostReadyToRunExtensions` +
  `ExtensionHostManager._createExtensionHostCustomers` → ext host init
  aborted → `IExtensionService.extensions` empty → Extensions view blank.
- Dead `MainContext`/`ExtHostContext` identifiers in
  `extHost.protocol.ts` with no registered impl: removed
  `MainThreadEmbeddings`, `MainThreadSpeech`, `MainThreadInteractive`,
  `MainThreadBrowserTunnelProxy`, `MainThreadBrowsers`,
  `ExtHostSpeech`, `ExtHostEmbeddings`, `ExtHostBrowserTunnelProxy`,
  `ExtHostBrowsers` (+ their shapes + `contrib/speech` module entirely).
- Also removed: `agentsWindow` config schema + `agentsWindowConfiguration`
  proposed check (configurationExtensionPoint), `agentSessions`
  `chatSessionsProvider` gate (viewsExtensionPoint), dead menu entries
  (menusExtensionPoint: contribSourceControlArtifact*,
  chatParticipantPrivate/Additions, chatSessionsProvider,
  chatSessionCustomizationProvider, contribChatEditorInlineGutterMenu),
  `DynamicSpeechAccessibilityConfiguration` +
  `SpeechAccessibilitySignalContribution` (accessibility.contribution),
  `HasSpeechProvider`/`TerminalDictationAvailable`/Start-Dictation menu
  (terminalMenus), `TextToSpeechStatus` (extHostTypes/api.impl).
- Result: `Code - OSS.exe` launches, ext host pid starts clean,
  `vscode.git`/`vscode.git-base`/`vscode.debug-auto-launch`/
  `vscode.merge-conflict` activate, `Eager extensions activated`,
  0 `Missing proxy`/`Failed to fetch`/`ERR_FAILED` errors.
  `typecheck-client` = 0 errors. `compile-extensions` = 0 errors.

### EXTENSIONS VIEW EMPTY — diagnosing getInstalled scan (2026-10-25)
- Ext host init fixed (dead proxy identifiers removed) — `vscode.git`/
  `merge-conflict`/`debug-auto-launch`/`emmet` activate.
- Rebuilt all `extensions/*/out/` (clean/compile race had wiped them).
- Extensions VIEW still empty: `IExtensionsWorkbenchService.local`/
  `installed`/`queryLocal`/`fetchInstalledExtensions` → `getInstalled` →
  shared-process 'extensions' channel → `ExtensionsScannerService`/
  `ExtensionsScanner` → `scanAllExtensions` → `scanDefaultSystemExtensions`
  (`builtinExtensionsPath` = `appRoot/extensions` = 105 dirs) +
  `scanDevSystemExtensions` (`.build/builtInExtensions` = 3).
- renderer.log shows NO Scanning/queryInstalled error → `getInstalled`
  returns `[]` cleanly → scan returns 0 → `builtinExtensionsPath`/
  `systemExtensionsLocation` resolves to empty/nonexistent dir, OR
  `scanExtension` returns null for all, OR `applyScanOptions`/`isValid`
  filters all built-ins.
- Diagnostic added: `SCANNED-SYSTEM` log in `scanDefaultSystemExtensions`
  (extensionsScannerService.ts:447) — logs `systemExtensionsLocation.fsPath`
  + `result.length` at `error` level → sharedprocess.log.
- Also added quick-input close button (quickInputController.ts +
  quickInput.css) — covers command palette/quick open/all pickers.

### EXTENSIONS VIEW FIXED — full pipeline verified (2026-10-26)
- Root cause of empty `out/`: `build-fast` incremental lane
  (`applyIncrementalClientChanges`) only emits changed paths — files deleted
  after its manifest was written were never re-emitted. `out/` had 1116
  missing .js incl. `watcher/nodejs/nodejsClient.js` (crash) — and
  `transpile-client` emits CJS-flavored output that breaks `out/main.js`
  (exports + top-level await). **`npx gulp compile-client` is the only
  correct full emit for `out/`** (tsc, ESM). Do NOT use `transpile-client`
  or incremental `build-fast` to restore missing output.
- `extensions/*/out/` also gets wiped by `clean-extension-*`/`build-fast`
  failures — restore with `npx gulp transpile-extensions`.
- Emmet `Cannot find module '../emmetCommon'` → fixed by re-emitting
  extension `out/` (`transpile-extension:emmet` / `transpile-extensions`).
- Extensions view verified end-to-end (CDP): system scan = 91 +
  3 built-in gallery = 94; `fetchInstalledExtensions` populates
  `this.installed`=94; view descriptors register (25); "Installed" pane
  renders; `@builtin` → Features/Themes/Languages rows.
- product change: `filterInstalledExtensions` no longer excludes
  `isBuiltin` (extensionsViews.ts) — with no marketplace/gallery, the
  Installed pane would always be empty; it now lists all installed
  extensions incl. builtins.
- Note: plain-text marketplace search can't work — `product.json` has no
  `extensionsGallery` (expected for OSS). `@installed`/`@builtin`/
  `@enabled`/`@disabled`/`@outdated` local queries all work.
- Diagnostics (SCANNED-SYSTEM/FETCH-INSTALLED/VIEWS-CONTRIB/VCM-*/DOSEARCH)
  removed; `out/` regenerated via `compile-client` (0 errors).

### MARKETPLACE GALLERY — Open VSX wired (2026-10-26)
- `product.json` gained `extensionsGallery`:
  `{ serviceUrl: https://open-vsx.org/vscode/gallery, itemUrl: https://open-vsx.org/vscode/item }`
  (Open VSX — the open marketplace; MS marketplace is licensed for
  official VS Code builds only). Runtime-read, no rebuild needed.
- Flow: `extensionsGallery.serviceUrl` → synthesized
  `IExtensionGalleryManifest` → `ExtensionGalleryManifestStatus.Available`
  → `hasGallery` context → marketplace/popular/recommended panes +
  `queryGallery` → POST `{serviceUrl}/extensionquery`.
- Verified via CDP: panes = Installed(94)/Popular/Recommended; text
  search `python` → Marketplace pane with 904 results.
- Note: Open VSX VSIXes are not MS-signed — install may hit signature
  verification if `extensions.verifySignature` is enabled.

### BUILT-IN PANE — separated from Installed (2026-10-26)
- Reverted `filterInstalledExtensions` isBuiltin gate (Installed now
  shows only non-builtin/user-installed — upstream semantics).
- Added `workbench.views.extensions.builtin` descriptor in
  `createDefaultExtensionsViewDescriptors` (extensionsViewlet.ts):
  `StaticQueryExtensionsView` with `@builtin` query, `DefaultViewsContext`,
  always visible, order 6 — a dedicated "Built-in" section listing all
  system extensions. Verified via CDP: panes = Installed(1), Popular,
  Recommended(0), Built-in(94).

### ACCOUNTS ICON — removed (2026-10-26)
- `isAccountsActionVisible` in globalCompositeBar.ts hardcoded to
  `false` — hides the Accounts action in BOTH the activity-bar global
  items and the title bar.
- Removed dead Accounts toggles: `getContextMenuActions` returns [],
  `simpleActivityContextMenuActions` drops hideAccounts/toggle.hideAccounts
  (params underscore-prefixed to satisfy noUnusedParameters), removed
  `accountsVisibilityPreference` setter.
- Verified via CDP: `.codicon-account`/`[aria-label*=Accounts]` absent.
- compile-client = 0 errors.
