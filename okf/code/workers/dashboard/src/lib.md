---
type: "Code Module"
title: "workers/dashboard/src/lib"
description: "Normalize to a scheme-safe image URL, or null."
resource: "workers/dashboard/src/lib"
tags: [code, dashboard, lib, workers]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-10T14:53:51Z
sources:
  - id: tree
    resource: "workers/dashboard/src/lib"
    title: "workers/dashboard/src/lib"
    author: process:git
okf_lock: generated
---

# Files

* `agent-config-schema.ts` — agentConfigSchema
* `api.ts` — DashboardStats, Position, Report, SystemLog, WorkerStatus, api, isTestnetPosition
* `config.ts` — AuthType, ConfigError, ENV_KEYS, TRADINGVIEW_WEBHOOK_PATH, assertProductionAuthConfigured, config, extractWorkersSubdomainPrefix, getAuthType, getConfig, getEnvVar, getInternalAuthKeys, requireSafeSessionSecret
* `env.ts` — DashboardEnv
* `safe-image-src.ts` — parseSafeImageSrc
* `utils.ts` — cn

# Packages

`@cloudflare/workers-types`, `@hoox-sh/hoox-shared/errors`, `@hoox-sh/hoox-shared/service-bindings`, `@hoox-sh/hoox-shared/types`, `clsx`, `tailwind-merge`, `zod`

# Used by

* [workers/dashboard/src](/code/workers/dashboard/src.md)

# Nested

* [workers/dashboard/src/lib/settings](/code/workers/dashboard/src/lib/settings.md)
