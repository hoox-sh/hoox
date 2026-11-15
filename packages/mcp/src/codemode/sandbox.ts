/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Mode sandbox boundary.
 *
 * ## What the boundary is
 *
 * `execute` and `search` run model-written JavaScript in a separate process
 * launched with bubblewrap (`bwrap`). The namespace is the security boundary:
 *
 *   --unshare-all      new user, pid, net, ipc, uts, and cgroup namespaces.
 *                      There is no network route, not even loopback.
 *   --clearenv         the child starts with no environment at all, then gets
 *                      PATH, HOME, TMPDIR, LANG, and NO_COLOR. No credentials,
 *                      no HOOX_*, no CLOUDFLARE_*, no .dev.vars values.
 *   --ro-bind <file>   only the Bun binary, the harness, and the shared library
 *                      directories are visible, read-only. The repository, the
 *                      home directory, and every .env file are simply absent.
 *   --tmpfs /          the root is a private tmpfs, so writes anywhere are
 *                      discarded with the process. Nothing reaches the host.
 *   --die-with-parent  no orphan survives the server.
 *   --new-session      no controlling terminal.
 *   --cap-drop ALL     no capabilities inside the user namespace.
 *
 * ## What the boundary is not
 *
 * - Not a V8 isolate and not `node:vm`. The harness uses `vm` for capability
 *   shaping (no `process`, `Bun`, `require`, `fetch`), but `vm` is not a
 *   boundary and is not treated as one. The namespace carries the security
 *   weight; `vm` only makes accidental escapes fail loudly.
 * - Not a seccomp filter. The child can still fork, but every path it can reach
 *   is a read-only bind of the runtime plus a private tmpfs, and it has no
 *   network and no credentials, so a fork buys nothing.
 * - Not available on hosts without bubblewrap. `execute` then fails closed with
 *   an explicit message. Setting `HOOX_MCP_CODE_MODE_SANDBOX=subprocess`
 *   accepts a weaker, documented mode: a plain child process with a cleared
 *   environment, a throwaway cwd, and no credentials, but with host filesystem
 *   reads still possible. That opt-in is a deliberate operator decision.
 *
 * ## Trust direction
 *
 * The parent never trusts the child. Every `run` request is re-validated as if
 * a model had typed it: catalog lookup, the same zod input schema the direct
 * tool uses, the same risk classification, the same confirm-token flow. The
 * child cannot widen its own permissions by lying.
 */

import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { redact } from "../redact.ts";
import { DEFAULT_LIMITS, type SandboxResult } from "./protocol.ts";
import type { CodeModeHandlers, SandboxRequest } from "./protocol.ts";
import type { SpawnFn, Spawned } from "../runner.ts";

export type SandboxKind = "bwrap" | "subprocess";

export interface SandboxPlan {
  kind: SandboxKind;
  cmd: string[];
  cwd: string;
  env: Record<string, string>;
  /** Removed after the child exits. Only set for the throwaway subprocess mode. */
  cleanupDir?: string;
}

export interface SandboxDeps {
  plan?: SandboxPlan;
  spawn?: SpawnFn;
}

const STDERR_CAP = 4_000;
const RESULT_CAP = DEFAULT_LIMITS.maxResultChars;

/** Shared libraries Bun needs. Bound read-only when they exist. */
const LIB_DIRS = ["/usr/lib", "/usr/lib64", "/lib", "/lib64"];

/** The complete environment the sandboxed process receives. */
const SANDBOX_ENV: Record<string, string> = {
  PATH: "/usr/bin",
  HOME: "/tmp",
  TMPDIR: "/tmp",
  LANG: "C.UTF-8",
  NO_COLOR: "1",
};

export function harnessPath(): string {
  return fileURLToPath(new URL("./harness.ts", import.meta.url));
}

export function bunPath(): string {
  return process.execPath;
}

/**
 * Decide which boundary to use. Default is fail closed: no bwrap, no execute.
 * `HOOX_MCP_CODE_MODE_SANDBOX=subprocess` is the only way to accept less.
 */
export function resolveSandboxKind(
  env: NodeJS.ProcessEnv = process.env
): { kind: SandboxKind } | { error: string } {
  const requested = env.HOOX_MCP_CODE_MODE_SANDBOX?.trim();
  if (requested === "subprocess") return { kind: "subprocess" };
  const bwrap = Bun.which("bwrap");
  if (bwrap) return { kind: "bwrap" };
  if (requested === "bwrap") {
    return {
      error:
        "HOOX_MCP_CODE_MODE_SANDBOX=bwrap but bubblewrap is not installed. Install bwrap, or set HOOX_MCP_CODE_MODE_SANDBOX=subprocess to accept the weaker documented mode.",
    };
  }
  return {
    error:
      "Code Mode needs bubblewrap for a real sandbox and bwrap is not installed. Install bwrap, or set HOOX_MCP_CODE_MODE_SANDBOX=subprocess to accept a plain child process with a cleared environment but host filesystem reads still possible.",
  };
}

