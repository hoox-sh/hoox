/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Compact, frameless CLI start screen.
 *
 * Layout (from the HOOX scribble):
 *
 *   ⣶⣦⡀ ⢀⣴⣶   ● HOOX · Cloudflare Workers        v0.5.0
 *   ⣤⣤⣄⣀⣶⣀⣠⣤⣤   ────────────────◆───────────────
 *   ⣠⣾⡇ ⢸⣷⣄   * SETUP   SHIP   DEVELOP   OPERATE
 *                     ▸ search commands…
 *                     ▸ Onboard      init + setup end-to-end
 *                       Doctor       runtime, TUI paths, security
 *                     ────────────────◆───────────────
 *                     ↑↓ move  ↵ run  ? help  q quit    ~/Git/hoox
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
import {
  AnimatedRule,
  BreatheGlyph,
  isMotionMuted,
  OrbitSpinner,
} from "../components/shared/motion";

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

function shortenPath(cwd: string, width: number): string {
  if (cwd.length <= width) return cwd;
  const home = process.env.HOME;
  const tilde =
    home && cwd.startsWith(home) ? `~${cwd.slice(home.length)}` : cwd;
  if (tilde.length <= width) return tilde;
  return `…${tilde.slice(-(width - 1))}`;
}

function Hint({ keys, label }: { keys: string; label: string }) {
  return (
    <box flexDirection="row" gap={1}>
      <text fg={Colors.foreground}>{keys}</text>
      <text fg={Colors.muted}>{label}</text>
    </box>
  );
}

/**
 * Pick the groups that fit the menu budget, keeping the active group visible
 * (and first) so the highlighted command always has a home in the menu.
 */
