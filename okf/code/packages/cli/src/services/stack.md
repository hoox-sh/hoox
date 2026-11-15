---
type: "Code Module"
title: "packages/cli/src/services/stack"
description: "Enable optional catalog workers and wire them into the HOOX stack."
resource: "packages/cli/src/services/stack"
tags: [cli, code, packages, services]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "packages/cli/src/services/stack"
    title: "packages/cli/src/services/stack"
    author: process:git
okf_lock: generated
---

# Files

- `index.ts` — EnsureWorkerOptions, EnsureWorkerResult, cloneWorkerIfMissing, createWorkspaceConfigService, ensureWorkerInStack, loadWorkerOrWire, requireCatalogWorker, wireCallerBindings
- `stack-service.test.ts`
- `stack-service.ts` — EnsureWorkerOptions, EnsureWorkerResult, cloneWorkerIfMissing, createWorkspaceConfigService, ensureWorkerInStack, loadWorkerOrWire, requireCatalogWorker, wireCallerBindings

# Packages

`@clack/prompts`, `@hoox-sh/hoox-shared`, `bun:test`, `jsonc-parser`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`
