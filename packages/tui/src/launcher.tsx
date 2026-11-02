#!/usr/bin/env bun
/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */
/** @jsxImportSource @opentui/react */

/**
 * Hoox CLI start intro — compact OpenTUI footer, not a full-screen home.
 *
 * Protocol:
 *   HOOX_LAUNCHER_CATALOG  path to JSON catalog (optional)
 *   HOOX_LAUNCHER_RESULT   path to write { action, argv? } JSON
 */

import { readFileSync, writeFileSync } from "node:fs";
import { createCliRenderer } from "@opentui/core";
import { createRoot } from "@opentui/react";
import {
  Colors,
  migrateThemeId,
  setActiveTheme,
  readConfigSync,
} from "@hoox-sh/hoox-shared";
import { LauncherApp } from "./launcher/app";
import {
  FALLBACK_CATALOG,
  type LauncherCatalog,
  type LauncherResult,
} from "./launcher/types";

function loadCatalog(): LauncherCatalog {
  const path = process.env.HOOX_LAUNCHER_CATALOG?.trim();
  if (!path) return FALLBACK_CATALOG;
  try {
    const parsed = JSON.parse(readFileSync(path, "utf-8")) as LauncherCatalog;
    if (!parsed || !Array.isArray(parsed.items)) return FALLBACK_CATALOG;
    return {
      ...FALLBACK_CATALOG,
      ...parsed,
      items: parsed.items,
      groups: parsed.groups?.length ? parsed.groups : FALLBACK_CATALOG.groups,
      recents: parsed.recents ?? [],
    };
  } catch {
    return FALLBACK_CATALOG;
  }
}

function writeResult(result: LauncherResult): void {
  const path = process.env.HOOX_LAUNCHER_RESULT?.trim();
  if (!path) return;
  try {
    writeFileSync(path, JSON.stringify(result) + "\n", "utf-8");
  } catch {
    // parent CLI treats a missing file as quit
  }
}

function resolveTargetFps(): number {
  const raw = Number(process.env.TUI_FPS ?? 30);
  if (!Number.isFinite(raw)) return 30;
  return Math.min(120, Math.max(5, Math.round(raw)));
}

function resolveUseMouse(): boolean {
  const v = process.env.TUI_MOUSE;
  if (v === "0" || v === "false" || v === "off") return false;
  return true;
}

async function main(): Promise<void> {
  try {
    const cfg = readConfigSync();
    setActiveTheme(migrateThemeId(process.env.HOOX_THEME ?? cfg.theme));
  } catch {
    setActiveTheme(migrateThemeId(process.env.HOOX_THEME));
  }
  const catalog = loadCatalog();
  const targetFps = resolveTargetFps();
  const renderer = await createCliRenderer({
    screenMode: "split-footer",
    footerHeight: 10,
    exitOnCtrlC: false,
    targetFps,
    maxFps: Math.max(60, targetFps),
    useMouse: resolveUseMouse(),
    backgroundColor: Colors.background,
    consoleMode: "disabled",
    useKittyKeyboard: {
      disambiguate: true,
      alternateKeys: true,
      events: true,
    },
  });

  let settled = false;
  const settle = (result: LauncherResult) => {
    if (settled) return;
    settled = true;
    writeResult(result);
    try {
      root.unmount();
    } catch {
      // already unmounted
    }
    try {
      renderer.destroy();
    } catch {
      // destroy may throw if already torn down
    }
    process.exit(0);
  };

  const root = createRoot(renderer);
  root.render(
    <LauncherApp
      catalog={catalog}
      onResolve={(result) => {
        settle(result);
      }}
    />
  );
  renderer.start();
}

main().catch((err) => {
  process.stderr.write(
    `hoox launcher: ${err instanceof Error ? err.message : String(err)}\n`
  );
  writeResult({ action: "quit" });
  process.exit(1);
});
