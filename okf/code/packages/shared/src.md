---
type: "Code Module"
title: "packages/shared/src"
description: "@hoox/shared — Shared module for HOOX (Open Core) Barrel export: re-exports all shared utilities, types, stores, and TUI helpers."
resource: "packages/shared/src"
tags: [code, packages, shared]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T22:51:08Z
sources:
  - id: tree
    resource: "packages/shared/src"
    title: "packages/shared/src"
    author: process:git
okf_lock: generated
---

# Files

* `agent-config-fields.test.ts`
* `agent-config-fields.ts` — AGENT_CONFIG_EMBEDDED_FIELDS, AGENT_CONFIG_KV_KEY, AgentConfigFieldSpec, DASHBOARD_SECTIONS_AGENT_CONFIG, applyAgentConfigFieldUpdates, expandAgentConfigToFieldMap, getAgentConfigEmbeddedValue, isAgentConfigEmbeddedField, isAgentConfigSection, parseAgentConfigJson, serializeAgentConfigForKv, setAgentConfigEmbeddedValue
* `analytics.test.ts`
* `analytics.ts` — AnalyticsEnv, TrackAnalyticsOptions, trackAnalytics
* `api-client.ts` — HooxFetchOptions, WorkerAPIError, hooxFetch
* `colors.ts` — AlertSeverityColor, AlertSeverityColorKey, ColorKey, Colors, ConnectionStatusColor, ConnectionStatusKey, CoolBracketColor, CoolBracketPalette, LogLevelColor, LogLevelColorKey, WorkerStatusColor, WorkerStatusKey
* `config.ts` — HOOX_CONFIG_FILE_MODE, HOOX_DIR_MODE, HooxConfig, HooxConfigTransport, ensureHooxDirSecure, formatConfigPermissionWarning, isConfigWorldOrGroupReadable, isUnixModeGroupOrWorldAccessible, readConfig, readConfigSync, validateConfig, writeConfig
* `cron-handler.ts` — CronHandlerOptions, createCronHandler
* `dashboard-manifest.test.ts`
* `dashboard-manifest.ts` — DASHBOARD_FIELD_KV_OVERRIDES, DASHBOARD_SECTIONS_NOT_FLAT_KV, DASHBOARD_SECTIONS_UI_SKIP, DASHBOARD_SECTION_PREFIX, DASHBOARD_WORKER_IDS, DASHBOARD_WORKER_PREFIX, DashboardFieldKind, DashboardFieldOption, DashboardFieldType, DashboardKvManifest, DashboardKvManifestKey, DashboardSection
* `entitlements.ts` — EntitledContext, EntitlementScope, hasScope, verifyCacheKey
* `errors.ts` — AppError, Errors, createErrorResponse, createJsonResponse, createSuccessResponse, toError
* `exchange-client.ts` — ClientCreateOptions, ExchangeConfig, ExchangeName, ExchangeRouter, IExchangeProvider, OrderResponse, Position, TradeParams
* `format-time.ts` — formatDuration, formatRelativeTime
* `formatters.ts` — formatCompactCurrency, formatCpu, formatCurrency, formatDuration, formatDurationCompact, formatLatency, formatMemory, formatNumber, formatPercent, formatRelativeTime, formatRequests, formatTimestamp
* `health.ts` — HealthCheckOptions, healthCheck
* `index.ts` — AGENT_CONFIG_EMBEDDED_FIELDS, AGENT_CONFIG_KV_KEY, AgentConfigFieldSpec, Alert, AlertSeverity, AlertSeverityColor, AlertSeverityColorKey, AnalyticsEnv, ApiErrorResponse, ApiResponse, ApiSuccessResponse, AuthenticatedServiceEnv
* `kill-switch.test.ts`
* `kill-switch.ts` — CheckKillSwitchOptions, KILL_SWITCH_ACTIVE_PREFIX, KILL_SWITCH_KEYS, KillSwitchFailMode, KillSwitchKv, KillSwitchResult, checkKillSwitch, isTradingPaused, isTruthyKillSwitchFlag
* `kvKeys.ts` — KVKeys, KV_AGENT_ANTHROPIC_KEY, KV_AGENT_CONFIG, KV_AGENT_GOOGLE_KEY, KV_AGENT_OPENAI_KEY, KV_BOT_AI_SUMMARIES_ENABLED, KV_BOT_DEFAULT_CHAT_ID, KV_BOT_ENABLED, KV_BOT_INCLUDE_PNL, KV_BOT_NOTIFY_ON_ERROR, KV_BOT_NOTIFY_ON_EXECUTION, KV_BOT_NOTIFY_ON_STARTUP
* `kvUtils.ts` — EnvWithKV, KV_BULK_GET_MAX_KEYS, KvPutEntry, headersToObject, kvGetMany, kvGetManyAsRecord, kvPutMany, logKvTimestamp
* `legal.ts` — COPYRIGHT, DISCLAIMER, DISCLAIMER_HEADER, FULL_LEGAL_NOTICE, TRADEMARKS, TRADEMARK_NOTICE
* `operator-transport.ts` — OperatorTransport, OperatorTransportEnv, OperatorTransportProfile, ResolveOperatorTransportOptions, buildOperatorAuthHeaders, hasOperatorClientCredentials, operatorUrl, resolveOperatorTransportProfile
* `path-utils.test.ts`
* `path-utils.ts` — HooxPath, RememberedMonorepo, RuntimeRootResult, RuntimeRootSource, findHooxSetupRoot, getHooxConfigDir, getHooxDataDir, getHooxHome, getHooxRepoPath, getHooxStatePath, getHooxWranglerPath, getRelativeHooxPath
* `queue-handler.ts` — QueueHandlerOptions, createQueueHandler
* `router.ts` — Handler, MiddlewareHandler, RouteParams, createRouter
* `service-bindings.ts` — AuthenticatedServiceEnv, D1_READ_AUTH_KEY_FIELDS, D1_WRITE_AUTH_KEY_FIELDS, DASHBOARD_D1_READ_AUTH_KEY_FIELDS, DASHBOARD_TELEGRAM_ALERT_AUTH_KEY_FIELDS, DASHBOARD_TRADE_EXECUTE_AUTH_KEY_FIELDS, InternalAuthKeyFields, ServiceAuthError, ServiceBinding, TELEGRAM_ALERT_AUTH_KEY_FIELDS, TRADE_EXECUTE_AUTH_KEY_FIELDS, TRADE_READ_AUTH_KEY_FIELDS
* `session.ts` — RestoredSession, SessionState, restoreSession, saveSession
* `sse.ts` — SSECallback, SSEStatusCallback, SubscribeSSEOptions, subscribeSSE
* `tenant.test.ts`
* `tenant.ts` — TenantEnv, TenantScope, effectiveTenantId, isTenantFlagOn, isTenantMode, scopeKey, scopeR2Key, tenantContextOf, tenantScope, withTenantId
* `test-utils.ts` — MockAi, MockAnalyticsEngine, MockAnalyticsEngineDataset, MockD1Database, MockD1PreparedStatement, MockExecutionContext, MockFetcher, MockKVNamespace, MockQueue, MockR2Bucket, MockSecretsStore, MockVectorizeIndex
* `types.ts` — Alert, AlertSeverity, ApiErrorResponse, ApiResponse, ApiSuccessResponse, AuditEvent, BalanceSchema, BaseEnv, BatchPayload, CliErrorDetails, CliErrorType, ConnectionStatus

