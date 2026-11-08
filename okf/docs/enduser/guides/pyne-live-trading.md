---
type: "Document"
title: "PYNE live trading"
description: "description: \"Bar-close cron: PYNE strategy events become HOOX WebhookPayloads on trade-worker. Alerts are a separate webhook path.\"."
resource: "docs/enduser/guides/pyne-live-trading.mdx"
tags: [doc, docs, enduser, guides]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T16:29:02Z
sources:
  - id: tree
    resource: "docs/enduser/guides/pyne-live-trading.mdx"
    title: "docs/enduser/guides/pyne-live-trading.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/enduser/guides/pyne-live-trading.mdx`.

# Outline

- Abstract
- Conceptual model
  - Event map (tradeforwarder.py)
  - Alert path (not orders)
- Interface surface
  - Secrets
  - Deploy and health
  - Operator CLI
- Internals
- Invariants
- Worked examples
- Failure modes
- See also
