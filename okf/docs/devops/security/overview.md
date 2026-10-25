---
type: "Document"
title: "overview.mdx"
description: "description: \"Comprehensive security testing infrastructure, auth hardening, and CI/CD security scanning for the Hoox trading platform.\"."
resource: "docs/devops/security/overview.mdx"
tags: [devops, doc, docs, security]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/security/overview.mdx"
    title: "docs/devops/security/overview.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/security/overview.mdx`.

# Outline

* Overview
  * Gateway mesh hardening (ships with 0.13+)
* 1. Auth Middleware Hardening
  * requireInternalAuth — Fail-Closed
  * timingSafeEqual — Exported for Cross-Worker Use
  * Webhook API Key — Timing-Safe Comparison
* 2. Auth Coverage by Worker
* 3. Shared Security Headers Middleware
  * API
  * Default Headers
  * Dashboard
* 4. Security Test Suites
  * Auth Bypass Tests
  * Security Headers Tests
  * Fuzz Tests
  * Running Security Tests
* 5. CI/CD Security Scanning
  * Dependency Audit
  * Secret Scanning
  * CodeQL
  * Dependabot
* 6. CI Pipeline Security Flow
* 7. Performance & Load Testing
* 8. Environment Setup
  * Required GitHub Secrets
* 9. Related Documentation

# Mentions

* [packages/shared/src/middleware](/code/packages/shared/src/middleware.md)
* [tests/security](/code/tests/security.md)
