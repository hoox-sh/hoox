---
type: "Code Module"
title: "tests/live"
description: "tests/live contains ai.test.ts, api.test.ts, config.ts, and 10 more files."
resource: "tests/live"
tags: [code, live, tests]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "tests/live"
    title: "tests/live"
    author: process:git
okf_lock: generated
---

# Files

- `ai.test.ts`
- `api.test.ts`
- `config.ts` — TEST_TIMEOUT
- `d1.test.ts`
- `durable-objects.test.ts` — TestCounter, TestIdempotencyStore
- `helpers.ts` — CfApiResponse, LiveTestConfig, WranglerResult, canMutateCloudflare, cfApi, getConfig, hasLiveEnv, log, section, skipIfMissing, testResourceName, wrangler
- `interconnection.test.ts`
- `kv.test.ts`
- `queues.test.ts`
- `r2.test.ts`
- `reporter.ts` — log, section
- `secrets.test.ts`
- `validation.test.ts`

# Other files

- `README.md`
- `env.template`

# Packages

`bun:test`, `cloudflare:workers`, `node:fs`, `node:path`
