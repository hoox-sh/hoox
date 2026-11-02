/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hoox CLI theme — refined ansis palette + icon set.
 *
 * Visual identity is "modern minimal" (Vercel / Linear / Turborepo):
 *   - Muted zinc base for text
 *   - Single indigo accent (no cyan/magenta clash)
 *   - De-saturated status colors (emerald / rose / amber / sky)
 *   - No high-contrast background chips; badges use colored text
 *
 * Every public name from the previous theme is preserved; only the
 * values change. This is a visual-only refactor.
 */

import ansis from "ansis";
import {
  Colors,
  DEFAULT_THEME,
  migrateThemeId,
  setActiveTheme,
  type ThemeId,
} from "@hoox-sh/hoox-shared";

function paint() {
  const c = Colors;
  return {
    text: ansis.hex(c.foreground),
    textMuted: ansis.hex(c.muted),
    textSubtle: ansis.hex(c["muted-foreground"]),
    textFaint: ansis.hex(c.dim),

    border: ansis.hex(c.border),
    borderStrong: ansis.hex(c.dim),

    success: ansis.hex(c.success),
    error: ansis.hex(c.error),
    warning: ansis.hex(c.warning),
    info: ansis.hex(c.info),
    accent: ansis.hex(c.accent),
    highlight: ansis.hex(c.highlight),

    surface: ansis.hex(c.card),

    dim: ansis.hex(c.muted),
    bold: ansis.bold,
    italic: ansis.italic,
    underline: ansis.underline,
    gray: ansis.gray,
    white: ansis.white,
    black: ansis.black,
    heading: ansis.hex(c.accent).bold,
    label: ansis.hex(c["muted-foreground"]),
    subtle: ansis.hex(c["muted-foreground"]),
    muted: ansis.hex(c.dim),
    value: ansis.hex(c.foreground),
    key: ansis.hex(c["muted-foreground"]),

    statusOk: ansis.hex(c.success)("✓") + " " + ansis.hex(c.foreground)("ok"),
    statusWarn:
      ansis.hex(c.warning)("⚠") + " " + ansis.hex(c.foreground)("warn"),
    statusError:
      ansis.hex(c.error)("✗") + " " + ansis.hex(c.foreground)("error"),
    statusInfo: ansis.hex(c.info)("ℹ") + " " + ansis.hex(c.foreground)("info"),

    separator: ansis.hex(c.dim)("─"),
    pipe: ansis.hex(c.dim)("│"),
    box: {
      topLeft: ansis.hex(c.dim)("┌"),
      topRight: ansis.hex(c.dim)("┐"),
      bottomLeft: ansis.hex(c.dim)("└"),
      bottomRight: ansis.hex(c.dim)("┘"),
      horizontal: ansis.hex(c.dim)("─"),
      vertical: ansis.hex(c.dim)("│"),
    },
  };
}

/** Live ANSI theme — mutated by `applyCliTheme`. */
export const theme = paint();

/** Apply a named palette to CLI output (and the shared Colors table). */
export function applyCliTheme(raw: unknown): ThemeId {
  const id = migrateThemeId(raw ?? DEFAULT_THEME);
  setActiveTheme(id);
  Object.assign(theme, paint());
  return id;
}

// ── Icons ─────────────────────────────────────────────────────────
export const icons = {
  success: "✓",
  error: "✗",
  warning: "⚠",
  info: "ℹ",
  arrow: "→",
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  dot: "●",
  sep: "·",
  bullet: "•",
  pipe: "│",
  pending: "○",
  running: "◐",
  done: "●",
} as const;

// ── Display helpers ───────────────────────────────────────────────

/** Strip ANSI escape codes from a string. */
export function stripAnsi(str: string): string {
  return ansis.strip(str);
}

/** Render a horizontal rule using the separator character. */
export function hr(width: number = 60): string {
  return theme.separator.repeat(width);
}

/** Format a key-value pair for aligned output. */
export function kv(key: string, value: string): string {
  return `${theme.key(key)} ${theme.dim(":")} ${theme.value(value)}`;
}

/** Format a labeled value. */
export function tagged(label: string, value: string): string {
  return `${theme.key(label)} ${theme.dim(":")} ${theme.value(value)}`;
}
