/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Config Store — TUI user preferences persisted under
 * `$HOOX_HOME/.tui-state/preferences.json` (never operator `config.json`).
 *
 * Operator secrets (`apiToken`, transport, …) live in `~/.hoox/config.json`
 * via `config.ts` and must not share a write path with this store.
 *
 * Middleware ordering (innermost first → outermost last):
 *   1. immer           (enables mutable-style updates)
 *   2. persist         (saves/restores from disk)
 */
import { create } from "zustand";
import { immer } from "zustand/middleware/immer";
import { persist, createJSONStorage } from "zustand/middleware";
import type { StateStorage } from "zustand/middleware";
import { chmodSync, mkdirSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ViewId, LogFilter, NotificationPreferences } from "../types";
import { DEFAULT_THEME, migrateThemeId, type ThemeId } from "../colors";
import { HOOX_CONFIG_FILE_MODE, HOOX_DIR_MODE } from "../config";
import { getHooxHome } from "../path-utils";

// ─── Paths ───────────────────────────────────────────────────────────────────

/** TUI prefs file — isolated from operator config.json (which may hold apiToken). */
export function getTuiPreferencesPath(): string {
  return join(getHooxHome(), ".tui-state", "preferences.json");
}

/** Legacy path that accidentally shared the operator config file. */
function getLegacyConfigJsonPath(): string {
  return join(getHooxHome(), "config.json");
}

/**
 * Detect a Zustand-persist envelope written into config.json by older TUI
 * builds. Operator HooxConfig is a flat object (apiUrl/apiToken/…); the
 * persist envelope is `{ state: { theme, … }, version?: number }`.
 */
function extractZustandPrefsPayload(raw: string): string | null {
  try {
    const parsed = JSON.parse(raw) as {
      state?: Record<string, unknown>;
      version?: number;
    };
    if (
      parsed &&
      typeof parsed === "object" &&
      parsed.state &&
      typeof parsed.state === "object" &&
      !Array.isArray(parsed.state) &&
      // Heuristic: TUI prefs always have theme or refreshIntervalMs
      ("theme" in parsed.state || "refreshIntervalMs" in parsed.state) &&
      // Operator config has apiToken at top level — envelope does not
      !("apiToken" in parsed)
    ) {
      return raw;
    }
  } catch {
    // ignore
  }
  return null;
}

// ─── Custom Bun Filesystem Storage ───────────────────────────────────────────

/**
 * StateStorage adapter that persists TUI prefs to
 * `$HOOX_HOME/.tui-state/preferences.json`. The Zustand `name` key is ignored
 * — the file path is fixed. Migrates once from a mis-written Zustand envelope
 * in the legacy `config.json` path without overwriting operator secrets.
 */
const bunConfigStorage: StateStorage = {
  getItem: async (_name: string): Promise<string | null> => {
    try {
      const prefsPath = getTuiPreferencesPath();
      const prefsFile = Bun.file(prefsPath);
      if (await prefsFile.exists()) {
        return await prefsFile.text();
      }

      // One-shot migration: older builds wrote Zustand envelope into config.json
      const legacyPath = getLegacyConfigJsonPath();
      if (existsSync(legacyPath)) {
        const legacyRaw = readFileSync(legacyPath, "utf-8");
        const envelope = extractZustandPrefsPayload(legacyRaw);
        if (envelope) {
          // Persist to the correct location so setItem never touches config.json
          await bunConfigStorage.setItem(_name, envelope);
          return envelope;
        }
      }
      return null;
    } catch {
      return null;
    }
  },

  setItem: async (_name: string, value: string): Promise<void> => {
    const home = getHooxHome();
    const stateDir = join(home, ".tui-state");
    if (!existsSync(home)) {
      mkdirSync(home, { recursive: true, mode: HOOX_DIR_MODE });
    }
    if (!existsSync(stateDir)) {
      mkdirSync(stateDir, { recursive: true, mode: HOOX_DIR_MODE });
    }
    try {
      chmodSync(home, HOOX_DIR_MODE);
      chmodSync(stateDir, HOOX_DIR_MODE);
    } catch {
      // ignore — platform may not support chmod
    }
    const filePath = getTuiPreferencesPath();
    await Bun.write(filePath, value);
    try {
      chmodSync(filePath, HOOX_CONFIG_FILE_MODE);
    } catch {
      // ignore
    }
  },

  removeItem: async (_name: string): Promise<void> => {
    // Prefs are never removed — only reset to defaults
  },
};

// ─── Default Shortcuts ───────────────────────────────────────────────────────

