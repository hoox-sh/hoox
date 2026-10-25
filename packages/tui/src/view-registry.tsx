/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
/**
 * View registry — single source of truth for view factories, sidebar items,
 * keyboard shortcuts, and command-palette view commands.
 */
import { VIEW_IDS, type ViewId } from "@hoox-sh/hoox-shared";
import type { DialogHandle } from "./components/ui/dialog";
import type { CommandEntry } from "./components/shared/command-palette";

import { DashboardView } from "./components/views/dashboard";
import { WorkersOverview } from "./components/views/workers-overview";
import { WorkerDetail } from "./components/views/worker-detail";
import { TradeMonitor } from "./components/views/trade-monitor";
import { LogsViewer } from "./components/views/logs-viewer";
import { ServiceManager } from "./components/views/service-manager";
import { ConfigEditor } from "./components/views/config-editor";
import { SetupWizard } from "./components/views/setup-wizard";
import { SettingsView } from "./components/views/settings";
import { QueueDepthView } from "./components/views/queue-depth";
import { KvViewer } from "./components/views/kv-viewer";
import { SecretsViewer } from "./components/views/secrets-viewer";
import { AiChatView } from "./components/views/ai-chat";
import { DbQueryView } from "./components/views/db-query";
import { EdgeTopology } from "./components/views/edge-topology";
import { WorkerSettingsView } from "./components/views/worker-settings";

export type ViewFactory = (dialog: DialogHandle) => React.ReactNode;

export type ViewKeyMod = "ctrl" | "ctrl-alt";

export interface ViewRegistryEntry {
  id: ViewId;
  /** Palette long name */
  label: string;
  /** Sidebar short name */
  shortLabel: string;
  /** Human hint in sidebar (e.g. "1", "^K") */
  shortcut: string;
  /** Key name for keyboard handler (digit or letter) */
  key: string;
  keyMod: ViewKeyMod;
  aliases?: string[];
  /** Palette shortcut display (e.g. "^1", "^#k") */
  paletteShortcut?: string;
  factory: ViewFactory;
}

