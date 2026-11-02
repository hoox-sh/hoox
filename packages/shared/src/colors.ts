/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Color tokens for CLI + TUI.
 *
 * Family packs from the hoox.sh landing page (`data-color-pack`) and AXIS VOID:
 *   signal — HOOX orange  (`oklch(0.7 0.2 45)` / mesh #F38020)
 *   volt   — PYNE lime    (`oklch(0.88 0.22 125)` / #B7EF09)
 *   void   — AXIS indigo  (`oklch(0.74 0.16 277)` / VOID #8B9CFF)
 */

export const THEME_IDS = ["signal", "volt", "void"] as const;
export type ThemeId = (typeof THEME_IDS)[number];
export const DEFAULT_THEME: ThemeId = "signal";

export const THEME_LABELS: Record<ThemeId, string> = {
  signal: "Signal",
  volt: "Volt",
  void: "Void",
};

export const THEME_HINTS: Record<ThemeId, string> = {
  signal: "HOOX · orange (default)",
  volt: "PYNE · electric lime",
  void: "AXIS · indigo",
};

export type ColorTokens = {
  background: string;
  foreground: string;
  card: string;
  border: string;
  muted: string;
  "muted-foreground": string;
  dim: string;
  accent: string;
  "accent-dim": string;
  success: string;
  warning: string;
  error: string;
  info: string;
  text: string;
  "text-muted": string;
  panel: string;
  divider: string;
  highlight: string;
  backdrop: string;
};

export type ColorKey = keyof ColorTokens;

/** Map legacy config values onto a ThemeId. */
export function migrateThemeId(raw: unknown): ThemeId {
  if (raw === "signal" || raw === "orange" || raw === "dark" || raw === "hoox")
    return "signal";
  if (raw === "volt" || raw === "lime" || raw === "pyne") return "volt";
  if (
    raw === "void" ||
    raw === "indigo" ||
    raw === "rail" ||
    raw === "axis" ||
    raw === "light"
  )
    return "void";
  return DEFAULT_THEME;
}

export function isThemeId(raw: unknown): raw is ThemeId {
  return (
    typeof raw === "string" && (THEME_IDS as readonly string[]).includes(raw)
  );
}

/** HOOX Signal — landing `data-color-pack="signal"`, mesh badge #F38020. */
const SIGNAL: ColorTokens = {
  background: "#141414",
  foreground: "#EEEEEE",
  card: "#1C1C1C",
  border: "#2E2E2E",
  muted: "#868686",
  "muted-foreground": "#7A7A7A",
  dim: "#484848",
  accent: "#F38020",
  "accent-dim": "#C45F12",
  success: "#46B250",
  warning: "#EEBC4A",
  error: "#E64343",
  info: "#00B7C1",
  text: "#EEEEEE",
  "text-muted": "#868686",
  panel: "#1C1C1C",
  divider: "#2E2E2E",
  highlight: "#FE6A00",
  backdrop: "#000000",
};

/** PYNE Volt — landing `data-color-pack="volt"`, accent #B7EF09. */
const VOLT: ColorTokens = {
  background: "#12140F",
  foreground: "#EEEEEE",
  card: "#1A1C15",
  border: "#3D3E37",
  muted: "#9E9F98",
  "muted-foreground": "#8A8B84",
  dim: "#55564E",
  accent: "#B7EF09",
  "accent-dim": "#8BB80A",
  success: "#46B250",
  warning: "#EBA941",
  error: "#E7000B",
  info: "#00B7C1",
  text: "#EEEEEE",
  "text-muted": "#9E9F98",
  panel: "#1A1C15",
  divider: "#3D3E37",
  highlight: "#D4FF4A",
  backdrop: "#000000",
};

/** AXIS Void — landing `data-color-pack="void"` + AXIS VOID tokens. */
const VOID: ColorTokens = {
  background: "#07080C",
  foreground: "#E8EAEE",
  card: "#0C0E14",
  border: "#1C2230",
  muted: "#9AA3B2",
  "muted-foreground": "#7A8494",
  dim: "#53555C",
  accent: "#8B9CFF",
  "accent-dim": "#6B7AE0",
  success: "#3DDC97",
  warning: "#E8B84A",
  error: "#F07178",
  info: "#6EC8D4",
  text: "#E8EAEE",
  "text-muted": "#9AA3B2",
  panel: "#0C0E14",
  divider: "#1C2230",
  highlight: "#A7B4FF",
  backdrop: "#000000",
};

export const THEME_PALETTES: Record<ThemeId, ColorTokens> = {
  signal: SIGNAL,
  volt: VOLT,
  void: VOID,
};

const SIGNAL_BRACKETS = [
  "#F38020",
  "#FE6A00",
  "#EEBC4A",
  "#F38020",
  "#C45F12",
  "#FE6A00",
] as const;

const VOLT_BRACKETS = [
  "#B7EF09",
  "#D4FF4A",
  "#8BB80A",
  "#B7EF09",
  "#EBA941",
  "#D4FF4A",
] as const;

const VOID_BRACKETS = [
  "#8B9CFF",
  "#A7B4FF",
  "#6EC8D4",
  "#8B9CFF",
  "#3DDC97",
  "#A7B4FF",
] as const;

const BRACKETS: Record<ThemeId, readonly string[]> = {
  signal: SIGNAL_BRACKETS,
  volt: VOLT_BRACKETS,
  void: VOID_BRACKETS,
};

let activeTheme: ThemeId = DEFAULT_THEME;

export function getActiveTheme(): ThemeId {
  return activeTheme;
}

export function getPalette(id: ThemeId = activeTheme): ColorTokens {
  return THEME_PALETTES[id];
}

/**
 * Live color table. Mutated in place by `setActiveTheme` so existing
 * `Colors.accent` imports pick up the new palette on the next read.
 */
export const Colors: ColorTokens = { ...SIGNAL };

/** Animated bracket hues for the active theme (live binding). */
export let CoolBracketPalette: readonly string[] = SIGNAL_BRACKETS;
export type CoolBracketColor = (typeof SIGNAL_BRACKETS)[number] | string;

export function setActiveTheme(id: ThemeId): ThemeId {
  activeTheme = id;
  Object.assign(Colors, THEME_PALETTES[id]);
  CoolBracketPalette = BRACKETS[id];
  return activeTheme;
}

export const ConnectionStatusColor = {
  get connected() {
    return Colors.success;
  },
  get polling() {
    return Colors.highlight;
  },
  get reconnecting() {
    return Colors.warning;
  },
  get offline() {
    return Colors.error;
  },
} as const;

export type ConnectionStatusKey = keyof typeof ConnectionStatusColor;

export const WorkerStatusColor = {
  get operational() {
    return Colors.success;
  },
  get degraded() {
    return Colors.warning;
  },
  get down() {
    return Colors.error;
  },
} as const;

export type WorkerStatusKey = keyof typeof WorkerStatusColor;

export const LogLevelColor = {
  get error() {
    return Colors.error;
  },
  get warn() {
    return Colors.warning;
  },
  get info() {
    return Colors.foreground;
  },
  get debug() {
    return Colors.muted;
  },
} as const;

export type LogLevelColorKey = keyof typeof LogLevelColor;

export const AlertSeverityColor = {
  get info() {
    return Colors.info;
  },
  get warning() {
    return Colors.warning;
  },
  get error() {
    return Colors.error;
  },
  get critical() {
    return Colors.error;
  },
} as const;

export type AlertSeverityColorKey = keyof typeof AlertSeverityColor;

/** Braille spinner frames (CLI + TUI). */
export const SPINNER_FRAMES = [
  "⠋",
  "⠙",
  "⠹",
  "⠸",
  "⠼",
  "⠴",
  "⠦",
  "⠧",
  "⠇",
  "⠏",
] as const;

/** Step-status glyphs for microfeedback. */
export const STEP_GLYPH = {
  pending: "○",
  running: "◐",
  done: "●",
  failed: "✗",
} as const;

/** Pulse wave used by the Signal banner / progress chrome. */
export const PULSE_FRAMES = [
  "▁▂▃▅▃▂▁",
  "▂▃▅▃▂▁▂",
  "▃▅▃▂▁▂▃",
  "▅▃▂▁▂▃▅",
  "▃▂▁▂▃▅▃",
  "▂▁▂▃▅▃▂",
] as const;
