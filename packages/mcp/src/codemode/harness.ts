/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Code Mode sandbox harness.
 *
 * This file runs INSIDE the boundary (see sandbox.ts). It is never imported by
 * the server and it imports nothing from the package: inside the boundary only
 * this file, the Bun binary, and its shared libraries are readable.
 *
 * Trust model, in order of importance:
 *
 * 1. The boundary is the OS, not this file. The parent spawns this harness in a
 *    bwrap namespace with a cleared environment, no network, and no host
 *    filesystem. If every line below were wrong, the child still has no
 *    credentials, no repo, and nowhere to write.
 * 2. The parent is the policy enforcement point. This harness can ask for
 *    `run`, but the parent re-validates the target, the arguments, the risk
 *    class, and the confirm token. A hostile child cannot widen its own
 *    permissions by lying to the parent.
 * 3. The vm context below is capability shaping, not a security boundary. It
 *    removes `process`, `Bun`, `require`, and `fetch` so accidental escapes
 *    fail loudly instead of silently working.
 *
 * The one rule that keeps point 3 honest: nothing created in this file's realm
 * is ever handed to sandboxed code as an object. Only primitives cross in
 * (strings), and sandboxed code builds its own objects with JSON.parse inside
 * the context. A single host object would reopen the
 * `fn.constructor.constructor("return process")()` escape.
 */

import vm from "node:vm";

interface Job {
  type: "job";
  mode: "search" | "execute";
  code: string;
  /** Pre-serialized JSON, or null. Parsed inside the context. */
  catalog: string | null;
  maxCalls: number;
}

interface Reply {
  type: "reply";
  id: number;
  ok: boolean;
  json: string;
}

const MAX_LOGS = 40;
const LOG_CHARS = 400;

const decoder = new TextDecoder();
let buffer = "";
let closed = false;
const replies = new Map<number, (message: Reply) => void>();
let pendingJob: Job | null = null;
let jobWaiter: ((value: Job | null) => void) | null = null;

function send(message: unknown): void {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

function dispatch(line: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(line);
  } catch {
    return;
  }
  const message = parsed as { type?: string; id?: number };
  if (message.type === "reply") {
    const id = message.id ?? -1;
    const resolve = replies.get(id);
    if (resolve) {
      replies.delete(id);
      resolve(parsed as Reply);
    }
    return;
  }
  if (message.type === "job") {
    if (jobWaiter) {
      const wake = jobWaiter;
      jobWaiter = null;
      wake(parsed as Job);
    } else {
      pendingJob = parsed as Job;
    }
  }
}

async function readLoop(): Promise<void> {
  const reader = Bun.stdin.stream().getReader();
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    if (!value) continue;
    buffer += decoder.decode(value, { stream: true });
    let at = buffer.indexOf("\n");
    while (at >= 0) {
      const line = buffer.slice(0, at);
      buffer = buffer.slice(at + 1);
      if (line.length > 0) dispatch(line);
      at = buffer.indexOf("\n");
    }
  }
  closed = true;
  if (jobWaiter) {
    const wake = jobWaiter;
    jobWaiter = null;
    wake(null);
  }
}

function nextJob(): Promise<Job | null> {
  if (pendingJob) {
    const value = pendingJob;
    pendingJob = null;
    return Promise.resolve(value);
  }
  if (closed) return Promise.resolve(null);
  return new Promise((resolve) => {
    jobWaiter = resolve;
  });
}

let nextId = 1;

/**
 * Ask the parent to do something. Always resolves to a JSON string and never
 * rejects: a rejected promise would hand a host Error object to sandboxed code,
 * and `error.constructor` is a host Function.
 */
async function callHost(
  method: string,
  target: unknown,
  args: unknown
): Promise<string> {
  const id = nextId;
  nextId += 1;
  const reply = new Promise<Reply>((resolve) => {
    replies.set(id, resolve);
  });
  send({ type: "call", id, method, target, args });
  let message: Reply;
  try {
    message = await reply;
  } catch {
    return JSON.stringify({ __error: "host call failed" });
  }
  if (!message.ok) {
    return JSON.stringify({
      __error:
        typeof message.json === "string" ? message.json : "host call failed",
    });
  }
  return typeof message.json === "string" ? message.json : "null";
}

