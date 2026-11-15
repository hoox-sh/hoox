/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpStdio } from "../../scripts/mcp-stdio.ts";
import { createConfirmCodec } from "../confirm.ts";
import { executeEntry, type SpawnFn } from "../runner.ts";
import type { CatalogEntry, ToolPayload } from "../types.ts";
import type {
  CodeModeHandlers,
  CodeModeLimits,
  SandboxResult,
} from "./protocol.ts";
import {
  buildBwrapPlan,
  buildSubprocessPlan,
  harnessPath,
  runInSandbox,
} from "./sandbox.ts";
import { createHandlers } from "./tools.ts";
import { searchEntries } from "./view.ts";

const pkgRoot = fileURLToPath(new URL("../..", import.meta.url));
const repoRoot = resolve(pkgRoot, "../..");
const bwrapAvailable = Boolean(Bun.which("bwrap"));

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

function textStream(text: string): ReadableStream<Uint8Array> {
  return new ReadableStream({
    start(controller) {
      if (text.length > 0) controller.enqueue(new TextEncoder().encode(text));
      controller.close();
    },
  });
}

function mockSpawn(stdoutText = '{"ok":true}\n') {
  const calls: Array<{ cmd: string[] }> = [];
  const spawn: SpawnFn = () => ({
    stdout: textStream(stdoutText),
    stderr: textStream(""),
    stdin: { write() {}, end() {} },
    exited: Promise.resolve(0),
    kill() {},
  });
  const wrapped: SpawnFn = (request) => {
    calls.push({ cmd: request.cmd });
    return spawn(request);
  };
  return { spawn: wrapped, calls };
}

const CATALOG: CatalogEntry[] = [
  entry({
    path: "doctor",
    toolName: "hoox_doctor",
    risk: "read",
    summary: "Check the local toolchain and report problems",
  }),
  entry({
    path: "deploy all",
    toolName: "hoox_deploy_all",
    risk: "mutate",
    summary: "Deploy every worker",
  }),
  entry({
    path: "db reset",
    toolName: "hoox_db_reset",
    risk: "mutate",
    destructive: true,
    summary: "Reset the local D1 database",
  }),
];

async function run(
  code: string,
  extra: {
    mode?: "search" | "execute";
    catalog?: unknown[];
    handlers?: CodeModeHandlers;
    limits?: Partial<CodeModeLimits>;
  } = {}
) {
  return runInSandbox(
    {
      mode: extra.mode ?? "execute",
      code,
      catalog: extra.catalog,
      handlers: extra.handlers,
      limits: extra.limits,
    },
    { plan: buildSubprocessPlan() }
  );
}

function payloadOf(result: SandboxResult): ToolPayload {
  if (!result.ok) throw new Error(`sandbox failed: ${result.message}`);
  return result.value as ToolPayload;
}

describe("code mode catalog view", () => {
  test("injects a compact row, not a schema", () => {
    const [row] = searchEntries([CATALOG[0] as CatalogEntry]);
    expect(Object.keys(row ?? {}).sort()).toEqual([
      "action",
      "args",
      "destructive",
      "flags",
      "local",
      "path",
      "risk",
      "summary",
      "tool",
    ]);
    expect(row?.path).toBe("doctor");
    expect(row?.tool).toBe("hoox_doctor");
    expect(row?.risk).toBe("read");
  });
});

