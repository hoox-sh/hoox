/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Path Resolution Service for Hoox
 *
 * Provides cross-OS utilities for resolving the $HOME/.hoox directory location
 * and constructing type-safe paths within it.
 *
 * Supports macOS, Linux, and Windows with proper fallback handling.
 *
 * Runtime layout:
 *   $HOME/.hoox/              — getHooxHome() (override with HOOX_HOME)
 *   $HOME/.hoox/repo/         — managed clone of the hoox monorepo (getHooxRepoPath)
 *   $HOME/.hoox/config/       — user config
 *   $HOME/.hoox/config/monorepo.json — remembered local monorepo path
 *   $HOME/.hoox/data/         — persistent state
 *
 * Tool/runtime resolution (resolveHooxRuntimeRoot):
 *   1. HOOX_REPO env (explicit monorepo path)
 *   2. Walk up from cwd for a local hoox monorepo checkout
 *   3. Remembered monorepo path (~/.hoox/config/monorepo.json)
 *   4. $HOME/.hoox/repo (global managed clone)
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
  chmodSync,
} from "fs";
import { homedir } from "os";
import { dirname, join, resolve, sep } from "path";

/**
 * Branded type for Hoox paths to prevent accidental string usage.
 * This ensures type safety when working with paths.
 */
export type HooxPath = string & { readonly __brand: "HooxPath" };

/** Where resolveHooxRuntimeRoot found (or failed to find) a setup monorepo. */
export type RuntimeRootSource =
  "env" | "cwd" | "remembered" | "global" | "none";

/** Result of resolveHooxRuntimeRoot(). */
export interface RuntimeRootResult {
  /** Absolute monorepo root, or null if none found. */
  root: string | null;
  /** Which resolution step produced the result. */
  source: RuntimeRootSource;
  /** Paths inspected (for doctor / error messages). */
  checked: {
    env?: string;
    cwd: string | null;
    remembered?: string | null;
    global: string;
  };
}

/** Persisted monorepo pointer written when the CLI discovers a checkout. */
export interface RememberedMonorepo {
  /** Absolute path to monorepo root. */
  root: string;
  /** ISO timestamp of last successful remember. */
  updatedAt: string;
}

/**
 * Creates a branded HooxPath from a string.
 * @internal Use only internally; prefer getHooxHome() and resolveHooxPath()
 */
function createHooxPath(path: string): HooxPath {
  return path as HooxPath;
}

/**
 * True when `child` is `parent` or a descendant. Uses a trailing separator
 * so `/home/alice/.hoox-evil` is not treated as inside `/home/alice/.hoox`.
 */
function isInsideDir(child: string, parent: string): boolean {
  const resolvedChild = resolve(child);
  const resolvedParent = resolve(parent);
  const cmpChild =
    process.platform === "win32" ? resolvedChild.toLowerCase() : resolvedChild;
  const cmpParent =
    process.platform === "win32"
      ? resolvedParent.toLowerCase()
      : resolvedParent;
  if (cmpChild === cmpParent) return true;
  const prefix = cmpParent.endsWith(sep) ? cmpParent : cmpParent + sep;
  return cmpChild.startsWith(prefix);
}

/**
 * Gets the Hoox home directory location: $HOME/.hoox
 *
 * Behavior:
 * - HOOX_HOME env wins when set (absolute or relative, then resolved)
 * - Else $HOME/.hoox on macOS, Linux, Windows
 * - Falls back to current working directory if HOME is not available
 * - Resolves to absolute path
 *
 * @returns Absolute path to $HOME/.hoox as a branded HooxPath
 * @throws Never — always returns a valid path
 *
 * @example
 * ```typescript
 * const hooxHome = getHooxHome();
 * // Returns: "/Users/alice/.hoox" (macOS)
 * // Returns: "/home/alice/.hoox" (Linux)
 * // Returns: "C:\\Users\\alice\\.hoox" (Windows)
 * ```
 */
