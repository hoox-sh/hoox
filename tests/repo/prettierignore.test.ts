import { describe, expect, test } from "bun:test";
import { join } from "node:path";

const ROOT = join(import.meta.dir, "..", "..");

async function read(rel: string): Promise<string> {
  return Bun.file(join(ROOT, rel)).text();
}

/** Submodule paths, one per `path = ...` line in `.gitmodules`. */
function submodulePaths(gitmodules: string): string[] {
  return gitmodules
    .split("\n")
    .map((line) => line.match(/^\s*path\s*=\s*(.+?)\s*$/)?.[1])
    .filter((path): path is string => Boolean(path));
}

/** Ignore entries, skipping blank lines and comments. */
function ignoreEntries(ignore: string): string[] {
  return ignore
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

describe(".prettierignore", () => {
  test("ignores every git submodule tree", async () => {
    const paths = submodulePaths(await read(".gitmodules"));
    const entries = ignoreEntries(await read(".prettierignore"));
    expect(paths.length).toBeGreaterThan(0);
    for (const path of paths) {
      expect(entries).toContain(`${path}/`);
    }
  });

  test("keeps the OpenOrchestrate state directory ignored", async () => {
    const entries = ignoreEntries(await read(".prettierignore"));
    expect(entries).toContain(".openorchestrate/");
  });

  test("does not claim a generator rewrites the file", async () => {
    // ensurePrettierIgnore (openOrchestrate src/core/scaffold.ts) is
    // append-only: it never truncates or rewrites this file. A
    // "rewritten on every run" header invites deleting the hand-maintained
    // submodule entries, which no generator would restore.
    const ignore = await read(".prettierignore");
    expect(ignore).not.toContain("Rewritten on every run");
  });
});
