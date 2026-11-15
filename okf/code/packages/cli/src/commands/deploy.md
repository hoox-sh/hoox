---
type: "Code Module"
title: "packages/cli/src/commands/deploy"
description: "hoox deploy command group — deploy workers and dashboard to Cloudflare."
resource: "packages/cli/src/commands/deploy"
tags: [cli, code, commands, packages]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "packages/cli/src/commands/deploy"
    title: "packages/cli/src/commands/deploy"
    author: process:git
okf_lock: generated
---

# Files

- `deploy-command.test.ts`
- `deploy-command.ts` — getDashboardBuildInfo, registerDeployCommand
- `index.ts` — DeployOptions, DeployResult, register, registerDeployCommand
- `register.ts` — register
- `telegram-service.test.ts`
- `telegram-service.ts` — TelegramService
- `types.ts` — DeployOptions, DeployResult

# Packages

`@clack/prompts`, `bun:test`, `commander`, `jsonc-parser`, `node:fs`, `node:os`, `node:path`
