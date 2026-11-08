---
type: "Document"
title: "Hoox Trading System — Product & Technical Design"
description: "This document serves as the Single Source of Truth for the Hoox Trading System. It outlines the product overview, technical architecture, data models, workflows, UI/UX…"
resource: "DESIGN.md"
tags: [design, doc]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T15:02:00Z
sources:
  - id: tree
    resource: "DESIGN.md"
    title: "DESIGN.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `DESIGN.md`.

# Outline

- 1. Product Overview & Goal
- 2. System Architecture & Workflows
  - 2.1 System Diagram
  - 2.2 Workers List
  - 2.3 Communication Pattern
- 3. Data Models (D1 & R2)
- 4. UI/UX & Aesthetic Rules (Dashboard)
- 5. AI Agent Rules & Project Conventions
- 6. Dashboard & Next.js Build Process
  - 6.1 Dashboard Overview
  - 6.2 Next.js 16 + Turbopack on Cloudflare Edge
- 7. Context File Organization
- 8. CLI Architecture
- 9. Infrastructure Bindings
- 10. Service Binding Map
- 11. Code Graph (AI/LLM Context)
- 12. Self-Hosted Limitations
  - Why option (a) — fail loudly?
  - Recommended deployment

# Mentions

- [packages/cli/src](/code/packages/cli/src.md)
- [scripts](/code/scripts.md)
