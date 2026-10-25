/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from "node:fs";
import { buildArgv } from "./argv.ts";
import { processCodec, type ConfirmCodec } from "./confirm.ts";
import {
  classifyCall,
  promptBlock,
  refusal,
  resolveTimeoutMs,
} from "./policy.ts";
import { hooxBinPath, resolveCwd } from "./paths.ts";
import {
  clip,
  parseJsonLoose,
  redact,
  redactArgv,
  stripAnsi,
} from "./redact.ts";
import { suggestNextCommand } from "./cli-bridge.ts";
import type { CatalogEntry, ToolPayload } from "./types.ts";

const RAW_CAP = 1_000_000;
const VIEW_CAP = 24_000;

export interface SpawnRequest {
  cmd: string[];
  cwd: string;
  env: Record<string, string>;
}

export interface Spawned {
  stdout: ReadableStream<Uint8Array> | null;
  stderr: ReadableStream<Uint8Array> | null;
  stdin: { write(chunk: string | Uint8Array): unknown; end(): unknown } | null;
  exited: Promise<number>;
  kill(signal?: NodeJS.Signals): void;
}

export type SpawnFn = (request: SpawnRequest) => Spawned;

export interface ExecDeps {
  spawn?: SpawnFn;
  codec?: ConfirmCodec;
  allowMutations?: boolean;
  bin?: string;
}

function blank(entry: CatalogEntry): ToolPayload {
  return {
    status: "refused",
    command: entry.path,
    risk: entry.risk,
    long: entry.long,
    argv: [],
    cwd: null,
    exit_code: null,
    duration_ms: null,
    timed_out: false,
    stdout: "",
    stderr: "",
    json: null,
    truncated: false,
    redactions: 0,
    confirm_token: null,
    expires_at: null,
    suggestion: null,
    message: null,
  };
}

export async function executeEntry(
  entry: CatalogEntry,
  values: Record<string, unknown>,
  opts?: { mode?: "run" | "plan"; deps?: ExecDeps }
): Promise<ToolPayload> {
  const mode = opts?.mode ?? "run";
  const payload = blank(entry);
  if (!entry.action) {
    payload.message = `${entry.path} is a command group. Choose a subcommand.`;
    return payload;
  }

  const classified = classifyCall(entry, values);
  payload.risk = classified.risk;
  payload.long = classified.long;
  payload.suggestion = await suggestNextCommand(entry.path);

  if (classified.risk === "interactive") {
    payload.message = refusal(entry.path);
    return payload;
  }
  const blocked = promptBlock(entry, values);
  if (blocked) {
    payload.message = blocked;
    return payload;
  }

  const cwd = resolveCwd(
    typeof values.cwd === "string" ? values.cwd : undefined
  );
  if (!cwd.ok) {
    payload.message = cwd.message;
    return payload;
  }
  payload.cwd = cwd.cwd;

  const built = buildArgv(entry, values);
  if (!built.ok) {
    payload.message = built.message;
    return payload;
  }

  const argv = [...built.argv];
  if (classified.risk === "mutate") {
    argv.push("--yes");
    // db reset checks the local flag, not global --yes.
    if (entry.path === "db reset") argv.push("--confirm");
  }
  const shown = redactArgv(argv);
  payload.argv = shown.argv;
  payload.redactions = shown.count;

  const claims = {
    path: entry.path,
    argv,
    cwd: cwd.cwd,
    secretHash: built.secretHash,
  };
  const codec = opts?.deps?.codec ?? processCodec();

  if (mode === "plan") {
    if (classified.risk === "mutate") {
      const issued = codec.issue(claims);
      payload.status = "confirmation_required";
      payload.confirm_token = issued.token;
      payload.expires_at = issued.expiresAt;
      payload.message =
        "Plan only. Pass confirm_token as confirm on the command tool to run it.";
      return payload;
    }
    payload.status = "planned";
    payload.message = "Read-only plan. No confirm token is required to run it.";
    return payload;
  }

  if (classified.risk === "mutate" && !mutationsAllowed(opts?.deps)) {
    const token = typeof values.confirm === "string" ? values.confirm : "";
    if (!token) {
      const issued = codec.issue(claims);
      payload.status = "confirmation_required";
      payload.confirm_token = issued.token;
      payload.expires_at = issued.expiresAt;
      payload.message =
        "Mutating command was not run. Call again with confirm set to confirm_token.";
      return payload;
    }
    const verified = codec.verify(token, claims);
    if (!verified.ok) {
      payload.message = verified.message;
      return payload;
    }
  }

  const bin = opts?.deps?.bin ?? hooxBinPath();
  if (!existsSync(bin)) {
    payload.status = "error";
    payload.message = `hoox binary not found at ${bin}`;
    return payload;
  }

  const timeoutMs = resolveTimeoutMs(
    entry,
    values,
    classified.long,
    classified.risk
  );
  try {
    return await runChild({
      payload,
      argv,
      cwd: cwd.cwd,
      stdin: built.stdin,
      bin,
      timeoutMs,
      spawn: opts?.deps?.spawn ?? bunSpawn,
    });
  } catch (err) {
    payload.status = "error";
    payload.message = err instanceof Error ? err.message : String(err);
    return payload;
  }
}

