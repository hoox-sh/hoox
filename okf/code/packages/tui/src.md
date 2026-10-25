---
type: "Code Module"
title: "packages/tui/src"
description: "@jsxImportSource @opentui/react."
resource: "packages/tui/src"
tags: [code, packages, tui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T22:51:08Z
sources:
  - id: tree
    resource: "packages/tui/src"
    title: "packages/tui/src"
    author: process:git
okf_lock: generated
---

# Role

@jsxImportSource @opentui/react

# Files

* `app.tsx` — AppRoot, CrashRecoveryApp
* `cli-bridge-test-double.ts` — cliBridgeDouble, createCliBridgeModuleMock, failCliResult, okCliResult, realCliBridge, resetCliBridgeDouble
* `main.tsx`
* `network-test-double.ts` — SseSubscriptionEntry, abortAllSseSubscriptions, emitSseEvent, hooxFetchMock, mockApiData, mockApiDelayMs, mockApiErrorMessage, mockApiShouldFail, resetNetworkDoubles, setMockApiData, setMockApiDelay, setMockApiFailure
* `opentui-augment.d.ts` — CliRenderer, CliRendererConfig, createCliRenderer
* `opentui-jsx.d.ts` — KeyEvent, createRoot, useKeyboard
* `test-setup.ts`
* `test-utils.ts` — ALL_VIEW_IDS, ConnectionStatus, LogLevel, MockErrorBoundary, TestLogEntry, TestTrade, TestWorkerInfo, TradeSide, WorkerStatus, abortAllSseSubscriptions, cliBridgeDouble, emitSseEvent
* `types.ts` — ALL_VIEWS, CliCommandState, CliCommandStatus, CliErrorDetails, CliErrorType, CliResult, DEFAULT_SHORTCUTS, ModalState, ModalType, ShortcutMap, VIEW_LABELS, ViewId
* `view-registry.test.ts`
* `view-registry.tsx` — ACTION_COMMANDS, ALL_PALETTE_COMMANDS, REGISTERED_VIEW_IDS, SIDEBAR_ITEMS, VIEW_REGISTRY, ViewFactory, ViewKeyMod, ViewRegistryEntry, getCtrlAltViewMap, getSidebarItems, getViewFactory, getViewPaletteCommands

# Packages

`@hoox-sh/hoox-shared`, `@hoox-sh/hoox-shared/api-client`, `@hoox/test-utils/spawn-shim`, `@opentui/core`, `@opentui/core/testing`, `@opentui/react`, `bun:test`, `react`

# Depends on

* [packages/tui/src/components/layout](/code/packages/tui/src/components/layout.md)
* [packages/tui/src/components/shared](/code/packages/tui/src/components/shared.md)
* [packages/tui/src/components/ui](/code/packages/tui/src/components/ui.md)
* [packages/tui/src/components/views](/code/packages/tui/src/components/views.md)
* [packages/tui/src/hooks](/code/packages/tui/src/hooks.md)
* [packages/tui/src/services](/code/packages/tui/src/services.md)
* [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)

# Used by

* [packages/tui/src/components/layout](/code/packages/tui/src/components/layout.md)
* [packages/tui/src/components/views](/code/packages/tui/src/components/views.md)
* [packages/tui/src/services](/code/packages/tui/src/services.md)
* [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)
* [packages/tui/src/stores](/code/packages/tui/src/stores.md)

# Nested

* [packages/tui/src/hooks](/code/packages/tui/src/hooks.md)
* [packages/tui/src/services](/code/packages/tui/src/services.md)
* [packages/tui/src/stores](/code/packages/tui/src/stores.md)
* [packages/tui/src/utils](/code/packages/tui/src/utils.md)
