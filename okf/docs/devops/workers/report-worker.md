---
type: "Document"
title: "report-worker.mdx"
description: "description: \"Engineering specification for the Hoox PDF report worker: BROWSER.quickAction pdf, cron at 08:00 and 18:00 UTC, and R2.\"."
resource: "docs/devops/workers/report-worker.mdx"
tags: [devops, doc, docs, workers]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-10T14:53:51Z
sources:
  - id: tree
    resource: "docs/devops/workers/report-worker.mdx"
    title: "docs/devops/workers/report-worker.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/workers/report-worker.mdx`.

# Outline

* ⚡ 1. Declared Wrangler Configurations & Bindings
* 🔑 2. Environmental Variables & Encrypted Secrets
* 🌐 3. Browser Rendering & PDF Print Pipeline
  * Step 1: Data Aggregation & HTML Compilation
  * Step 2: Cloudflare Chrome Isolate Print
  * Step 3: R2 Storage & Expiration
  * Step 4: Dispatch Telegram Alert
  * Security notes
  * 🔗 Next Steps
