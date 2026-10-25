/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * TUI-specific types — Navigation, modals, keyboard shortcuts.
 */

import {
  VIEW_IDS,
  type ViewId,
  type CliErrorType,
  type CliErrorDetails,
} from "@hoox-sh/hoox-shared";

// Re-export shared CLI error types for convenience so consumers can
// import everything from the tui/types module.
export type { CliErrorType, CliErrorDetails, ViewId };
export { VIEW_IDS as ALL_VIEWS };

/** Sidebar / tab labels for each {@link ViewId}. */
export const VIEW_LABELS: Record<ViewId, string> = {
  dashboard: "DASHBOARD",
  workers: "WORKERS",
  "worker-detail": "WORKER DETAIL",
  "trade-monitor": "TRADES",
  "logs-viewer": "LOGS",
  "service-manager": "SERVICES",
  "config-editor": "CONFIG",
  "setup-wizard": "SETUP",
  settings: "SETTINGS",
  "queue-depth": "QUEUES",
  "kv-viewer": "KV",
  "secrets-viewer": "SECRETS",
  "db-query": "DB QUERY",
  "ai-chat": "AI CHAT",
  "edge-topology": "TOPOLOGY",
  "worker-settings": "W SETTINGS",
};

export type ModalType = "confirm" | "choice" | "loading" | "prompt";

export interface ModalState {
  type: ModalType;
  id: string;
  title?: string;
  message?: string;
  resolve?: (value: unknown) => void;
}

export interface ShortcutMap {
  [keys: string]: string;
}

export const DEFAULT_SHORTCUTS: ShortcutMap = {
  "Ctrl+1": "DASHBOARD",
  "Ctrl+2": "WORKERS",
  "Ctrl+3": "WORKER DETAIL",
  "Ctrl+4": "TRADES",
  "Ctrl+5": "LOGS",
  "Ctrl+6": "SERVICES",
  "Ctrl+7": "CONFIG",
  "Ctrl+8": "SETUP",
  "Ctrl+9": "SETTINGS",
  "Ctrl+0": "QUEUES",
  "Ctrl+Alt+K": "KV",
  "Ctrl+Alt+S": "SECRETS",
  "Ctrl+Alt+C": "AI CHAT",
  "Ctrl+Alt+Q": "DB QUERY",
  "Ctrl+Alt+E": "TOPOLOGY",
  "Ctrl+Alt+W": "W SETTINGS",
  "Ctrl+P": "COMMAND PALETTE",
  "Ctrl+B": "TOGGLE SIDEBAR",
  "Ctrl+R": "REFRESH DATA",
  "Ctrl+Q": "QUIT",
  "Ctrl+Shift+D": "ERROR DIAGNOSTICS",
  Esc: "BACK / CLOSE",
  Tab: "NEXT FOCUS",
  "Shift+Tab": "PREVIOUS FOCUS",
  Space: "TOGGLE / PAUSE",
  "/": "SEARCH",
  Enter: "SELECT / CONFIRM",
};

// ─── CliBridge Types ─────────────────────────────────────────────

export interface CliResult<T = unknown> {
  success: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
  data: T | null;
  duration: number;
  /**
   * The full command string that was executed, e.g. `"hoox check health"`.
   * Captured by `cli-bridge.exec()` so the status bar can show exactly
   * which command failed. Empty string when the binary itself was not found.
   */
  command: string;
  /**
   * Classification of the failure, or `null` on success.
   * Drives the icon and recovery hint shown in the expanded error panel.
   */
  errorType: CliErrorType | null;
}

export type CliCommandStatus = "idle" | "running" | "success" | "failure";

export interface CliCommandState {
  tag: string;
  description: string;
  status: CliCommandStatus;
  result: CliResult | null;
  startedAt: number | null;
}
