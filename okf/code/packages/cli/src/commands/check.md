---
type: "Code Module"
title: "packages/cli/src/commands/check"
description: "hoox check command group — validation, health checks, and auto-repair."
resource: "packages/cli/src/commands/check"
tags: [cli, code, commands, packages]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T22:51:08Z
sources:
  - id: tree
    resource: "packages/cli/src/commands/check"
    title: "packages/cli/src/commands/check"
    author: process:git
okf_lock: generated
---

# Files

* `check-command.test.ts`
* `check-command.ts` — probeWorkerHealth, registerCheckCommand, resolveWorkerBaseUrl
* `index.ts` — CheckCategory, CheckReport, CheckResult, FixAction, FixReport, HealthCheckResult, registerCheckCommand, registerPrerequisitesCommand
* `prerequisites-command.test.ts`
* `prerequisites-command.ts` — registerPrerequisitesCommand, runPrerequisitesCheck
* `types.ts` — CheckCategory, CheckReport, CheckResult, FixAction, FixReport, HealthCheckResult

# Packages

`bun:test`, `commander`, `jsonc-parser`, `node:fs`, `node:fs/promises`, `node:os`, `node:path`
