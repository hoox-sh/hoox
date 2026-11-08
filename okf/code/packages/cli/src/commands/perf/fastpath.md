---
type: "Code Module"
title: "packages/cli/src/commands/perf/fastpath"
description: "hoox perf fastpath — measure the deployed fast-path latency."
resource: "packages/cli/src/commands/perf/fastpath"
tags: [cli, code, commands, packages]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "packages/cli/src/commands/perf/fastpath"
    title: "packages/cli/src/commands/perf/fastpath"
    author: process:git
okf_lock: generated
---

# Files

- `fastpath-command.test.ts`
- `fastpath-command.ts` — formatMs, formatTableAsText, parseTimeOrThrow, parseTimeRange, registerFastpathCommand
- `fastpath-service.test.ts`
- `fastpath-service.ts` — FastPathService, RunConfig
- `index.ts` — FastPathReport, HopStats, ProbeRequest, ProbeResult, registerFastpathCommand
- `types.ts` — FastPathReport, HopStats, ProbeRequest, ProbeResult

# Packages

`bun:test`, `commander`
