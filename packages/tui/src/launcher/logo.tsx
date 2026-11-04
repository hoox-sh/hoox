/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Launcher logo — thin wrapper around the dotted HOOX mark.
 *
 * Kept as a stable import point for the start screen; the canonical mark
 * lives in `components/shared/hoox-mark.tsx`.
 */
import {
  HooxMark,
  HooxWordmark,
  hooxMarkHeight,
  hooxMarkWidth,
} from "../components/shared/hoox-mark";

export const LOGO_WIDTH = hooxMarkWidth("sm");
export const LOGO_HEIGHT = hooxMarkHeight("sm");

export function HooxLogo({ compact = false }: { compact?: boolean }) {
  if (compact) return <HooxWordmark />;
  return <HooxMark size="sm" />;
}
