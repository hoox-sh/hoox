/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";
import {
  resolveLauncherEntry,
  shouldLaunchStartScreen,
} from "./opentui-launch.js";

describe("resolveLauncherEntry", () => {
  it("finds the monorepo launcher entry", () => {
    const entry = resolveLauncherEntry();
    expect(entry).toBeTruthy();
    expect(existsSync(entry!)).toBe(true);
    expect(entry).toMatch(/launcher\.(tsx|js)$/);
  });
});

describe("shouldLaunchStartScreen", () => {
  it("is false when HOOX_NO_LAUNCHER=1", () => {
    const prev = process.env.HOOX_NO_LAUNCHER;
    process.env.HOOX_NO_LAUNCHER = "1";
    try {
      expect(shouldLaunchStartScreen()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.HOOX_NO_LAUNCHER;
      else process.env.HOOX_NO_LAUNCHER = prev;
    }
  });
});
