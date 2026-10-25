---
type: "Document"
title: "cli-features.mdx"
description: "description: \"Detailed specification of the Hoox Command-Line Interface, monorepo workspaces compilation, and task-management engines.\"."
resource: "docs/devops/cli-features.mdx"
tags: [cli-features, devops, doc, docs]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T15:19:17Z
sources:
  - id: tree
    resource: "docs/devops/cli-features.mdx"
    title: "docs/devops/cli-features.mdx"
    author: process:git
okf_lock: generated
---

# Source

Repo path `docs/devops/cli-features.mdx`.

# Outline

* 🏗️ Monorepo Workspace Design
* ⚡ 1. Command-Line Core Architectures
  * A. Command Dispatcher (packages/cli/src/index.ts)
  * B. Cloudflare services (src/services/cloudflare/, src/services/)
  * C. Shared config & path resolution (@hoox-sh/hoox-shared)
  * D. Workspace context (startup)
* 🔒 2. Declarative Config Mapping & Validation
* 🛜 3. Self-Healing & Diagnostics Engine
* 🎨 4. Output Framework
  * Theme tokens (utils/theme.ts)
  * Output formatters (utils/formatters.ts)
  * Rich mode gate (utils/format-mode.ts)
  * Custom help formatter (utils/help-formatter.ts)
  * "Did you mean" + completion footer (utils/completion.ts, utils/error-handler.ts)
  * Banner (ui/banner.ts) — Linear Rail
  * Adding a new output
* 🔑 5. Secrets modes (hoox secrets)
* 👷 6. Worker catalog (hoox workers)
* 🚪 7. Setup gates (hoox onboard / hoox setup)
  * 🔗 Next Steps

# Mentions

* [packages/cli/src](/code/packages/cli/src.md)
