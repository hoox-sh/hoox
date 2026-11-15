---
type: "Code Module"
title: "packages/cli/src/services/runtime"
description: "Global Hoox runtime — managed monorepo clone under $HOME/.hoox/repo."
resource: "packages/cli/src/services/runtime"
tags: [cli, code, packages, services]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "packages/cli/src/services/runtime"
    title: "packages/cli/src/services/runtime"
    author: process:git
okf_lock: generated
---

# Files

- `index.ts` — DEFAULT_HOOX_SETUP_REPO, ensureGlobalRuntime, getRuntimeStatus
- `runtime-service.test.ts`
- `runtime-service.ts` — DEFAULT_HOOX_RUNTIME_REPO, DEFAULT_HOOX_SETUP_REPO, EnsureRuntimeOptions, EnsureRuntimeResult, RuntimeStatus, ensureGlobalRuntime, getRuntimeStatus

# Packages

`@hoox-sh/hoox-shared`, `bun:test`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`
