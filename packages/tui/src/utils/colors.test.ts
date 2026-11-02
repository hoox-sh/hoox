/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Colors Utility Tests — Design token validation.
 *
 * Tests that the Hoox design system colors are correctly defined,
 * follow the Hoox Signal DNA (OKLCH orange accent on a near-black canvas),
 * and provide adequate contrast ratios for TUI readability.
 *
 * Source of truth: @hoox-sh/hoox-shared (Colors + status maps).
 * Uses Bun test runner.
 */
import { describe, it, expect } from "bun:test";
import {
  Colors,
  CoolBracketPalette,
  ConnectionStatusColor,
  WorkerStatusColor,
  LogLevelColor,
  AlertSeverityColor,
  THEME_PALETTES,
  setActiveTheme,
} from "@hoox-sh/hoox-shared";

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Parse a hex color string into RGB components */
function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const match = hex.match(
    /^#?([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})([0-9A-Fa-f]{2})$/
  );
  if (!match) return null;
  const rHex = match[1];
  const gHex = match[2];
  const bHex = match[3];
  if (rHex === undefined || gHex === undefined || bHex === undefined)
    return null;
  return {
    r: parseInt(rHex, 16),
    g: parseInt(gHex, 16),
    b: parseInt(bHex, 16),
  };
}

/** Calculate relative luminance (per WCAG 2.0) */
function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 0;
  const toLinear = (c: number): number => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * toLinear(rgb.r) +
    0.7152 * toLinear(rgb.g) +
    0.0722 * toLinear(rgb.b)
  );
}

