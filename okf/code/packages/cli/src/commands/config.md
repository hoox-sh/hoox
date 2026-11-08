---
type: "Code Module"
title: "packages/cli/src/commands/config"
description: "hoox config command group — configuration and secrets management."
resource: "packages/cli/src/commands/config"
tags: [cli, code, commands, packages]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "packages/cli/src/commands/config"
    title: "packages/cli/src/commands/config"
    author: process:git
okf_lock: generated
---

# Files

- `config-command.test.ts`
- `config-command.ts` — registerConfigCommand
- `env-command.test.ts`
- `env-command.ts` — registerEnvCommand
- `index.ts` — registerConfigCommand, registerEnvCommand, registerKvCommand
- `keys-subcommands.ts` — registerKeysSubcommands
- `kv-command.test.ts`
- `kv-command.ts` — registerKvCommand
- `secrets-subcommands.test.ts`
- `secrets-subcommands.ts` — registerSecretsSubcommands, reportSecretSync, updateDevVars
- `theme-command.test.ts`
- `theme-command.ts` — registerThemeCommand

# Packages

`@clack/prompts`, `@hoox-sh/hoox-shared`, `bun:test`, `commander`, `jsonc-parser`, `node:fs`, `node:os`, `node:path`, `node:url`
