/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Symbol-based microfeedback for the CLI: ticks, pulse, progress.
 * Honors rich-mode (no animation on --json / --quiet / non-TTY).
 */

import { PULSE_FRAMES, SPINNER_FRAMES, STEP_GLYPH } from "@hoox-sh/hoox-shared";
import { theme } from "./theme.js";
import { isRichMode } from "./format-mode.js";
import { renderProgressBar, type FormatOptions } from "./formatters.js";

export { renderProgressBar };

export function spinnerFrame(tick: number): string {
  return SPINNER_FRAMES[tick % SPINNER_FRAMES.length] ?? SPINNER_FRAMES[0]!;
}

export function pulseFrame(tick: number): string {
  return PULSE_FRAMES[tick % PULSE_FRAMES.length] ?? PULSE_FRAMES[0]!;
}

export function stepGlyph(
  status: "pending" | "running" | "done" | "failed"
): string {
  const g = STEP_GLYPH[status];
  if (status === "done") return theme.success(g);
  if (status === "failed") return theme.error(g);
  if (status === "running") return theme.accent(g);
  return theme.dim(g);
}

/** One-line checklist row. */
export function feedbackRow(
  status: "pending" | "running" | "done" | "failed",
  label: string,
  opts?: { tick?: number }
): string {
  const mark =
    status === "running"
      ? theme.accent(spinnerFrame(opts?.tick ?? 0))
      : stepGlyph(status);
  return `  ${mark} ${status === "running" ? theme.text(label) : theme.textMuted(label)}`;
}

/** Overwrite-friendly progress line for sequential work. */
export function progressLine(
  current: number,
  total: number,
  label: string,
  opts?: FormatOptions
): string {
  if (!isRichMode(opts)) return `${label} (${current}/${total})`;
  return `${theme.accent(spinnerFrame(current))} ${label}  ${renderProgressBar(current, total)}`;
}

export function successTick(message: string): string {
  return `${theme.success("✓")} ${theme.text(message)}`;
}

export function warnTick(message: string): string {
  return `${theme.warning("⚠")} ${theme.text(message)}`;
}

export function errorTick(message: string): string {
  return `${theme.error("✗")} ${theme.text(message)}`;
}
