/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import {
  renderBanner,
  renderBannerMinimal,
  renderBannerLogo,
  renderLegacy,
  renderCompactBanner,
  animateBanner,
  BANNER_VARIANTS,
  DISCLAIMER,
} from "./banner.js";
import { stripAnsi } from "../utils/theme.js";

describe("renderBanner", () => {
  it("renders the logo variant by default", () => {
    const defaultBanner = renderBanner();
    const logoBanner = renderBannerLogo();
    expect(stripAnsi(defaultBanner)).toBe(stripAnsi(logoBanner));
  });

  it("minimal is an alias of logo", () => {
    expect(stripAnsi(renderBannerMinimal())).toBe(
      stripAnsi(renderBannerLogo())
    );
  });

  it("renders the explicitly-requested variant", () => {
    const horizon = renderBanner("horizon");
    const logo = renderBanner("logo");
    expect(stripAnsi(horizon)).not.toBe(stripAnsi(logo));
  });

  it("renders Linear Rail wordmark (◆ H · O · O · X)", () => {
    const plain = stripAnsi(renderBannerLogo());
    // No old ASCII box-drawing wordmark patterns
    expect(plain).not.toContain("_   _");
    expect(plain).not.toContain("| | | |");
    // Linear Rail letters + diamond
    expect(plain).toContain("◆");
    expect(plain).toMatch(/H\s*·\s*O\s*·\s*O\s*·\s*X/);
  });

  it("includes the HOOX wordmark and tagline", () => {
    const plain = stripAnsi(renderBannerLogo());
    expect(plain).toContain("H");
    expect(plain).toContain("O");
    expect(plain).toContain("X");
    expect(plain).toContain("Cloudflare Workers Platform");
  });

  it("strips cleanly (no ansi codes leftover after visible text)", () => {
    for (const v of Object.keys(BANNER_VARIANTS) as Array<
      keyof typeof BANNER_VARIANTS
    >) {
      const out = BANNER_VARIANTS[v]();
      for (const line of out.split("\n")) {
        expect(line.startsWith("\x1b") || line.endsWith("\x1b")).toBe(false);
      }
    }
  });
});

describe("banner version (bug fix)", () => {
  it("includes the current package.json version, not a hardcoded one", () => {
    const out = renderCompactBanner();
    expect(out).toMatch(/v?\d+\.\d+\.\d+/);
  });

  it("the legacy variant does NOT show 'v0.3.0' (the bug)", () => {
    const out = renderLegacy();
    expect(out).not.toContain("0.3.0");
  });

  it("resolves the version from package.json in any layout (source or bundle)", async () => {
    const mod = await import("./banner.js");
    expect(mod).toBeDefined();
    const out = mod.renderCompactBanner();
    expect(out).not.toContain("unknown");
    expect(out).toMatch(/v\d+\.\d+\.\d+/);
  });

  it("static logo banner includes the package version", () => {
    const plain = stripAnsi(renderBannerLogo());
    expect(plain).toMatch(/v\d+\.\d+\.\d+/);
  });
});

describe("renderCompactBanner", () => {
  it("returns a single line", () => {
    const out = renderCompactBanner();
    expect(out.split("\n").length).toBe(1);
  });

  it("includes diamond, Hoox, and version", () => {
    const plain = stripAnsi(renderCompactBanner());
    expect(plain).toContain("◆");
    expect(plain).toContain("Hoox");
    expect(plain).toMatch(/v\d+\.\d+\.\d+/);
  });
});

describe("animateBanner", () => {
  it("writes a static frame when forced static (non-TTY path)", async () => {
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      const lines = await animateBanner({ static: true });
      // Linear Rail: title + rule + meta ≈ 3 lines
      expect(lines).toBeGreaterThanOrEqual(2);
      expect(lines).toBeLessThanOrEqual(5);
      const out = chunks.join("");
      expect(stripAnsi(out)).toContain("Cloudflare Workers Platform");
      expect(stripAnsi(out)).toMatch(/H\s*·\s*O\s*·\s*O\s*·\s*X/);
      // Static path must not use cursor hide / line-clear animation sequences
      expect(out).not.toContain("\x1b[?25l");
      expect(out).not.toContain("\x1b[2K");
      // eslint-disable-next-line no-control-regex -- intentional: matches ESC cursor-up sequences
      expect(out).not.toMatch(/\x1b\[\d+A/);
    } finally {
      process.stdout.write = origWrite;
    }
  });

  it("stays static even on a TTY (mechanical shell)", async () => {
    const origTTY = process.stdout.isTTY;
    const origNoColor = process.env.NO_COLOR;
    const origTerm = process.env.TERM;
    const origCi = process.env.CI;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    delete process.env.NO_COLOR;
    delete process.env.CI;
    process.env.TERM = "xterm-256color";

    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      const lines = await animateBanner({ durationMs: 50 });
      expect(lines).toBeGreaterThan(0);
      const out = chunks.join("");
      // No cursor-hide / line-clear animation on any path
      expect(out).not.toContain("\x1b[?25l");
      expect(out).not.toContain("\x1b[2K");
      expect(stripAnsi(out)).toContain("Cloudflare Workers Platform");
    } finally {
      process.stdout.write = origWrite;
      Object.defineProperty(process.stdout, "isTTY", {
        value: origTTY,
        configurable: true,
      });
      if (origNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = origNoColor;
      if (origTerm === undefined) delete process.env.TERM;
      else process.env.TERM = origTerm;
      if (origCi === undefined) delete process.env.CI;
      else process.env.CI = origCi;
    }
  });

  it("falls back to static when CI=true even on TTY", async () => {
    const origTTY = process.stdout.isTTY;
    const origNoColor = process.env.NO_COLOR;
    const origTerm = process.env.TERM;
    const origCi = process.env.CI;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
    });
    delete process.env.NO_COLOR;
    process.env.TERM = "xterm-256color";
    process.env.CI = "true";

    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      await animateBanner({ durationMs: 50 });
      const out = chunks.join("");
      expect(out).not.toContain("\x1b[?25l");
    } finally {
      process.stdout.write = origWrite;
      Object.defineProperty(process.stdout, "isTTY", {
        value: origTTY,
        configurable: true,
      });
      if (origNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = origNoColor;
      if (origTerm === undefined) delete process.env.TERM;
      else process.env.TERM = origTerm;
      if (origCi === undefined) delete process.env.CI;
      else process.env.CI = origCi;
    }
  });
});

describe("renderBannerSignal / horizon", () => {
  it("renders signal and horizon variants with tagline", () => {
    const signal = stripAnsi(BANNER_VARIANTS.signal());
    const horizon = stripAnsi(BANNER_VARIANTS.horizon());
    expect(signal).toContain("Cloudflare Workers Platform");
    expect(horizon).toContain("Cloudflare Workers Platform");
    expect(signal).not.toBe(horizon);
  });
});

describe("DISCLAIMER", () => {
  it("is a non-empty string mentioning trading risk", () => {
    expect(DISCLAIMER.length).toBeGreaterThan(0);
    expect(DISCLAIMER.toLowerCase()).toContain("risk");
  });
});
