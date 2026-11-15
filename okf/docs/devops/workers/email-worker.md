---
type: "Document"
title: "email-worker.mdx"
description: 'description: "Engineering specification for the Hoox email parsing worker, covering Mailgun webhook ingestion, direct JSON signal parsing, KV-configured regex patterns, and…'
resource: "docs/devops/workers/email-worker.mdx"
tags: [devops, doc, docs, workers]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "docs/devops/workers/email-worker.mdx"
    title: "docs/devops/workers/email-worker.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/workers/email-worker.mdx`.

# Outline

- ⚡ 1. Endpoints
- 🔐 2. Mailgun Signature Verification
- 📨 3. Signal Extraction
  - Phase 1: JSON Parsing
  - Phase 2: Plaintext Fallback
  - Zod Validation
  - Forwarding
  - Cloudflare Email Routing
- 🔗 4. Bindings
  - Service Bindings
  - Send Email Binding
  - KV Namespaces
- 🔑 5. Secrets
- ⚙️ 6. Environment Variables (Vars)
- 🗄️ 7. KV Configuration Keys
- 📊 8. Observability
- 🛠️ 9. Configuration (wrangler.jsonc)
- 🧪 10. Development
- 🏗️ 11. Architecture Context
  - Next Steps
