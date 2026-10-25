/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { createConfirmCodec, hashSecret } from "./confirm.ts";
import { executeEntry, type SpawnFn } from "./runner.ts";
import type { CatalogEntry } from "./types.ts";

function entry(
  overrides: Partial<CatalogEntry> & Pick<CatalogEntry, "path" | "risk">
): CatalogEntry {
  return {
    toolName: "hoox_test",
    summary: overrides.path,
    description: "",
    aliases: [],
    action: true,
    args: [],
    options: [],
    long: false,
    destructive: false,
    local: true,
    secretStdin: false,
    scriptStdin: false,
    safety: "none",
    ...overrides,
  };
}

function mockSpawn(stdoutText = '{"ok":true}\n') {
  const calls: Array<{ cmd: string[]; stdin: string }> = [];
  const spawn: SpawnFn = (request) => {
    let stdin = "";
    return {
      stdout: textStream(stdoutText),
      stderr: textStream(""),
      stdin: {
        write(chunk: string | Uint8Array) {
          stdin +=
            typeof chunk === "string" ? chunk : new TextDecoder().decode(chunk);
        },
        end() {
          calls.push({ cmd: request.cmd, stdin });
        },
      },
      exited: Promise.resolve(0),
      kill() {},
    };
  };
  return { spawn, calls };
}

function textStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (text.length > 0) controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

