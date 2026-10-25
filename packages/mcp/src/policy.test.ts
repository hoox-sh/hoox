/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { classifyCall, promptBlock, toolNameFromPath } from "./policy.ts";
import type { CatalogEntry } from "./types.ts";

function entry(path: string, risk: CatalogEntry["risk"]): CatalogEntry {
  return {
    path,
    toolName: toolNameFromPath(path),
    summary: path,
    description: "",
    aliases: [],
    action: true,
    args: [],
    options: [],
    risk,
    long: false,
    destructive: false,
    local: false,
    secretStdin: false,
    scriptStdin: false,
    safety: "none",
  };
}

describe("policy", () => {
  test("names stay within the MCP tool-name shape", () => {
    const name = toolNameFromPath("monitor kill-switch show");
    expect(name).toBe("hoox_monitor_kill_switch_show");
    expect(name).toMatch(/^[a-z0-9_-]{1,64}$/);
  });

  test("dry-run downgrades a mutation and --fix upgrades a read", () => {
    expect(
      classifyCall(entry("deploy all", "mutate"), { dry_run: true })
    ).toEqual({
      risk: "read",
      long: false,
    });
    expect(classifyCall(entry("check health", "read"), { fix: true })).toEqual({
      risk: "mutate",
      long: false,
    });
    expect(
      classifyCall(entry("deploy all", "mutate"), {
        dry_run: true,
        provision: true,
      }).risk
    ).toBe("mutate");
  });

  test("refuses wizards unless the non-interactive flags are set", () => {
    expect(promptBlock(entry("init", "mutate"), {})).toContain("--token");
    expect(
      promptBlock(entry("init", "mutate"), { token: "t", account: "a" })
    ).toBeNull();
    expect(promptBlock(entry("onboard", "mutate"), { token: "t" })).toContain(
      "--account"
    );
    expect(
      promptBlock(entry("config env init", "mutate"), { yes: true })
    ).toContain("prompts");
    expect(promptBlock(entry("deploy dashboard", "mutate"), {})).toContain(
      "--rebuild"
    );
    expect(
      promptBlock(entry("deploy dashboard", "mutate"), { rebuild: true })
    ).toBeNull();
    expect(
      promptBlock(entry("deploy dashboard", "mutate"), { no_rebuild: true })
    ).toContain("--rebuild");
    expect(promptBlock(entry("deploy rollback", "mutate"), {})).toContain(
      "version"
    );
    expect(
      promptBlock(entry("deploy rollback", "mutate"), { version: "abc" })
    ).toBeNull();
    expect(promptBlock(entry("deploy all", "mutate"), {})).toBeNull();
  });
});
