/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  mock,
  spyOn,
} from "bun:test";
import type { Command } from "commander";
import * as clack from "@clack/prompts";
import { runInteractiveTUI } from "./menu.js";

interface Behavior {
  exitCode?: number;
  error?: Error;
}

/**
 * Minimal Commander stand-in: records each argv exactly as `runCommand`
 * hands it to `parseAsync`.
 */
function makeProgram(calls: string[][], behaviors: Behavior[] = []): Command {
  return {
    parseAsync: async (argv: readonly string[]) => {
      calls.push([...argv]);
      const behavior = behaviors.shift();
      if (behavior?.exitCode !== undefined) {
        process.exitCode = behavior.exitCode;
      }
      if (behavior?.error) throw behavior.error;
    },
  } as unknown as Command;
}

function installPromptSpies(selects: string[], texts: string[]): void {
  spyOn(clack, "select").mockImplementation((async () => {
    const next = selects.shift();
    if (next === undefined) throw new Error("unexpected select prompt");
    return next;
  }) as unknown as typeof clack.select);
  spyOn(clack, "text").mockImplementation((async () => {
    const next = texts.shift();
    if (next === undefined) throw new Error("unexpected text prompt");
    return next;
  }) as unknown as typeof clack.text);
  spyOn(clack, "confirm").mockImplementation(
    (async () => true) as unknown as typeof clack.confirm
  );
  spyOn(clack, "intro").mockImplementation(() => {});
  spyOn(clack, "outro").mockImplementation(() => {});
}

let previousExitCode: number | string | null | undefined;
let previousNoLauncher: string | undefined;

beforeEach(() => {
  previousExitCode = process.exitCode;
  previousNoLauncher = process.env.HOOX_NO_LAUNCHER;
  // Keep the tests on the Clack menu path; TTY handling is covered by
  // opentui-launch.test.ts.
  process.env.HOOX_NO_LAUNCHER = "1";
  process.exitCode = 0;
});

afterEach(() => {
  mock.restore();
  process.exitCode = previousExitCode;
  if (previousNoLauncher === undefined) delete process.env.HOOX_NO_LAUNCHER;
  else process.env.HOOX_NO_LAUNCHER = previousNoLauncher;
});

describe("runInteractiveTUI argv", () => {
  it("passes a deploy worker name containing spaces as one argument", async () => {
    const calls: string[][] = [];
    installPromptSpies(["deploy", "single", "__back", "__exit"], ["my worker"]);

    await runInteractiveTUI(makeProgram(calls));

    expect(calls).toEqual([["deploy", "worker", "my worker"]]);
  });

  it("passes a config value containing spaces as one argument", async () => {
    const calls: string[][] = [];
    installPromptSpies(
      ["manage", "config", "set", "__back", "__exit"],
      ["global.cloudflare_account_id", "value with spaces"]
    );

    await runInteractiveTUI(makeProgram(calls));

    expect(calls).toEqual([
      ["config", "set", "global.cloudflare_account_id", "value with spaces"],
    ]);
  });

  it("passes a secrets worker and secret name containing spaces as single arguments", async () => {
    const calls: string[][] = [];
    installPromptSpies(
      ["manage", "secrets", "set", "__back", "__exit"],
      ["my worker", "MY SECRET VALUE"]
    );

    await runInteractiveTUI(makeProgram(calls));

    expect(calls).toEqual([["secrets", "set", "my worker", "MY SECRET VALUE"]]);
  });

  it("passes a logs worker name containing spaces as one argument", async () => {
    const calls: string[][] = [];
    installPromptSpies(
      ["monitor", "__logs", "single", "__back", "__exit"],
      ["my worker"]
    );

    await runInteractiveTUI(makeProgram(calls));

    expect(calls).toEqual([["logs", "worker", "my worker"]]);
  });
});
