/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * OpenCode-style half-block wordmark: muted HO + bold OX.
 * 3 rows, ~23 cols. Hidden on very short terminals.
 */
import { Colors } from "@hoox-sh/hoox-shared";

const HO = ["█  █  █▀▀█", "█▀▀█  █  █", "█  █  █▄▄█"] as const;

const OX = ["  █▀▀█  █  █", "  █  █   ██ ", "  █▄▄█  █  █"] as const;

export const LOGO_WIDTH = 23;
export const LOGO_HEIGHT = 3;

export function HooxLogo({ compact = false }: { compact?: boolean }) {
  if (compact) {
    return (
      <box flexDirection="row" gap={1} alignItems="center">
        <text fg={Colors.muted}>HO</text>
        <text fg={Colors.foreground} bold>
          OX
        </text>
      </box>
    );
  }

  return (
    <box flexDirection="row" gap={1}>
      <box flexDirection="column">
        {HO.map((line) => (
          <text key={line} fg={Colors.muted}>
            {line}
          </text>
        ))}
      </box>
      <box flexDirection="column">
        {OX.map((line) => (
          <text key={line} fg={Colors.foreground} bold>
            {line}
          </text>
        ))}
      </box>
    </box>
  );
}