export function getHooxHome(): HooxPath {
  try {
    const override = process.env.HOOX_HOME?.trim();
    if (override) {
      return createHooxPath(resolve(override));
    }
    const home = homedir();
    if (!home || home.length === 0) {
      // Fallback: use current working directory
      return createHooxPath(resolve(process.cwd(), ".hoox"));
    }
    return createHooxPath(join(home, ".hoox"));
  } catch {
    // Fallback: use current working directory if homedir() throws
    return createHooxPath(resolve(process.cwd(), ".hoox"));
  }
}

/**
 * True when `dir` looks like a hoox monorepo root.
 *
 * Aligns with CLI `verifyRepoRoot`:
 *   - Required: `packages/cli/package.json`
 *   - Plus one of: `wrangler.jsonc`, `wrangler.jsonc.example`, `workers/`, `.gitmodules`
 *
 * (`wrangler.jsonc` is gitignored and created by init — fresh clones only
 * ship `wrangler.jsonc.example`.)
 */
export function isHooxSetupRoot(dir: string): boolean {
  if (!dir) return false;
  try {
    const root = resolve(dir);
    if (!existsSync(join(root, "packages", "cli", "package.json"))) {
      return false;
    }
    return (
      existsSync(join(root, "wrangler.jsonc")) ||
      existsSync(join(root, "wrangler.jsonc.example")) ||
      existsSync(join(root, "workers")) ||
      existsSync(join(root, ".gitmodules"))
    );
  } catch {
    return false;
  }
}

/**
 * Path to the remembered monorepo pointer file.
 * `$HOOX_HOME/config/monorepo.json` (default `~/.hoox/config/monorepo.json`).
 */
export function getRememberedMonorepoPath(): HooxPath {
  return resolveHooxPath("config/monorepo.json");
}

/**
 * Read the last monorepo path the CLI discovered (if still valid).
 * Returns null when missing, unreadable, or no longer a setup root.
 */
export function getRememberedMonorepoRoot(): string | null {
  try {
    const path = getRememberedMonorepoPath();
    if (!existsSync(path)) return null;
    const raw = readFileSync(path, "utf-8");
    const data = JSON.parse(raw) as Partial<RememberedMonorepo>;
    if (!data.root || typeof data.root !== "string") return null;
    const resolved = resolve(data.root);
    return isHooxSetupRoot(resolved) ? resolved : null;
  } catch {
    return null;
  }
}

/**
 * Persist a monorepo root for future CLI invocations from any cwd.
 * No-op when path is not a valid setup root.
 */
export function rememberMonorepoRoot(root: string): boolean {
  try {
    const resolved = resolve(root);
    if (!isHooxSetupRoot(resolved)) return false;
    const configDir = getHooxConfigDir();
    mkdirSync(configDir, { recursive: true, mode: 0o700 });
    try {
      chmodSync(configDir, 0o700);
    } catch {
      /* ignore */
    }
    const payload: RememberedMonorepo = {
      root: resolved,
      updatedAt: new Date().toISOString(),
    };
    const path = getRememberedMonorepoPath();
    writeFileSync(path, JSON.stringify(payload, null, 2) + "\n", {
      mode: 0o600,
    });
    try {
      chmodSync(path, 0o600);
    } catch {
      /* ignore */
    }
    return true;
  } catch {
    return false;
  }
}

/**
 * Walk up from `startDir` looking for a hoox monorepo root.
 *
 * @returns Absolute root path, or null if not found
 */