export const VIEW_REGISTRY: ViewRegistryEntry[] = [
  {
    id: "dashboard",
    label: "DASHBOARD",
    shortLabel: "DASHBOARD",
    shortcut: "1",
    key: "1",
    keyMod: "ctrl",
    paletteShortcut: "^1",
    aliases: ["home", "overview"],
    factory: (dialog) => <DashboardView dialog={dialog} />,
  },
  {
    id: "workers",
    label: "WORKERS OVERVIEW",
    shortLabel: "WORKERS",
    shortcut: "2",
    key: "2",
    keyMod: "ctrl",
    paletteShortcut: "^2",
    aliases: ["services"],
    factory: (dialog) => <WorkersOverview dialog={dialog} />,
  },
  {
    id: "worker-detail",
    label: "WORKER DETAIL",
    shortLabel: "DETAIL",
    shortcut: "3",
    key: "3",
    keyMod: "ctrl",
    paletteShortcut: "^3",
    aliases: ["detail"],
    factory: () => <WorkerDetail />,
  },
  {
    id: "trade-monitor",
    label: "TRADE MONITOR",
    shortLabel: "TRADES",
    shortcut: "4",
    key: "4",
    keyMod: "ctrl",
    paletteShortcut: "^4",
    aliases: ["trades", "positions"],
    factory: () => <TradeMonitor />,
  },
  {
    id: "logs-viewer",
    label: "LOGS VIEWER",
    shortLabel: "LOGS",
    shortcut: "5",
    key: "5",
    keyMod: "ctrl",
    paletteShortcut: "^5",
    aliases: ["logs"],
    factory: () => <LogsViewer />,
  },
  {
    id: "service-manager",
    label: "SERVICE MANAGER",
    shortLabel: "SERVICES",
    shortcut: "6",
    key: "6",
    keyMod: "ctrl",
    paletteShortcut: "^6",
    aliases: ["deploy", "restart"],
    factory: (dialog) => <ServiceManager dialog={dialog} />,
  },
  {
    id: "config-editor",
    label: "CONFIG EDITOR",
    shortLabel: "CONFIG",
    shortcut: "7",
    key: "7",
    keyMod: "ctrl",
    paletteShortcut: "^7",
    aliases: ["edit", "config", "toml", "json"],
    factory: () => <ConfigEditor />,
  },
  {
    id: "setup-wizard",
    label: "SETUP WIZARD",
    shortLabel: "SETUP",
    shortcut: "8",
    key: "8",
    keyMod: "ctrl",
    paletteShortcut: "^8",
    aliases: ["onboarding", "first-run"],
    factory: (dialog) => <SetupWizard dialog={dialog} />,
  },
  {
    id: "settings",
    label: "SETTINGS",
    shortLabel: "SETTINGS",
    shortcut: "9",
    key: "9",
    keyMod: "ctrl",
    paletteShortcut: "^9",
    aliases: ["preferences"],
    factory: (dialog) => <SettingsView dialog={dialog} />,
  },
  {
    id: "queue-depth",
    label: "QUEUE DEPTH",
    shortLabel: "QUEUES",
    shortcut: "0",
    key: "0",
    keyMod: "ctrl",
    paletteShortcut: "^0",
    aliases: ["queues", "backlog"],
    factory: () => <QueueDepthView />,
  },
  {
    id: "kv-viewer",
    label: "KV VIEWER",
    shortLabel: "KV",
    shortcut: "^K",
    key: "k",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#k",
    aliases: ["kv", "config-kv", "config-kv-list"],
    factory: () => <KvViewer />,
  },
  {
    id: "secrets-viewer",
    label: "SECRETS VIEWER",
    shortLabel: "SECRETS",
    shortcut: "^S",
    key: "s",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#s",
    aliases: ["secrets", "config-secrets", "config-secrets-list"],
    factory: () => <SecretsViewer />,
  },
  {
    id: "db-query",
    label: "DB QUERY",
    shortLabel: "DB QUERY",
    shortcut: "^Q",
    key: "q",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#q",
    aliases: ["sql", "d1", "database", "db"],
    factory: () => <DbQueryView />,
  },
  {
    id: "ai-chat",
    label: "AI CHAT",
    shortLabel: "AI CHAT",
    shortcut: "^C",
    key: "c",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#c",
    aliases: ["chat", "ai", "agent"],
    factory: () => <AiChatView />,
  },
  {
    id: "edge-topology",
    label: "EDGE TOPOLOGY",
    shortLabel: "TOPOLOGY",
    shortcut: "^E",
    key: "e",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#e",
    aliases: ["topology", "graph", "architecture", "map"],
    factory: () => <EdgeTopology />,
  },
  {
    id: "worker-settings",
    label: "WORKER SETTINGS",
    shortLabel: "W SETTINGS",
    shortcut: "^W",
    key: "w",
    keyMod: "ctrl-alt",
    paletteShortcut: "^#w",
    aliases: [
      "dashboard-settings",
      "worker-config",
      "dashboard.jsonc",
      "kv-settings",
    ],
    factory: () => <WorkerSettingsView />,
  },
];

/** All ViewIds in registry order (single source for exhaustiveness checks). */
export const REGISTERED_VIEW_IDS: ViewId[] = VIEW_REGISTRY.map((e) => e.id);

const REGISTERED_VIEW_ID_SET = new Set<string>(REGISTERED_VIEW_IDS);

/** True when `id` is a known primary view (safe for setView / session restore). */
export function isRegisteredViewId(id: unknown): id is ViewId {
  return typeof id === "string" && REGISTERED_VIEW_ID_SET.has(id);
}