describe("executeEntry", () => {
  test("refuses interactive commands without spawning", async () => {
    const mocked = mockSpawn();
    const result = await executeEntry(
      entry({ path: "tui", risk: "interactive" }),
      {},
      {
        deps: { spawn: mocked.spawn, allowMutations: false },
      }
    );
    expect(result.status).toBe("refused");
    expect(mocked.calls).toHaveLength(0);
  });

  test("holds mutations until the same token is presented", async () => {
    const codec = createConfirmCodec("runner-test", () => 5_000);
    const mocked = mockSpawn();
    const deploy = entry({
      path: "deploy all",
      risk: "mutate",
      options: [
        {
          key: "dry_run",
          flag: "--dry-run",
          description: "dry",
          kind: "boolean",
          required: false,
        },
      ],
    });
    const deps = { spawn: mocked.spawn, codec, allowMutations: false };
    const held = await executeEntry(deploy, {}, { deps });
    expect(held.status).toBe("confirmation_required");
    expect(held.confirm_token).toBeTruthy();
    expect(mocked.calls).toHaveLength(0);

    const ran = await executeEntry(
      deploy,
      { confirm: held.confirm_token ?? "" },
      { deps }
    );
    expect(ran.status).toBe("ok");
    expect(ran.exit_code).toBe(0);
    expect(mocked.calls).toHaveLength(1);
    const cmd = mocked.calls[0]?.cmd.join(" ") ?? "";
    expect(cmd).toContain("deploy all");
    expect(cmd).toContain("--yes");
    expect(ran.json).toEqual({ ok: true });
  });

  test("treats dry-run as read-only and keeps secrets off argv", async () => {
    const codec = createConfirmCodec("runner-test", () => 5_000);
    const mocked = mockSpawn();
    const deploy = entry({
      path: "deploy all",
      risk: "mutate",
      options: [
        {
          key: "dry_run",
          flag: "--dry-run",
          description: "dry",
          kind: "boolean",
          required: false,
        },
      ],
    });
    const dry = await executeEntry(
      deploy,
      { dry_run: true },
      { deps: { spawn: mocked.spawn, codec, allowMutations: false } }
    );
    expect(dry.status).toBe("ok");
    expect(dry.argv).toContain("--dry-run");
    expect(dry.argv).not.toContain("--yes");

    const secrets = entry({
      path: "secrets set",
      risk: "mutate",
      secretStdin: true,
      args: [
        {
          key: "worker",
          name: "worker",
          required: true,
          variadic: false,
          description: "worker",
        },
        {
          key: "name",
          name: "name",
          required: true,
          variadic: false,
          description: "name",
        },
      ],
    });
    const values = {
      worker: "trade-worker",
      name: "API_KEY",
      secret_value: "super-secret",
    };
    const held = await executeEntry(secrets, values, {
      deps: { spawn: mocked.spawn, codec, allowMutations: false },
    });
    expect(held.status).toBe("confirmation_required");
    expect(JSON.stringify(held)).not.toContain("super-secret");

    const ran = await executeEntry(
      secrets,
      { ...values, confirm: held.confirm_token ?? "" },
      { deps: { spawn: mocked.spawn, codec, allowMutations: false } }
    );
    expect(ran.status).toBe("ok");
    const last = mocked.calls[mocked.calls.length - 1];
    expect(last?.stdin).toBe("super-secret\n");
    expect(last?.cmd.join(" ")).not.toContain("super-secret");
    expect(JSON.stringify(ran.argv)).not.toContain("super-secret");
    const claims = tokenClaims(held.confirm_token ?? "");
    expect(claims.secretHash).toBe(hashSecret("super-secret\n"));
    expect(JSON.stringify(claims)).not.toContain("super-secret");
  });

  test("rejects newlines in secret_value and trims before hashing", async () => {
    const codec = createConfirmCodec("runner-test", () => 5_000);
    const mocked = mockSpawn();
    const secrets = entry({
      path: "secrets set",
      risk: "mutate",
      secretStdin: true,
      args: [
        {
          key: "worker",
          name: "worker",
          required: true,
          variadic: false,
          description: "worker",
        },
        {
          key: "name",
          name: "name",
          required: true,
          variadic: false,
          description: "name",
        },
      ],
    });
    const deps = { spawn: mocked.spawn, codec, allowMutations: true };
    const rejected = await executeEntry(
      secrets,
      { worker: "trade-worker", name: "API", secret_value: "line1\nline2" },
      { deps }
    );
    expect(rejected.status).toBe("refused");
    expect(rejected.message).toContain("newline");
    expect(mocked.calls).toHaveLength(0);

    const ran = await executeEntry(
      secrets,
      {
        worker: "trade-worker",
        name: "API",
        secret_value: "  super-secret  ",
      },
      { deps }
    );
    expect(ran.status).toBe("ok");
    expect(mocked.calls[0]?.stdin).toBe("super-secret\n");
    expect(JSON.stringify(ran)).not.toContain("super-secret");
  });

  test("binds script stdin into the confirm token", async () => {
    const codec = createConfirmCodec("runner-test", () => 5_000);
    const mocked = mockSpawn();
    const pyne = entry({
      path: "pyne run",
      risk: "mutate",
      scriptStdin: true,
      args: [
        {
          key: "script_path",
          name: "script-path",
          required: true,
          variadic: false,
          description: "script",
        },
      ],
    });
    const deps = { spawn: mocked.spawn, codec, allowMutations: false };
    const body = "indicator alpha";
    const held = await executeEntry(
      pyne,
      { script_path: "-", script_body: body },
      { deps }
    );
    expect(held.status).toBe("confirmation_required");
    const claims = tokenClaims(held.confirm_token ?? "");
    expect(claims.secretHash).toBe(hashSecret("indicator alpha\n"));
    expect(JSON.stringify(claims)).not.toContain("indicator alpha");
    expect(JSON.stringify(held)).not.toContain("indicator alpha");

    const mismatch = await executeEntry(
      pyne,
      {
        script_path: "-",
        script_body: "indicator beta",
        confirm: held.confirm_token ?? "",
      },
      { deps }
    );
    expect(mismatch.status).not.toBe("ok");
    expect(mismatch.message).toContain("does not match");
    expect(mocked.calls).toHaveLength(0);

    const ran = await executeEntry(
      pyne,
      {
        script_path: "-",
        script_body: body,
        confirm: held.confirm_token ?? "",
      },
      { deps }
    );
    expect(ran.status).toBe("ok");
    expect(mocked.calls[0]?.stdin).toBe("indicator alpha\n");
    expect(JSON.stringify(ran)).not.toContain("indicator alpha");
  });

  test("injects --confirm for db reset into the token argv", async () => {
    const codec = createConfirmCodec("runner-test", () => 5_000);
    const mocked = mockSpawn();
    const reset = entry({ path: "db reset", risk: "mutate" });
    const deps = { spawn: mocked.spawn, codec, allowMutations: false };
    const planned = await executeEntry(reset, {}, { mode: "plan", deps });
    expect(planned.status).toBe("confirmation_required");
    expect(planned.argv).toContain("--confirm");
    expect(planned.argv).toContain("--yes");
    expect(mocked.calls).toHaveLength(0);

    const ran = await executeEntry(
      reset,
      { confirm: planned.confirm_token ?? "" },
      { deps }
    );
    expect(ran.status).toBe("ok");
    expect(mocked.calls[0]?.cmd.join(" ")).toContain("--confirm");
  });

  test("refuses prompt-driven commands without spawning", async () => {
    const mocked = mockSpawn();
    const deps = { spawn: mocked.spawn, allowMutations: true };
    const cases: Array<[CatalogEntry, Record<string, unknown>]> = [
      [entry({ path: "init", risk: "mutate" }), {}],
      [entry({ path: "onboard", risk: "mutate" }), { token: "t" }],
      [entry({ path: "config env init", risk: "mutate" }), {}],
      [entry({ path: "deploy dashboard", risk: "mutate" }), {}],
      [
        entry({ path: "deploy rollback", risk: "mutate" }),
        { worker: "trade-worker" },
      ],
    ];
    for (const [item, values] of cases) {
      const result = await executeEntry(item, values, { deps });
      expect(result.status).toBe("refused");
    }
    expect(mocked.calls).toHaveLength(0);

    const init = await executeEntry(
      entry({ path: "init", risk: "mutate" }),
      { token: "t", account: "a" },
      { deps }
    );
    expect(init.status).toBe("ok");
    const dashboard = await executeEntry(
      entry({ path: "deploy dashboard", risk: "mutate" }),
      { rebuild: true },
      { deps }
    );
    expect(dashboard.status).toBe("ok");
    const rollback = await executeEntry(
      entry({
        path: "deploy rollback",
        risk: "mutate",
        args: [
          {
            key: "worker",
            name: "worker",
            required: true,
            variadic: false,
            description: "worker",
          },
          {
            key: "version",
            name: "version",
            required: false,
            variadic: false,
            description: "version",
          },
        ],
      }),
      { worker: "trade-worker", version: "abc" },
      { deps }
    );
    expect(rollback.status).toBe("ok");
    expect(rollback.argv).toContain("abc");
    expect(mocked.calls).toHaveLength(3);
  });

  test("parses JSON larger than the stdout view cap", async () => {
    const big = {
      items: Array.from({ length: 800 }, (_, i) => ({
        i,
        name: `worker-${i}`,
        note: "x".repeat(40),
      })),
    };
    const text = JSON.stringify(big);
    expect(text.length).toBeGreaterThan(24_000);
    const mocked = mockSpawn(text);
    const result = await executeEntry(
      entry({ path: "doctor", risk: "read" }),
      {},
      { deps: { spawn: mocked.spawn, allowMutations: false } }
    );
    expect(result.status).toBe("ok");
    expect(result.json).toEqual(big);
    expect(result.truncated).toBe(true);
    expect(result.stdout.length).toBeLessThan(text.length);
    expect(() => JSON.parse(result.stdout)).toThrow();
  });
});

function tokenClaims(token: string): { secretHash: string; argv: string[] } {
  const payload = token.split(".")[1] ?? "";
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    secretHash: string;
    argv: string[];
  };
}