export function findHooxSetupRoot(
  startDir: string = process.cwd()
): string | null {
  let dir = resolve(startDir);
  for (;;) {
    if (isHooxSetupRoot(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

/**
 * Resolve the Hoox tool/runtime monorepo root (local checkout or global clone).
 *
 * Order:
 *   1. HOOX_REPO — must pass isHooxSetupRoot or result is source "env" with root null
 *   2. Walk up from cwd
 *   3. Remembered monorepo (~/.hoox/config/monorepo.json) — last discovered checkout
 *   4. getHooxRepoPath() ($HOME/.hoox/repo or $HOOX_HOME/repo)
 *
 * Project cwd and tool root are intentionally separate: a random project
 * directory can still use a remembered or global monorepo for CLI ops.
 */
export function resolveHooxRuntimeRoot(options?: {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  /** Skip reading remembered path (tests). Default false. */
  skipRemembered?: boolean;
}): RuntimeRootResult {
  const env = options?.env ?? process.env;
  const cwd = resolve(options?.cwd ?? process.cwd());
  const globalRepo = getHooxRepoPath();
  const remembered = options?.skipRemembered
    ? null
    : getRememberedMonorepoRoot();

  const envRepo = env.HOOX_REPO?.trim();
  if (envRepo) {
    const resolved = resolve(envRepo);
    if (isHooxSetupRoot(resolved)) {
      return {
        root: resolved,
        source: "env",
        checked: {
          env: resolved,
          cwd: findHooxSetupRoot(cwd),
          remembered,
          global: globalRepo,
        },
      };
    }
    return {
      root: null,
      source: "env",
      checked: {
        env: resolved,
        cwd: findHooxSetupRoot(cwd),
        remembered,
        global: globalRepo,
      },
    };
  }

  const local = findHooxSetupRoot(cwd);
  if (local) {
    return {
      root: local,
      source: "cwd",
      checked: { cwd: local, remembered, global: globalRepo },
    };
  }

  if (remembered) {
    return {
      root: remembered,
      source: "remembered",
      checked: { cwd: null, remembered, global: globalRepo },
    };
  }

  if (isHooxSetupRoot(globalRepo)) {
    return {
      root: globalRepo,
      source: "global",
      checked: { cwd: null, remembered: null, global: globalRepo },
    };
  }

  return {
    root: null,
    source: "none",
    checked: { cwd: null, remembered: null, global: globalRepo },
  };
}

/**
 * Candidate TUI entry files under a monorepo root (source first, then dist).
 */
export function getTuiEntryCandidates(runtimeRoot: string): string[] {
  const root = resolve(runtimeRoot);
  return [
    join(root, "packages", "tui", "src", "main.tsx"),
    join(root, "packages", "tui", "dist", "main.js"),
    join(root, "packages", "tui", "src", "main.ts"),
  ];
}

/**
 * Resolves a relative path within the Hoox home directory.
 *
 * Behavior:
 * - Joins the relative path with $HOME/.hoox
 * - Resolves to absolute path
 * - Prevents path traversal attacks (../ sequences)
 *
 * @param relativePath - Path relative to $HOME/.hoox (e.g., "repo", "config/wrangler.jsonc")
 * @returns Absolute path as a branded HooxPath
 * @throws Error if path contains suspicious traversal patterns
 *
 * @example
 * ```typescript
 * const repoPath = resolveHooxPath("repo");
 * // Returns: "/Users/alice/.hoox/repo"
 *
 * const configPath = resolveHooxPath("config/wrangler.jsonc");
 * // Returns: "/Users/alice/.hoox/config/wrangler.jsonc"
 * ```
 */
export function resolveHooxPath(relativePath: string): HooxPath {
  // Validate input
  if (!relativePath || typeof relativePath !== "string") {
    throw new Error("relativePath must be a non-empty string");
  }

  // Prevent path traversal attacks
  if (relativePath.includes("..")) {
    throw new Error(
      `Path traversal detected in relativePath: "${relativePath}"`
    );
  }

  // Normalize backslashes to forward slashes for cross-OS compatibility.
  // On Windows, both / and \ are valid path separators; on Linux/macOS
  // backslashes are NOT path separators, so normalizing ensures consistent
  // behavior regardless of which separator the caller used.
  const normalizedPath = relativePath.replace(/\\/g, "/");

  const hooxHome = getHooxHome();
  const fullPath = join(hooxHome, normalizedPath);

  // Ensure the resolved path is still within hooxHome (security check)
  const resolvedPath = resolve(fullPath);
  const resolvedHome = resolve(hooxHome);

  if (!isInsideDir(resolvedPath, resolvedHome)) {
    throw new Error(
      `Resolved path "${resolvedPath}" is outside Hoox home directory`
    );
  }

  return createHooxPath(resolvedPath);
}

/**
 * Checks if a given path is within the Hoox home directory.
 *
 * @param path - Path to check
 * @returns true if path is within $HOME/.hoox, false otherwise
 *
 * @example
 * ```typescript
 * isWithinHooxHome("/Users/alice/.hoox/repo"); // true
 * isWithinHooxHome("/Users/alice/other"); // false
 * ```
 */
export function isWithinHooxHome(path: string): boolean {
  try {
    const hooxHome = getHooxHome();
    const resolvedPath = resolve(path);
    const resolvedHome = resolve(hooxHome);
    return isInsideDir(resolvedPath, resolvedHome);
  } catch {
    return false;
  }
}

/**
 * Gets the relative path from Hoox home directory.
 *
 * @param absolutePath - Absolute path to resolve
 * @returns Relative path from $HOME/.hoox, or null if path is outside Hoox home
 *
 * @example
 * ```typescript
 * getRelativeHooxPath("/Users/alice/.hoox/repo/src");
 * // Returns: "repo/src"
 *
 * getRelativeHooxPath("/Users/alice/other");
 * // Returns: null
 * ```
 */
export function getRelativeHooxPath(absolutePath: string): string | null {
  try {
    if (!isWithinHooxHome(absolutePath)) {
      return null;
    }

    const hooxHome = getHooxHome();
    const resolvedPath = resolve(absolutePath);
    const resolvedHome = resolve(hooxHome);

    // Remove trailing slashes for consistent comparison
    const relativePath = resolvedPath.slice(resolvedHome.length);
    return relativePath.startsWith("/") || relativePath.startsWith("\\")
      ? relativePath.slice(1)
      : relativePath;
  } catch {
    return null;
  }
}

/**
 * Constructs a path to the Hoox repository location.
 *
 * @returns Path to $HOME/.hoox/repo as a branded HooxPath
 *
 * @example
 * ```typescript
 * const repoPath = getHooxRepoPath();
 * // Returns: "/Users/alice/.hoox/repo"
 * ```
 */
export function getHooxRepoPath(): HooxPath {
  return resolveHooxPath("repo");
}

/**
 * Constructs a path to the Hoox configuration directory.
 *
 * @returns Path to $HOME/.hoox/config as a branded HooxPath
 *
 * @example
 * ```typescript
 * const configDir = getHooxConfigDir();
 * // Returns: "/Users/alice/.hoox/config"
 * ```
 */
export function getHooxConfigDir(): HooxPath {
  return resolveHooxPath("config");
}

/**
 * Constructs a path to the Hoox data directory.
 *
 * @returns Path to $HOME/.hoox/data as a branded HooxPath
 *
 * @example
 * ```typescript
 * const dataDir = getHooxDataDir();
 * // Returns: "/Users/alice/.hoox/data"
 * ```
 */
export function getHooxDataDir(): HooxPath {
  return resolveHooxPath("data");
}

/**
 * Constructs a path to the Hoox wrangler configuration file.
 *
 * @returns Path to $HOME/.hoox/config/wrangler.jsonc as a branded HooxPath
 *
 * @example
 * ```typescript
 * const wranglerPath = getHooxWranglerPath();
 * // Returns: "/Users/alice/.hoox/config/wrangler.jsonc"
 * ```
 */
export function getHooxWranglerPath(): HooxPath {
  return resolveHooxPath("config/wrangler.jsonc");
}

/**
 * Constructs a path to the Hoox state file.
 *
 * @returns Path to $HOME/.hoox/data/state.json as a branded HooxPath
 *
 * @example
 * ```typescript
 * const statePath = getHooxStatePath();
 * // Returns: "/Users/alice/.hoox/data/state.json"
 * ```
 */
export function getHooxStatePath(): HooxPath {
  return resolveHooxPath("data/state.json");
}