function fitGroups(
  groups: LauncherGroup[],
  activeId: string | undefined,
  budget: number
): LauncherGroup[] {
  const active = groups.find((g) => g.id === activeId);
  const ordered = active
    ? [active, ...groups.filter((g) => g.id !== active.id)]
    : groups;
  const out: LauncherGroup[] = [];
  let used = 0;
  for (const group of ordered) {
    const cost = group.title.length + 2 + (out.length > 0 ? 2 : 0);
    if (out.length > 0 && used + cost > budget) continue;
    out.push(group);
    used += cost;
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
  const rightWidth = Math.max(16, width - railWidth - 4);

  const listLimit = Math.max(2, Math.min(LIST_MAX, height - 8));
  const visible = filtered.slice(0, listLimit);
  const safeIndex =
    visible.length === 0 ? 0 : Math.min(index, visible.length - 1);

  const footerRows = Math.max(
    markHeight + 2,
    6 + listLimit + (helpOpen ? 2 : 0)
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
    const id = setInterval(() => setPhTick((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const placeholder = PLACEHOLDERS[phTick % PLACEHOLDERS.length] ?? "hoox tui";
  const fullPlaceholder = `search commands… "${placeholder}"`;
  const placeholderLine =
    rightWidth >= 36
      ? fullPlaceholder.slice(0, rightWidth - 2)
      : "search commands…";
  const cwdLabel = shortenPath(catalog.cwd, Math.max(8, railWidth - 1));

  const activeItem = visible[safeIndex];
  const menuGroups = fitGroups(
    catalog.groups,
    activeItem?.group,
    Math.max(8, rightWidth - 1)
  );

  const labelWidth = Math.max(
    10,
    Math.min(18, rightWidth - (width >= 60 ? 22 : 14))
  );
  const hintWidth = Math.max(8, rightWidth - labelWidth - 4);
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
    <box
      width="100%"
      flexDirection="column"
      backgroundColor={Colors.background}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" gap={2} flexGrow={1}>
        {/* ── Left rail: dotted logo + wordmark + live heartbeat ─────────── */}
        <box flexDirection="column" width={railWidth} gap={0}>
          <HooxMark size={markSize} animated />
          <HooxWordmark tagline={width >= 72 ? "edge ops" : undefined} />
          <OrbitSpinner
            label={width >= 72 ? "mesh online" : undefined}
            variant="orbit"
          />
          {height >= 17 ? (
            <text fg={Colors.dim} dim>
              {cwdLabel}
            </text>
          ) : null}
        </box>

        {/* ── Right column: status → menu → content → commands ──────────── */}
        <box flexDirection="column" flexGrow={1} gap={0}>
          {/* Status line */}
          <box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            <box flexDirection="row" gap={1} alignItems="center">
              <BreatheGlyph />
              <text fg={Colors.foreground} bold>
                HOOX
              </text>
              {width >= 52 ? (
                <>
                  <text fg={Colors.dim}>·</text>
                  <text fg={Colors.muted}>Cloudflare Workers</text>
                </>
              ) : null}
            </box>
            <text fg={Colors.dim}>{`v${catalog.version}`}</text>
          </box>

          <AnimatedRule width={rightWidth} />

          {/* Menu — contextual group tabs, active group pinned first */}
          <box flexDirection="row" gap={2}>
            {menuGroups.map((group) => {
              const active = group.id === activeItem?.group;
              return (
                <text
                  key={group.id}
                  fg={active ? Colors.accent : Colors.muted}
                  bold={active}
                >
                  {`${active ? "* " : "  "}${group.title.toUpperCase()}`}
                </text>
              );
            })}
          </box>

          {/* Composer / filter */}
          <box flexDirection="row" gap={1}>
            <text fg={query ? Colors.accent : Colors.dim}>▸</text>
            {query ? (
              <text fg={Colors.foreground}>{query}</text>
            ) : (
              <text fg={Colors.dim}>{placeholderLine}</text>
            )}
          </box>

          {/* Content — filtered commands */}
          {helpOpen ? (
            <box flexDirection="column">
              <text fg={Colors.muted}>
                {" "}
                Type to filter. Enter runs the highlighted command.
              </text>
              <text fg={Colors.muted}>
                {" "}
                Esc clears the filter or quits. q also quits.
              </text>
            </box>
          ) : visible.length === 0 ? (
            <box flexDirection="row" gap={1}>
              <text fg={Colors.dim}>·</text>
              <text fg={Colors.muted}>no matches</text>
            </box>
          ) : (
            visible.map((item, i) => {
              const selected = i === safeIndex;
              return (
                <box
                  key={item.id}
                  flexDirection="row"
                  gap={1}
                  backgroundColor={selected ? Colors.card : Colors.background}
                  onMouseUp={() => runItem(item)}
                >
                  <text fg={selected ? Colors.accent : Colors.dim}>
                    {selected ? "▸" : " "}
                  </text>
                  <text
                    fg={selected ? Colors.foreground : Colors.muted}
                    bold={selected}
                  >
                    {item.label.slice(0, labelWidth).padEnd(labelWidth, " ")}
                  </text>
                  <text fg={selected ? Colors.muted : Colors.dim} dim>
                    {item.hint.slice(0, hintWidth)}
                  </text>
                </box>
              );
            })
          )}

          <box flexGrow={1} />

          {/* Commands + legend */}
          <AnimatedRule width={rightWidth} />
          <box
            flexDirection="row"
            justifyContent="space-between"
            alignItems="center"
          >
            {width >= 56 ? (
              <box flexDirection="row" gap={2}>
                <Hint keys="↑↓" label="move" />
                <Hint keys="↵" label="run" />
                <Hint keys="?" label="help" />
                <Hint keys="q" label="quit" />
              </box>
            ) : (
              <text fg={Colors.muted}>↑↓ · ↵ · ? · q quit</text>
            )}
            {previewWidth >= 10 && commandPreview ? (
              <text fg={Colors.dim} dim>
                {commandPreview.slice(0, previewWidth)}
              </text>
            ) : null}
          </box>
        </box>
      </box>
    </box>
  );
}
