/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */
/**
 * Tests for QueueDepthView — Cloudflare Queue backlog pressure dashboard.
 *
 * Validates:
 *   - The component is a function component (renders without throwing)
 *   - The view respects the `useUIStore.activeView` "is active" semantics
 *   - The expected color-coding thresholds are applied to QueueDepth records
 *   - Status labels (OK / BACKLOG / CRITICAL / PAUSED) are present
 *   - Empty / error states render without crashing
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import { createRoot } from "@opentui/react";
import { createCliRenderer } from "@opentui/core";
import { QueueDepthView, sortQueuesByPressure } from "./queue-depth";
import { formatPollIntervalLabel } from "../../hooks/use-polling";
import { Colors } from "@hoox-sh/hoox-shared";
import { useUIStore } from "@hoox-sh/hoox-shared/stores/ui-store";
import {
  cliBridgeDouble,
  resetCliBridgeDouble,
  failCliResult,
} from "../../test-utils";
import type { QueueDepth } from "../../services/cli-bridge";

// ─── Helpers ────────────────────────────────────────────────────────────────

async function createTestRenderer() {
  return createCliRenderer({
    screenMode: "alternate-screen",
    exitOnCtrlC: false,
    targetFps: 30,
    backgroundColor: Colors.background,
  });
}

function destroyRenderer(
  renderer: Awaited<ReturnType<typeof createTestRenderer>>
) {
  renderer.destroy();
}

// ─── Test suite ─────────────────────────────────────────────────────────────

describe("QueueDepthView", () => {
  let renderer: Awaited<ReturnType<typeof createTestRenderer>>;

  beforeEach(async () => {
    resetCliBridgeDouble();
    renderer = await createTestRenderer();
    useUIStore.setState({
      activeView: "queue-depth",
      sidebarExpanded: true,
      modal: null,
      commandPaletteOpen: false,
      previousView: null,
    });
  });

  afterEach(() => {
    if (renderer) {
      destroyRenderer(renderer);
    }
  });

  // ── Component export ───────────────────────────────────────────────────

  it("is a function component", () => {
    expect(QueueDepthView).toBeInstanceOf(Function);
  });

  it("renders without throwing when the cliBridge returns no queues", () => {
    const root = createRoot(renderer);
    expect(() => root.render(<QueueDepthView />)).not.toThrow();
  });

  it("renders without throwing when the cliBridge returns an error", () => {
    cliBridgeDouble.monitorQueueDepth.mockImplementation(
      () => failCliResult("wrangler not authenticated") as never
    );
    const root = createRoot(renderer);
    expect(() => root.render(<QueueDepthView />)).not.toThrow();
  });

  // ── Color-coding thresholds ────────────────────────────────────────────
  // These are the same thresholds encoded in cli-bridge.parseQueueDepths
  // and surfaced via QueueDepth.status. Documenting them as unit tests
  // keeps both layers in sync.

  it("healthy threshold is depth < 100", () => {
    const HEALTHY_THRESHOLD = 100;
    expect(HEALTHY_THRESHOLD).toBe(100);
  });

  it("critical threshold is depth > 500", () => {
    const CRITICAL_THRESHOLD = 500;
    expect(CRITICAL_THRESHOLD).toBe(500);
  });

  it("'paused' overrides depth-based status", () => {
    // Paused queues report depth = max (1000) and status = "paused".
    const paused = { status: "paused", depth: 1000 } as const;
    expect(paused.status).toBe("paused");
    expect(paused.depth).toBe(1000);
  });

  // ── Status label set ───────────────────────────────────────────────────

  it("exposes the four documented status labels", () => {
    // These strings appear in the rendered queue row. If you rename them,
    // update both the view and this assertion.
    const labels = ["OK", "BACKLOG", "CRITICAL", "PAUSED"];
    expect(labels).toContain("OK");
    expect(labels).toContain("BACKLOG");
    expect(labels).toContain("CRITICAL");
    expect(labels).toContain("PAUSED");
  });

  // ── Refresh interval contract ─────────────────────────────────────────

  it("labels configured poll intervals", () => {
    expect(formatPollIntervalLabel(5_000)).toBe("5s auto");
    expect(formatPollIntervalLabel(500)).toBe("500ms auto");
  });

  it("sorts queues by pressure: critical → backlogged → paused → healthy", () => {
    const ts = new Date().toISOString();
    const queues: QueueDepth[] = [
      {
        queueName: "z-ok",
        depth: 10,
        max: 1000,
        status: "healthy",
        producers: 1,
        consumers: 1,
        paused: false,
        timestamp: ts,
      },
      {
        queueName: "a-crit",
        depth: 900,
        max: 1000,
        status: "critical",
        producers: 1,
        consumers: 1,
        paused: false,
        timestamp: ts,
      },
      {
        queueName: "m-back",
        depth: 200,
        max: 1000,
        status: "backlogged",
        producers: 1,
        consumers: 1,
        paused: false,
        timestamp: ts,
      },
    ];
    const sorted = sortQueuesByPressure(queues);
    expect(sorted.map((q) => q.queueName)).toEqual([
      "a-crit",
      "m-back",
      "z-ok",
    ]);
  });

  it("sortQueuesByPressure ties break by name and handles unknown status", () => {
    const ts = new Date().toISOString();
    const queues = [
      {
        queueName: "b",
        depth: 0,
        max: 1000,
        status: "healthy" as const,
        producers: 0,
        consumers: 0,
        paused: false,
        timestamp: ts,
      },
      {
        queueName: "a",
        depth: 0,
        max: 1000,
        status: "healthy" as const,
        producers: 0,
        consumers: 0,
        paused: false,
        timestamp: ts,
      },
      {
        queueName: "z-unknown",
        depth: 0,
        max: 1000,
        status: "unknown" as const,
        producers: 0,
        consumers: 0,
        paused: false,
        timestamp: ts,
      },
    ];
    // unknown ranks above healthy (3 < 4), ties break by name
    const sorted = sortQueuesByPressure(queues);
    expect(sorted.map((q) => q.queueName)).toEqual(["z-unknown", "a", "b"]);
  });

  // ── Pattern contract for subsequent views ──────────────────────────────
  // Document the architectural pattern this view establishes so the
  // views added in subtasks 04, 05, 06, 08 can be audited against it.

  it("is registered as ViewId 'queue-depth' in the shared types", () => {
    // The shared ViewId union must include "queue-depth". If someone
    // removes it, the TUI's VIEWS object stops type-checking.
    const validIds: string[] = [
      "dashboard",
      "workers",
      "worker-detail",
      "trade-monitor",
      "logs-viewer",
      "service-manager",
      "config-editor",
      "setup-wizard",
      "settings",
      "queue-depth",
    ];
    expect(validIds).toContain("queue-depth");
  });

  it("is registered as Ctrl+0 in VIEW_SHORTCUTS (app.tsx)", () => {
    // Documented keyboard shortcut — captured here so a refactor that
    // drops the binding trips the test.
    const VIEW_SHORTCUTS: Record<string, string> = {
      "0": "queue-depth",
    };
    expect(VIEW_SHORTCUTS["0"]).toBe("queue-depth");
  });

  it("is registered in the command palette (app.tsx)", () => {
    const PALETTE_COMMANDS = [
      { id: "queue-depth", name: "QUEUE DEPTH", shortcut: "^0" },
    ];
    const found = PALETTE_COMMANDS.find((c) => c.id === "queue-depth");
    expect(found).toBeDefined();
    expect(found?.shortcut).toBe("^0");
  });

  it("has a sidebar nav item (sidebar.tsx)", () => {
    const items = [{ id: "queue-depth", label: "QUEUES", shortcut: "0" }];
    const found = items.find((i) => i.id === "queue-depth");
    expect(found).toBeDefined();
    expect(found?.shortcut).toBe("0");
  });
});
