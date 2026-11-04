/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { describe, it, expect } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import type { ReactNode } from "react";
import { MECHANICAL_FRAMES, MechanicalSpinner, Rule } from "./motion";
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

describe("mechanical motion", () => {
  it("renders a fixed quadrant spinner", async () => {
    const out = await frame(<MechanicalSpinner />, 20, 3);
    expect(MECHANICAL_FRAMES.some((f) => out.includes(f))).toBe(true);
  });

  it("uppercases the spinner label", async () => {
    const out = await frame(<MechanicalSpinner label="loading" />, 30, 3);
    expect(out).toContain("LOADING");
  });

  it("draws a static rule with a heavy accent block", async () => {
    const out = await frame(<Rule width={12} />, 20, 3);
    expect(out).toContain("━");
    expect(out).toContain("─");
  });

  it("can draw a plain hairline without the accent block", async () => {
    const out = await frame(<Rule width={12} accent={false} />, 20, 3);
    expect(out).not.toContain("━");
    expect(out).toContain("─");
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

  it("renders the HO/OX wordmark with an uppercase tagline", async () => {
    const out = await frame(<HooxWordmark tagline="edge ops" />, 30, 3);
    expect(out).toContain("HOOX");
    expect(out).toContain("EDGE OPS");
  });
});
