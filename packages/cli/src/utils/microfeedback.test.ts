/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { stripAnsi } from "./theme.js";
import {
  errorTick,
  feedbackRow,
  progressLine,
  pulseFrame,
  spinnerFrame,
  successTick,
} from "./microfeedback.js";

describe("microfeedback", () => {
  it("cycles spinner and pulse frames", () => {
    expect(spinnerFrame(0)).toBe("⠋");
    expect(spinnerFrame(10)).toBe("⠋");
    expect(pulseFrame(0).length).toBeGreaterThan(3);
  });

  it("renders step rows and ticks", () => {
    expect(stripAnsi(feedbackRow("done", "keys"))).toContain("keys");
    expect(stripAnsi(successTick("ok"))).toContain("ok");
    expect(stripAnsi(errorTick("nope"))).toContain("nope");
  });

  it("renders a progress line", () => {
    const line = stripAnsi(progressLine(2, 5, "deploy"));
    expect(line).toContain("deploy");
    expect(line).toContain("2");
  });
});
