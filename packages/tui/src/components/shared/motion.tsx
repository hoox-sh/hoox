/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Motion primitives for the HOOX CLI shell.
 *
 * A tiny, dependency-free animation kit in the spirit of the Grok CLI:
 * orbiting dot spinners, shimmering labels, travelling rule markers and
 * breathing glyphs. Every animation degrades to a static frame under the
 * test renderer (`IS_REACT_ACT_ENVIRONMENT`) so component tests stay quiet.
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

/** Shared animation clock. Returns a monotonically increasing frame index. */
export function useMotionTick(intervalMs = 90, enabled = true): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!enabled || isMotionMuted()) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);

  return tick;
}

// ─── Orbit spinner ──────────────────────────────────────────────────────────

/** Single dot orbiting the 8 braille positions — a comet, not a wheel. */
export const ORBIT_FRAMES = ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"] as const;

/** Classic braille wheel, kept for callers that want a denser spinner. */
export const WHEEL_FRAMES = [
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

/** Breathing dot — changes size as well as colour. */
export const BREATHE_FRAMES = ["·", "•", "●", "•"] as const;

export type SpinnerVariant = "orbit" | "wheel" | "breathe";

export interface SpinnerProps {
  label?: string;
  /** Override the cycling colour with a fixed one. */
  color?: string;
  variant?: SpinnerVariant;
  /** Milliseconds per frame. */
  speedMs?: number;
  enabled?: boolean;
}

function framesFor(variant: SpinnerVariant): readonly string[] {
  if (variant === "wheel") return WHEEL_FRAMES;
  if (variant === "breathe") return BREATHE_FRAMES;
  return ORBIT_FRAMES;
}

function spinnerColor(frame: number): string {
  const palette = [
    Colors.accent,
    Colors.highlight,
    Colors.warning,
    Colors.accent,
    Colors.info,
    Colors.accent,
    Colors.highlight,
    Colors["accent-dim"],
  ];
  return palette[frame % palette.length] ?? Colors.accent;
}

/**
 * OrbitSpinner — compact animated loader.
 *
 * Frame, colour and (for `breathe`) glyph size change as it runs, which is
 * the little "alive" signal the shell uses while commands or data load.
 */
export function OrbitSpinner({
  label,
  color,
  variant = "orbit",
  speedMs = 90,
  enabled = true,
}: SpinnerProps) {
  const tick = useMotionTick(speedMs, enabled);
  const frames = framesFor(variant);
  const glyph = frames[tick % frames.length] ?? frames[0];
  const fg = color ?? spinnerColor(tick);

  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={fg}>{glyph}</text>
      {label ? (
        <text fg={Colors.muted} dim>
          {label}
        </text>
      ) : null}
    </box>
  );
}

// ─── Shimmer text ───────────────────────────────────────────────────────────

export interface ShimmerTextProps {
  text: string;
  baseColor?: string;
  highlightColor?: string;
  /** Width of the moving highlight window, in characters. */
  window?: number;
  speedMs?: number;
  enabled?: boolean;
  bold?: boolean;
}

/**
 * ShimmerText — a highlight sweeps across the label, Grok-style.
 * Character content is always preserved so tests can still match text.
 */
export function ShimmerText({
  text,
  baseColor = Colors.muted,
  highlightColor = Colors.accent,
  window = 5,
  speedMs = 80,
  enabled = true,
  bold = false,
}: ShimmerTextProps) {
  const tick = useMotionTick(speedMs, enabled);
  const chars = Array.from(text);
  const span = Math.max(1, Math.floor(window));
  const head = chars.length > 0 ? (tick % (chars.length + span)) - span : -span;

  return (
    <text>
      {chars.map((ch, i) => {
        const hot = Math.abs(i - head) <= Math.floor(span / 2);
        return (
          <span
            key={`${i}-${ch}`}
            fg={hot ? highlightColor : baseColor}
            bold={hot || bold}
          >
            {ch}
          </span>
        );
      })}
    </text>
  );
}

// ─── Animated rule ──────────────────────────────────────────────────────────

export interface AnimatedRuleProps {
  width?: number;
  color?: string;
  pulseColor?: string;
  char?: string;
  pulse?: string;
  speedMs?: number;
  enabled?: boolean;
}

/**
 * AnimatedRule — a thin divider with a marker travelling along it.
 * Doubles as the frameless separator between shell regions.
 */
export function AnimatedRule({
  width = 24,
  color = Colors.border,
  pulseColor = Colors.accent,
  char = "─",
  pulse = "◆",
  speedMs = 110,
  enabled = true,
}: AnimatedRuleProps) {
  const tick = useMotionTick(speedMs, enabled);
  const cells = Math.max(1, Math.floor(width));
  const pos = tick % cells;
  const prefix = char.repeat(pos);
  const suffix = char.repeat(Math.max(0, cells - pos - 1));

  return (
    <text>
      <span fg={color}>{prefix}</span>
      <span fg={pulseColor}>{pulse}</span>
      <span fg={color}>{suffix}</span>
    </text>
  );
}

// ─── Breathing glyph ────────────────────────────────────────────────────────

export interface BreatheGlyphProps {
  color?: string;
  accentColor?: string;
  speedMs?: number;
  enabled?: boolean;
}

/**
 * BreatheGlyph — a dot that grows and shrinks (· → • → ● → •).
 * Used as the connection heartbeat in the status line.
 */
export function BreatheGlyph({
  color = Colors.accent,
  accentColor = Colors.highlight,
  speedMs = 420,
  enabled = true,
}: BreatheGlyphProps) {
  const tick = useMotionTick(speedMs, enabled);
  const glyph = BREATHE_FRAMES[tick % BREATHE_FRAMES.length] ?? "●";
  const fg =
    tick % (BREATHE_FRAMES.length * 2) < BREATHE_FRAMES.length
      ? color
      : accentColor;
  return <text fg={fg}>{glyph}</text>;
}
