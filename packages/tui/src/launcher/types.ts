/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** Serializable catalog the CLI writes for the OpenTUI start screen. */

export interface LauncherItem {
  id: string;
  argv: string[];
  label: string;
  hint: string;
  group: string;
  keywords: string[];
  recommended?: boolean;
  longRunning?: boolean;
}

export interface LauncherGroup {
  id: string;
  title: string;
}

export interface LauncherCatalog {
  version: string;
  cwd: string;
  groups: LauncherGroup[];
  items: LauncherItem[];
  recents: string[];
}

export type LauncherResult =
  { action: "quit" } | { action: "run"; argv: string[]; longRunning?: boolean };

export const FALLBACK_CATALOG: LauncherCatalog = {
  version: "dev",
  cwd: process.cwd(),
  groups: [
    { id: "setup", title: "Setup" },
    { id: "ship", title: "Ship" },
    { id: "develop", title: "Develop" },
    { id: "operate", title: "Operate" },
    { id: "observe", title: "Observe" },
  ],
  items: [
    {
      id: "tui",
      argv: ["tui"],
      label: "Operations center",
      hint: "full-screen OpenTUI dashboard",
      group: "operate",
      keywords: ["tui", "dashboard"],
      recommended: true,
      longRunning: true,
    },
    {
      id: "onboard",
      argv: ["onboard"],
      label: "Onboard",
      hint: "init + setup end-to-end",
      group: "setup",
      keywords: ["bootstrap"],
      recommended: true,
    },
    {
      id: "doctor",
      argv: ["doctor"],
      label: "Doctor",
      hint: "runtime, TUI paths, security",
      group: "setup",
      keywords: ["diagnose"],
      recommended: true,
    },
    {
      id: "deploy-all",
      argv: ["deploy", "all"],
      label: "Deploy all",
      hint: "workers + dashboard",
      group: "ship",
      keywords: ["ship"],
      recommended: true,
    },
    {
      id: "dev-start",
      argv: ["dev", "start"],
      label: "Dev start",
      hint: "run workers locally",
      group: "develop",
      keywords: ["local"],
      recommended: true,
      longRunning: true,
    },
    {
      id: "check-setup",
      argv: ["check", "setup"],
      label: "Check setup",
      hint: "full system validation",
      group: "observe",
      keywords: ["diagnostics"],
      recommended: true,
    },
  ],
  recents: [],
};
