---
type: "Document"
title: "payloads.mdx"
description: "description: \"High-integrity JSON request payload specifications, TypeScript interfaces, and validation rules across Hoox microservices.\"."
resource: "docs/devops/api/payloads.mdx"
tags: [api, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/api/payloads.mdx"
    title: "docs/devops/api/payloads.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/api/payloads.mdx`.

# Outline

* 🛡️ 1. Standard Request Envelope
* 📈 2. Trade Execution Payloads (trade-worker)
  * A. Centralized Exchange Order Payload (/webhook & /process)
  * B. Spot DEX signal (same /webhook envelope)
* 🗄️ 3. Database SQL Query Payloads (d1-worker)
  * A. Execute Single SQL Statement
* 💬 4. Telegram Notification Payloads (telegram-worker)
  * 🔗 Next Steps
