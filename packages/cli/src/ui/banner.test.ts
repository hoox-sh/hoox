/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import ansis from "ansis";
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

/** Run `fn` with a rich TTY (color on) and restore the environment after. */
function withRichMode<T>(fn: () => T): T {
  const origTTY = process.stdout.isTTY;
  const origNoColor = process.env.NO_COLOR;
  const origTerm = process.env.TERM;
  const origLevel = ansis.level;
  Object.defineProperty(process.stdout, "isTTY", {
    value: true,
    configurable: true,
    writable: true,
  });
  delete process.env.NO_COLOR;
  process.env.TERM = "xterm-256color";
  ansis.level = 3;
  try {
    return fn();
  } finally {
    Object.defineProperty(process.stdout, "isTTY", {
      value: origTTY,
      configurable: true,
      writable: true,
    });
    if (origNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = origNoColor;
    if (origTerm === undefined) delete process.env.TERM;
    else process.env.TERM = origTerm;
    ansis.level = origLevel;
  }
}

/** Run `fn` with a non-TTY (piped) environment and restore it after. */
function withPipedMode<T>(fn: () => T): T {
  const origTTY = process.stdout.isTTY;
  const origNoColor = process.env.NO_COLOR;
  const origTerm = process.env.TERM;
  Object.defineProperty(process.stdout, "isTTY", {
    value: false,
    configurable: true,
    writable: true,
  });
  delete process.env.NO_COLOR;
  process.env.TERM = "xterm-256color";
  try {
    return fn();
  } finally {
    Object.defineProperty(process.stdout, "isTTY", {
      value: origTTY,
      configurable: true,
      writable: true,
    });
    if (origNoColor === undefined) delete process.env.NO_COLOR;
    else process.env.NO_COLOR = origNoColor;
    if (origTerm === undefined) delete process.env.TERM;
    else process.env.TERM = origTerm;
  }
}

/** True when the string contains only printable ASCII and newlines. */
function isAsciiOnly(value: string): boolean {
  return /^[\x20-\x7e\n]*$/.test(value);
}

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
    withRichMode(() => {
      const horizon = renderBanner("horizon");
      const logo = renderBanner("logo");
      expect(stripAnsi(horizon)).not.toBe(stripAnsi(logo));
    });
  });

  it("renders Linear Rail wordmark (◆ H · O · O · X) on a TTY", () => {
    withRichMode(() => {
      const plain = stripAnsi(renderBannerLogo());
      // No old ASCII box-drawing wordmark patterns
      expect(plain).not.toContain("_   _");
      expect(plain).not.toContain("| | | |");
      // Linear Rail letters + diamond
      expect(plain).toContain("◆");
      expect(plain).toMatch(/H\s*·\s*O\s*·\s*O\s*·\s*X/);
    });
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

  it("includes diamond, Hoox, and version on a TTY", () => {
    withRichMode(() => {
      const plain = stripAnsi(renderCompactBanner());
      expect(plain).toContain("◆");
      expect(plain).toContain("Hoox");
      expect(plain).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  it("is plain ASCII when piped", () => {
    withPipedMode(() => {
      const out = renderCompactBanner();
      expect(out).not.toContain("\x1b");
      expect(out).not.toContain("◆");
      expect(isAsciiOnly(out)).toBe(true);
      expect(out).toMatch(/v\d+\.\d+\.\d+/);
    });
  });
});

describe("animateBanner", () => {
  it("writes a plain ASCII frame on the non-TTY path", async () => {
    const origTTY = process.stdout.isTTY;
    Object.defineProperty(process.stdout, "isTTY", {
      value: false,
      configurable: true,
      writable: true,
    });
    const chunks: string[] = [];
    const origWrite = process.stdout.write.bind(process.stdout);
    process.stdout.write = ((chunk: string | Uint8Array) => {
      chunks.push(typeof chunk === "string" ? chunk : chunk.toString());
      return true;
    }) as typeof process.stdout.write;

    try {
      const lines = await animateBanner({ static: true });
      // Plain frame: wordmark + rule + meta = 3 lines
      expect(lines).toBeGreaterThanOrEqual(2);
      expect(lines).toBeLessThanOrEqual(5);
      const out = chunks.join("");
      expect(out).toContain("Cloudflare Workers Platform");
      expect(out).toContain("HOOX");
      // Piped output carries no ANSI and no decorative glyphs.
      expect(out).not.toContain("\x1b");
      expect(isAsciiOnly(out)).toBe(true);
      // Static path must not use cursor hide / line-clear animation sequences
      expect(out).not.toContain("\x1b[?25l");
      expect(out).not.toContain("\x1b[2K");
      // eslint-disable-next-line no-control-regex -- intentional: matches ESC cursor-up sequences
      expect(out).not.toMatch(/\x1b\[\d+A/);
    } finally {
      process.stdout.write = origWrite;
      Object.defineProperty(process.stdout, "isTTY", {
        value: origTTY,
        configurable: true,
        writable: true,
      });
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
    withRichMode(() => {
      const signal = stripAnsi(BANNER_VARIANTS.signal());
      const horizon = stripAnsi(BANNER_VARIANTS.horizon());
      expect(signal).toContain("Cloudflare Workers Platform");
      expect(horizon).toContain("Cloudflare Workers Platform");
      expect(signal).not.toBe(horizon);
    });
  });
});

describe("banner plain mode (P2-7)", () => {
  it("renderBannerLogo is ASCII-only when piped", () => {
    withPipedMode(() => {
      const out = renderBannerLogo();
      expect(out).not.toContain("\x1b");
      expect(isAsciiOnly(out)).toBe(true);
      expect(out).toContain("Cloudflare Workers Platform");
      expect(out).toMatch(/v\d+\.\d+\.\d+/);
    });
  });

  it("renderBanner falls back to the plain frame for every variant when piped", () => {
    withPipedMode(() => {
      for (const variant of Object.keys(BANNER_VARIANTS) as Array<
        keyof typeof BANNER_VARIANTS
      >) {
        const out = renderBanner(variant);
        expect(out).not.toContain("\x1b");
        expect(isAsciiOnly(out)).toBe(true);
      }
    });
  });

  it("honors NO_COLOR even on a TTY", () => {
    const origTTY = process.stdout.isTTY;
    const origNoColor = process.env.NO_COLOR;
    Object.defineProperty(process.stdout, "isTTY", {
      value: true,
      configurable: true,
      writable: true,
    });
    process.env.NO_COLOR = "1";
    try {
      const out = renderBannerLogo();
      expect(out).not.toContain("\x1b");
      expect(isAsciiOnly(out)).toBe(true);
    } finally {
      Object.defineProperty(process.stdout, "isTTY", {
        value: origTTY,
        configurable: true,
        writable: true,
      });
      if (origNoColor === undefined) delete process.env.NO_COLOR;
      else process.env.NO_COLOR = origNoColor;
    }
  });
});

describe("DISCLAIMER", () => {
  it("is a non-empty string mentioning trading risk", () => {
    expect(DISCLAIMER.length).toBeGreaterThan(0);
    expect(DISCLAIMER.toLowerCase()).toContain("risk");
  });
});
