---
type: "Document"
title: "endpoints.mdx"
description: "description: \"Exhaustive HTTP REST API directory for the Hoox edge gateway, webhooks, analytics telemetry, and database queries.\"."
resource: "docs/devops/api/endpoints.mdx"
tags: [api, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/api/endpoints.mdx"
    title: "docs/devops/api/endpoints.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/api/endpoints.mdx`.

# Outline

* 🔒 Security & Authorization Headers
* 🚀 Ingress Webhook Endpoints (workers/hoox-worker)
  * A. Ingest Signal Webhook
  * B. Proactive Health Diagnostics
* Operator management plane (/v1/)
* Wallet operator proxy (/wallet/)
* 🗄️ Database Service Endpoints (workers/d1-worker)
  * A. Execute Single SQL Statement
  * B. Execute Transactional Batch Statements
* 🧠 AI Risk & Chat Endpoints (workers/agent-worker)
  * A. Conversational Chat Stream (Server-Sent Events)
  * B. Multimodal AI Vision Audit
  * 🔗 Next Steps
