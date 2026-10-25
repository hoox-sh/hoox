/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Decide whether "rich" terminal output is appropriate.
 *
 * Rich output (spinners, progress bars, color, badges) is suppressed when:
 *   1. `--json` is set (script consumers expect machine output).
 *   2. `--quiet` is set (user asked for minimal output).
 *   3. `--no-color` is set (explicit color override).
 *   4. `NO_COLOR` env var is set (https://no-color.org standard).
 *   5. `TERM=dumb` (terminal doesn't support ANSI).
 *   6. stdout is not a TTY (piped, redirected, CI).
 *
 * Centralising this check keeps every formatter honest: any caller can
 * ask "is rich mode right now?" and get the same answer.
 */

import * as clack from "@clack/prompts";
import type { FormatOptions } from "./formatters.js";

/**
 * True when spinners, color, and progress chrome may write to the terminal.
 * False for `--json`, `--quiet`, `--no-color`, `NO_COLOR`, `TERM=dumb`, or a non-TTY.
 */
export function isRichMode(opts?: FormatOptions): boolean {
  if (opts?.json || opts?.quiet || opts?.noColor) return false;
  if (process.env.NO_COLOR) return false;
  if (process.env.TERM === "dumb") return false;
  // In test environments, process.stdout.isTTY is usually undefined.
  // Treat undefined as "not a TTY" so we never accidentally emit ansi
  // codes into captured test output.
  return Boolean(process.stdout.isTTY);
}

/** Minimal spinner surface used by CLI commands. */
export interface CliSpinner {
  start: (msg?: string) => void;
  stop: (msg?: string) => void;
  message: (msg?: string) => void;
}

const NOOP_SPINNER: CliSpinner = {
  start() {},
  stop() {},
  message() {},
};

/**
 * Clack spinner that stays off `--json` / `--quiet` stdout.
 * Human non-TTY (tests, CI) still prints `stop()` lines so progress is visible.
 */
export function createCliSpinner(opts?: FormatOptions): CliSpinner {
  if (opts?.json || opts?.quiet) return NOOP_SPINNER;
  if (isRichMode(opts)) {
    const s = clack.spinner();
    return {
      start: (msg) => s.start(msg),
      stop: (msg) => s.stop(msg),
      message: (msg) => s.message(msg),
    };
  }
  return {
    start() {},
    stop(msg) {
      if (msg) process.stdout.write(`${msg}\n`);
    },
    message() {},
  };
}
