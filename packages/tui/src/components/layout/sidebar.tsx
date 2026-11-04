/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { Colors, useUIStore } from "@hoox-sh/hoox-shared";
import { useTerminalDimensions } from "@opentui/react";
import { SIDEBAR_ITEMS } from "../../view-registry";
import { HooxMark, HooxWordmark } from "../shared/hoox-mark";
import { Rule } from "../shared/motion";

/** Fixed sidebar width (columns). */
export const SIDEBAR_WIDTH = 24;

/**
 * Sidebar — frameless left rail.
 *
 * Editorial stack: dotted mark, wordmark, hairline, numbered nav. No border,
 * no card fill, no ambient animation. Shortcut hints come from the view
 * registry so the rail can never drift from the keyboard map.
 */
export function Sidebar() {
  const activeView = useUIStore((s) => s.activeView);
  const sidebarExpanded = useUIStore((s) => s.sidebarExpanded);
  const setView = useUIStore((s) => s.setView);
  const dims = useTerminalDimensions();
  const height = dims?.height ?? 24;

  if (!sidebarExpanded) return null;

  // Tight terminals shed chrome before the nav list.
  const showLegend = height >= 27;
  const showWordmark = height >= 24;
  const showMark = height >= 22;

  return (
    <box
      flexDirection="column"
      width={SIDEBAR_WIDTH}
      paddingLeft={1}
      paddingRight={1}
      gap={0}
    >
      {showMark ? (
        <>
          <HooxMark size="xs" />
          <text> </text>
        </>
      ) : null}
      {showWordmark ? <HooxWordmark /> : null}
      <Rule width={SIDEBAR_WIDTH - 2} />

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
                {isActive ? "▌" : " "}
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
                <text dim onMouseUp={() => setView(item.id)}>
                  {item.label}
                </text>
              )}
            </box>
            <text dim>{item.shortcut}</text>
          </box>
        );
      })}

      {/* Legend */}
      <box flexGrow={1} />
      {showLegend ? (
        <box flexDirection="column">
          <Rule width={SIDEBAR_WIDTH - 2} accent={false} />
          <text dim>^B HIDE ^P CMD</text>
        </box>
      ) : null}
    </box>
  );
}
