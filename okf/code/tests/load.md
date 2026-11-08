---
type: "Code Module"
title: "tests/load"
description: "D1 Query Load Test Tests concurrent database query patterns against d1-worker."
resource: "tests/load"
tags: [code, load, tests]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "tests/load"
    title: "tests/load"
    author: process:git
okf_lock: generated
---

# Files

- `agent-cron-sim.js` — agent_cron, health_probes, options, setup
- `d1-query-load.js` — options, setup, teardown
- `fastpath-audit.js` — healthScenario, options, webhookAuthFailScenario, webhookHappyScenario, webhookInvalidScenario
- `health-probe.js` — cold, options, warm
- `helpers.js` — checkLatency, checkResponse, checkSuccess, getAuthHeaders, getBaseUrl, getD1BatchPayload, getD1QueryPayload, getDefaultThresholds, getWebhookApiKey, getWebhookPayload, healthCheck, url
- `system-mixed.js` — options, setup, teardown
- `webhook-flow.js` — options, setup, teardown

# Other files

- `README.md`

# Packages

`k6`, `k6/http`, `k6/metrics`
