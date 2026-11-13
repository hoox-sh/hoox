/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Minimal MCP stdio client: newline-delimited JSON-RPC 2.0 over a child
 * process's stdin/stdout. No dependency on an MCP client package.
 *
 * Kept deliberately small so the pyne-mcp and axis-worker Code Mode cards can
 * copy it to prove their own tool lists and payloads.
 */

export interface McpTool {
  name: string;
  description?: string;
  inputSchema?: unknown;
  annotations?: Record<string, unknown>;
}

export interface McpToolResult {
  content: Array<{ type: string; text?: string }>;
  structuredContent?: unknown;
  isError?: boolean;
}

export interface McpStdioOptions {
  /** Directory the server runs in. */
  cwd: string;
  /** Entry argv, for example ["bun", "bin/hoox-mcp.js"]. */
  cmd?: string[];
  /** Extra environment. `undefined` removes a key from the parent env. */
  env?: Record<string, string | undefined>;
  /** Per-request timeout. */
  timeoutMs?: number;
}

interface Pending {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export class McpStdio {
  private readonly proc: ReturnType<typeof Bun.spawn>;
  private readonly stdin: { write(chunk: string): unknown; end(): unknown };
  private buffer = "";
  private nextId = 1;
  private readonly pending = new Map<number, Pending>();
  private readonly timeoutMs: number;
  private stderr = "";

  private constructor(proc: ReturnType<typeof Bun.spawn>, timeoutMs: number) {
    this.proc = proc;
    this.stdin = proc.stdin as unknown as {
      write(chunk: string): unknown;
      end(): unknown;
    };
    this.timeoutMs = timeoutMs;
    void this.readStdout();
    void this.readStderr();
  }

  static async start(options: McpStdioOptions): Promise<McpStdio> {
    const env: Record<string, string> = {};
    for (const [key, value] of Object.entries(process.env)) {
      if (typeof value === "string") env[key] = value;
    }
    for (const [key, value] of Object.entries(options.env ?? {})) {
      if (value === undefined) delete env[key];
      else env[key] = value;
    }
    const proc = Bun.spawn({
      cmd: options.cmd ?? ["bun", "bin/hoox-mcp.js"],
      cwd: options.cwd,
      env,
      stdin: "pipe",
      stdout: "pipe",
      stderr: "pipe",
    });
    const client = new McpStdio(proc, options.timeoutMs ?? 30_000);
    await client.initialize();
    return client;
  }

  private async readStdout(): Promise<void> {
    const decoder = new TextDecoder();
    for await (const chunk of this.proc.stdout as ReadableStream<Uint8Array>) {
      this.buffer += decoder.decode(chunk, { stream: true });
      let at = this.buffer.indexOf("\n");
      while (at >= 0) {
        const line = this.buffer.slice(0, at).trim();
        this.buffer = this.buffer.slice(at + 1);
        if (line.length > 0) this.dispatch(line);
        at = this.buffer.indexOf("\n");
      }
    }
  }

  private async readStderr(): Promise<void> {
    const decoder = new TextDecoder();
    for await (const chunk of this.proc.stderr as ReadableStream<Uint8Array>) {
      this.stderr += decoder.decode(chunk, { stream: true });
    }
  }

  private dispatch(line: string): void {
    let message: { id?: number; result?: unknown; error?: unknown };
    try {
      message = JSON.parse(line) as typeof message;
    } catch {
      return;
    }
    if (typeof message.id !== "number") return;
    const pending = this.pending.get(message.id);
    if (!pending) return;
    this.pending.delete(message.id);
    clearTimeout(pending.timer);
    if (message.error) {
      pending.reject(new Error(JSON.stringify(message.error)));
    } else {
      pending.resolve(message.result);
    }
  }

  private send(message: unknown): void {
    this.stdin.write(`${JSON.stringify(message)}\n`);
  }

  private async initialize(): Promise<void> {
    await this.request("initialize", {
      protocolVersion: "2026-07-28",
      capabilities: {},
      clientInfo: { name: "hoox-codemode-proof", version: "0.0.0" },
    });
    this.send({ jsonrpc: "2.0", method: "notifications/initialized" });
  }

  request(method: string, params: unknown): Promise<unknown> {
    const id = this.nextId;
    this.nextId += 1;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `${method} timed out after ${this.timeoutMs}ms; stderr: ${this.stderr.slice(0, 400)}`
          )
        );
      }, this.timeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      this.send({ jsonrpc: "2.0", id, method, params });
    });
  }

  async listTools(): Promise<McpTool[]> {
    const result = (await this.request("tools/list", {})) as {
      tools?: McpTool[];
    };
    return result.tools ?? [];
  }

  async callTool(name: string, args: unknown): Promise<McpToolResult> {
    return (await this.request("tools/call", {
      name,
      arguments: args,
    })) as McpToolResult;
  }

  get diagnostics(): string {
    return this.stderr;
  }

  close(): void {
    try {
      this.stdin.end();
    } catch {
      // already closed
    }
    try {
      this.proc.kill("SIGTERM");
    } catch {
      // already gone
    }
  }
}
