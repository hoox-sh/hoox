---
type: "Code Module"
title: "packages/cli/src/ui"
description: "Hoox CLI UI module — interactive TUI components."
resource: "packages/cli/src/ui"
tags: [cli, code, packages, ui]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-08T16:29:02Z
sources:
  - id: tree
    resource: "packages/cli/src/ui"
    title: "packages/cli/src/ui"
    author: process:git
okf_lock: generated
---

# Files

- `banner.test.ts`
- `banner.ts` — BANNER_VARIANTS, BannerVariant, DISCLAIMER, animateBanner, renderBanner, renderBannerHorizon, renderBannerLogo, renderBannerMinimal, renderBannerSignal, renderCompactBanner, renderLegacy
- `catalog.test.ts`
- `catalog.ts` — COMMAND_GROUPS, CommandGroupId, LONG_RUNNING_COMMANDS, LauncherCatalog, LauncherGroup, LauncherItem, buildLauncherCatalog, commandBlurb, firstLine, groupIdForCommand, groupTitle, isLongRunning
- `index.ts` — animateBanner, buildLauncherCatalog, renderBanner, renderBannerLogo, renderCompactBanner, resolveLauncherEntry, runInteractiveTUI, shouldLaunchStartScreen
- `menu.ts` — runInteractiveTUI
- `opentui-launch.test.ts`
- `opentui-launch.ts` — LauncherResult, resolveLauncherEntry, runOpenTuiLauncher, shouldLaunchStartScreen

# Packages

`@clack/prompts`, `@hoox-sh/hoox-shared`, `ansis`, `bun:test`, `commander`, `node:child_process`, `node:fs`, `node:module`, `node:os`, `node:path`, `node:url`
