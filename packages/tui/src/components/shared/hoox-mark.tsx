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
 */
import { Colors } from "@hoox-sh/hoox-shared";
import { useMotionTick } from "./motion";

/** 11 cols × 4 rows — sidebar rail / very tight layouts. */
export const HOOX_MARK_TINY = [
  " ⢶⣶⡄   ⢠⣶⡶",
  " ⣠⣭⣅⢀⣤⡀⣨⣭⣄",
  " ⠙⣛⡋⠈⠛⠁⢙⣛⠋",
  " ⠾⠿⠃   ⠘⠿⠷",
] as const;

/** 10 cols × 6 rows — sidebar / narrow terminals. */
export const HOOX_MARK_SMALL = [
  " ⣶⣦⡀   ⢀⣴⣶",
  " ⠙⢿⡇   ⢸⡿⠋",
  " ⣤⣤⣄⢀⣶⡀⣠⣤⣤",
  " ⠛⠛⠋⠈⠿⠁⠙⠛⠛",
  " ⣠⣾⡇   ⢸⣷⣄",
  " ⠿⠟⠁   ⠈⠻⠿",
] as const;

/** 12 cols × 8 rows — launcher hero / wide terminals. */
export const HOOX_MARK_MEDIUM = [
  " ⢠⣤⡀     ⢀⣤⡄",
  " ⠸⣿⣿⡆   ⢰⣿⣿⠇",
  "  ⠘⠛⠃   ⠘⠛⠋",
  " ⣴⣶⣶⡄⣠⣿⣄⢠⣶⣶⣦",
  " ⠻⠿⠿⠋⠙⣿⠋⠙⠿⠿⠟",
  "  ⢠⣤⡄   ⢠⣤⡄",
  " ⢰⣿⣿⠇   ⠸⣿⣿⣆",
  " ⠘⠛⠁     ⠈⠛⠃",
] as const;

export type HooxMarkSize = "xs" | "sm" | "md";

export interface HooxMarkProps {
  size?: HooxMarkSize;
  /** Fixed dot colour. Defaults to the theme accent. */
  color?: string;
  /** Slowly cycle accent → highlight → warning across the dot rows. */
  animated?: boolean;
  /** Milliseconds per colour phase. */
  speedMs?: number;
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

const MARK_PALETTE = () => [Colors.accent, Colors.highlight, Colors.warning];

/**
 * HooxMark — dotted logo block.
 *
 * `animated` shifts the dot colour in a slow diagonal wave. The glyphs never
 * change shape, so the logo stays recognisable while it breathes.
 */
export function HooxMark({
  size = "sm",
  color,
  animated = false,
  speedMs = 700,
}: HooxMarkProps) {
  const tick = useMotionTick(speedMs, animated);
  const rows = hooxMarkRows(size);
  const width = hooxMarkWidth(size);
  const palette = MARK_PALETTE();

  return (
    <box flexDirection="column">
      {rows.map((row, index) => {
        const fg =
          color ??
          (animated
            ? (palette[(tick + Math.floor(index / 2)) % palette.length] ??
              Colors.accent)
            : Colors.accent);
        return (
          <text key={index} fg={fg}>
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
  /** Use the accent for "OX" instead of the foreground colour. */
  accentOx?: boolean;
}

/** HO + OX wordmark — muted first half, bright second half. */
export function HooxWordmark({ tagline, accentOx = true }: HooxWordmarkProps) {
  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text>
        <span fg={Colors.muted}>HO</span>
        <span fg={accentOx ? Colors.accent : Colors.foreground} bold>
          OX
        </span>
      </text>
      {tagline ? (
        <text fg={Colors.dim} dim>
          {tagline}
        </text>
      ) : null}
    </box>
  );
}
