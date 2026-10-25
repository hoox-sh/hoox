---
type: "Document"
title: "⚡ Edge-First Architecture"
description: "description: \"Why V8 isolates and Cloudflare Workers cut order-path latency versus a single VPS.\"."
resource: "docs/enduser/concepts/edge-architecture.mdx"
tags: [concepts, doc, docs, enduser]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/enduser/concepts/edge-architecture.mdx"
    title: "docs/enduser/concepts/edge-architecture.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/enduser/concepts/edge-architecture.mdx`.

# Outline

* 🏎️ The Physics of Latency: Why Traditional VPS Bots Fail
  * The VPS Bottleneck (200ms+ slippage)
  * The Hoox Edge Path (Under 15ms latency)
* 🧅 V8 Isolates vs. Traditional VMs / Containers
* 🎯 Smart Placement: Zero-Config Latency Optimizer
  * How Smart Placement Works
  * Latency Comparison: Real Numbers
* ⚙️ Hardware-Level Security
  * Service Binding Architecture
  * 🔗 Next Steps
