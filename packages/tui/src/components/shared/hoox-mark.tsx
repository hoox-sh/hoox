/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * HOOX mark — the official five-path logo rendered as a braille dot matrix.
 *
 * The shape is rasterised from the production SVG (corner blocks, side
 * hexagons and the centre diamond) into braille cells, so every "pixel" is a
 * real terminal dot. Two sizes are provided for the compact shell rails.
 *
 * On startup the rows light up sequentially with a dim → foreground ramp,
 * then settle to the terminal's default text colour. No looping animation.
 */
import { isMotionMuted, useCountUp } from "./motion";

/** 10 cols × 4 rows — sidebar rail / very tight layouts. */
export const HOOX_MARK_TINY = [
  "⠸⣿⣶    ⣴⣿⠇",
  "⢀⣬⣭⡀⣠⣄⢀⣭⣥⡀",
  "⠈⢛⣛⠁⠙⠋⠈⣛⡛⠁",
  "⢰⣿⠿    ⠿⣿⡆",
] as const;

/** 10 cols × 5 rows — sidebar / narrow terminals. */
export const HOOX_MARK_SMALL = [
  "⠸⣿⣦    ⣴⣿⡇",
  " ⠙⠛    ⠛⠋ ",
  "⢾⣿⣿⠆⢾⡷⠰⣿⣿⡷",
  " ⣠⣤    ⣤⣄ ",
  "⢰⣿⠟    ⠻⣿⡆",
] as const;

/** 12 cols × 6 rows — launcher hero / wide terminals. */
export const HOOX_MARK_MEDIUM = [
  "⢸⣿⣷⣄    ⢠⣾⣿⡇",
  " ⠙⠿⠿    ⠿⠿⠋ ",
  "⣠⣶⣶⣆⢀⣴⣦⡀⣰⣶⣶⣄",
  "⠙⠿⠿⠏⠈⠻⠟⠁⠹⠿⠿⠋",
  " ⣠⣶⣶    ⣶⣶⣄ ",
  "⢸⣿⡿⠋    ⠙⢿⣿⡇",
] as const;

export type HooxMarkSize = "xs" | "sm" | "md";

export interface HooxMarkProps {
  size?: HooxMarkSize;
  /** Explicit dot colour. Omit to inherit the terminal foreground. */
  color?: string;
  /** Dim → default-foreground reveal while the rows light up (default on). */
  gradient?: boolean;
  /** One-shot row-by-row reveal on mount (default on). */
  reveal?: boolean;
  /** Milliseconds per row. */
  speedMs?: number;
  /** Milliseconds to hold the reveal before settling. */
  holdMs?: number;
}

export function hooxMarkRows(size: HooxMarkSize = "sm"): readonly string[] {
  if (size === "md") return HOOX_MARK_MEDIUM;
  if (size === "xs") return HOOX_MARK_TINY;
  return HOOX_MARK_SMALL;
}

export function hooxMarkWidth(size: HooxMarkSize = "sm"): number {
  return Math.max(...hooxMarkRows(size).map((row) => row.length));
}

export function hooxMarkHeight(size: HooxMarkSize = "sm"): number {
  return hooxMarkRows(size).length;
}

// ─── Startup reveal ─────────────────────────────────────────────────────────

/**
 * HooxMark — dotted logo block.
 *
 * By default the dots inherit the terminal foreground, so the mark is legible
 * on both light and dark backgrounds. `reveal` lights rows top-to-bottom with
 * a dim → default-foreground ramp, then settles. No colour, no loop.
 */
export function HooxMark({
  size = "sm",
  color,
  gradient = true,
  reveal = true,
  speedMs = 55,
  holdMs = 420,
}: HooxMarkProps) {
  const rows = hooxMarkRows(size);
  const width = hooxMarkWidth(size);
  const muted = isMotionMuted();
  const holdFrames = Math.max(1, Math.ceil(holdMs / speedMs));
  const total = rows.length + holdFrames;
  const tick = useCountUp(total, speedMs, reveal && !muted);
  const revealed = Math.min(tick, rows.length);
  const settled = tick >= total;

  return (
    <box flexDirection="column">
      {rows.map((row, index) => {
        const visible = index < revealed;
        const dim = !visible || (!settled && gradient && !color);
        return (
          <text key={index} fg={color} dim={dim}>
            {row.padEnd(width, " ")}
          </text>
        );
      })}
    </box>
  );
}

export interface HooxWordmarkProps {
  /** Optional tagline rendered after the wordmark. */
  tagline?: string;
}

/**
 * HO + OX wordmark — terminal foreground only: dim first half, bold second
 * half. No accent colour, so it tracks light/dark terminal themes.
 */
export function HooxWordmark({ tagline }: HooxWordmarkProps) {
  return (
    <box flexDirection="row" alignItems="center">
      <text dim>HO</text>
      <text bold>OX</text>
      {tagline ? <text dim>{` ${tagline.toUpperCase()}`}</text> : null}
    </box>
  );
}
