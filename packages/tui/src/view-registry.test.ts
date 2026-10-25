/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { VIEW_IDS, type ViewId } from "@hoox-sh/hoox-shared";
import {
  VIEW_REGISTRY,
  REGISTERED_VIEW_IDS,
  SIDEBAR_ITEMS,
  getSidebarItems,
  getViewShortcutMap,
  getCtrlAltViewMap,
  getViewPaletteCommands,
  getViewFactory,
  isRegisteredViewId,
  ACTION_COMMANDS,
  ALL_PALETTE_COMMANDS,
} from "./view-registry";

const ALL_VIEWS: ViewId[] = [...VIEW_IDS];

describe("view-registry", () => {
  it("covers every ViewId exactly once in order", () => {
    expect(VIEW_REGISTRY.map((v) => v.id)).toEqual(ALL_VIEWS);
    expect(REGISTERED_VIEW_IDS).toEqual(ALL_VIEWS);
  });

  it("sidebar items match registry short labels", () => {
    const items = getSidebarItems();
    expect(items).toHaveLength(ALL_VIEWS.length);
    expect(items).toEqual(SIDEBAR_ITEMS);
    expect(items[0]).toEqual({
      id: "dashboard",
      label: "DASHBOARD",
      shortcut: "1",
    });
  });

  it("Ctrl digit shortcuts map 1-9 and 0", () => {
    const map = getViewShortcutMap();
    expect(map["1"]).toBe("dashboard");
    expect(map["0"]).toBe("queue-depth");
    expect(map["9"]).toBe("settings");
    expect(Object.keys(map)).toHaveLength(10);
  });

  it("Ctrl+Alt chords map k/s/c/q/e/w", () => {
    const map = getCtrlAltViewMap();
    expect(map.k).toBe("kv-viewer");
    expect(map.s).toBe("secrets-viewer");
    expect(map.c).toBe("ai-chat");
    expect(map.q).toBe("db-query");
    expect(map.e).toBe("edge-topology");
    expect(map.w).toBe("worker-settings");
    expect(Object.keys(map)).toHaveLength(6);
  });

  it("ctrl and ctrl-alt key sets are unique", () => {
    const ctrl = VIEW_REGISTRY.filter((e) => e.keyMod === "ctrl").map(
      (e) => e.key
    );
    const ctrlAlt = VIEW_REGISTRY.filter((e) => e.keyMod === "ctrl-alt").map(
      (e) => e.key
    );
    expect(new Set(ctrl).size).toBe(ctrl.length);
    expect(new Set(ctrlAlt).size).toBe(ctrlAlt.length);
  });

  it("palette view commands include all views", () => {
    const cmds = getViewPaletteCommands();
    expect(cmds.every((c) => c.category === "view")).toBe(true);
    expect(new Set(cmds.map((c) => c.id))).toEqual(new Set(ALL_VIEWS));
  });

  it("every view has a factory", () => {
    for (const id of ALL_VIEWS) {
      expect(typeof getViewFactory(id)).toBe("function");
    }
  });

  it("isRegisteredViewId accepts all registry ids and rejects junk", () => {
    for (const id of ALL_VIEWS) {
      expect(isRegisteredViewId(id)).toBe(true);
    }
    expect(isRegisteredViewId("not-a-view")).toBe(false);
    expect(isRegisteredViewId(null)).toBe(false);
    expect(isRegisteredViewId(42)).toBe(false);
    expect(isRegisteredViewId("")).toBe(false);
  });

  it("action commands include refresh, reconnect, diagnostics, sidebar, quit", () => {
    const ids = ACTION_COMMANDS.map((c) => c.id);
    expect(ids).toContain("refresh");
    expect(ids).toContain("force-retry");
    expect(ids).toContain("expand-error");
    expect(ids).toContain("toggle-sidebar");
    expect(ids).toContain("quit");
  });

  it("ALL_PALETTE_COMMANDS merges views + actions without id collisions", () => {
    expect(ALL_PALETTE_COMMANDS.length).toBe(
      getViewPaletteCommands().length + ACTION_COMMANDS.length
    );
    const ids = ALL_PALETTE_COMMANDS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("action shortcuts do not collide with view Ctrl digits", () => {
    // refresh=R, sidebar=B, quit=Q — none are digit view keys
    const digitKeys = new Set(Object.keys(getViewShortcutMap()));
    expect(digitKeys.has("r")).toBe(false);
    expect(digitKeys.has("b")).toBe(false);
    expect(digitKeys.has("q")).toBe(false);
  });
});
