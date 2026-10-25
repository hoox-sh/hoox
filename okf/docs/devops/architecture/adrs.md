---
type: "Document"
title: "📐 Architecture Decision Records (ADRs)"
description: "This directory contains the Architecture Decision Records for the Hoox trading platform. Each ADR documents a significant architectural choice, its context, the decision made,…"
resource: "docs/devops/architecture/adrs.mdx"
tags: [architecture, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/architecture/adrs.mdx"
    title: "docs/devops/architecture/adrs.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/architecture/adrs.mdx`.

# Outline

* ADR Index
* ADR-001: Cloudflare Workers as Execution Platform
* ADR-002: SQLite-backed Durable Objects for Idempotency
* ADR-003: Mesh of specialized Workers
* ADR-004: Dual-Layer Configuration (Environment \+ KV)
* ADR-005: Multi-Provider AI Gateway with Fallback Chain
* ADR-006: Bun Workspaces for Monorepo Management
* ADR-007: Opt-in Tenant Isolation (TenantEnv)