describe("search", () => {
  test("narrows by risk, path, and description inside the sandbox", async () => {
    const result = await run(
      `async () => catalog
        .filter((e) => e.risk === "read" || e.path.includes("reset"))
        .map((e) => ({ path: e.path, risk: e.risk }))`,
      { mode: "search", catalog: searchEntries(CATALOG) }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      { path: "doctor", risk: "read" },
      { path: "db reset", risk: "mutate" },
    ]);
  });

  test("matches a description substring", async () => {
    const result = await run(
      `async () => catalog.filter((e) => e.summary.toLowerCase().includes("deploy")).map((e) => e.tool)`,
      { mode: "search", catalog: searchEntries(CATALOG) }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(["hoox_deploy_all"]);
  });

  test("has no command client in search mode", async () => {
    const result = await run("async () => typeof hoox.run", {
      mode: "search",
      catalog: searchEntries(CATALOG),
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("undefined");
  });
});

describe("execute", () => {
  test("runs a read-only command through the runner and returns its data", async () => {
    const mocked = mockSpawn('{"healthy":true}\n');
    const handlers = createHandlers(CATALOG, undefined, {
      spawn: mocked.spawn,
      allowMutations: false,
    });
    const result = await run(
      `async () => {
        const payload = await hoox.run("doctor");
        return { status: payload.status, json: payload.json };
      }`,
      { handlers }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual({ status: "ok", json: { healthy: true } });
    expect(mocked.calls).toHaveLength(1);
  });

  test("composes several calls in one execution", async () => {
    const mocked = mockSpawn('{"ok":true}\n');
    const handlers = createHandlers(CATALOG, undefined, {
      spawn: mocked.spawn,
      allowMutations: false,
    });
    const result = await run(
      `async () => {
        const a = await hoox.run("doctor");
        const b = await hoox.run("hoox_doctor");
        return [a.status, b.status];
      }`,
      { handlers }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual(["ok", "ok"]);
    expect(mocked.calls).toHaveLength(2);
  });

  test("rejects an unknown command without spawning", async () => {
    const mocked = mockSpawn();
    const handlers = createHandlers(CATALOG, undefined, {
      spawn: mocked.spawn,
      allowMutations: false,
    });
    const result = await run(`async () => hoox.run("rm -rf /")`, { handlers });
    expect(result.ok).toBe(true);
    const payload = payloadOf(result);
    expect(payload.status).toBe("refused");
    expect(payload.message).toContain("Unknown runnable command");
    expect(mocked.calls).toHaveLength(0);
  });

  test("strips arguments the command does not declare", async () => {
    const mocked = mockSpawn();
    const handlers = createHandlers(CATALOG, undefined, {
      spawn: mocked.spawn,
      allowMutations: false,
    });
    await run(`async () => hoox.run("doctor", { argv: ["--evil"] })`, {
      handlers,
    });
    expect(mocked.calls).toHaveLength(1);
    expect(mocked.calls[0]?.cmd.join(" ")).not.toContain("--evil");
  });
});

describe("confirm gate parity", () => {
  test("a destructive command is refused identically to the direct tool", async () => {
    const codec = createConfirmCodec("codemode-test", () => 5_000);
    const direct = mockSpawn();
    const sandboxed = mockSpawn();
    const deps = { codec, allowMutations: false };

    const reset = CATALOG[2] as CatalogEntry;
    const directPayload = await executeEntry(
      reset,
      {},
      {
        deps: { ...deps, spawn: direct.spawn },
      }
    );

    const handlers = createHandlers(CATALOG, undefined, {
      ...deps,
      spawn: sandboxed.spawn,
    });
    const result = await run(`async () => hoox.run("db reset")`, { handlers });
    const sandboxPayload = payloadOf(result);

    expect(sandboxPayload.status).toBe(directPayload.status);
    expect(sandboxPayload.status).toBe("confirmation_required");
    expect(sandboxPayload.message).toBe(directPayload.message);
    expect(sandboxPayload.confirm_token).toBeTruthy();
    expect(direct.calls).toHaveLength(0);
    expect(sandboxed.calls).toHaveLength(0);
  });

  test("the token minted inside the sandbox runs the command when presented back", async () => {
    const codec = createConfirmCodec("codemode-test", () => 5_000);
    const mocked = mockSpawn();
    const handlers = createHandlers(CATALOG, undefined, {
      codec,
      allowMutations: false,
      spawn: mocked.spawn,
    });

    const held = await run(`async () => hoox.run("deploy all")`, { handlers });
    const token = payloadOf(held).confirm_token ?? "";
    expect(token.length).toBeGreaterThan(0);
    expect(mocked.calls).toHaveLength(0);

    // The sandbox code receives no arguments, so the token is embedded literally.
    const ran = await run(
      `async () => (await hoox.run("deploy all", { confirm: ${JSON.stringify(token)} })).status`,
      { handlers }
    );
    expect(ran.ok).toBe(true);
    if (!ran.ok) return;
    expect(ran.value).toBe("ok");
    expect(mocked.calls).toHaveLength(1);
    expect(mocked.calls[0]?.cmd.join(" ")).toContain("--yes");
  });

  test("a token bound to other arguments is rejected", async () => {
    const codec = createConfirmCodec("codemode-test", () => 5_000);
    const mocked = mockSpawn();
    const handlers = createHandlers(CATALOG, undefined, {
      codec,
      allowMutations: false,
      spawn: mocked.spawn,
    });
    const other = await executeEntry(
      CATALOG[1] as CatalogEntry,
      {},
      {
        deps: { codec, allowMutations: false, spawn: mocked.spawn },
      }
    );
    const result = await run(
      `async () => (await hoox.run("db reset", { confirm: ${JSON.stringify(other.confirm_token)} })).status`,
      { handlers }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("refused");
    expect(mocked.calls).toHaveLength(0);
  });
});

describe("sandbox escapes", () => {
  const handlers = () =>
    createHandlers(CATALOG, undefined, {
      spawn: mockSpawn().spawn,
      allowMutations: false,
    });

  test("process and process.env are not reachable", async () => {
    const result = await run(
      `async () => process.env.HOOX_MCP_CONFIRM_SECRET`,
      {
        handlers: handlers(),
      }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("process is not defined");
  });

  test("the constructor escape is blocked", async () => {
    const attempts = [
      `async () => (function () {}).constructor("return process")()`,
      `async () => hoox.run.constructor("return process")()`,
      `async () => hoox.constructor.constructor("return process")()`,
      `async () => hoox.describe.constructor("return globalThis")()`,
      `async () => eval("1")`,
    ];
    for (const code of attempts) {
      const result = await run(code, { handlers: handlers() });
      expect(result.ok).toBe(false);
      if (result.ok) continue;
      expect(result.message).toMatch(
        /Code generation from strings disallowed|not defined/
      );
    }
  });

  test("runtime globals are absent", async () => {
    const result = await run(
      `async () => [typeof Bun, typeof require, typeof fetch, typeof WebSocket, typeof Deno]`,
      { handlers: handlers() }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toEqual([
      "undefined",
      "undefined",
      "undefined",
      "undefined",
      "undefined",
    ]);
  });

  test("console output does not corrupt the protocol", async () => {
    const result = await run(
      `async () => { console.log("hello", { a: 1 }); return "ok"; }`,
      { handlers: handlers() }
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value).toBe("ok");
    expect(result.logs).toEqual(['log: hello {"a":1}']);
  });
});

describe("sandbox limits", () => {
  test("rejects oversized code before spawning", async () => {
    const result = await run(`async () => 1`, { limits: { maxCodeChars: 5 } });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("the limit is 5");
  });

  test("enforces the call budget", async () => {
    const handlers = createHandlers(CATALOG, undefined, {
      spawn: mockSpawn().spawn,
      allowMutations: false,
    });
    const result = await run(
      `async () => {
        const out = [];
        for (let i = 0; i < 5; i += 1) out.push((await hoox.run("doctor")).status);
        return out;
      }`,
      { handlers, limits: { maxCalls: 2 } }
    );
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("call limit");
  });

  test("kills runaway code", async () => {
    const result = await run(`async () => { for (;;) {} }`, {
      handlers: createHandlers(CATALOG),
      limits: { timeoutMs: 400 },
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.message).toContain("timed out");
  }, 20_000);
});

describe("bwrap boundary", () => {
  test("the plan clears the environment and unshares every namespace", () => {
    const plan = buildBwrapPlan();
    const cmd = plan.cmd.join(" ");
    expect(cmd).toContain("--unshare-all");
    expect(cmd).toContain("--clearenv");
    expect(cmd).toContain("--cap-drop ALL");
    expect(cmd).toContain("--die-with-parent");
    expect(cmd).toContain("--tmpfs /tmp");
    expect(cmd).toContain("--ro-bind");
    // The repo appears exactly once: the harness file itself, never a directory.
    const repoRefs = plan.cmd.filter((arg) => arg.includes(repoRoot));
    expect(repoRefs).toEqual([harnessPath()]);
    expect(plan.env).toEqual({});
    expect(plan.cmd.at(-1)).toBe("/harness.ts");
  });

  test.skipIf(!bwrapAvailable)(
    "denies repo reads, network, and persistent writes",
    async () => {
      const plan = buildBwrapPlan();
      const probeFile = `/etc/hoox-codemode-probe-${Date.now()}`;
      const probe = `
        const out = {};
        out.env = Object.keys(process.env).sort();
        try { await Bun.file(${JSON.stringify(`${repoRoot}/hoox/package.json`)}).text(); out.repo = "READ"; }
        catch { out.repo = "DENIED"; }
        try { await fetch("https://example.com", { signal: AbortSignal.timeout(1500) }); out.net = "OPEN"; }
        catch { out.net = "DENIED"; }
        await Bun.write(${JSON.stringify(probeFile)}, "x");
        out.etcWrite = "WROTE";
        console.log(JSON.stringify(out));
      `;
      const cmd = [...plan.cmd];
      cmd.splice(cmd.length - 2, 2, "/bun", "-e", probe);
      const proc = Bun.spawn({
        cmd,
        cwd: plan.cwd,
        env: plan.env,
        stdin: "ignore",
        stdout: "pipe",
        stderr: "pipe",
      });
      const [stdout, stderr, code] = await Promise.all([
        new Response(proc.stdout).text(),
        new Response(proc.stderr).text(),
        proc.exited,
      ]);
      expect(stderr).toBe("");
      expect(code).toBe(0);
      const probeResult = JSON.parse(stdout.trim()) as {
        env: string[];
        repo: string;
        net: string;
        etcWrite: string;
      };
      expect(probeResult.repo).toBe("DENIED");
      expect(probeResult.net).toBe("DENIED");
      expect(probeResult.etcWrite).toBe("WROTE");
      expect(existsSync(probeFile)).toBe(false);
      for (const key of probeResult.env) {
        expect(key).not.toMatch(/TOKEN|SECRET|KEY|PASSWORD|CLOUDFLARE|HOOX_/i);
      }
    },
    30_000
  );
});

describe("code mode flag", () => {
  test("flag off keeps the tool list; flag on adds exactly search and execute", async () => {
    const off = await McpStdio.start({
      cwd: pkgRoot,
      env: { HOOX_MCP_CODE_MODE: undefined },
    });
    const offTools = (await off.listTools()).map((tool) => tool.name);
    off.close();

    const on = await McpStdio.start({
      cwd: pkgRoot,
      env: { HOOX_MCP_CODE_MODE: "1" },
    });
    const onTools = (await on.listTools()).map((tool) => tool.name);
    on.close();

    expect(offTools.length).toBeGreaterThan(100);
    expect(offTools).not.toContain("search");
    expect(offTools).not.toContain("execute");
    expect(onTools.length).toBe(offTools.length + 2);
    expect(onTools.filter((name) => !offTools.includes(name))).toEqual([
      "search",
      "execute",
    ]);
    expect(onTools.slice(0, offTools.length)).toEqual(offTools);
  }, 60_000);
});
