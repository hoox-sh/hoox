/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync, statSync } from "node:fs";
import { isAbsolute, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Monorepo root that contains this package. */
export function packageRepoRoot(): string {
  return resolve(fileURLToPath(new URL(".", import.meta.url)), "../../..");
}

export function isHooxRoot(dir: string): boolean {
  return existsSync(join(dir, "packages/cli/package.json"));
}

export function hooxBinPath(): string {
  const override = process.env.HOOX_BIN;
  if (override && override.length > 0) return resolve(override);
  return join(packageRepoRoot(), "packages/cli/bin/hoox.js");
}

export function resolveCwd(
  requested?: string
): { ok: true; cwd: string } | { ok: false; message: string } {
  if (requested !== undefined) {
    if (!isAbsolute(requested)) {
      return { ok: false, message: "cwd must be an absolute path" };
    }
    return checkDir(requested);
  }
  const fromEnv = process.env.HOOX_REPO;
  if (fromEnv && isHooxRoot(resolve(fromEnv))) {
    return { ok: true, cwd: resolve(fromEnv) };
  }
  if (isHooxRoot(process.cwd())) return { ok: true, cwd: process.cwd() };
  const embedded = packageRepoRoot();
  if (isHooxRoot(embedded)) return { ok: true, cwd: embedded };
  return {
    ok: false,
    message:
      "Pass cwd as an absolute Hoox checkout (it must contain packages/cli/package.json).",
  };
}

function checkDir(
  dir: string
): { ok: true; cwd: string } | { ok: false; message: string } {
  let info;
  try {
    info = statSync(dir);
  } catch {
    return { ok: false, message: `cwd does not exist: ${dir}` };
  }
  if (!info.isDirectory()) {
    return { ok: false, message: `cwd is not a directory: ${dir}` };
  }
  if (!isHooxRoot(dir)) {
    return { ok: false, message: `cwd is not a Hoox checkout: ${dir}` };
  }
  return { ok: true, cwd: dir };
}
