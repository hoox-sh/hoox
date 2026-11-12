/**
 * Copyright (c) 2026 HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Frontmatter helpers for OKF bundles. Parsing uses Bun's YAML parser so
 * flow maps (`{ by, at }`), nested lists, and quoted scalars match the spec.
 */

export type Frontmatter = Record<string, unknown>;

type BunYaml = { parse: (input: string) => unknown };

function bunYaml(): BunYaml {
  const bun = (globalThis as { Bun?: { YAML?: BunYaml } }).Bun;
  if (!bun?.YAML) {
    throw new Error("OKF tooling requires Bun.YAML.parse");
  }
  return bun.YAML;
}

export function parseYaml(input: string): unknown {
  return bunYaml().parse(input);
}

export function splitFrontmatter(text: string): {
  yaml: string | null;
  body: string;
} {
  const norm = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
  const match = norm.match(/^---\n([\s\S]*?)\n---(?:\n|$)([\s\S]*)$/);
  if (!match) return { yaml: null, body: norm };
  return { yaml: match[1] ?? "", body: match[2] ?? "" };
}

export function isRecord(value: unknown): value is Frontmatter {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/** `verified` may be one event or a list. The spec requires both to read as a list. */
export function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (isRecord(value)) return [value];
  return [];
}

export function quote(value: string): string {
  const flat = value.replace(/\r?\n/g, " ");
  // Prettier's YAML printer switches to single quotes when a value contains a
  // double quote but no single quote. Emitting that shape keeps the generated
  // bundle stable under `prettier --check`.
  if (flat.includes('"') && !flat.includes("'") && !flat.includes("\\")) {
    return `'${flat}'`;
  }
  return `"${flat.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

export function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function sortedUnique(values: Iterable<string>): string[] {
  return [...new Set(values)].sort(cmp);
}

export const ISO_8601 =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/;

export const ACTOR = /^(?:human:\S+|process:\S+|\S+\/\S+)$/;

export const PRODUCER = "process:axis-okf/1";

/** Drop the compiler stamp so an unchanged concept keeps its previous `generated.at`. */
export function withoutStamp(markdown: string): string {
  return markdown.replace(
    new RegExp(`(by: ${PRODUCER.replace("/", "\\/")}\\n  at:) [^\\n]+`),
    "$1 STABLE"
  );
}
