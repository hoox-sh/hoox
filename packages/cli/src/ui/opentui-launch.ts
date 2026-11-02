/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Spawn the OpenTUI CLI start screen and wait for a launcher result.
 *
 * The launcher lives in `@hoox-sh/hoox-tui` so the CLI does not take a
 * hard OpenTUI dependency. Missing TUI / non-TTY / CI fall through.
 */

import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir, homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { Command } from "commander";
import {
  getHooxRepoPath,
  getTuiLauncherCandidates,
  resolveHooxRuntimeRoot,
} from "@hoox-sh/hoox-shared";
import { buildLauncherCatalog, type LauncherCatalog } from "./catalog.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const TUI_PKG = "@hoox-sh/hoox-tui";

export type LauncherResult =
  { action: "quit" } | { action: "run"; argv: string[]; longRunning?: boolean };

function collectLauncherCandidates(): string[] {
  const candidates: string[] = [];
  const explicit = process.env.HOOX_LAUNCHER_ENTRY?.trim();
  if (explicit) candidates.push(resolve(explicit));

  const runtime = resolveHooxRuntimeRoot();
  if (runtime.root) {
    candidates.push(...getTuiLauncherCandidates(runtime.root));
  }
  candidates.push(...getTuiLauncherCandidates(getHooxRepoPath()));

  candidates.push(
    resolve(__dirname, "../../../../tui/src/launcher.tsx"),
    resolve(__dirname, "../../../../tui/dist/launcher.js"),
    resolve(__dirname, "../../../tui/src/launcher.tsx"),
    resolve(__dirname, "../../../tui/dist/launcher.js"),
    resolve(process.cwd(), "packages/tui/src/launcher.tsx"),
    resolve(process.cwd(), "packages/tui/dist/launcher.js")
  );

  try {
    const pkgJsonPath = require.resolve(`${TUI_PKG}/package.json`);
    const root = dirname(pkgJsonPath);
    candidates.push(
      join(root, "src", "launcher.tsx"),
      join(root, "dist", "launcher.js")
    );
  } catch {
    // optional package missing
  }

  const bunGlobal = join(
    homedir(),
    ".bun",
    "install",
    "global",
    "node_modules",
    TUI_PKG
  );
  candidates.push(
    join(bunGlobal, "src", "launcher.tsx"),
    join(bunGlobal, "dist", "launcher.js")
  );

  try {
    const which = Bun.which("hoox-tui");
    if (which) {
      let binPath = which;
      try {
        binPath = realpathSync(which);
      } catch {
        /* keep */
      }
      const pkgRoot = resolve(dirname(binPath), "..");
      candidates.push(
        join(pkgRoot, "src", "launcher.tsx"),
        join(pkgRoot, "dist", "launcher.js")
      );
    }
  } catch {
    /* ignore */
  }

  return [...new Set(candidates)];
}

export function resolveLauncherEntry(): string | null {
  for (const path of collectLauncherCandidates()) {
    if (existsSync(path)) return path;
  }
  return null;
}

export function shouldLaunchStartScreen(): boolean {
  if (process.env.HOOX_NO_LAUNCHER === "1") return false;
  if (process.env.CI === "1" || process.env.CI === "true") return false;
  if (process.env.TERM === "dumb") return false;
  if (process.env.NO_COLOR) return false;
  return Boolean(process.stdin.isTTY && process.stdout.isTTY);
}

function parseResult(raw: string): LauncherResult | null {
  try {
    const parsed = JSON.parse(raw) as LauncherResult;
    if (parsed?.action === "quit") return { action: "quit" };
    if (
      parsed?.action === "run" &&
      Array.isArray(parsed.argv) &&
      parsed.argv.every((a) => typeof a === "string") &&
      parsed.argv.length > 0
    ) {
      return {
        action: "run",
        argv: parsed.argv,
        longRunning: Boolean(parsed.longRunning),
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Run the OpenTUI start screen once. Returns null when the TUI package
 * is missing or the child exits without a result file.
 */
export async function runOpenTuiLauncher(
  program: Command,
  opts: { version: string; recents?: string[] }
): Promise<LauncherResult | null> {
  const entry = resolveLauncherEntry();
  if (!entry) return null;

  const dir = mkdtempSync(join(tmpdir(), "hoox-launcher-"));
  const catalogPath = join(dir, "catalog.json");
  const resultPath = join(dir, "result.json");

  const catalog: LauncherCatalog = buildLauncherCatalog(program, {
    version: opts.version,
    cwd: process.cwd(),
    recents: opts.recents,
  });
  writeFileSync(catalogPath, JSON.stringify(catalog), "utf-8");

  try {
    const code = await new Promise<number | null>((resolveChild, reject) => {
      const child = spawn("bun", ["run", entry], {
        stdio: "inherit",
        env: {
          ...process.env,
          HOOX_LAUNCHER_CATALOG: catalogPath,
          HOOX_LAUNCHER_RESULT: resultPath,
        },
      });
      child.on("close", (exitCode) => resolveChild(exitCode));
      child.on("error", (err) => reject(err));
    });

    if (code !== 0 && code !== null && !existsSync(resultPath)) {
      return null;
    }
    if (!existsSync(resultPath)) return { action: "quit" };
    return parseResult(readFileSync(resultPath, "utf-8")) ?? { action: "quit" };
  } finally {
    try {
      rmSync(dir, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }
}
