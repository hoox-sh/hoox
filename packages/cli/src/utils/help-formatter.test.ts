/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { Command } from "commander";
import { renderHelp } from "./help-formatter.js";
import { stripAnsi } from "./theme.js";
import { commandBlurb, firstLine, splitHelpBody } from "../ui/catalog.js";

function makeCmd(): Command {
  const program = new Command();
  program.name("hoox").description("Hoox CLI");
  const deploy = program
    .command("deploy all")
    .summary("Deploy all workers + dashboard to Cloudflare")
    .description("Deploy all enabled workers, then the dashboard")
    .option("--auto", "Skip confirmations")
    .option("--json", "Output JSON");
  deploy.addHelpText(
    "after",
    "\nExamples:\n  $ hoox deploy all\n  $ hoox deploy all --auto\n"
  );
  return deploy;
}

function makeRoot(): Command {
  const program = new Command();
  program
    .name("hoox")
    .description("Hoox CLI")
    .version("0.17.0")
    .option("--json", "Output in JSON format")
    .option("--quiet", "Minimal output");
  program
    .command("setup")
    .summary("Auto-bootstrap keys, secrets, schema, dashboard")
    .description(
      `Single-command setup that auto-detects and fixes EVERY issue:

EXAMPLES:
  hoox setup --yes                    Full auto-setup (non-interactive)`
    );
  program
    .command("trace")
    .summary("Query and manage Cloudflare Workers traces (beta)")
    .description(
      `Query and manage Cloudflare Workers automatic traces (beta).

SUBCOMMANDS:
  events              Query trace events (spans) with filters

EXAMPLES:
  hoox trace events                              Recent trace events`
    );
  program
    .command("perf")
    .summary("Performance measurement tools")
    .description(
      `Measure latency, throughput, and other performance characteristics of
the deployed Hoox system.

SUBCOMMANDS:
  fastpath   Measure the deployed fast-path latency (probe-based)

EXAMPLES:
  hoox perf fastpath run --n 50`
    );
  program.command("completion").description("Generate shell completion script");
  return program;
}

describe("renderHelp", () => {
  it("includes the program name and command path", () => {
    const out = renderHelp(makeCmd(), makeCmd().helpInformation);
    const stripped = stripAnsi(out);
    expect(stripped).toContain("hoox deploy all");
  });

  it("includes the description", () => {
    const out = renderHelp(makeCmd(), makeCmd().helpInformation);
    const stripped = stripAnsi(out);
    expect(stripped).toContain("Deploy all workers");
  });

  it("includes all option flags", () => {
    const out = renderHelp(makeCmd(), makeCmd().helpInformation);
    const stripped = stripAnsi(out);
    expect(stripped).toContain("--auto");
    expect(stripped).toContain("--json");
  });

  it("includes Examples block from addHelpText", () => {
    const out = renderHelp(makeCmd(), makeCmd().helpInformation);
    const stripped = stripAnsi(out);
    expect(stripped).toContain("EXAMPLES");
    expect(stripped).toContain("hoox deploy all --auto");
    const lines = stripped
      .split("\n")
      .filter((l) => l.includes("hoox deploy all"));
    const indents = lines.map((l) => (l.match(/^(\s*)/)?.[1] ?? "").length);
    expect(new Set(indents).size).toBe(1);
  });

  it("uses section headers (Usage, Options, Examples)", () => {
    const out = renderHelp(makeCmd(), makeCmd().helpInformation);
    const stripped = stripAnsi(out);
    expect(stripped).toContain("USAGE");
    expect(stripped).toContain("OPTIONS");
    expect(stripped).toContain("EXAMPLES");
  });
});

describe("root help catalog", () => {
  it("lists one-line summaries, not nested EXAMPLES/SUBCOMMANDS", () => {
    const out = stripAnsi(renderHelp(makeRoot(), makeRoot().helpInformation));
    expect(out).toContain("setup");
    expect(out).toContain("Auto-bootstrap keys, secrets, schema, dashboard");
    expect(out).toContain("trace");
    expect(out).toContain("Query and manage Cloudflare Workers traces");
    expect(out).not.toContain("hoox setup --yes");
    expect(out).not.toContain("hoox trace events");
    expect(out).not.toContain("fastpath");
    expect(out).not.toContain("SUBCOMMANDS:");
    expect(out).not.toMatch(/^EXAMPLES:/m);
  });

  it("groups commands into sections in catalog order", () => {
    const out = stripAnsi(renderHelp(makeRoot(), makeRoot().helpInformation));
    expect(out).toContain("SETUP");
    expect(out).toContain("OBSERVE");
    expect(out).toContain("TOOLS");
    expect(out.indexOf("onboard")).toBeLessThan(out.indexOf("setup"));
    expect(out.indexOf("SETUP")).toBeLessThan(out.indexOf("OBSERVE"));
  });

  it("points at the launcher and per-command help", () => {
    const out = stripAnsi(renderHelp(makeRoot(), makeRoot().helpInformation));
    expect(out).toContain("hoox <command> --help");
    expect(out).toContain("interactive launcher");
  });

  it("live program root help stays a one-line catalog", async () => {
    const { program } = await import("../index.js");
    const out = stripAnsi(
      renderHelp(program, program.helpInformation as never)
    );
    expect(out).toContain("SETUP");
    expect(out).toContain("OPERATE");
    expect(out).not.toContain("SUBCOMMANDS:");
    expect(out).not.toContain("hoox setup --yes");
    expect(out).not.toContain("hoox trace events");
    expect(out).not.toContain("hoox perf fastpath");
  });

  it("wraps optional arguments in brackets", () => {
    const program = new Command();
    program.name("hoox");
    const completion = program
      .command("completion")
      .argument("[shell]", "Shell type")
      .description("Generate shell completion script");
    const out = stripAnsi(renderHelp(completion, completion.helpInformation));
    expect(out).toContain("[shell]");
    expect(out).not.toContain("completion shell");
  });
});

describe("commandBlurb / splitHelpBody", () => {
  it("prefers summary over a multi-line description", () => {
    const cmd = new Command()
      .name("setup")
      .summary("Auto-bootstrap everything")
      .description("Single-command setup\n\nEXAMPLES:\n  hoox setup --yes");
    expect(commandBlurb(cmd)).toBe("Auto-bootstrap everything");
  });

  it("falls back to the first description line", () => {
    const cmd = new Command()
      .name("completion")
      .description("Generate shell completion script");
    expect(commandBlurb(cmd)).toBe("Generate shell completion script");
  });

  it("strips EXAMPLES and SUBCOMMANDS from the body", () => {
    const { body, examples } = splitHelpBody(
      "Query traces (beta).\n\nSUBCOMMANDS:\n  events\n\nEXAMPLES:\n  hoox trace events"
    );
    expect(body).toBe("Query traces (beta).");
    expect(examples).toContain("hoox trace events");
    const exampleLines = examples
      .split("\n")
      .filter((l) => l.trim().length > 0);
    const indents = exampleLines.map(
      (l) => (l.match(/^(\s*)/)?.[1] ?? "").length
    );
    expect(new Set(indents).size).toBe(1);
    expect(firstLine(body)).toBe("Query traces (beta).");
  });
});
