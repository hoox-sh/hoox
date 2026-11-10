---
type: "Document"
title: "tui.mdx"
description: "description: \"High-integrity architecture specifications, Zustand store configurations, and connection state machines of the Hoox Terminal UI.\"."
resource: "docs/devops/tui.mdx"
tags: [devops, doc, docs, tui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-10T14:53:51Z
sources:
  - id: tree
    resource: "docs/devops/tui.mdx"
    title: "docs/devops/tui.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/tui.mdx`.

# Outline

* 🏗️ Architectural Blueprint
  * Directory map
  * Navigation registry & colors
  * Test doubles (no polluting mock.module)
* 🗺️ View registry (16)
* 🌐 Local vs remote mode
  * Security posture (operator plane)
  * Auth token UX (remote)
  * Dev logging
* 🛜 Dual-channel + SSE
  * Startup sequence (AppRoot)
  * CLI bridge (src/services/cli-bridge)
* 🛡️ Crash protection
  * Layer 1 — per-view ErrorBoundary
  * Layer 2 — CrashRecoveryApp
* 🧪 Verification
* 📊 Graph integration
* Known limitations (honest)
  * Next steps

# Mentions

* [packages/shared/src](/code/packages/shared/src.md)
* [packages/shared/src/stores](/code/packages/shared/src/stores.md)
* [packages/shared/src/types](/code/packages/shared/src/types.md)
* [packages/tui/src](/code/packages/tui/src.md)
* [packages/tui/src/stores](/code/packages/tui/src/stores.md)
* [scripts](/code/scripts.md)
