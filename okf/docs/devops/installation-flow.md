---
type: "Document"
title: "installation-flow.mdx"
description: "description: \"Detailed system onboarding, toolchain validation steps, wrangler.jsonc schemas, and Secret Store binding architectures.\"."
resource: "docs/devops/installation-flow.mdx"
tags: [devops, doc, docs, installation-flow]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-10T14:53:51Z
sources:
  - id: tree
    resource: "docs/devops/installation-flow.mdx"
    title: "docs/devops/installation-flow.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/installation-flow.mdx`.

# Outline

* 🏗️ Onboarding Wizard (hoox onboard)
  * Phase 1: Cloudflare® Authentication
  * Phase 2: Worker Preset Selection
  * Phase 3: Integration Secrets
  * Phase 4: Configuration Write
  * Phase 5: Infrastructure Provisioning
  * Phase 6: Verification (suggested next step)
* 🔎 Configuration Files Spec
  * A. wrangler.jsonc (Central Settings)
  * B. .wizard-state.json (Onboarding State)
* 🔒 Secret Bindings Architecture
  * Local Mocking (.dev.vars)
  * Production Secret Bindings
  * 🔗 Next Steps
