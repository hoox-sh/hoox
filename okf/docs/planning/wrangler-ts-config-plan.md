---
type: "Document"
title: "Wrangler TypeScript Config — Engineering Plan"
description: "Status: draft for approval · Owner: Engineering · Date: 2026-11-11."
resource: "docs/planning/wrangler-ts-config-plan.md"
tags: [doc, docs, planning, wrangler-ts-config-plan]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "docs/planning/wrangler-ts-config-plan.md"
    title: "docs/planning/wrangler-ts-config-plan.md"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/planning/wrangler-ts-config-plan.md`.

# Outline

- 0. Corrections to the brief (verified in-repo)
- 1. Decision: prepare now, do not adopt
- 2. What we can capture today (highest-value work)
  - 2.1 Typed config source that generates the 12 JSONC files
  - 2.2 wrangler types --include-main-module=false (4.159.0)
  - 2.3 wrangler types --check in CI
  - 2.4 Deprecated / removed behaviour audit
- 3. Readiness gaps (blockers before any adoption)
- 4. Staged rollout
- 5. Risks and rollback
- 6. Open questions
  - Sources

# Mentions

- [packages/cli/src](/code/packages/cli/src.md)
- [packages/cli/src/commands/deploy](/code/packages/cli/src/commands/deploy.md)
- [packages/cli/src/services/config](/code/packages/cli/src/services/config.md)
- [scripts](/code/scripts.md)
