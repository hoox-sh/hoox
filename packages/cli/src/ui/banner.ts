/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Hoox CLI top banner — Linear Rail default (◆ H · O · O · X).
 *
 * Static on every path: non-TTY / CI / NO_COLOR and TTY all get the same
 * single frame. No assemble/pulse animation.
 */

import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import ansis from "ansis";
import { theme } from "../utils/theme.js";
import { isRichMode } from "../utils/format-mode.js";

// ── Brand palette ─────────────────────────────────────────────────

const ORANGE = ansis.hex("#ff7f2a");
const AMBER = ansis.hex("#ffb722");
const INDIGO = ansis.hex("#818cf8");
const INDIGO_SOFT = ansis.hex("#a5b4fc");
const ZINC = ansis.hex("#a1a1aa");
const ZINC_FAINT = ansis.hex("#52525b");
const ZINC_SOFT = ansis.hex("#71717a");

const TAGLINE = "Cloudflare Workers Platform";

/**
 * Walk up from this file looking for the hoox-cli package.json.
 * Works from source (`src/ui/`) and the bundled `dist/index.js` layout.
 */
function findCliVersion(): string {
  const PKG_NAME = "@hoox-sh/hoox-cli";
  let dir = dirname(fileURLToPath(import.meta.url));
  for (let i = 0; i < 5; i++) {
    const pkgPath = join(dir, "package.json");
    if (existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(readFileSync(pkgPath, "utf-8"));
        if (pkg.name === PKG_NAME) return pkg.version as string;
      } catch {
        // continue walking
      }
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return "unknown";
}

const VERSION: string = findCliVersion();

/** Disclaimer line rendered below the banner and in the menu footer. */
export const DISCLAIMER =
  "DISCLAIMER: Trading cryptocurrencies involves substantial risk of loss. Use at your own risk.";

// ── Linear Rail wordmark ──────────────────────────────────────────
//
// Static settle (~38 cols):
//   ◆  H · O · O · X
//   ────────────────────────────────────
//   Cloudflare Workers Platform · vX.Y.Z

const LETTERS = ["H", "O", "O", "X"] as const;
/** Rule length ≈ tagline + version width (~38). */
const RULE_W = 38;
const PAD = " ";

type PhaseMode = "assemble" | "pulse" | "static";

/** Color the diamond mark (◆). */
function colorDiamond(phase: number, mode: PhaseMode): string {
  if (mode === "assemble") {
    // Appear first, slightly dim until letters start
    if (phase < 0.05) return " ";
    if (phase < 0.2) return ZINC_FAINT("◆");
    return AMBER("◆");
  }
  if (mode === "pulse") {
    // Amber ↔ orange shimmer
    const t = (phase * 2) % 1;
    return t < 0.5 ? AMBER("◆") : ORANGE("◆");
  }
  return AMBER("◆");
}

/** Color a single HOOX letter by index (0–3). */
function colorLetter(
  letter: string,
  index: number,
  phase: number,
  mode: PhaseMode
): string {
  if (mode === "assemble") {
    // Letters reveal left-to-right after the diamond
    // phase 0.15..1.0 maps across 4 letters
    const start = 0.12;
    const span = 0.88;
    const letterPhase = (phase - start) / span;
    const revealAt = index / LETTERS.length;
    if (letterPhase < revealAt) return " ";
    // Soft fill, then solid indigo
    if (letterPhase < revealAt + 0.12) return ZINC(letter);
    return INDIGO.bold(letter);
  }

  if (mode === "pulse") {
    // Subtle indigo pulse sweeping across letters
    const t = (phase * 1.4 + index * 0.18) % 1;
    if (t < 0.15) return INDIGO_SOFT(letter);
    if (t < 0.3) return AMBER(letter);
    return INDIGO.bold(letter);
  }

  return INDIGO.bold(letter);
}

/** Color an interpunct between letters. */
function colorDot(
  afterLetterIndex: number,
  phase: number,
  mode: PhaseMode
): string {
  // Dot appears with the letter that follows it (or with previous letter)
  if (mode === "assemble") {
    const start = 0.12;
    const span = 0.88;
    const letterPhase = (phase - start) / span;
    // Show dot once letter `afterLetterIndex + 1` is about to appear
    const revealAt = (afterLetterIndex + 1) / LETTERS.length;
    if (letterPhase < revealAt - 0.02) return " ";
    return ZINC_FAINT("·");
  }
  return ZINC_FAINT("·");
}

/** Build the linear-rail title line: ◆  H · O · O · X */
function composeTitleLine(phase: number, mode: PhaseMode): string {
  const diamond = colorDiamond(phase, mode);
  const parts: string[] = [diamond, "  "];

  for (let i = 0; i < LETTERS.length; i++) {
    parts.push(colorLetter(LETTERS[i]!, i, phase, mode));
    if (i < LETTERS.length - 1) {
      parts.push(" ");
      parts.push(colorDot(i, phase, mode));
      parts.push(" ");
    }
  }

  return PAD + parts.join("");
}

/** Build the meta line: tagline · vX.Y.Z */
function composeMetaLine(): string {
  return (
    PAD +
    ZINC_SOFT(TAGLINE) +
    " " +
    ZINC_FAINT("·") +
    " " +
    INDIGO_SOFT(`v${VERSION}`)
  );
}

function composeFrame(phase: number, mode: PhaseMode): string {
  const title = composeTitleLine(phase, mode);
  // Soft left accent dot + faint rule (modern-minimal chrome)
  const rule = PAD + ZINC_SOFT("·") + " " + ZINC_FAINT("─".repeat(RULE_W - 2));
  const meta = composeMetaLine();
  return [title, rule, meta].join("\n");
}

// ── Plain fallback ────────────────────────────────────────────────
//
// Every public banner entry point consults `isRichMode()` first. Piped,
// redirected, CI, `NO_COLOR`, `TERM=dumb`, `--no-color`, `--json`, and
// `--quiet` output gets this ASCII-only frame: no ANSI escapes and no
// decorative glyphs.

function composePlainFrame(): string {
  return [
    "  HOOX",
    `  ${"-".repeat(RULE_W)}`,
    `  ${TAGLINE} - v${VERSION}`,
  ].join("\n");
}

// ── Public static API ─────────────────────────────────────────────

/** Default static banner — Linear Rail (final frame). */
export function renderBannerLogo(): string {
  if (!isRichMode()) return composePlainFrame();
  return composeFrame(1, "static");
}

/** @deprecated Prefer renderBannerLogo — kept as alias for callers. */
export function renderBannerMinimal(): string {
  return renderBannerLogo();
}

// ── Alternate variants ────────────────────────────────────────────

/** Larger 6-line block letters (legacy look, still available). */
const LEGACY_LINES = [
  "██╗  ██╗ ██████╗  ██████╗ ██╗  ██╗",
  "██║  ██║██╔═══██╗██╔═══██╗╚██╗██╔╝",
  "███████║██║   ██║██║   ██║ ╚███╔╝ ",
  "██╔══██║██║   ██║██║   ██║ ██╔██╗ ",
  "██║  ██║╚██████╔╝╚██████╔╝██╔╝ ██╗",
  "╚═╝  ╚═╝ ╚═════╝  ╚═════╝ ╚═╝  ╚═╝",
];

export function renderLegacy(): string {
  if (!isRichMode()) return composePlainFrame();
  const bw = 52;
  const line = ` ${theme.box.horizontal.repeat(bw - 2)}`;
  const top = ` ${theme.box.topLeft}${line.slice(2)}${theme.box.topRight}`;
  const bottom = ` ${theme.box.bottomLeft}${line.slice(2)}${theme.box.bottomRight}`;
  const ascii = LEGACY_LINES.map((l) => ` ${theme.heading(l)}`);
  const gap = Math.floor((bw - TAGLINE.length - VERSION.length - 2) / 2);
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${theme.textMuted(`v${VERSION}`)}`;
  return [top, ...ascii, line, tag, bottom].join("\n");
}

/**
 * Horizon — readable 4-line FIGlet HOOX (letters clearly separated).
 * Pure ASCII, indigo-friendly for multi-line moments.
 */
const HORIZON_LINES = [
  " _   _     ___      ___     __  __",
  "| | | |   / _ \\    / _ \\    \\ \\/ /",
  "| |_| |  | (_) |  | (_) |    >  < ",
  " \\___/    \\___/    \\___/    /_/\\_\\",
] as const;

export function renderBannerHorizon(): string {
  if (!isRichMode()) return composePlainFrame();
  const contentW = Math.max(...HORIZON_LINES.map((l) => l.length));
  const bw = Math.max(contentW + 4, TAGLINE.length + VERSION.length + 8);
  const inner = theme.box.horizontal.repeat(bw - 2);
  const top = ` ${theme.textFaint("╭")}${inner}${theme.textFaint("╮")}`;
  const bottom = ` ${theme.textFaint("╰")}${inner}${theme.textFaint("╯")}`;
  const ascii = HORIZON_LINES.map((l, i) => {
    // Soft gradient: top rows slightly brighter
    const color = i < 2 ? theme.heading : theme.accent;
    return `  ${color(l)}`;
  });
  const gap = Math.max(
    0,
    Math.floor((bw - TAGLINE.length - VERSION.length - 4) / 2)
  );
  const tag = ` ${" ".repeat(gap)}${theme.textMuted(TAGLINE)} ${INDIGO_SOFT(`v${VERSION}`)}`;
  return [
    top,
    ...ascii,
    ` ${ZINC_SOFT("·")} ${ZINC_FAINT("─".repeat(bw - 4))}`,
    tag,
    bottom,
  ].join("\n");
}

/**
 * Signal — slim rail + pulse wave (edge-ops vibe).
 * Keeps the default diamond mark and adds a soft activity line.
 */
export function renderBannerSignal(): string {
  if (!isRichMode()) return composePlainFrame();
  const title =
    PAD +
    AMBER("◆") +
    "  " +
    INDIGO.bold("H") +
    " " +
    ZINC_FAINT("·") +
    " " +
    INDIGO.bold("O") +
    " " +
    ZINC_FAINT("·") +
    " " +
    INDIGO.bold("O") +
    " " +
    ZINC_FAINT("·") +
    " " +
    INDIGO.bold("X");
  const wave =
    PAD +
    ZINC_FAINT("·") +
    " " +
    theme.accent("▁▂▃▅▃▂▁") +
    ZINC_FAINT("·") +
    theme.accent("▂▄▆▄▂") +
    ZINC_FAINT("·") +
    "  " +
    ZINC_SOFT(TAGLINE) +
    " " +
    INDIGO_SOFT(`v${VERSION}`);
  const rule = PAD + ZINC_SOFT("·") + " " + ZINC_FAINT("─".repeat(RULE_W - 2));
  return [title, rule, wave].join("\n");
}

export const BANNER_VARIANTS = {
  logo: renderBannerLogo,
  minimal: renderBannerLogo,
  legacy: renderLegacy,
  horizon: renderBannerHorizon,
  signal: renderBannerSignal,
} as const;

export type BannerVariant = keyof typeof BANNER_VARIANTS;

/** Default banner — Linear Rail (static final frame). */
export function renderBanner(variant?: BannerVariant): string {
  if (!isRichMode()) return composePlainFrame();
  return variant ? BANNER_VARIANTS[variant]() : renderBannerLogo();
}

/** Compact one-line banner for inline display. */
export function renderCompactBanner(): string {
  if (!isRichMode()) return `Hoox - v${VERSION}`;
  return (
    `${AMBER("◆")} ${INDIGO.bold("Hoox")}` +
    `  ${ZINC_FAINT("·")}  ` +
    INDIGO_SOFT(`v${VERSION}`)
  );
}

// ── Animation ─────────────────────────────────────────────────────

/**
 * Print the banner.
 *
 * Static by design: the shell is mechanical, so there is no assemble/pulse
 * animation and no cursor-hide/clear sequence. Kept async for API
 * compatibility with callers that previously awaited the animation.
 *
 * @returns number of lines written
 */
export async function animateBanner(_options?: {
  /** @deprecated Ignored — the banner is always static. */
  durationMs?: number;
  /** @deprecated Ignored — the banner is always static. */
  static?: boolean;
}): Promise<number> {
  // `renderBannerLogo()` owns the rich-mode gate, so this path emits the
  // plain ASCII frame when piped, in CI, or under NO_COLOR.
  const frame = renderBannerLogo();
  process.stdout.write(frame + "\n");
  return frame.split("\n").length;
}