export function buildBwrapPlan(
  input: { bun?: string; harness?: string; bwrap?: string } = {}
): SandboxPlan {
  const bwrap = input.bwrap ?? Bun.which("bwrap") ?? "bwrap";
  const bun = input.bun ?? bunPath();
  const harness = input.harness ?? harnessPath();
  const cmd = [
    bwrap,
    "--unshare-all",
    "--die-with-parent",
    "--new-session",
    "--cap-drop",
    "ALL",
    "--clearenv",
  ];
  for (const [key, value] of Object.entries(SANDBOX_ENV)) {
    cmd.push("--setenv", key, value);
  }
  for (const dir of LIB_DIRS) {
    if (existsSync(dir)) cmd.push("--ro-bind", dir, dir);
  }
  cmd.push(
    "--ro-bind",
    bun,
    "/bun",
    "--ro-bind",
    harness,
    "/harness.ts",
    "--proc",
    "/proc",
    "--dev",
    "/dev",
    "--tmpfs",
    "/tmp",
    "--chdir",
    "/tmp",
    "/bun",
    "/harness.ts"
  );
  return { kind: "bwrap", cmd, cwd: tmpdir(), env: {} };
}

export function buildSubprocessPlan(
  input: { bun?: string; harness?: string } = {}
): SandboxPlan {
  const dir = mkdtempSync(join(tmpdir(), "hoox-codemode-"));
  return {
    kind: "subprocess",
    cmd: [input.bun ?? bunPath(), input.harness ?? harnessPath()],
    cwd: dir,
    env: { ...SANDBOX_ENV },
    cleanupDir: dir,
  };
}

export function defaultSandboxPlan(): SandboxPlan | { error: string } {
  const resolved = resolveSandboxKind();
  if ("error" in resolved) return resolved;
  return resolved.kind === "bwrap" ? buildBwrapPlan() : buildSubprocessPlan();
}

function safeParse(line: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(line) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export async function runInSandbox(
  request: SandboxRequest,
  deps: SandboxDeps = {}
): Promise<SandboxResult> {
  const started = Date.now();
  const limits = { ...DEFAULT_LIMITS, ...request.limits };
  const elapsed = () => Date.now() - started;

  if (request.code.length > limits.maxCodeChars) {
    return {
      ok: false,
      message: `code is ${request.code.length} characters; the limit is ${limits.maxCodeChars}`,
      stderr: "",
      durationMs: elapsed(),
    };
  }
  if (request.mode === "execute" && !request.handlers) {
    return {
      ok: false,
      message: "execute mode requires handlers",
      stderr: "",
      durationMs: elapsed(),
    };
  }

  const plan = deps.plan ?? defaultSandboxPlan();
  if ("error" in plan) {
    return {
      ok: false,
      message: plan.error,
      stderr: "",
      durationMs: elapsed(),
    };
  }

  const spawn = deps.spawn ?? bunSpawn;
  let child: Spawned;
  try {
    child = spawn({ cmd: plan.cmd, cwd: plan.cwd, env: plan.env });
  } catch (err) {
    return {
      ok: false,
      message: `could not start the sandbox: ${
        err instanceof Error ? err.message : String(err)
      }`,
      stderr: "",
      durationMs: elapsed(),
    };
  }

  const stderrTask = readCapped(child.stderr, STDERR_CAP);
  const handlers = request.handlers;
  let callCount = 0;
  let timedOut = false;

  // Writes must not interleave, because each message is one line.
  let writeChain: Promise<unknown> = Promise.resolve();
  const send = (message: unknown): Promise<unknown> => {
    const line = `${JSON.stringify(message)}\n`;
    writeChain = writeChain.then(async () => {
      try {
        await child.stdin?.write(line);
      } catch {
        // the child is gone; the read loop reports it
      }
    });
    return writeChain;
  };

  const reply = (id: number, ok: boolean, payload: unknown): void => {
    if (!ok) {
      void send({ type: "reply", id, ok: false, json: String(payload) });
      return;
    }
    let json: string;
    try {
      // Always an envelope: the context unwraps `value`, so a payload that
      // happens to be a primitive still round-trips.
      json = JSON.stringify({ value: payload }) ?? "null";
    } catch (err) {
      void send({
        type: "reply",
        id,
        ok: false,
        json: `result is not JSON-serializable: ${
          err instanceof Error ? err.message : String(err)
        }`,
      });
      return;
    }
    void send({ type: "reply", id, ok: true, json });
  };

  const handleCall = async (
    message: Record<string, unknown>
  ): Promise<void> => {
    const id = typeof message.id === "number" ? message.id : -1;
    const method = typeof message.method === "string" ? message.method : "";
    if (id < 0) return;
    callCount += 1;
    if (callCount > limits.maxCalls) {
      reply(id, false, `sandbox call limit reached (${limits.maxCalls})`);
      return;
    }
    if (!handlers || !isMethod(method)) {
      reply(id, false, `unknown sandbox method: ${method}`);
      return;
    }
    const target = typeof message.target === "string" ? message.target : "";
    try {
      const value = await dispatch(handlers, method, target, message.args);
      reply(id, true, value);
    } catch (err) {
      reply(id, false, err instanceof Error ? err.message : String(err));
    }
  };

  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill("SIGKILL");
    } catch {
      // already gone
    }
  }, limits.timeoutMs);

  let done: { json: string; calls: number; logs: string[] } | null = null;
  let failure: string | null = null;

  try {
    await send({
      type: "job",
      mode: request.mode,
      code: request.code,
      catalog:
        request.mode === "search" && request.catalog
          ? JSON.stringify(request.catalog)
          : null,
      maxCalls: limits.maxCalls,
    });

    for await (const line of lines(child.stdout)) {
      const message = safeParse(line);
      if (!message) continue;
      if (message.type === "call") {
        void handleCall(message);
        continue;
      }
      if (message.type === "done") {
        done = {
          json: typeof message.json === "string" ? message.json : "null",
          calls: typeof message.calls === "number" ? message.calls : callCount,
          logs: Array.isArray(message.logs)
            ? message.logs.filter(
                (item): item is string => typeof item === "string"
              )
            : [],
        };
        break;
      }
      if (message.type === "error") {
        failure =
          typeof message.message === "string"
            ? message.message
            : "sandbox error";
        break;
      }
    }
  } finally {
    clearTimeout(timer);
  }

  // The child waits on stdin, so close it, then make sure it is gone.
  try {
    child.stdin?.end();
  } catch {
    // already closed
  }
  try {
    child.kill("SIGKILL");
  } catch {
    // already gone
  }
  const exitCode = await Promise.race([
    child.exited.catch(() => -1),
    new Promise<number>((resolve) => setTimeout(() => resolve(-1), 1_000)),
  ]);
  const stderrRaw = await stderrTask;
  const stderr = redact(stderrRaw.text).text;
  await writeChain;

  if (plan.cleanupDir) {
    try {
      rmSync(plan.cleanupDir, { recursive: true, force: true });
    } catch {
      // best effort
    }
  }

  if (timedOut) {
    return {
      ok: false,
      message: `sandbox timed out after ${limits.timeoutMs}ms`,
      stderr,
      durationMs: elapsed(),
    };
  }
  if (failure !== null) {
    return { ok: false, message: failure, stderr, durationMs: elapsed() };
  }
  if (!done) {
    return {
      ok: false,
      message: `sandbox exited ${exitCode} without returning a result`,
      stderr,
      durationMs: elapsed(),
    };
  }

  let value: unknown;
  try {
    value = JSON.parse(done.json) as unknown;
  } catch {
    return {
      ok: false,
      message: "sandbox returned invalid JSON",
      stderr,
      durationMs: elapsed(),
    };
  }

  let truncated = false;
  if (done.json.length > limits.maxResultChars) {
    value = {
      truncated: true,
      note: `result was ${done.json.length} characters; the limit is ${limits.maxResultChars}`,
    };
    truncated = true;
  }

  return {
    ok: true,
    value,
    calls: done.calls,
    logs: done.logs,
    durationMs: elapsed(),
    truncated,
  };
}

