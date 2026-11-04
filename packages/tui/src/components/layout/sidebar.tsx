/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { Colors, useUIStore } from "@hoox-sh/hoox-shared";
import { useTerminalDimensions } from "@opentui/react";
import { SIDEBAR_ITEMS } from "../../view-registry";
import { HooxMark, HooxWordmark } from "../shared/hoox-mark";
import { AnimatedRule, OrbitSpinner, ShimmerText } from "../shared/motion";

/** Fixed sidebar width (columns). */
export const SIDEBAR_WIDTH = 24;

/**
 * Sidebar — frameless left rail.
 *
 * The dotted HOOX mark anchors the top; the nav list sits directly on the
 * terminal background (no border, no card fill). Shortcut hints come from the
 * view registry so the rail can never drift from the keyboard map.
 */
export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const setView = useUIStore((s) => s.setView);
  const dims = useTerminalDimensions();
  const height = dims?.height ?? 24;

  if (!sidebarExpanded) return null;

  // Very short terminals: drop the legend, then the wordmark, then shrink
  // the mark so the navigation list stays usable.
  const showLegend = height >= 27;
  const showWordmark = height >= 24;

  return (
    <box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      paddingLeft={1}
      paddingRight={1}
      gap={0}
      backgroundColor={Colors.background}
    >
      {/* Brand: dotted logo + live heartbeat */}
      <HooxMark size="xs" animated />
      {showWordmark ? (
        <box flexDirection="row" gap={1} alignItems="center">
          <OrbitSpinner variant="breathe" />
          <HooxWordmark />
        </box>
      ) : null}
      <AnimatedRule width={SIDEBAR_WIDTH - 2} />

      {/* Navigation items (registry order) — frameless rows */}
      {SIDEBAR_ITEMS.map((item) => {
        const isActive = item.id === activeView;
        return (
          <box
            flexDirection="row"
            gap={1}
            key={item.id}
            justifyContent="space-between"
          >
            <box flexDirection="row" gap={1} flexGrow={1}>
              <text fg={isActive ? Colors.accent : Colors.dim}>
                {isActive ? "▸" : " "}
              </text>
              {isActive ? (
                <text
                  fg={Colors.accent}
                  bold
                  onMouseUp={() => setView(item.id)}
                >
                  {item.label}
                </text>
              ) : (
                <text fg={Colors.muted} onMouseUp={() => setView(item.id)}>
                  {item.label}
                </text>
              )}
            </box>
            <text fg={Colors.dim} dim>
              {item.shortcut}
            </text>
          </box>
        );
      })}

      {/* Legend */}
      <box flexGrow={1} />
      {showLegend ? (
        <box flexDirection="column">
          <AnimatedRule width={SIDEBAR_WIDTH - 2} />
          <ShimmerText text="^B hide · ^P cmd" baseColor={Colors.dim} />
        </box>
      ) : null}
    </box>
  );
}