/**
 * Built inside the vm context. Every binding the model touches is created here,
 * so its `constructor` is the context's Function, and
 * `codeGeneration: { strings: false }` turns the classic escape into a throw.
 */
const CONTEXT_SOURCE = `(function (host, mode, catalogJson, maxCalls) {
  "use strict";
  var calls = 0;
  var logs = [];
  var catalog = catalogJson === null ? null : JSON.parse(catalogJson);

  function fmt(value) {
    if (typeof value === "string") return value;
    try {
      var json = JSON.stringify(value);
      return json === undefined ? String(value) : json;
    } catch (err) {
      return String(value);
    }
  }

  function record(kind, args) {
    if (logs.length >= ${MAX_LOGS}) return;
    var parts = [];
    for (var i = 0; i < args.length; i += 1) parts.push(fmt(args[i]));
    logs.push((kind + ": " + parts.join(" ")).slice(0, ${LOG_CHARS}));
  }

  var consoleApi = {};
  var kinds = ["log", "info", "warn", "error", "debug", "trace"];
  for (var k = 0; k < kinds.length; k += 1) {
    (function (kind) {
      consoleApi[kind] = function () { record(kind, arguments); };
    })(kinds[k]);
  }

  async function call(method, target, args) {
    if (calls >= maxCalls) {
      throw new Error("sandbox call limit reached (" + maxCalls + ")");
    }
    calls += 1;
    var raw = await host.call(method, target, args);
    var reply = JSON.parse(raw);
    if (reply && reply.__error) throw new Error(String(reply.__error));
    return reply === null || reply === undefined ? null : reply.value;
  }

  var api = {};
  if (catalog !== null) api.catalog = catalog;
  if (mode === "execute") {
    api.run = function (target, args) { return call("run", target, args); };
    api.describe = function (target) { return call("describe", target, null); };
    api.advise = function (command, cwd) { return call("advise", command, cwd); };
    api.snapshot = function (opts) { return call("snapshot", opts, null); };
    api.policy = function () { return call("policy", null, null); };
  }

  return { api: api, catalog: catalog, console: consoleApi, logs: logs, calls: function () { return calls; } };
})`;

async function run(job: Job): Promise<void> {
  const context = vm.createContext(Object.create(null), {
    codeGeneration: { strings: false, wasm: false },
  });

  const build = vm.runInContext(CONTEXT_SOURCE, context) as (
    host: unknown,
    mode: string,
    catalogJson: string | null,
    maxCalls: number
  ) => {
    api: Record<string, unknown>;
    catalog: unknown;
    console: Record<string, unknown>;
    logs: string[];
    calls: () => number;
  };

  // The host bridge is a closure variable inside the context, never a property
  // of a context object, so sandboxed code cannot reach it.
  const built = build({ call: callHost }, job.mode, job.catalog, job.maxCalls);
  context.hoox = built.api;
  context.console = built.console;
  if (built.catalog !== null) context.catalog = built.catalog;

  const source = `(${job.code.trim().replace(/;+$/, "")}\n)`;
  let fn: unknown;
  try {
    fn = vm.runInContext(source, context);
  } catch (err) {
    send({
      type: "error",
      message: `code must be a JavaScript async arrow function: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    return;
  }
  if (typeof fn !== "function") {
    send({ type: "error", message: "code did not evaluate to a function" });
    return;
  }

  let value: unknown;
  try {
    value = await (fn as () => unknown)();
  } catch (err) {
    send({
      type: "error",
      message: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return;
  }

  let json: string;
  try {
    const encoded = JSON.stringify(value === undefined ? null : value);
    json = encoded === undefined ? "null" : encoded;
  } catch (err) {
    send({
      type: "error",
      message: `result is not JSON-serializable: ${
        err instanceof Error ? err.message : String(err)
      }`,
    });
    return;
  }

  send({
    type: "done",
    json,
    calls: built.calls(),
    logs: built.logs.slice(0, MAX_LOGS),
  });
}

async function main(): Promise<void> {
  void readLoop();
  const job = await nextJob();
  if (!job) {
    send({ type: "error", message: "sandbox received no job" });
    return;
  }
  await run(job);
}

await main();
