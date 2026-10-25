---
type: "Code Module"
title: "packages/tui/src/hooks"
description: "Hook unit tests — renderer ref and polling helpers."
resource: "packages/tui/src/hooks"
tags: [code, hooks, packages, tui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T22:51:08Z
sources:
  - id: tree
    resource: "packages/tui/src/hooks"
    title: "packages/tui/src/hooks"
    author: process:git
okf_lock: generated
---

# Files

* `hooks.test.ts`
* `index.ts` — POLLING_MAX_BACKOFF_MS, UsePollingOptions, computePollingBackoff, createPollingController, formatPollIntervalLabel, getRendererRef, isShellOverlayOpen, setRendererRef, usePolling, useViewKeyboard
* `renderer-ref.ts` — getRendererRef, setRendererRef
* `shell-overlay.ts` — ViewKeyEvent, isShellOverlayOpen, useViewKeyboard
* `use-polling.ts` — POLLING_MAX_BACKOFF_MS, UsePollingOptions, computePollingBackoff, createPollingController, formatPollIntervalLabel, usePolling

# Packages

`@hoox-sh/hoox-shared`, `@opentui/core`, `@opentui/react`, `bun:test`, `react`

# Depends on

* [packages/tui/src/components/ui](/code/packages/tui/src/components/ui.md)

# Used by

* [packages/tui/src](/code/packages/tui/src.md)
* [packages/tui/src/components/layout](/code/packages/tui/src/components/layout.md)
* [packages/tui/src/components/views](/code/packages/tui/src/components/views.md)
* [packages/tui/src/components/views/dashboard](/code/packages/tui/src/components/views/dashboard.md)
* [packages/tui/src/services](/code/packages/tui/src/services.md)
