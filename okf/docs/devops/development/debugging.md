---
type: "Document"
title: "debugging.mdx"
description: "description: \"Detailed system troubleshooting guide, covering local console logging, production wrangler tailing telemetry, and distributed trace ID tracking.\"."
resource: "docs/devops/development/debugging.mdx"
tags: [development, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-10T14:53:51Z
sources:
  - id: tree
    resource: "docs/devops/development/debugging.mdx"
    title: "docs/devops/development/debugging.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/development/debugging.mdx`.

# Outline

* ⚡ 1. Real-Time Telemetry: Tailing Production Logs
* 📝 2. Distributed Tracing: The requestId Standard
  * The RequestId Protocol
* 🛡️ 3. Operational Runbooks for Common Edge Failures
  * A. Symptom: 401 Unauthorized on Internal Worker Calls
  * B. Symptom: 502 Bad Gateway on Webhook Routes
  * C. Symptom: D1ERROR: no such table
  * D. Symptom: KV Configuration Propagation Delays
  * 🔗 Next Steps
