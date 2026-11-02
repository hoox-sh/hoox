/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/** @jsxImportSource @opentui/react */

import { describe, it, expect } from "bun:test";
import { testRender } from "@opentui/react/test-utils";
import { LauncherApp } from "./app";
import { FALLBACK_CATALOG } from "./types";

async function renderLauncher(width = 80, height = 24) {
  const setup = await testRender(
    <LauncherApp catalog={FALLBACK_CATALOG} onResolve={() => {}} />,
    { width, height, exitOnCtrlC: false }
  );
  await setup.renderOnce();
  return setup;
}

describe("LauncherApp", () => {
  it("renders a compact intro: brand, search, recommended, hints", async () => {
    const { captureCharFrame } = await renderLauncher(64, 12);
    const frame = captureCharFrame();
    expect(frame).toContain("HOOX");
    expect(frame).toContain("Cloudflare Workers");
    expect(frame).toContain("Onboard");
    expect(frame).toContain("Operations center");
    expect(frame).toContain("search commands");
    expect(frame).toContain("quit");
  });

  it("stays compact on a narrow terminal", async () => {
    const { captureCharFrame } = await renderLauncher(40, 10);
    const frame = captureCharFrame();
    expect(frame).toContain("HOOX");
    expect(frame).toContain("Onboard");
    expect(frame).toContain("quit");
  });
});
