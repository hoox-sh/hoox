/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Session restore/save tests — validates that all 16 ViewIds round-trip
 * through `$HOME/.hoox/.tui-state/session.json` and invalid views fall back
 * to dashboard (fail-closed for unknown IDs).
 *
 * Uses a temp HOOX_HOME so production ~/.hoox is never touched.
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { mkdir, rm, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { saveSession, restoreSession } from "@hoox-sh/hoox-shared";
import type { ViewId } from "@hoox-sh/hoox-shared";
import { ALL_VIEW_IDS } from "../test-utils";

const PREV_HOOX_HOME = process.env.HOOX_HOME;
const PREV_HOME = process.env.HOME;

let tempRoot: string;

async function setupTempHome(): Promise<void> {
  tempRoot = join(
    tmpdir(),
    `hoox-tui-session-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
  );
  await mkdir(tempRoot, { recursive: true });
  // path-utils / session prefer HOOX_HOME when set
  process.env.HOOX_HOME = tempRoot;
  process.env.HOME = tempRoot;
}

async function teardownTempHome(): Promise<void> {
  if (PREV_HOOX_HOME === undefined) delete process.env.HOOX_HOME;
  else process.env.HOOX_HOME = PREV_HOOX_HOME;
  if (PREV_HOME === undefined) delete process.env.HOME;
  else process.env.HOME = PREV_HOME;
  if (tempRoot) {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => {});
  }
}

/** session.json lives under HOOX_HOME/.tui-state (getHooxHome() + .tui-state). */
function sessionPath(): string {
  return join(tempRoot, ".tui-state", "session.json");
}

describe("session restore / save", () => {
  beforeEach(async () => {
    await setupTempHome();
  });

  afterEach(async () => {
    await teardownTempHome();
  });

  it("returns defaults when no session file exists", async () => {
    const session = await restoreSession();
    expect(session.activeView).toBe("dashboard");
    expect(session.sidebarExpanded).toBe(true);
    expect(session.lastData).toBe(0);
    expect(session.fromDisk).toBe(false);
  });

  it("round-trips every ViewId (all 16)", async () => {
    expect(ALL_VIEW_IDS).toHaveLength(16);
    for (const view of ALL_VIEW_IDS) {
      await saveSession(view, true, { cols: 100, rows: 40 }, 12345);
      const restored = await restoreSession();
      expect(restored.activeView).toBe(view);
      expect(restored.sidebarExpanded).toBe(true);
      expect(restored.windowSize).toEqual({ cols: 100, rows: 40 });
      expect(restored.lastData).toBe(12345);
      expect(restored.fromDisk).toBe(true);
    }
  });

  it("preserves sidebarExpanded=false", async () => {
    await saveSession("workers", false, { cols: 80, rows: 24 }, 0);
    const restored = await restoreSession();
    expect(restored.sidebarExpanded).toBe(false);
    expect(restored.activeView).toBe("workers");
  });

  it("falls back to dashboard for unknown view IDs", async () => {
    await mkdir(join(tempRoot, ".tui-state"), { recursive: true });
    await writeFile(
      sessionPath(),
      JSON.stringify({
        activeView: "not-a-real-view",
        sidebarExpanded: true,
        windowSize: { cols: 80, rows: 24 },
        lastData: 0,
        savedAt: new Date().toISOString(),
      }),
      "utf8"
    );
    const restored = await restoreSession();
    expect(restored.activeView).toBe("dashboard");
  });

  it("restores chord views (kv, secrets, ai-chat, db-query, edge, worker-settings)", async () => {
    const chordViews: ViewId[] = [
      "kv-viewer",
      "secrets-viewer",
      "ai-chat",
      "db-query",
      "edge-topology",
      "worker-settings",
    ];
    for (const view of chordViews) {
      await saveSession(view, true, { cols: 80, rows: 24 }, 1);
      expect((await restoreSession()).activeView).toBe(view);
    }
  });

  it("returns defaults on corrupt JSON", async () => {
    await mkdir(join(tempRoot, ".tui-state"), { recursive: true });
    await writeFile(sessionPath(), "{not-json!!!", "utf8");
    const restored = await restoreSession();
    expect(restored.activeView).toBe("dashboard");
    expect(restored.sidebarExpanded).toBe(true);
  });

  it("saveSession writes readable session.json under .tui-state", async () => {
    await saveSession("queue-depth", true, { cols: 120, rows: 36 }, 99);
    const raw = await readFile(sessionPath(), "utf8");
    const parsed = JSON.parse(raw) as { activeView: string; lastData: number };
    expect(parsed.activeView).toBe("queue-depth");
    expect(parsed.lastData).toBe(99);
  });
});
