---
type: "Code Module"
title: "packages/tui/src/components/views"
description: "packages/tui/src/components/views contains ai-chat.test.tsx, ai-chat.tsx, config-editor.test.tsx, and 29 more files."
resource: "packages/tui/src/components/views"
tags: [code, components, packages, tui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T22:51:08Z
sources:
  - id: tree
    resource: "packages/tui/src/components/views"
    title: "packages/tui/src/components/views"
    author: process:git
okf_lock: generated
---

# Files

* `ai-chat.test.tsx`
* `ai-chat.tsx` — AiChatView, MAX_MESSAGE_CHARS, MAX_STORED_MESSAGES, sanitizeChatMessage
* `config-editor.test.tsx`
* `config-editor.tsx` — ActivePane, CONFIG_TREE_BLUEPRINT, ConfigEditor, FileNode, FileType, MAX_CONFIG_FILE_BYTES, MAX_EDITOR_DISPLAY_LINES, SyntaxErrorEntry, TokenSpan, detectFileType, flattenTree, formatContent
* `dashboard.test.tsx`
* `dashboard.tsx` — DashboardView, DashboardViewProps
* `db-query.test.tsx`
* `db-query.tsx` — DbQueryView, MAX_HISTORY, MAX_VISIBLE_ROWS, compareCells, formatCell, sanitizeCellText
* `edge-topology.test.tsx`
* `edge-topology.tsx` — EdgeTopology, MAX_FLOWS_PREVIEW, resolveGraphMetadataPath
* `kv-viewer.test.tsx`
* `kv-viewer.tsx` — KvViewer, MAX_VISIBLE_KEYS, filterKvKeys, sanitizeKvValue
* `logs-viewer.test.tsx`
* `logs-viewer.tsx` — LogsViewer, MAX_VISIBLE_LOGS, applyLogFilters, sanitizeLogText
* `queue-depth.test.tsx`
* `queue-depth.tsx` — QueueDepthView, sortQueuesByPressure
* `secrets-viewer.test.tsx`
* `secrets-viewer.tsx` — MAX_VISIBLE_SECRETS, SecretsViewer, filterSecrets
* `service-manager.test.tsx`
* `service-manager.tsx` — ServiceManager, ServiceManagerProps
* `settings.test.tsx`
* `settings.tsx` — SettingsView, SettingsViewProps
* `setup-wizard.test.tsx`
* `setup-wizard.tsx` — SetupWizard, SetupWizardProps, maskSecret, redactWizardSecrets, validateApiKey, validateEmail, validateUrl
* `trade-monitor.test.tsx`
* `trade-monitor.tsx` — MAX_VISIBLE_TRADES, TRADE_RING_BUFFER_CAP, TradeMonitor, calcLatency, sanitizeTerminalText, selectVisibleTrades
* `worker-detail.test.tsx`
* `worker-detail.tsx` — WorkerDetail, redactConfigEntries
* `worker-settings.test.tsx`
* `worker-settings.tsx` — WorkerSettingsView
* `workers-overview.test.tsx`
* `workers-overview.tsx` — WorkersOverview, WorkersOverviewProps

# Packages

`@/components/ui/dialog`, `@hoox-sh/hoox-shared`, `@hoox-sh/hoox-shared/stores/config-store`, `@hoox-sh/hoox-shared/stores/service-store`, `@hoox-sh/hoox-shared/stores/ui-store`, `@hoox-sh/hoox-shared/types`, `@opentui/core`, `@opentui/react`, `@opentui/react/test-utils`, `bun:test`, `fs`, `node:fs`, `node:path`, `os`, `path`, `react`

# Depends on

* [packages/tui/src](/code/packages/tui/src.md)
* [packages/tui/src/components/shared](/code/packages/tui/src/components/shared.md)
* [packages/tui/src/components/ui](/code/packages/tui/src/components/ui.md)
* [packages/tui/src/components/views/config-editor](/code/packages/tui/src/components/views/config-editor.md)
* [packages/tui/src/components/views/dashboard](/code/packages/tui/src/components/views/dashboard.md)
* [packages/tui/src/hooks](/code/packages/tui/src/hooks.md)
* [packages/tui/src/services](/code/packages/tui/src/services.md)
* [packages/tui/src/services/cli-bridge](/code/packages/tui/src/services/cli-bridge.md)

# Used by

* [packages/tui/src](/code/packages/tui/src.md)

# Nested

* [packages/tui/src/components/views/config-editor](/code/packages/tui/src/components/views/config-editor.md)
* [packages/tui/src/components/views/dashboard](/code/packages/tui/src/components/views/dashboard.md)
