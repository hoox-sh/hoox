/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect, afterEach } from "bun:test";
import {
  Colors,
  DEFAULT_THEME,
  THEME_IDS,
  THEME_PALETTES,
  getActiveTheme,
  getPalette,
  migrateThemeId,
  setActiveTheme,
} from "./colors";

afterEach(() => {
  setActiveTheme(DEFAULT_THEME);
});

describe("theme ids", () => {
  it("defaults to signal", () => {
    expect(DEFAULT_THEME).toBe("signal");
    expect(getActiveTheme()).toBe("signal");
    expect(Colors.accent).toBe(THEME_PALETTES.signal.accent);
  });

  it("migrates legacy names", () => {
    expect(migrateThemeId("dark")).toBe("signal");
    expect(migrateThemeId("orange")).toBe("signal");
    expect(migrateThemeId("indigo")).toBe("void");
    expect(migrateThemeId("volt")).toBe("volt");
    expect(migrateThemeId("void")).toBe("void");
    expect(migrateThemeId("pyne")).toBe("volt");
    expect(migrateThemeId("axis")).toBe("void");
    expect(migrateThemeId("rail")).toBe("void");
    expect(migrateThemeId("light")).toBe("void");
    expect(migrateThemeId("nope")).toBe("signal");
  });

  it("switches live Colors in place", () => {
    setActiveTheme("volt");
    expect(Colors.accent).toBe("#B7EF09");
    setActiveTheme("void");
    expect(Colors.accent).toBe("#8B9CFF");
    setActiveTheme("signal");
    expect(Colors.accent).toBe("#F38020");
  });

  it("every palette token is a 6-digit hex", () => {
    for (const id of THEME_IDS) {
      for (const value of Object.values(getPalette(id))) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    }
  });

  it("signal accent is warm orange (OKLCH hue 48)", () => {
    const accent = THEME_PALETTES.signal.accent;
    expect(accent.toUpperCase()).toBe("#F38020");
    const r = parseInt(accent.slice(1, 3), 16);
    const b = parseInt(accent.slice(5, 7), 16);
    expect(r).toBeGreaterThan(b);
  });
});
