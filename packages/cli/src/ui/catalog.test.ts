/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { Command } from "commander";
import {
  buildLauncherCatalog,
  commandBlurb,
  isLongRunning,
  groupIdForCommand,
} from "./catalog.js";

describe("catalog grouping", () => {
  it("maps well-known commands into help groups", () => {
    expect(groupIdForCommand("setup")).toBe("setup");
    expect(groupIdForCommand("deploy")).toBe("ship");
    expect(groupIdForCommand("tui")).toBe("operate");
    expect(groupIdForCommand("trace")).toBe("observe");
    expect(groupIdForCommand("completion")).toBe("tools");
    expect(groupIdForCommand("mystery")).toBe("other");
  });

  it("flags long-running commands", () => {
    expect(isLongRunning("tui")).toBe(true);
    expect(isLongRunning("dev start")).toBe(true);
    expect(isLongRunning("logs worker hoox")).toBe(true);
    expect(isLongRunning("deploy all")).toBe(false);
  });
});

describe("buildLauncherCatalog", () => {
  it("includes recommended shortcuts and top-level commands", () => {
    const program = new Command();
    program.name("hoox");
    program.command("setup").summary("Auto-bootstrap");
    program.command("deploy").summary("Deploy workers");
    program
      .command("tui")
      .description("Launch the OpenTUI terminal operations center");
    const catalog = buildLauncherCatalog(program, {
      version: "0.17.0",
      cwd: "/tmp/hoox",
    });
    expect(catalog.version).toBe("0.17.0");
    expect(catalog.items.some((i) => i.id === "tui" && i.recommended)).toBe(
      true
    );
    expect(catalog.items.some((i) => i.argv.join(" ") === "deploy all")).toBe(
      true
    );
    expect(catalog.items.some((i) => i.argv.join(" ") === "setup")).toBe(true);
    expect(catalog.items.find((i) => i.id === "setup")?.hint).toBe(
      "Auto-bootstrap"
    );
  });

  it("uses summary as the item hint", () => {
    const program = new Command();
    program
      .command("trace")
      .summary("Query traces")
      .description("Long body\n\nEXAMPLES:\n  hoox trace events");
    const catalog = buildLauncherCatalog(program, {
      version: "1.0.0",
      cwd: "/",
    });
    const trace = catalog.items.find((i) => i.argv.join(" ") === "trace");
    expect(trace?.hint).toBe("Query traces");
    expect(commandBlurb(program.commands[0]!)).toBe("Query traces");
  });
});
