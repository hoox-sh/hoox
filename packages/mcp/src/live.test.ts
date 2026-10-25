/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { importEnvDefinitions } from "./cli-bridge.ts";
import { loadHooxCatalog } from "./load-catalog.ts";
import { SECRET_ENV_NAMES } from "./redact.ts";
import { executeEntry } from "./runner.ts";
import { inputSchemaFor } from "./schema.ts";
import { createHooxMcpServer } from "./server.ts";

describe("live hoox catalog", () => {
  test("exposes every runnable command and can run disclaimer", async () => {
    const catalog = await loadHooxCatalog();
    const runnable = catalog.filter((entry) => entry.action);
    expect(runnable.length).toBeGreaterThan(120);

    const names = runnable.map((entry) => entry.toolName);
    expect(new Set(names).size).toBe(names.length);
    for (const name of names) expect(name).toMatch(/^[a-z0-9_-]{1,64}$/);

    expect(catalog.find((entry) => entry.path === "deploy all")?.risk).toBe(
      "mutate"
    );
    expect(catalog.find((entry) => entry.path === "doctor")?.risk).toBe("read");
    expect(catalog.find((entry) => entry.path === "tui")?.risk).toBe(
      "interactive"
    );
    expect(catalog.find((entry) => entry.path === "workers logs")?.risk).toBe(
      "interactive"
    );
    expect(catalog.find((entry) => entry.path === "logs worker")?.safety).toBe(
      "no-follow-logs"
    );
    expect(
      catalog
        .find((entry) => entry.path === "repair check")
        ?.options.some((opt) => opt.flag === "--no-typecheck")
    ).toBe(true);

    for (const entry of runnable) inputSchemaFor(entry);
    expect(createHooxMcpServer(catalog)).toBeTruthy();

    const disclaimer = catalog.find((entry) => entry.path === "disclaimer");
    expect(disclaimer?.action).toBe(true);
    const result = await executeEntry(disclaimer!, {});
    expect(result.status).toBe("ok");
    expect(result.exit_code).toBe(0);
    expect(result.stdout.length).toBeGreaterThan(20);
    expect(result.argv).toContain("--json");
    expect(result.argv).not.toContain("--quiet");
    const reset = catalog.find((entry) => entry.path === "db reset");
    expect(reset?.options.some((opt) => opt.flag === "--confirm")).toBe(false);
    expect(
      catalog
        .find((entry) => entry.path === "deploy rollback")
        ?.args.some((arg) => arg.name === "version")
    ).toBe(true);
  });

  test("secret env names match EnvService secret definitions", async () => {
    // Static `import("../../cli/...")` pulls the CLI into this package and
    // fails tsc with TS6059. The bridge keeps the specifier in a variable.
    const defs = await importEnvDefinitions();
    const fromCli = defs
      .filter((def) => def.secret)
      .map((def) => def.name)
      .sort();
    expect([...SECRET_ENV_NAMES].sort()).toEqual(fromCli);
  });
});