# Packages

`@cloudflare/workers-types`, `@hoox-sh/hoox-shared`, `@hoox-sh/hoox-shared/kvKeys`, `bun:test`, `fs`, `node:fs`, `node:path`, `node:url`, `os`, `path`, `router.ts`, `zod`

# Depends on

* [packages/shared/src/d1](/code/packages/shared/src/d1.md)
* [packages/shared/src/exchanges](/code/packages/shared/src/exchanges.md)
* [packages/shared/src/middleware](/code/packages/shared/src/middleware.md)
* [packages/shared/src/stores](/code/packages/shared/src/stores.md)
* [packages/shared/src/types](/code/packages/shared/src/types.md)
* [packages/shared/src/wizard](/code/packages/shared/src/wizard.md)

# Used by

* [packages/shared/src/d1](/code/packages/shared/src/d1.md)
* [packages/shared/src/middleware](/code/packages/shared/src/middleware.md)
* [packages/shared/src/stores](/code/packages/shared/src/stores.md)

# Nested

* [packages/shared/src/d1](/code/packages/shared/src/d1.md)
* [packages/shared/src/exchanges](/code/packages/shared/src/exchanges.md)
* [packages/shared/src/middleware](/code/packages/shared/src/middleware.md)
* [packages/shared/src/schemas](/code/packages/shared/src/schemas.md)
* [packages/shared/src/stores](/code/packages/shared/src/stores.md)
* [packages/shared/src/types](/code/packages/shared/src/types.md)
* [packages/shared/src/wizard](/code/packages/shared/src/wizard.md)
