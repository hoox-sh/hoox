/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * renderer-ref — Module-level singleton for the CLI renderer.
 *
 * Avoids circular imports between main.ts and hooks.
 */
import type { CliRenderer } from "@opentui/core";

let _renderer: CliRenderer | null = null;

/** Install (or clear with `null`) the process-wide CLI renderer singleton. */
export function setRendererRef(renderer: CliRenderer | null): void {
  _renderer = renderer;
}

/** Current CLI renderer, or `null` before `setRendererRef` / after teardown. */
export function getRendererRef(): CliRenderer | null {
  return _renderer;
}
