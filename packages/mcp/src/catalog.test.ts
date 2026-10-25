/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { Command } from "commander";
import { buildArgv } from "./argv.ts";
import { walkCatalog } from "./catalog.ts";
import type { CmdLike } from "./types.ts";

describe("catalog walker", () => {
  test("turns commander commands into argv-safe tools", () => {
    const program = new Command();
    program.name("hoox");
    program
      .command("logs")
      .command("worker <name>")
      .option("--follow", "stream", true)
      .option("--no-follow", "exit")
      .option("--level <level>", "level", "all")
      .option("--json", "json")
      .action(() => {});

    const entries = walkCatalog(program as unknown as CmdLike);
    const worker = entries.find((entry) => entry.path === "logs worker");
    expect(worker).toBeDefined();
    expect(worker?.toolName).toBe("hoox_logs_worker");
    expect(worker?.safety).toBe("no-follow-logs");
    expect(worker?.options.some((opt) => opt.flag === "--json")).toBe(false);

    const built = buildArgv(worker!, { name: "trade-worker" });
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.argv).toEqual([
        "logs",
        "worker",
        "trade-worker",
        "--no-follow",
        "--json",
        "--no-color",
      ]);
    }
  });

  test("does not rename db reset --confirm to confirm_2", () => {
    const program = new Command();
    program
      .command("db")
      .command("reset")
      .option("--confirm", "Skip confirmation prompt")
      .action(() => {});
    const reset = walkCatalog(program as unknown as CmdLike).find(
      (entry) => entry.path === "db reset"
    );
    expect(reset?.options.some((opt) => opt.flag === "--confirm")).toBe(false);
    expect(reset?.options.map((opt) => opt.key)).not.toContain("confirm_2");
  });
});
