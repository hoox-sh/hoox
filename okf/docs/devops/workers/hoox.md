---
type: "Document"
title: "hoox.mdx"
description: "description: \"Comprehensive engineering specification for the Hoox public gateway, covering ingress WAF rules, Durable Object idempotency stores, and Service Binding…"
resource: "docs/devops/workers/hoox.mdx"
tags: [devops, doc, docs, workers]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/workers/hoox.mdx"
    title: "docs/devops/workers/hoox.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/workers/hoox.mdx`.

# Outline

* 🏗️ Architectural Topology
* ⚡ 1. Declared Wrangler Configurations & Bindings
* 🔑 2. Environmental Variables & Encrypted Secrets
  * Local Development Mocking (.dev.vars)
* 🛡️ 2b. Ingress controls (WAF-layer)
* 🛜 3. API Route Specifications
  * A. Ingest Signal Webhook
  * B. Gateway Health Diagnostics
  * C. Operator management plane (/v1/)
  * D. Operator wallet proxy (/wallet/)
  * 🔗 Next Steps