/** Compile-time exhaustiveness helper (call once at module load). */
function assertFullCoverage(entries: ViewRegistryEntry[]): void {
  const ids = new Set(entries.map((e) => e.id));
  for (const id of VIEW_IDS) {
    if (!ids.has(id)) throw new Error(`view-registry missing ViewId: ${id}`);
  }
  // Unique keyboard bindings within each modifier class
  const ctrlKeys = new Set<string>();
  const ctrlAltKeys = new Set<string>();
  for (const e of entries) {
    if (e.keyMod === "ctrl") {
      if (ctrlKeys.has(e.key)) {
        throw new Error(`view-registry duplicate Ctrl+${e.key}`);
      }
      ctrlKeys.add(e.key);
    } else {
      if (ctrlAltKeys.has(e.key)) {
        throw new Error(`view-registry duplicate Ctrl+Alt+${e.key}`);
      }
      ctrlAltKeys.add(e.key);
    }
  }
}
assertFullCoverage(VIEW_REGISTRY);

/** Cached sidebar rows (registry is static). */
export const SIDEBAR_ITEMS: {
  id: ViewId;
  label: string;
  shortcut: string;
}[] = VIEW_REGISTRY.map((e) => ({
  id: e.id,
  label: e.shortLabel,
  shortcut: e.shortcut,
}));

/** Sidebar rows in registry order (id, short label, key hint). */
export function getSidebarItems(): {
  id: ViewId;
  label: string;
  shortcut: string;
}[] {
  return SIDEBAR_ITEMS;
}

/** Ctrl+digit / letter → view id (primary shortcuts). */
export function getViewShortcutMap(): Record<string, ViewId> {
  const map: Record<string, ViewId> = {};
  for (const e of VIEW_REGISTRY) {
    if (e.keyMod === "ctrl") map[e.key] = e.id;
  }
  return map;
}

/** Ctrl+Alt+letter → view id (overflow chords once Ctrl+0-9 are taken). */
export function getCtrlAltViewMap(): Record<string, ViewId> {
  const map: Record<string, ViewId> = {};
  for (const e of VIEW_REGISTRY) {
    if (e.keyMod === "ctrl-alt") map[e.key] = e.id;
  }
  return map;
}

/** Factory for `id`, or the dashboard factory when the id is unknown. */
export function getViewFactory(id: ViewId): ViewFactory {
  const entry = VIEW_REGISTRY.find((e) => e.id === id);
  // Fail soft to dashboard when store has a stale/unknown id
  return entry?.factory ?? VIEW_REGISTRY[0]!.factory;
}

/** Command-palette entries for every registered view. */
export function getViewPaletteCommands(): CommandEntry[] {
  return VIEW_REGISTRY.map((e) => ({
    id: e.id,
    name: e.label,
    category: "view" as const,
    shortcut: e.paletteShortcut,
    aliases: e.aliases,
  }));
}

export const ACTION_COMMANDS: CommandEntry[] = [
  {
    id: "refresh",
    name: "REFRESH DATA",
    category: "action",
    shortcut: "^R",
    aliases: ["reload"],
  },
  {
    id: "force-retry",
    name: "FORCE RECONNECT",
    category: "action",
    aliases: ["retry", "reconnect", "online"],
  },
  {
    id: "expand-error",
    name: "TOGGLE ERROR DIAGNOSTICS",
    category: "action",
    shortcut: "^⇧D",
    aliases: ["diagnostics", "stderr", "cli-error", "expand-error"],
  },
  {
    id: "toggle-sidebar",
    name: "TOGGLE SIDEBAR",
    category: "action",
    shortcut: "^B",
    aliases: ["collapse"],
  },
  {
    id: "quit",
    name: "QUIT HOOX",
    category: "action",
    shortcut: "^Q",
    aliases: ["exit", "close"],
  },
];

export const ALL_PALETTE_COMMANDS: CommandEntry[] = [
  ...getViewPaletteCommands(),
  ...ACTION_COMMANDS,
];