function isMethod(value: string): value is keyof CodeModeHandlers {
  return (
    value === "run" ||
    value === "describe" ||
    value === "advise" ||
    value === "snapshot" ||
    value === "policy"
  );
}

function dispatch(
  handlers: CodeModeHandlers,
  method: keyof CodeModeHandlers,
  target: string,
  args: unknown
): Promise<unknown> {
  switch (method) {
    case "run":
      return handlers.run(target, args);
    case "describe":
      return handlers.describe(target);
    case "advise":
      return handlers.advise(target, args);
    case "snapshot":
      return handlers.snapshot(args);
    case "policy":
      return handlers.policy();
  }
}

function bunSpawn(request: {
  cmd: string[];
  cwd: string;
  env: Record<string, string>;
}): Spawned {
  const proc = Bun.spawn({
    cmd: request.cmd,
    cwd: request.cwd,
    env: request.env,
    stdin: "pipe",
    stdout: "pipe",
    stderr: "pipe",
  });
  return {
    stdout: proc.stdout,
    stderr: proc.stderr,
    stdin: proc.stdin,
    exited: proc.exited,
    kill(signal) {
      proc.kill(signal);
    },
  };
}

async function* lines(
  stream: ReadableStream<Uint8Array> | null
): AsyncGenerator<string> {
  if (!stream) return;
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      buffer += decoder.decode(value, { stream: true });
      let at = buffer.indexOf("\n");
      while (at >= 0) {
        yield buffer.slice(0, at);
        buffer = buffer.slice(at + 1);
        at = buffer.indexOf("\n");
      }
    }
    if (buffer.length > 0) yield buffer;
  } finally {
    reader.releaseLock();
  }
}

async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  cap: number
): Promise<{ text: string; truncated: boolean }> {
  if (!stream) return { text: "", truncated: false };
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let text = "";
  let truncated = false;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      if (!value) continue;
      if (text.length >= cap) {
        truncated = true;
        continue;
      }
      text += decoder.decode(value, { stream: true });
    }
  } finally {
    reader.releaseLock();
  }
  if (text.length > cap) {
    return { text: text.slice(0, cap), truncated: true };
  }
  return { text, truncated };
}

export { RESULT_CAP };
