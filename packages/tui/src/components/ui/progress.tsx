/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { Colors } from "@hoox-sh/hoox-shared";

export interface ProgressBarProps {
  current: number;
  total: number;
  width?: number;
  label?: string;
}

/** Compact █░ bar using the active theme accent. */
export function ProgressBar({
  current,
  total,
  width = 24,
  label,
}: ProgressBarProps) {
  const ratio = total > 0 ? Math.min(Math.max(current / total, 0), 1) : 0;
  const filled = Math.round(width * ratio);
  const empty = Math.max(0, width - filled);
  const pct = Math.round(ratio * 100);
  return (
    <box flexDirection="row" gap={1} alignItems="center">
      <text fg={Colors.accent}>{"█".repeat(filled)}</text>
      <text fg={Colors.dim}>{"░".repeat(empty)}</text>
      <text fg={Colors.muted}>{`${pct}%`}</text>
      {label ? <text fg={Colors.dim}>{label}</text> : null}
    </box>
  );
}