/** Calculate contrast ratio between two hex colors */
function contrastRatio(hex1: string, hex2: string): number {
  const l1 = relativeLuminance(hex1);
  const l2 = relativeLuminance(hex2);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

// ─── Test Suite ───────────────────────────────────────────────────────────────

describe("Colors Design System", () => {
  // ── All tokens are valid hex colors ─────────────────────────────────────

  describe("valid hex colors", () => {
    it("all color tokens are valid 6-digit hex", () => {
      for (const [name, value] of Object.entries(Colors)) {
        expect(value).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it("all tokens can be parsed to RGB", () => {
      for (const [name, value] of Object.entries(Colors)) {
        const rgb = hexToRgb(value);
        expect(rgb).not.toBeNull();
        expect(rgb!.r).toBeGreaterThanOrEqual(0);
        expect(rgb!.r).toBeLessThanOrEqual(255);
        expect(rgb!.g).toBeGreaterThanOrEqual(0);
        expect(rgb!.g).toBeLessThanOrEqual(255);
        expect(rgb!.b).toBeGreaterThanOrEqual(0);
        expect(rgb!.b).toBeLessThanOrEqual(255);
      }
    });
  });

  // ── Black / cool DNA ────────────────────────────────────────────────────

  describe("signal DNA (default)", () => {
    it("background is near-black", () => {
      setActiveTheme("signal");
      expect(Colors.background).toBe(THEME_PALETTES.signal.background);
      const rgb = hexToRgb(Colors.background)!;
      expect(rgb.r).toBeLessThan(30);
      expect(rgb.g).toBeLessThan(30);
      expect(rgb.b).toBeLessThan(30);
    });

    it("accent is warm orange (OKLCH hue 48)", () => {
      setActiveTheme("signal");
      expect(Colors.accent.toUpperCase()).toBe("#F38020");
      const rgb = hexToRgb(Colors.accent)!;
      expect(rgb.r).toBeGreaterThan(rgb.b);
      expect(rgb.r).toBeGreaterThan(200);
    });

    it("highlight is a second orange, distinct from accent", () => {
      setActiveTheme("signal");
      expect(Colors.highlight).not.toBe(Colors.accent);
      const rgb = hexToRgb(Colors.highlight)!;
      expect(rgb.r).toBeGreaterThan(rgb.b);
    });

    it("cards are elevated above the canvas", () => {
      setActiveTheme("signal");
      const bg = hexToRgb(Colors.background)!;
      const card = hexToRgb(Colors.card)!;
      expect(card.r + card.g + card.b).toBeGreaterThan(bg.r + bg.g + bg.b);
    });

    it("volt is PYNE lime and void is AXIS indigo", () => {
      expect(THEME_PALETTES.volt.accent.toUpperCase()).toBe("#B7EF09");
      expect(THEME_PALETTES.void.accent.toUpperCase()).toBe("#8B9CFF");
    });

    it("borders are dark, not mid-grey", () => {
      setActiveTheme("signal");
      const rgb = hexToRgb(Colors.border)!;
      expect(rgb.r).toBeLessThan(60);
      expect(rgb.g).toBeLessThan(60);
      expect(rgb.b).toBeLessThan(70);
    });
  });

  describe("CoolBracketPalette", () => {
    it("has multiple cool hues for animation", () => {
      expect(CoolBracketPalette.length).toBeGreaterThanOrEqual(6);
      for (const c of CoolBracketPalette) {
        expect(c).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it("signal brackets start in orange", () => {
      setActiveTheme("signal");
      const first = hexToRgb(CoolBracketPalette[0]!)!;
      expect(first.r).toBeGreaterThan(first.b);
    });
  });

  // ── Semantic Colors ─────────────────────────────────────────────────────

  describe("semantic colors", () => {
    it("success is green", () => {
      setActiveTheme("signal");
      const rgb = hexToRgb(Colors.success)!;
      expect(rgb.g).toBeGreaterThan(rgb.r);
    });

    it("error is red", () => {
      setActiveTheme("signal");
      const rgb = hexToRgb(Colors.error)!;
      expect(rgb.r).toBeGreaterThan(200);
    });

    it("warning is amber", () => {
      setActiveTheme("signal");
      const rgb = hexToRgb(Colors.warning)!;
      expect(rgb.r).toBeGreaterThan(200);
      expect(rgb.g).toBeGreaterThan(150);
    });

    it("info is cyan", () => {
      setActiveTheme("signal");
      const rgb = hexToRgb(Colors.info)!;
      expect(rgb.g).toBeGreaterThan(150);
      expect(rgb.b).toBeGreaterThan(150);
    });
  });

  // ── Contrast Ratios ─────────────────────────────────────────────────────

  describe("contrast ratios", () => {
    it("foreground on background has sufficient contrast (WCAG AA)", () => {
      const ratio = contrastRatio(Colors.foreground, Colors.background);
      // WCAG AA requires 4.5:1 for normal text
      expect(ratio).toBeGreaterThan(4.5);
    });

    it("accent on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.accent, Colors.background);
      // Large/bold text requires 3:1
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("success on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.success, Colors.background);
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("error on background has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.error, Colors.background);
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("muted on background has at least some contrast (visible)", () => {
      const ratio = contrastRatio(Colors.muted, Colors.background);
      // Muted text should be readable but not dominant (>= 3.0)
      expect(ratio).toBeGreaterThan(3.0);
    });

    it("foreground on card has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.foreground, Colors.card);
      expect(ratio).toBeGreaterThan(4.5);
    });

    it("accent on card has sufficient contrast", () => {
      const ratio = contrastRatio(Colors.accent, Colors.card);
      expect(ratio).toBeGreaterThan(3.0);
    });
  });

  // ── Token completeness ──────────────────────────────────────────────────

  describe("token completeness", () => {
    it("all required semantic tokens exist", () => {
      const required = [
        "background",
        "foreground",
        "card",
        "accent",
        "border",
        "muted",
        "muted-foreground",
        "dim",
        "success",
        "error",
        "warning",
        "info",
        "highlight",
        "backdrop",
      ] as const;
      for (const key of required) {
        expect(Colors[key]).toBeDefined();
      }
    });

    it("no two core semantic colors share the same hex value", () => {
      const semanticKeys = [
        "background",
        "foreground",
        "card",
        "accent",
        "border",
        "muted",
        "muted-foreground",
        "dim",
        "success",
        "error",
        "warning",
        "info",
        "backdrop",
      ] as const;
      const hexes = semanticKeys.map((k) => Colors[k]);
      // Core tokens must be unique (aliases like highlight/text may duplicate)
      const uniqueHexes = new Set(hexes);
      expect(uniqueHexes.size).toBe(semanticKeys.length);
    });
  });

  // ── Edge Cases ──────────────────────────────────────────────────────────

  describe("edge cases", () => {
    it("hexToRgb returns null for invalid hex", () => {
      expect(hexToRgb("not-a-color")).toBeNull();
      expect(hexToRgb("#FFF")).toBeNull(); // 3-digit not supported
      expect(hexToRgb("#GGGGGG")).toBeNull();
      expect(hexToRgb("")).toBeNull();
    });

    it("contrast ratio of same color is 1.0", () => {
      expect(contrastRatio(Colors.background, Colors.background)).toBeCloseTo(
        1.0,
        1
      );
    });

    it("contrast ratio is symmetric", () => {
      const r1 = contrastRatio(Colors.foreground, Colors.background);
      const r2 = contrastRatio(Colors.background, Colors.foreground);
      expect(r1).toBeCloseTo(r2, 5);
    });

    it("white on black has maximum contrast (~21:1)", () => {
      const ratio = contrastRatio("#FFFFFF", "#000000");
      expect(ratio).toBeCloseTo(21, 0);
    });
  });
});

// ─── Status Color Mappings ───────────────────────────────────────────────────

describe("status color mappings", () => {
  it("connection status maps to correct colors", () => {
    expect(ConnectionStatusColor.connected).toBe(Colors.success);
    expect(ConnectionStatusColor.polling).toBe(Colors.highlight);
    expect(ConnectionStatusColor.reconnecting).toBe(Colors.warning);
    expect(ConnectionStatusColor.offline).toBe(Colors.error);
  });

  it("alert severity maps to correct colors", () => {
    expect(AlertSeverityColor.info).toBe(Colors.info);
    expect(AlertSeverityColor.warning).toBe(Colors.warning);
    expect(AlertSeverityColor.error).toBe(Colors.error);
    expect(AlertSeverityColor.critical).toBe(Colors.error);
  });

  it("worker status maps to correct colors", () => {
    expect(WorkerStatusColor.operational).toBe(Colors.success);
    expect(WorkerStatusColor.degraded).toBe(Colors.warning);
    expect(WorkerStatusColor.down).toBe(Colors.error);
  });

  it("log level maps to correct colors", () => {
    expect(LogLevelColor.debug).toBe(Colors.muted);
    expect(LogLevelColor.info).toBe(Colors.foreground);
    expect(LogLevelColor.warn).toBe(Colors.warning);
    expect(LogLevelColor.error).toBe(Colors.error);
  });
});
