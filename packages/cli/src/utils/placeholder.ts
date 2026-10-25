/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * True when a secret/env value looks like an unfilled template rather than
 * a real credential. Shared by env validate, secrets sync, and DEX setup.
 */
export function isPlaceholderValue(value: string | undefined | null): boolean {
  if (value == null) return true;
  const v = value.trim();
  if (v === "") return true;
  if (v.startsWith("placeholder_")) return true;
  if (v.startsWith("your_")) return true;
  if (v.startsWith("generate_")) return true;
  if (v.startsWith("<") && v.endsWith(">")) return true;
  if (v.includes("generate-with")) return true;
  if (/USE_CLOUDFLARE_API_TOKEN|USE_WRANGLER_SECRET_PUT/i.test(v)) return true;
  return false;
}

/** Compare `major.minor` against a minimum (newer major always passes). */
export function meetsMinVersion(
  version: string,
  minMajor: number,
  minMinor: number
): boolean {
  const [major, minor] = version.split(".").map(Number);
  const maj = Number.isFinite(major) ? (major as number) : 0;
  const min = Number.isFinite(minor) ? (minor as number) : 0;
  return maj > minMajor || (maj === minMajor && min >= minMinor);
}
