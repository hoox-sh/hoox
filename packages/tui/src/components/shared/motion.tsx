/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Mechanical motion primitives for the HOOX CLI.
 *
 * Deliberately restrained: a discrete four-frame index spinner and a static
 * hairline rule. No colour cycling, no shimmer, no travelling markers. The
 * only entrance animation lives in the logo itself (`HooxMark` gradient).
 */
import { useEffect, useState } from "react";
import { Colors } from "@hoox-sh/hoox-shared";

/** True while rendering under the OpenTUI test harness. */
export function isMotionMuted(): boolean {
  return (
    (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean })
      .IS_REACT_ACT_ENVIRONMENT === true ||
    process.env.BUN_TEST === "1" ||
    process.env.NODE_ENV === "test"
  );
}

/** Shared clock. Returns a monotonically increasing frame index. */
export function useMotionTick(intervalMs = 160, enabled = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || isMotionMuted()) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return tick;
}

/**
 * Finite counter used for one-shot entrances. Counts to `max` then stops —
 * no loop, no ambient motion.
 */
export function useCountUp(
  max: number,
  intervalMs = 55,
  enabled = true
): number {
  const [value, setValue] = useState(enabled ? 0 : max);

  useEffect(() => {
    if (!enabled || isMotionMuted()) {
      setValue(max);
      return;
    }
    setValue(0);
    let current = 0;
    const id = setInterval(() => {
      current += 1;
      setValue(current);
      if (current >= max) clearInterval(id);
    }, intervalMs);
    return () => clearInterval(id);
  }, [max, intervalMs, enabled]);

  return value;
}

// ─── Mechanical spinner ─────────────────────────────────────────────────────

/**
 * Four discrete quadrant blocks. Reads as an indexing mechanism, not a
 * rainbow loader. Colour is fixed for the lifetime of the component.
 */
export const MECHANICAL_FRAMES = ["▖", "▘", "▝", "▗"] as const;

export interface MechanicalSpinnerProps {
  /** Uppercase status label rendered after the glyph. */
  label?: string;
  /** Fixed colour (defaults to the theme accent). */
  color?: string;
  /** Milliseconds per quadrant. */
  speedMs?: number;
  enabled?: boolean;
}

export function MechanicalSpinner({
  label,
  color = Colors.accent,
  speedMs = 150,
  enabled = true,
}: MechanicalSpinnerProps) {
  const tick = useMotionTick(speedMs, enabled);
  const glyph = MECHANICAL_FRAMES[tick % MECHANICAL_FRAMES.length] ?? "▖";

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={color}>{glyph}</text>
      {label ? (
        <text fg={Colors.muted} dim>
          {label.toUpperCase()}
        </text>
      ) : null}
    </box>
  );
}

// ─── Static rule ────────────────────────────────────────────────────────────

export interface RuleProps {
  width?: number;
  color?: string;
  /** Leading heavy accent segment (default on). */
  accent?: boolean;
  accentColor?: string;
  /** Width of the accent segment in cells. */
  accentWidth?: number;
  char?: string;
  accentChar?: string;
}

/**
 * Rule — a static hairline with a short heavy accent block at the left.
 * This is the only divider in the shell; it never moves.
 */
export function Rule({
  width = 24,
  color = Colors.border,
  accent = true,
  accentColor = Colors.accent,
  accentWidth = 2,
  char = "─",
  accentChar = "━",
}: RuleProps) {
  const cells = Math.max(1, Math.floor(width));
  const heavy = accent ? Math.min(cells, Math.max(0, accentWidth)) : 0;

  return (
    <text>
      {heavy > 0 ? (
        <span fg={accentColor}>{accentChar.repeat(heavy)}</span>
      ) : null}
      <span fg={color}>{char.repeat(Math.max(0, cells - heavy))}</span>
    </text>
  );
}
