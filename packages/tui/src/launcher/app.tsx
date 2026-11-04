/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Compact, frameless CLI start screen.
 *
 * Editorial layout: dotted mark rail on the left, a ruled status/menu/content
 * column on the right, command legend at the foot. Static by design — the
 * only entrance motion is the mark's one-shot gradient reveal.
 *
 * Keyboard-first: type to filter, ↑↓ to move, Enter to run, q/Esc to quit.
 */

import { useEffect, useMemo, useState } from "react";
import {
  useKeyboard,
  useRenderer,
  useTerminalDimensions,
} from "@opentui/react";
import type { KeyEvent } from "@opentui/react";
import { Colors } from "@hoox-sh/hoox-shared";
import { filterLauncherItems } from "./filter";
import type {
  LauncherCatalog,
  LauncherGroup,
  LauncherItem,
  LauncherResult,
} from "./types";
import {
  HooxMark,
  HooxWordmark,
  hooxMarkHeight,
  hooxMarkWidth,
  type HooxMarkSize,
} from "../components/shared/hoox-mark";
import { isMotionMuted, Rule } from "../components/shared/motion";

const LIST_MAX = 5;
const PLACEHOLDERS = [
  "hoox deploy all",
  "hoox tui",
  "hoox doctor",
  "hoox check setup",
];

