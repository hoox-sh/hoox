/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { filterLauncherItems } from "./filter";
import { FALLBACK_CATALOG } from "./types";

describe("filterLauncherItems", () => {
  it("puts recommended items first when the query is empty", () => {
    const out = filterLauncherItems(FALLBACK_CATALOG.items, "");
    expect(out.length).toBeGreaterThan(0);
    expect(out[0]?.recommended).toBe(true);
  });

  it("ranks an argv prefix above a fuzzy haystack match", () => {
    const out = filterLauncherItems(FALLBACK_CATALOG.items, "dep");
    expect(out[0]?.argv[0]).toBe("deploy");
    expect(out.some((i) => i.argv.join(" ") === "deploy all")).toBe(true);
  });

  it("matches keywords", () => {
    const out = filterLauncherItems(FALLBACK_CATALOG.items, "ops");
    expect(out.some((i) => i.id === "tui")).toBe(true);
  });

  it("returns an empty list when nothing matches", () => {
    expect(filterLauncherItems(FALLBACK_CATALOG.items, "zzzz-nope")).toEqual(
      []
    );
  });
});
