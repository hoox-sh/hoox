/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { describe, it, expect } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import {
  AnimatedRule,
  BreatheGlyph,
  ORBIT_FRAMES,
  OrbitSpinner,
  ShimmerText,
} from "./motion";
import {
  HOOX_MARK_MEDIUM,
  HOOX_MARK_SMALL,
  HOOX_MARK_TINY,
  HooxMark,
  HooxWordmark,
  hooxMarkHeight,
  hooxMarkRows,
  hooxMarkWidth,
} from "./hoox-mark";

async function frame(node: ReactNode, width = 40, height = 6) {
  const setup = await testRender(node, { width, height, exitOnCtrlC: false });
  await setup.renderOnce();
  return setup.captureCharFrame();
}

describe("motion primitives", () => {
  it("renders an orbit spinner frame", async () => {
    const out = await frame(<OrbitSpinner />, 20, 3);
    expect(ORBIT_FRAMES.some((f) => out.includes(f))).toBe(true);
  });

  it("renders a spinner label", async () => {
    const out = await frame(<OrbitSpinner label="loading" />, 30, 3);
    expect(out).toContain("loading");
  });

  it("preserves shimmer text content", async () => {
    const out = await frame(<ShimmerText text="restoring session" />, 40, 3);
    expect(out).toContain("restoring session");
  });

  it("draws a rule with a travelling marker", async () => {
    const out = await frame(<AnimatedRule width={12} />, 20, 3);
    expect(out).toContain("◆");
    expect(out).toContain("─");
  });

  it("renders a breathing glyph", async () => {
    const out = await frame(<BreatheGlyph />, 10, 3);
    expect(out).toMatch(/[·•●]/);
  });
});

describe("dotted HOOX mark", () => {
  it("exposes three dot-matrix sizes", () => {
    expect(hooxMarkRows("xs")).toBe(HOOX_MARK_TINY);
    expect(hooxMarkRows("sm")).toBe(HOOX_MARK_SMALL);
    expect(hooxMarkRows("md")).toBe(HOOX_MARK_MEDIUM);
    expect(hooxMarkWidth("sm")).toBeGreaterThan(0);
    expect(hooxMarkHeight("md")).toBe(HOOX_MARK_MEDIUM.length);
  });

  it("renders braille dots", async () => {
    const out = await frame(<HooxMark size="sm" />, 24, 10);
    expect(out).toContain("⣶");
    expect(out).toContain("⢀");
  });

  it("renders the HO/OX wordmark", async () => {
    const out = await frame(<HooxWordmark tagline="edge ops" />, 30, 3);
    expect(out).toContain("HOOX");
    expect(out).toContain("edge ops");
  });
});
