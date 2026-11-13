---
type: "Document"
title: "responses.mdx"
description: 'description: "High-integrity JSON response templates, success envelopes, edge error codes, and shared error middleware specs.".'
resource: "docs/devops/api/responses.mdx"
tags: [api, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "docs/devops/api/responses.mdx"
    title: "docs/devops/api/responses.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/api/responses.mdx`.

# Outline

- 🛡️ 1. Standard Response Envelope
- 🏆 2. Success Response Templates
  - A. Trade Execution Fill Success (trade-worker - 200 OK)
  - B. Telegram Push Success (telegram-worker - 200 OK)
- 🚨 3. Error Models & Edge Error Codes
  - A. 400 Bad Request (JSON Validation Error)
  - B. 409 Conflict (Idempotency Mutex Intercept)
- 🛠️ 4. Shared Errors Factory Middleware
  - 🔗 Next Steps