export interface LauncherAppProps {
  catalog: LauncherCatalog;
  onResolve: (result: LauncherResult) => void;
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/**
 * Pick the groups that fit the menu budget in their natural order. If the
 * active group falls outside the visible slice, swap it into the last slot so
 * the highlighted command always has a visible home.
 */
function fitGroups(
  groups: LauncherGroup[],
  activeId: string | undefined,
  budget: number
): Array<{ group: LauncherGroup; index: number }> {
  const out: Array<{ group: LauncherGroup; index: number }> = [];
  let used = 0;

  groups.forEach((group, index) => {
    const cost = group.title.length + 4 + (out.length > 0 ? 2 : 0);
    if (out.length > 0 && used + cost > budget) return;
    out.push({ group, index });
    used += cost;
  });

  const activeIndex = groups.findIndex((g) => g.id === activeId);
  if (
    activeIndex >= 0 &&
    out.length > 0 &&
    !out.some((entry) => entry.index === activeIndex)
  ) {
    out[out.length - 1] = { group: groups[activeIndex]!, index: activeIndex };
  }

  return out;
}

export function LauncherApp({ catalog, onResolve }: LauncherAppProps) {
  const renderer = useRenderer();
  const dims = useTerminalDimensions();
  const width = dims?.width ?? 80;
  const height = dims?.height ?? 24;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [phTick, setPhTick] = useState(0);

  const filtered = useMemo(
    () => filterLauncherItems(catalog.items, query),
    [catalog.items, query]
  );

  const markSize: HooxMarkSize = height >= 15 && width >= 52 ? "md" : "sm";
  const markWidth = hooxMarkWidth(markSize);
  const markHeight = hooxMarkHeight(markSize);
  const railWidth = markWidth + 2;
  const rightWidth = Math.max(16, width - railWidth - 5);

  const listLimit = Math.max(2, Math.min(LIST_MAX, height - 8));
  const visible = filtered.slice(0, listLimit);
  const safeIndex =
    visible.length === 0 ? 0 : Math.min(index, visible.length - 1);

  const footerRows = Math.max(
    markHeight + 3,
    7 + listLimit + (helpOpen ? 2 : 0)
  );

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    if (renderer && typeof renderer === "object") {
      renderer.footerHeight = footerRows;
    }
  }, [footerRows, renderer]);

  useEffect(() => {
    if (isMotionMuted()) return;
    const id = setInterval(() => setPhTick((n) => n + 1), 5000);
    return () => clearInterval(id);
  }, []);

  const placeholder = PLACEHOLDERS[phTick % PLACEHOLDERS.length] ?? "hoox tui";
  const fullPlaceholder = `search commands… "${placeholder}"`;
  const placeholderLine =
    rightWidth >= 36
      ? fullPlaceholder.slice(0, rightWidth - 2)
      : "search commands…";

  const activeItem = visible[safeIndex];
  const menuGroups = fitGroups(
    catalog.groups,
    activeItem?.group,
    Math.max(8, rightWidth - 1)
  );

  const labelWidth = Math.max(
    10,
    Math.min(18, rightWidth - (rightWidth >= 34 ? 20 : 10))
  );
  const showIndex = rightWidth >= 34;
  const hintWidth = Math.max(0, rightWidth - labelWidth - (showIndex ? 6 : 4));
  const commandPreview = activeItem
    ? `↵ hoox ${activeItem.argv.join(" ")}`
    : "";
  const previewWidth = Math.max(0, rightWidth - 34);

  const runItem = (item: LauncherItem | undefined) => {
    if (!item) return;
    onResolve({
      action: "run",
      argv: item.argv,
      longRunning: item.longRunning,
    });
  };

  useKeyboard((key: KeyEvent) => {
    if (key.ctrl && (key.name === "c" || key.name === "d")) {
      onResolve({ action: "quit" });
      return;
    }

    if (helpOpen) {
      if (
        key.name === "escape" ||
        key.name === "return" ||
        key.name === "enter" ||
        key.sequence === "?" ||
        key.sequence === "q"
      ) {
        setHelpOpen(false);
      }
      return;
    }

    if (key.ctrl && (key.name === "p" || key.sequence === "\u0010")) {
      setIndex(0);
      return;
    }

    if (key.name === "escape") {
      if (query) {
        setQuery("");
        setIndex(0);
      } else {
        onResolve({ action: "quit" });
      }
      return;
    }

    if (key.sequence === "?" && !query) {
      setHelpOpen(true);
      return;
    }

    if (
      (key.sequence === "q" || key.sequence === "Q") &&
      query.length === 0 &&
      !key.ctrl &&
      !key.alt &&
      !key.meta
    ) {
      onResolve({ action: "quit" });
      return;
    }

    if (key.name === "up") {
      setIndex((i) => {
        const last = Math.max(0, visible.length - 1);
        const cur = Math.min(i, last);
        return cur > 0 ? cur - 1 : last;
      });
      return;
    }
    if (key.name === "down") {
      setIndex((i) => {
        const last = Math.max(0, visible.length - 1);
        const cur = Math.min(i, last);
        return cur < last ? cur + 1 : 0;
      });
      return;
    }

    if (key.name === "return" || key.name === "enter") {
      const selected = visible[safeIndex];
      if (selected) {
        runItem(selected);
        return;
      }
      const typed = query.trim();
      if (typed) {
        onResolve({
          action: "run",
          argv: typed.split(/\s+/).filter(Boolean),
        });
      }
      return;
    }

    if (key.name === "backspace" || key.name === "delete") {
      setQuery((q) => q.slice(0, -1));
      setIndex(0);
      return;
    }

    if (
      key.sequence &&
      !key.ctrl &&
      !key.alt &&
      !key.meta &&
      key.sequence.length === 1 &&
      key.sequence >= " "
    ) {
      setQuery((q) => q + key.sequence);
      setIndex(0);
    }
  });

  return (
    <box width="100%" flexDirection="column" paddingLeft={1} paddingRight={1}>
      <box flexDirection="row" flexGrow={1}>
        {/* ── Left rail: dotted mark, no overlays ────────────────────────── */}
        <box flexDirection="column" width={railWidth} paddingRight={1} gap={0}>
          <HooxMark size={markSize} />
          <text> </text>
          <HooxWordmark tagline={railWidth >= 14 ? "edge ops" : undefined} />
          {height >= 15 ? <text dim>{`v${catalog.version}`}</text> : null}
          {height >= 15 ? <text> </text> : null}
          {height >= 13 ? (
            <box flexDirection="row">
              <text fg={Colors.success}>■</text>
              <text dim> ONLINE</text>
            </box>
          ) : null}
        </box>

        {/* ── Right column: status / menu / content / legend ─────────────── */}
        <box
          flexDirection="column"
          flexGrow={1}
          border={["left"]}
          borderStyle="single"
          borderColor={Colors.border}
          paddingLeft={2}
          gap={0}
        >
          {/* Status */}
          <box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <box flexDirection="row">
              <text fg={Colors.accent} bold>
                ■
              </text>
              <text bold> HOOX</text>
              {width >= 52 ? <text dim>{` / Cloudflare Workers`}</text> : null}
            </box>
            <text dim>{`v${catalog.version}`}</text>
          </box>

          <Rule width={rightWidth} />

          {/* Menu — numbered sections, active section marked */}
          <box flexDirection="row" gap={2}>
            {menuGroups.map(({ group, index: groupIndex }) => {
              const active = group.id === activeItem?.group;
              return (
                <text
                  key={group.id}
                  fg={active ? Colors.accent : undefined}
                  bold={active}
                  dim={!active}
                >
                  {`${active ? "▌" : " "}${pad2(groupIndex + 1)} ${group.title.toUpperCase()}`}
                </text>
              );
            })}
          </box>

          <Rule width={rightWidth} accent={false} />

          {/* Search */}
          <box flexDirection="row" gap={1}>
            <text fg={Colors.accent}>›</text>
            {query ? (
              <text>
                {query}
                <span fg={Colors.accent}>▌</span>
              </text>
            ) : (
              <text dim>{placeholderLine}</text>
            )}
          </box>

          {/* Content */}
          {helpOpen ? (
            <box flexDirection="column">
              <text dim>TYPE TO FILTER · ENTER RUNS · ESC CLEARS</text>
              <text dim>Q QUITS · ↑↓ MOVES THE SELECTION</text>
            </box>
          ) : visible.length === 0 ? (
            <text dim>NO MATCHES</text>
          ) : (
            visible.map((item, i) => {
              const selected = i === safeIndex;
              return (
                <box
                  key={item.id}
                  flexDirection="row"
                  gap={1}
                  onMouseUp={() => runItem(item)}
                >
                  <text
                    fg={selected ? Colors.accent : undefined}
                    dim={!selected}
                  >
                    {selected ? "▌" : " "}
                  </text>
                  {showIndex ? <text dim>{pad2(i + 1)}</text> : null}
                  <text bold={selected} dim={!selected}>
                    {item.label.slice(0, labelWidth).padEnd(labelWidth, " ")}
                  </text>
                  {hintWidth >= 4 ? (
                    <text dim>{item.hint.slice(0, hintWidth)}</text>
                  ) : null}
                </box>
              );
            })
          )}

          <box flexGrow={1} />

          {/* Commands + legend */}
          <Rule width={rightWidth} />
          <box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            {width >= 60 ? (
              <text dim>↑↓ select ↵ run ? help q quit</text>
            ) : (
              <text dim>↑↓ · ↵ · ? · q quit</text>
            )}
            {previewWidth >= 10 && commandPreview ? (
              <text dim>{commandPreview.slice(0, previewWidth)}</text>
            ) : null}
          </box>
        </box>
      </box>
    </box>
  );
}
