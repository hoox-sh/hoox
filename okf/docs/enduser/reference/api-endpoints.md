---
type: "Document"
title: "api-endpoints.mdx"
description: "description: \"Public webhook, health, operator /v1 and /wallet proxy routes on the hoox gateway.\"."
resource: "docs/enduser/reference/api-endpoints.mdx"
tags: [doc, docs, enduser, reference]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/enduser/reference/api-endpoints.mdx"
    title: "docs/enduser/reference/api-endpoints.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/enduser/reference/api-endpoints.mdx`.

# Outline

* 🔒 Request headers
* 🎯 1. Ingest trade signal webhook
  * Request payload
  * Response models
* 🟢 2. System health check
* 🛡️ 3. Operator plane (/v1/)
* 💱 4. Wallet proxy (/wallet/)
* 🚨 5. Standard platform errors
  * A. 400 Bad Request
  * B. 403 Forbidden (invalid apiKey or IP)
  * C. 409 Conflict (duplicate idempotency key)
  * D. 503 Service Unavailable (kill switch or missing DO)
  * 🔗 Next Steps
