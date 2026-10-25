---
type: "Document"
title: "📊 Signals & Trade Spec"
description: "description: \"Webhook JSON schema, CEX/DEX venue names, test trading, and D1 ledger columns.\"."
resource: "docs/enduser/concepts/signals-and-trades.mdx"
tags: [concepts, doc, docs, enduser]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/enduser/concepts/signals-and-trades.mdx"
    title: "docs/enduser/concepts/signals-and-trades.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/enduser/concepts/signals-and-trades.mdx`.

# Outline

* 1. Webhook Signal Ingestion Schema
  * Parameter Rules & Type Constraints
  * Test trading
* 2. Dynamic Payload Translation & Side Mapping
  * A. Translation Table (One-Way Margin / Spot)
  * B. Hedge-Mode PositionSide Mapping
  * C. Dynamic Position Resolution
* 3. Leverage Scaling & Order Math
  * Precision Table by Exchange
* 4. D1 Database Transaction Ledger
* 5. Queue Failover & Guaranteed Delivery
  * 🔗 Next Steps