async function runChild(input: {
  payload: ToolPayload;
  argv: string[];
  cwd: string;
  stdin: string | null;
  bin: string;
  timeoutMs: number;
  spawn: SpawnFn;
}): Promise<ToolPayload> {
  const started = Date.now();
  const child = input.spawn({
    cmd: [process.execPath, input.bin, ...input.argv],
    cwd: input.cwd,
    env: childEnv(input.cwd),
  });
  const stdoutTask = readCapped(child.stdout, RAW_CAP);
  const stderrTask = readCapped(child.stderr, RAW_CAP);
  if (input.stdin && child.stdin) {
    await Promise.resolve(child.stdin.write(input.stdin));
  }
  await Promise.resolve(child.stdin?.end());

  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    try {
      child.kill("SIGTERM");
    } catch {
      // already exited
    }
    const kill = setTimeout(() => {
      try {
        child.kill("SIGKILL");
      } catch {
        // already exited
      }
    }, 400);
    kill.unref?.();
  }, input.timeoutMs);

  let exitCode: number;
  try {
    exitCode = await raceExit(child.exited, input.timeoutMs + 2_000);
  } finally {
    clearTimeout(timer);
  }

  const [stdoutRaw, stderrRaw] = await Promise.all([stdoutTask, stderrTask]);
  const stdoutClean = present(stdoutRaw.text);
  const stderrClean = present(stderrRaw.text);
  const stdout = clip(stdoutClean.text, VIEW_CAP);
  const stderr = clip(stderrClean.text, VIEW_CAP);
  const payload = input.payload;
  payload.exit_code = exitCode;
  payload.duration_ms = Date.now() - started;
  payload.timed_out = timedOut;
  payload.stdout = stdout.text;
  payload.stderr = stderr.text;
  payload.truncated =
    stdout.truncated ||
    stderr.truncated ||
    stdoutRaw.truncated ||
    stderrRaw.truncated;
  payload.redactions += stdoutClean.count + stderrClean.count;
  // The clipped view is not valid JSON once the marker is inserted.
  payload.json = parseJsonLoose(stdoutClean.text);
  if (timedOut) {
    payload.status = "error";
    payload.message = `Timed out after ${input.timeoutMs}ms`;
    return payload;
  }
  if (exitCode !== 0) {
    payload.status = "error";
    payload.message = `hoox exited ${exitCode}`;
    return payload;
  }
  payload.status = "ok";
  payload.message = payload.suggestion
    ? `Next: ${payload.suggestion.command} (${payload.suggestion.reason})`
    : null;
  return payload;
}

function present(text: string): { text: string; count: number } {
  return redact(stripAnsi(text));
}

function mutationsAllowed(deps: ExecDeps | undefined): boolean {
  if (deps?.allowMutations !== undefined) return deps.allowMutations;
  return process.env.HOOX_MCP_ALLOW_MUTATIONS === "1";
}

function childEnv(cwd: string): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (typeof value !== "string") continue;
    if (key.startsWith("HOOX_MCP_") || key === "BUN_TEST") continue;
    env[key] = value;
  }
  if (env.NODE_ENV === "test") delete env.NODE_ENV;
  env.HOOX_REPO = cwd;
  env.HOOX_SKIP_WRANGLER_UPDATE = "1";
  env.HOOX_CLI_SILENT = "1";
  env.NO_COLOR = "1";
  env.TERM = "dumb";
  if (!env.CI) env.CI = "1";
  return env;
}

function bunSpawn(request: SpawnRequest): Spawned {
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

async function readCapped(
  stream: ReadableStream<Uint8Array> | null,
  cap: number
): Promise<{ text: string; truncated: boolean }> {
  if (!stream) return { text: "", truncated: false };
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  let truncated = false;
  try {
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      const value = next.value;
      if (!value) continue;
      if (total >= cap) {
        truncated = true;
        continue;
      }
      if (total + value.byteLength > cap) {
        chunks.push(value.subarray(0, cap - total));
        total = cap;
        truncated = true;
      } else {
        chunks.push(value);
        total += value.byteLength;
      }
    }
  } finally {
    reader.releaseLock();
  }
  const buf = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    buf.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { text: new TextDecoder().decode(buf), truncated };
}

async function raceExit(exited: Promise<number>, ms: number): Promise<number> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      exited,
      new Promise<number>((resolve) => {
        timer = setTimeout(() => resolve(124), ms);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