const DEFAULT_SHORTCUTS: Record<string, string> = {
  "command-palette": "Ctrl+P",
  "toggle-sidebar": "Ctrl+B",
  "force-refresh": "Ctrl+R",
  quit: "Ctrl+Q",
  "view-1": "Ctrl+1",
  "view-2": "Ctrl+2",
  "view-3": "Ctrl+3",
  "view-4": "Ctrl+4",
  "view-5": "Ctrl+5",
  "view-6": "Ctrl+6",
  "view-7": "Ctrl+7",
  "view-8": "Ctrl+8",
  "view-9": "Ctrl+9",
  "view-10": "Ctrl+0",
};

// ─── Default Log Filters ─────────────────────────────────────────────────────

const DEFAULT_LOG_FILTER: LogFilter = {
  levels: ["info", "warn", "error"],
  workers: [], // empty = all workers
  searchText: "",
};

// ─── Default Notifications ───────────────────────────────────────────────────

const DEFAULT_NOTIFICATIONS: NotificationPreferences = {
  alerts: true,
  trades: false,
  debug: false,
  system: true,
};

// ─── State ───────────────────────────────────────────────────────────────────

export interface ConfigState {
  theme: ThemeId;
  refreshIntervalMs: number;
  defaultView: ViewId;
  activeExchanges: string[];
  keyboardShortcuts: Record<string, string>;
  logFilters: LogFilter;
  notifications: NotificationPreferences;
  soundEnabled: boolean;
}

// ─── Actions ─────────────────────────────────────────────────────────────────

interface ConfigActions {
  /** Merge partial config — only provided fields are updated. */
  updateConfig: (partial: Partial<ConfigState>) => void;
  /** Reset all settings to factory defaults. */
  resetDefaults: () => void;
  /** Update a single keyboard shortcut. */
  setShortcut: (action: string, key: string) => void;
  /** Toggle a specific notification channel. */
  toggleNotification: (channel: keyof NotificationPreferences) => void;
}

// ─── Default State (fallback when no saved config) ───────────────────────────

const defaults: ConfigState = {
  theme: DEFAULT_THEME,
  refreshIntervalMs: 500,
  defaultView: "dashboard",
  activeExchanges: [],
  keyboardShortcuts: { ...DEFAULT_SHORTCUTS },
  logFilters: { ...DEFAULT_LOG_FILTER },
  notifications: { ...DEFAULT_NOTIFICATIONS },
  soundEnabled: false,
};

// ─── Store ───────────────────────────────────────────────────────────────────

export const useConfigStore = create<ConfigState & ConfigActions>()(
  persist(
    immer((set) => ({
      ...defaults,

      updateConfig: (partial) =>
        set((state) => {
          // Merge each key individually so immer tracks mutations correctly
          if (partial.theme !== undefined)
            state.theme = migrateThemeId(partial.theme);
          if (partial.refreshIntervalMs !== undefined)
            state.refreshIntervalMs = partial.refreshIntervalMs;
          if (partial.defaultView !== undefined)
            state.defaultView = partial.defaultView;
          if (partial.activeExchanges !== undefined)
            state.activeExchanges = partial.activeExchanges;
          if (partial.keyboardShortcuts !== undefined)
            state.keyboardShortcuts = partial.keyboardShortcuts;
          if (partial.logFilters !== undefined)
            state.logFilters = partial.logFilters;
          if (partial.notifications !== undefined)
            state.notifications = partial.notifications;
          if (partial.soundEnabled !== undefined)
            state.soundEnabled = partial.soundEnabled;
        }),

      resetDefaults: () =>
        set((state) => {
          Object.assign(state, defaults);
        }),

      setShortcut: (action, key) =>
        set((state) => {
          state.keyboardShortcuts[action] = key;
        }),

      toggleNotification: (channel) =>
        set((state) => {
          state.notifications[channel] = !state.notifications[channel];
        }),
    })),
    {
      name: "hoox-tui-prefs",
      storage: createJSONStorage(() => bunConfigStorage),
      // Only persist these fields (exclude derived/computed if any added later)
      partialize: (state) => ({
        theme: state.theme,
        refreshIntervalMs: state.refreshIntervalMs,
        defaultView: state.defaultView,
        activeExchanges: state.activeExchanges,
        keyboardShortcuts: state.keyboardShortcuts,
        logFilters: state.logFilters,
        notifications: state.notifications,
        soundEnabled: state.soundEnabled,
      }),
      // Restore defaults for any missing keys from older schema versions
      merge: (persisted, current) => {
        const partial = persisted as Partial<ConfigState>;
        return {
          ...current,
          ...partial,
          theme: migrateThemeId(partial.theme ?? current.theme),
        };
      },
    }
  )
);
