---
type: "Code Module"
title: "packages/tui/src/services"
description: "packages/tui/src/services contains cli-bridge.test.ts, clipboard.test.ts, clipboard.ts, and 10 more files."
resource: "packages/tui/src/services"
tags: [code, packages, services, tui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "packages/tui/src/services"
    title: "packages/tui/src/services"
    author: process:git
okf_lock: generated
---

# Files

- `cli-bridge.test.ts`
- `clipboard.test.ts`
- `clipboard.ts` — ClipboardRenderer, ClipboardResult, CopyToClipboardOptions, copyToClipboard, copyViaSystemClipboard, enableAutoCopyOnSelection
- `dashboard-settings-loader.test.ts`
- `dashboard-settings-loader.ts` — loadDashboardSettingsManifests
- `dev-log.test.ts`
- `dev-log.ts` — DevLogEntry, DevLogLevel, devLog, getDevLogPath, isDevLogEnabled, redactDevLogContext, redactSecretsInText, resetDevLogForTests, tuiDevLog
- `hoox-path-service.test.ts`
- `hoox-path-service.ts` — ensureTuiStateDir, getTuiStateDir, resetHooxPathCacheForTests, resolveHooxHomePath, resolveTuiStatePath, tuiStateDirExists
- `tui-connection.test.ts`
- `tui-connection.ts` — ConnectionErrorKind, SettingsConnectionConfigFallback, SettingsConnectionSnapshot, TuiConnectionEnv, TuiMode, classifyConnectionError, formatAuthBanner, getApiBase, getApiHost, getSettingsConnectionSnapshot, getTuiMode, hasAccessCredentials
- `tui-storage.test.ts`
- `tui-storage.ts` — TuiStateFiles, readJsonState, removeJsonState, writeJsonState

# Packages

`@hoox-sh/hoox-shared`, `@opentui/core`, `bun:test`, `fs`, `fs/promises`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`, `path`

# Depends on

- [packages/tui/src](/code/packages/tui/src.md)
- [packages/tui/src/components/ui](/code/packages/tui/src/components/ui.md)
- [packages/tui/src/hooks](/code/packages/tui/src/hooks.md)
- [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)

# Used by

- [packages/tui/src](/code/packages/tui/src.md)
- [packages/tui/src/components/layout](/code/packages/tui/src/components/layout.md)
- [packages/tui/src/components/shared](/code/packages/tui/src/components/shared.md)
- [packages/tui/src/components/ui](/code/packages/tui/src/components/ui.md)
- [packages/tui/src/components/views](/code/packages/tui/src/components/views.md)
- [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)

# Nested

- [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)
