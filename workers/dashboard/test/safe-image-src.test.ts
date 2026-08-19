/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import { parseSafeImageSrc } from "../src/lib/safe-image-src";

describe("parseSafeImageSrc", () => {
  it("accepts http(s) and normalizes via URL", () => {
    expect(parseSafeImageSrc("https://example.com/chart.png")).toBe(
      "https://example.com/chart.png"
    );
    expect(parseSafeImageSrc("  http://cdn.example/a.jpg  ")).toBe(
      "http://cdn.example/a.jpg"
    );
  });

  it("accepts data:image base64 and blob: URLs", () => {
    expect(parseSafeImageSrc("data:image/png;base64,abc")).toBe(
      "data:image/png;base64,abc"
    );
    expect(parseSafeImageSrc("blob:https://hoox.local/123")).toBe(
      "blob:https://hoox.local/123"
    );
  });

  it("rejects javascript:, data:html, and empty values", () => {
    expect(parseSafeImageSrc("javascript:alert(1)")).toBeNull();
    expect(parseSafeImageSrc("data:text/html,<img>")).toBeNull();
    expect(parseSafeImageSrc("data:image/svg+xml,<svg>")).toBeNull();
    expect(parseSafeImageSrc("")).toBeNull();
    expect(parseSafeImageSrc("  ")).toBeNull();
    expect(parseSafeImageSrc("/relative.png")).toBeNull();
  });

  it("returns encodeURI of the scheme-checked URL", () => {
    const raw = "https://example.com/chart.png";
    expect(parseSafeImageSrc(raw)).toBe(encodeURI(raw));
  });
});
