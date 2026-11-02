/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { LauncherItem } from "./types";

function fuzzyMatch(query: string, candidate: string): boolean {
  const q = query.toLowerCase();
  const c = candidate.toLowerCase();
  let qi = 0;
  for (let ci = 0; ci < c.length && qi < q.length; ci++) {
    if (c[ci] === q[qi]) qi++;
  }
  return qi === q.length;
}

function haystack(item: LauncherItem): string {
  return [item.label, item.hint, item.argv.join(" "), ...item.keywords].join(
    " "
  );
}

function scoreItem(query: string, item: LauncherItem): number {
  if (!query) return item.recommended ? 2 : 1;
  const q = query.toLowerCase();
  const argv = item.argv.join(" ").toLowerCase();
  if (argv === q) return 200;
  if (argv.startsWith(q)) return 150;
  if (item.label.toLowerCase().startsWith(q)) return 120;
  if (item.id.toLowerCase().startsWith(q)) return 110;
  if (fuzzyMatch(q, argv) || fuzzyMatch(q, item.label)) return 80;
  if (fuzzyMatch(q, haystack(item))) return 40;
  return -1;
}

/** Filter launcher items by a type-to-search query. Empty query = recommended first. */
export function filterLauncherItems(
  items: LauncherItem[],
  query: string
): LauncherItem[] {
  const q = query.trim();
  const scored = items
    .map((item) => ({ item, score: scoreItem(q, item) }))
    .filter(({ score }) => score >= 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return 0;
    });

  const seen = new Set<string>();
  const out: LauncherItem[] = [];
  for (const { item } of scored) {
    const key = item.argv.join(" ");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}
