/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { Command } from "commander";
import { registerConfigCommand } from "./config-command.js";

describe("config theme", () => {
  it("registers hoox config theme", () => {
    const program = new Command();
    registerConfigCommand(program);
    const config = program.commands.find((c) => c.name() === "config");
    const themeCmd = config?.commands.find((c) => c.name() === "theme");
    expect(themeCmd).toBeTruthy();
    expect(themeCmd?.summary()).toContain("theme");
  });
});
