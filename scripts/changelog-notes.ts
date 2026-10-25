#!/usr/bin/env bun
/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Extract one Keep-a-Changelog section from CHANGELOG.md.
 *
 * Usage:
 *   bun scripts/changelog-notes.ts 0.16.0
 *   bun scripts/changelog-notes.ts v0.16.0
 *   bun scripts/changelog-notes.ts shared-v1.6.0
 *
 * `shared-v*` looks up the HOOX section whose Packages table lists that
 * `@hoox-sh/hoox-shared` version. Product tags `v*` match `## [x.y.z]`.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = process.argv[2];
if (!arg) {
  console.error(
    "Usage: bun scripts/changelog-notes.ts <version|vX.Y.Z|shared-vX.Y.Z>"
  );
  process.exit(1);
}

const changelogPath = resolve(import.meta.dir, "..", "CHANGELOG.md");
const md = readFileSync(changelogPath, "utf8");

const headingRe = /^## \[([^\]]+)\][^\n]*$/gm;
const headings: { version: string; start: number; headingEnd: number }[] = [];
for (const m of md.matchAll(headingRe)) {
  if (m.index === undefined || m[1] === undefined) continue;
  headings.push({
    version: m[1],
    start: m.index,
    headingEnd: m.index + m[0].length,
  });
}

function sectionBody(i: number): string {
  const cur = headings[i];
  if (!cur) return "";
  const next = headings[i + 1];
  const end = next ? next.start : md.length;
  return md.slice(cur.start, end).trim() + "\n";
}

function findByHeading(version: string): string | null {
  const i = headings.findIndex((h) => h.version === version);
  return i >= 0 ? sectionBody(i) : null;
}

function findShared(sharedVersion: string): string | null {
  const needle = `| \`@hoox-sh/hoox-shared\` | ${sharedVersion}`;
  for (let i = 0; i < headings.length; i++) {
    const body = sectionBody(i);
    if (body.includes(needle)) return body;
  }
  return null;
}

const notes = arg.startsWith("shared-v")
  ? findShared(arg.slice("shared-v".length))
  : findByHeading(arg.replace(/^v/, ""));

if (!notes) {
  console.error(`No CHANGELOG.md section found for ${arg}`);
  process.exit(1);
}

process.stdout.write(notes);
