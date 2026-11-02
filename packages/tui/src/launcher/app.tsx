/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

/**
 * Compact CLI start intro (OpenCode splash, not the full-screen home).
 *
 * Split-footer widget: brand line, composer, a short command list, hints.
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
import { PulseDot } from "../components/ui/pulse";
import { filterLauncherItems } from "./filter";
import type { LauncherCatalog, LauncherItem, LauncherResult } from "./types";

const SLAB_MAX = 64;
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

export function LauncherApp({ catalog, onResolve }: LauncherAppProps) {
  const renderer = useRenderer();
  const dims = useTerminalDimensions();
  const width = dims?.width ?? 80;
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const [helpOpen, setHelpOpen] = useState(false);
  const [phTick, setPhTick] = useState(0);

  const filtered = useMemo(
    () => filterLauncherItems(catalog.items, query),
    [catalog.items, query]
  );

  const visible = filtered.slice(0, LIST_MAX);
  const safeIndex =
    visible.length === 0 ? 0 : Math.min(index, visible.length - 1);

  const footerRows = helpOpen ? 7 : 4 + Math.max(1, visible.length);

  useEffect(() => {
    if (index !== safeIndex) setIndex(safeIndex);
  }, [index, safeIndex]);

  useEffect(() => {
    if (renderer && typeof renderer === "object") {
      renderer.footerHeight = footerRows;
    }
  }, [footerRows, renderer]);

  useEffect(() => {
    const id = setInterval(() => setPhTick((n) => n + 1), 4000);
    return () => clearInterval(id);
  }, []);

  const slabWidth = Math.min(SLAB_MAX, Math.max(32, width - 2));
  const placeholder = PLACEHOLDERS[phTick % PLACEHOLDERS.length] ?? "hoox tui";
  const cwdLabel = shortenPath(
    catalog.cwd,
    Math.max(10, Math.min(24, Math.floor(slabWidth / 4)))
  );

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

  const shelf = "▀".repeat(Math.max(8, slabWidth - 1));
  const hintWidth = Math.max(8, slabWidth - 24);

  return (
    <box
      width="100%"
      flexDirection="column"
      backgroundColor={Colors.background}
      paddingLeft={1}
      paddingRight={1}
    >
      <box flexDirection="row" gap={1} alignItems="center">
        <PulseDot />
        <text fg={Colors.warning}>◆</text>
        <text>
          <span fg={Colors.muted}>HO</span>
          <span fg={Colors.foreground} bold>
            OX
          </span>
        </text>
        {width >= 52 ? (
          <>
            <text fg={Colors.dim}>·</text>
            <text fg={Colors.muted}>Cloudflare Workers</text>
          </>
        ) : null}
        <text fg={Colors.dim}>{`v${catalog.version}`}</text>
        {width >= 64 ? (
          <>
            <text fg={Colors.dim}>·</text>
            <text fg={Colors.dim}>{cwdLabel}</text>
          </>
        ) : null}
      </box>

      <box flexDirection="row">
        <text fg={Colors.border}>┃</text>
        <box
          flexGrow={1}
          flexDirection="row"
          gap={1}
          backgroundColor={Colors.card}
          paddingLeft={1}
        >
          <text fg={query ? Colors.accent : Colors.dim}>▸</text>
          {query ? (
            <text fg={Colors.foreground}>{query}</text>
          ) : (
            <text fg={Colors.dim}>{`search commands… "${placeholder}"`}</text>
          )}
        </box>
      </box>

      {helpOpen ? (
        <box flexDirection="column">
          <box flexDirection="row">
            <text fg={Colors.border}>┃</text>
            <text fg={Colors.muted}>
              {" "}
              Type to filter. Enter runs the highlighted command.
            </text>
          </box>
          <box flexDirection="row">
            <text fg={Colors.border}>┃</text>
            <text fg={Colors.muted}>
              {" "}
              Esc clears the filter or quits. q also quits.
            </text>
          </box>
        </box>
      ) : visible.length === 0 ? (
        <box flexDirection="row">
          <text fg={Colors.border}>┃</text>
          <text fg={Colors.muted}> no matches</text>
        </box>
      ) : (
        visible.map((item, i) => {
          const selected = i === safeIndex;
          return (
            <box
              key={item.id}
              flexDirection="row"
              backgroundColor={selected ? Colors.border : Colors.card}
              onMouseUp={() => runItem(item)}
            >
              <text fg={selected ? Colors.accent : Colors.border}>┃</text>
              <text fg={selected ? Colors.accent : Colors.dim}>
                {selected ? "▸ " : "  "}
              </text>
              <text
                fg={selected ? Colors.foreground : Colors.muted}
                bold={selected}
              >
                {item.label.padEnd(18).slice(0, 18)}
              </text>
              <text fg={selected ? Colors.muted : Colors.dim}>
                {` ${item.hint}`.slice(0, hintWidth)}
              </text>
            </box>
          );
        })
      )}

      <box flexDirection="row">
        <text fg={Colors.border}>╹</text>
        <text fg={Colors.dim}>{shelf}</text>
      </box>

      <box flexDirection="row" gap={2}>
        <Hint keys="↑↓" label="move" />
        <Hint keys="↵" label="run" />
        <Hint keys="?" label="help" />
        <Hint keys="q" label="quit" />
      </box>
    </box>
  );
}
