/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Tests for validateReadOnlySql — the client-side read-only SQL validator.
 *
 * Validates the security guarantees of the db-query view:
 *   - SELECT / WITH / EXPLAIN are allowed
 *   - INSERT / UPDATE / DELETE / DROP / CREATE / ALTER / TRUNCATE / PRAGMA
 *     / ATTACH / DETACH / VACUUM / REINDEX are rejected
 *   - Multi-statement payloads (semicolons with content after) are rejected
 *   - Empty/whitespace-only input is rejected
 *   - Comment-only input is rejected
 *   - Mixed-case variants are handled case-insensitively
 *   - String literals and comments are stripped before keyword check
 */
import { describe, it, expect, beforeEach, afterEach } from "bun:test";
import {
  validateReadOnlySql,
  tryParseJsonLoose,
  sanitizeCliArgsForLog,
  parseDbQueryResult,
  deriveQueueDepthStatus,
  parseQueueDepths,
  parseSecretsList,
  inferSecretType,
  parseKvList,
  parseKvManifest,
  stripAnsi,
  parseKillSwitchStatus,
  parsePyneHealth,
  parseAgentHealth,
  extractNamespaceId,
  agentChatStream,
  AI_MODEL_OPTIONS,
  type SqlValidationResult,
} from "./cli-bridge";
import { realCliBridge } from "../cli-bridge-test-double";
import type { CliResult } from "../types";

// ─── Helper ───────────────────────────────────────────────────────────────────

function isValid(sql: string): boolean {
  return validateReadOnlySql(sql).readonly;
}

function rejectReason(sql: string): string {
  const result = validateReadOnlySql(sql);
  return result.readonly ? "" : (result as { reason: string }).reason;
}

// ─── Allowed entry points ─────────────────────────────────────────────────────

describe("validateReadOnlySql — allowed entry points", () => {
  it("accepts simple SELECT", () => {
    expect(isValid("SELECT * FROM users")).toBe(true);
  });

  it("accepts SELECT with WHERE clause", () => {
    expect(isValid("SELECT id, name FROM users WHERE active = 1")).toBe(true);
  });

  it("accepts SELECT with JOIN", () => {
    expect(
      isValid(
        "SELECT u.name, o.total FROM users u JOIN orders o ON u.id = o.user_id"
      )
    ).toBe(true);
  });

  it("accepts SELECT with subquery", () => {
    expect(
      isValid(
        "SELECT * FROM (SELECT id, name FROM users WHERE active = 1) AS active_users"
      )
    ).toBe(true);
  });

  it("accepts WITH ... SELECT (CTE)", () => {
    expect(
      isValid(
        "WITH active_users AS (SELECT * FROM users WHERE active = 1) SELECT * FROM active_users"
      )
    ).toBe(true);
  });

  it("accepts EXPLAIN SELECT", () => {
    expect(isValid("EXPLAIN SELECT * FROM users")).toBe(true);
  });

  it("accepts EXPLAIN QUERY PLAN", () => {
    expect(isValid("EXPLAIN QUERY PLAN SELECT * FROM users")).toBe(true);
  });

  it("accepts SELECT with LIMIT", () => {
    expect(isValid("SELECT * FROM migrations ORDER BY id DESC LIMIT 5")).toBe(
      true
    );
  });

  it("accepts SELECT from sqlite_master", () => {
    expect(
      isValid(
        "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name"
      )
    ).toBe(true);
  });
});

// ─── Forbidden keywords ────────────────────────────────────────────────────────

describe("validateReadOnlySql — forbidden keywords", () => {
  // INSERT
  it("rejects INSERT", () => {
    expect(isValid("INSERT INTO users (name) VALUES ('test')")).toBe(false);
  });
  it("rejects INSERT as first token (uppercase)", () => {
    expect(isValid("INSERT INTO users VALUES (1)")).toBe(false);
  });
  it("rejects insert (lowercase)", () => {
    expect(isValid("insert into users values (1)")).toBe(false);
  });

  // UPDATE
  it("rejects UPDATE", () => {
    expect(isValid("UPDATE users SET name = 'test' WHERE id = 1")).toBe(false);
  });
  it("rejects update (lowercase)", () => {
    expect(isValid("update users set name = 'test' where id = 1")).toBe(false);
  });

  // DELETE
  it("rejects DELETE", () => {
    expect(isValid("DELETE FROM users WHERE id = 1")).toBe(false);
  });
  it("rejects delete (lowercase)", () => {
    expect(isValid("delete from users where id = 1")).toBe(false);
  });

  // REPLACE
  it("rejects REPLACE", () => {
    expect(isValid("REPLACE INTO users (id, name) VALUES (1, 'test')")).toBe(
      false
    );
  });

  // DROP
  it("rejects DROP TABLE", () => {
    expect(isValid("DROP TABLE users")).toBe(false);
  });
  it("rejects DROP INDEX", () => {
    expect(isValid("DROP INDEX idx_users")).toBe(false);
  });

  // CREATE
  it("rejects CREATE TABLE", () => {
    expect(isValid("CREATE TABLE test (id INTEGER PRIMARY KEY)")).toBe(false);
  });
  it("rejects CREATE INDEX", () => {
    expect(isValid("CREATE INDEX idx ON users(name)")).toBe(false);
  });
  it("rejects CREATE VIEW", () => {
    expect(isValid("CREATE VIEW v AS SELECT * FROM users")).toBe(false);
  });

  // ALTER
  it("rejects ALTER TABLE", () => {
    expect(isValid("ALTER TABLE users ADD COLUMN email TEXT")).toBe(false);
  });

  // TRUNCATE
  it("rejects TRUNCATE", () => {
    expect(isValid("TRUNCATE TABLE users")).toBe(false);
  });

  // PRAGMA
  it("rejects PRAGMA", () => {
    expect(isValid("PRAGMA journal_mode=WAL")).toBe(false);
  });
  it("rejects pragma (lowercase)", () => {
    expect(isValid("pragma journal_mode")).toBe(false);
  });

  // ATTACH
  it("rejects ATTACH", () => {
    expect(isValid("ATTACH DATABASE '/tmp/test.db' AS test")).toBe(false);
  });

  // DETACH
  it("rejects DETACH", () => {
    expect(isValid("DETACH DATABASE test")).toBe(false);
  });

  // VACUUM
  it("rejects VACUUM", () => {
    expect(isValid("VACUUM")).toBe(false);
  });

  // REINDEX
  it("rejects REINDEX", () => {
    expect(isValid("REINDEX")).toBe(false);
  });

  // Forbidden keyword mixed into a valid-looking SELECT (injection attempt)
  it("rejects SELECT with DROP in string literal", () => {
    // The validator strips string literals before checking, so embedded
    // keywords in string literals should not trigger rejection.
    // However, the whole-statement check should still reject if the
    // keyword appears outside strings/comments.
    expect(isValid("SELECT 'DROP TABLE users'")).toBe(true); // keyword is inside string
  });

  it("rejects SELECT with forbidden keyword after string literal", () => {
    // Keyword outside string → must be rejected
    expect(isValid("SELECT 'hello' FROM users; DROP TABLE users")).toBe(false);
  });
});

// ─── Comment stripping ────────────────────────────────────────────────────────

describe("validateReadOnlySql — comment stripping", () => {
  it("accepts SELECT with trailing line comment", () => {
    expect(isValid("SELECT * FROM users -- this is a comment")).toBe(true);
  });

  it("accepts SELECT with inline line comment", () => {
    expect(isValid("SELECT * FROM users -- comment\nWHERE id = 1")).toBe(true);
  });

  it("accepts SELECT with block comment", () => {
    expect(isValid("SELECT /* comment */ * FROM users")).toBe(true);
  });

  it("rejects INSERT hidden in block comment prefix", () => {
    // The first significant token is read from the stripped+string-stripped
    // input. Block comments are stripped first, so "INSERT /* ... */ INTO"
    // should still be caught.
    // Actual behaviour: "INSERT" is the first token after block comment
    // stripping → rejected. This tests the defence-in-depth property.
    expect(isValid("INSERT /* comment */ INTO users VALUES (1)")).toBe(false);
  });

  it("rejects comment-only input", () => {
    expect(isValid("-- just a comment")).toBe(false);
    expect(isValid("/* block comment */")).toBe(false);
  });
});

// ─── String literal stripping ──────────────────────────────────────────────────

describe("validateReadOnlySql — string literal stripping", () => {
  it("accepts SELECT with string literal containing keyword", () => {
    // Keywords inside single-quoted strings should be stripped and not
    // cause false positives.
    expect(isValid("SELECT 'INSERT' FROM users")).toBe(true);
  });

  it("accepts SELECT with double-quoted identifier containing keyword", () => {
    expect(isValid('SELECT "DROP" FROM users')).toBe(true);
  });

  it("rejects keyword that appears after string literal end", () => {
    expect(isValid("SELECT 'x' FROM users; DROP TABLE users")).toBe(false);
  });
});

// ─── Multi-statement rejection ─────────────────────────────────────────────────

describe("validateReadOnlySql — multi-statement rejection", () => {
  it("rejects two SELECTs with semicolon", () => {
    expect(isValid("SELECT 1; SELECT 2")).toBe(false);
  });

  it("rejects SELECT then DROP with semicolon", () => {
    expect(isValid("SELECT * FROM users; DROP TABLE users")).toBe(false);
  });

  it("rejects SELECT with trailing semicolon (allowed)", () => {
    expect(isValid("SELECT * FROM users;")).toBe(true);
  });

  it("rejects SELECT with semicolon and trailing whitespace (allowed)", () => {
    expect(isValid("SELECT * FROM users;   ")).toBe(true);
  });

  it("rejects SELECT with semicolon and extra statement after", () => {
    expect(isValid("SELECT * FROM users; SELECT 2")).toBe(false);
  });

  it("rejects multiple semicolons", () => {
    expect(isValid("SELECT 1;; SELECT 2")).toBe(false);
  });
});

// ─── Empty / whitespace input ─────────────────────────────────────────────────

describe("validateReadOnlySql — empty and whitespace input", () => {
  it("rejects empty string", () => {
    expect(isValid("")).toBe(false);
  });

  it("rejects whitespace-only string", () => {
    expect(isValid("   ")).toBe(false);
    expect(isValid("\t\n")).toBe(false);
  });

  it("rejects newlines only", () => {
    expect(isValid("\n\n")).toBe(false);
  });
});

// ─── Result shape ─────────────────────────────────────────────────────────────

describe("validateReadOnlySql — result shape", () => {
  it("returns {readonly: true} for valid SQL", () => {
    const result = validateReadOnlySql("SELECT * FROM users");
    expect(result.readonly).toBe(true);
  });

  it("returns {readonly: false, reason: string} for invalid SQL", () => {
    const result = validateReadOnlySql("DROP TABLE users");
    expect(result.readonly).toBe(false);
    expect(typeof (result as { reason: string }).reason).toBe("string");
    expect((result as { reason: string }).reason.length).toBeGreaterThan(0);
  });

  it("returns a non-empty reason for forbidden keyword", () => {
    const result = validateReadOnlySql("INSERT INTO users VALUES (1)");
    expect(result.readonly).toBe(false);
    expect((result as { reason: string }).reason).toContain("INSERT");
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("validateReadOnlySql — edge cases", () => {
  it("handles SQL with leading whitespace", () => {
    expect(isValid("   SELECT * FROM users")).toBe(true);
  });

  it("handles SQL with leading parenthesis", () => {
    expect(isValid("(SELECT * FROM users)")).toBe(true);
  });

  it("handles long valid SQL without issues", () => {
    const longSql =
      "SELECT u.id, u.name, o.total, o.created_at " +
      "FROM users u " +
      "JOIN orders o ON u.id = o.user_id " +
      "WHERE u.active = 1 AND o.total > 100 " +
      "ORDER BY o.created_at DESC LIMIT 50";
    expect(isValid(longSql)).toBe(true);
  });

  it("handles unicode in SQL (emoji in string)", () => {
    expect(isValid("SELECT '🚀' FROM users")).toBe(true);
  });

  it("handles backslash in string literal", () => {
    expect(isValid("SELECT 'C:\\Users\\test' FROM users")).toBe(true);
  });

  it("handles escaped single quote in string", () => {
    expect(isValid("SELECT name FROM users WHERE name = 'O''Brien'")).toBe(
      true
    );
  });

  it("handles doubled single quotes (SQL standard escape)", () => {
    expect(isValid("SELECT 'it''s fine' FROM users")).toBe(true);
  });
});

// ─── Robust JSON + secret redaction helpers ───────────────────────────────────

describe("tryParseJsonLoose", () => {
  it("parses clean JSON", () => {
    expect(tryParseJsonLoose('{"ok":true}')).toEqual({ ok: true });
    expect(tryParseJsonLoose("[1,2]")).toEqual([1, 2]);
  });

  it("parses JSON after leading noise lines", () => {
    const noisy = 'Fetching queues…\n{\n  "queues": []\n}\n';
    expect(tryParseJsonLoose(noisy)).toEqual({ queues: [] });
  });

  it("returns null on empty or garbage", () => {
    expect(tryParseJsonLoose("")).toBeNull();
    expect(tryParseJsonLoose("not json at all")).toBeNull();
  });

  it("extracts balanced JSON embedded in trailing noise", () => {
    const mixed = 'prefix { "a": 1 } trailing text';
    expect(tryParseJsonLoose(mixed)).toEqual({ a: 1 });
  });

  it("extracts JSON array from mixed text", () => {
    expect(tryParseJsonLoose('noise [1, {"x": true}] more')).toEqual([
      1,
      { x: true },
    ]);
  });

  it("handles escaped quotes inside strings during extract", () => {
    const raw = 'log\n{"msg":"say \\"hi\\""}\n';
    expect(tryParseJsonLoose(raw)).toEqual({ msg: 'say "hi"' });
  });

  it("returns null when braces never close", () => {
    expect(tryParseJsonLoose("{ not closed")).toBeNull();
  });

  it("prefers earlier of object vs array start", () => {
    expect(tryParseJsonLoose('x [1] y {"a":2}')).toEqual([1]);
    expect(tryParseJsonLoose('x {"a":2} y [1]')).toEqual({ a: 2 });
  });
});

describe("sanitizeCliArgsForLog", () => {
  it("redacts values after set", () => {
    const sanitized = sanitizeCliArgsForLog([
      "config",
      "kv",
      "set",
      "OPENAI_API_KEY",
      "sk-live-super-secret",
    ]);
    expect(sanitized).toEqual([
      "config",
      "kv",
      "set",
      "OPENAI_API_KEY",
      "[redacted]",
    ]);
    expect(sanitized.join(" ")).not.toContain("sk-live");
  });

  it("redacts Bearer tokens in free-form args", () => {
    const sanitized = sanitizeCliArgsForLog([
      "deploy",
      "Authorization: Bearer abcdefghijklmnop",
    ]);
    expect(sanitized[1]).toContain("[redacted]");
    expect(sanitized.join(" ")).not.toContain("abcdefghijklmnop");
  });

  it("redacts put and login next-arg forms", () => {
    expect(sanitizeCliArgsForLog(["secrets", "put", "s3cr3t"])).toEqual([
      "secrets",
      "put",
      "[redacted]",
    ]);
    expect(sanitizeCliArgsForLog(["auth", "login", "tok-xyz"])).toEqual([
      "auth",
      "login",
      "[redacted]",
    ]);
  });

  it("redacts create-token value at i+2 when present", () => {
    expect(
      sanitizeCliArgsForLog(["auth", "create-token", "name", "raw-token"])
    ).toEqual(["auth", "create-token", "name", "[redacted]"]);
  });

  it("leaves set without value alone", () => {
    expect(sanitizeCliArgsForLog(["kv", "set", "KEY_ONLY"])).toEqual([
      "kv",
      "set",
      "KEY_ONLY",
    ]);
  });
});

// ─── Pure CLI stdout parsers ──────────────────────────────────────────────────

describe("parseDbQueryResult", () => {
  it("returns empty shape for blank/invalid input", () => {
    expect(parseDbQueryResult("")).toEqual({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    });
    expect(parseDbQueryResult("not json")).toEqual({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    });
    expect(parseDbQueryResult("[]")).toEqual({
      columns: [],
      rows: [],
      rowCount: 0,
      executionTimeMs: null,
      meta: null,
    });
  });

  it("parses wrangler envelope with rows and duration", () => {
    const stdout = JSON.stringify([
      {
        results: [{ id: 1, name: "a" }, { id: 2, name: "b" }, null, [1]],
        success: true,
        meta: { duration: 0.125, rows_read: 2 },
      },
    ]);
    const result = parseDbQueryResult(stdout);
    expect(result.columns).toEqual(["id", "name"]);
    expect(result.rowCount).toBe(2);
    expect(result.rows).toEqual([
      { id: 1, name: "a" },
      { id: 2, name: "b" },
    ]);
    expect(result.executionTimeMs).toBe(125);
    expect(result.meta).toEqual({ duration: 0.125, rows_read: 2 });
  });

  it("handles missing results and non-object envelope", () => {
    expect(
      parseDbQueryResult(JSON.stringify([{ success: true }]))
    ).toMatchObject({ rows: [], columns: [] });
    expect(parseDbQueryResult(JSON.stringify([null]))).toMatchObject({
      rows: [],
    });
    expect(parseDbQueryResult(JSON.stringify(["x"]))).toMatchObject({
      rows: [],
    });
  });

  it("nulls absurd durations over 24h", () => {
    const stdout = JSON.stringify([
      {
        results: [{ x: 1 }],
        meta: { duration: 100_000 }, // seconds → 100M ms
      },
    ]);
    expect(parseDbQueryResult(stdout).executionTimeMs).toBeNull();
  });
});

describe("deriveQueueDepthStatus", () => {
  it("maps thresholds and paused flag", () => {
    expect(deriveQueueDepthStatus(0, true)).toBe("paused");
    expect(deriveQueueDepthStatus(50, false)).toBe("healthy");
    expect(deriveQueueDepthStatus(100, false)).toBe("backlogged");
    expect(deriveQueueDepthStatus(500, false)).toBe("backlogged");
    expect(deriveQueueDepthStatus(501, false)).toBe("critical");
  });
});

describe("parseQueueDepths", () => {
  it("returns empty for blank/invalid", () => {
    expect(parseQueueDepths("")).toEqual([]);
    expect(parseQueueDepths("{}")).toEqual([]);
    expect(parseQueueDepths('{"queues":"nope"}')).toEqual([]);
  });

  it("normalizes queue records with heuristic depth", () => {
    const stdout = JSON.stringify({
      queues: [
        {
          queue_name: "trades",
          producers_total_count: 2,
          consumers_total_count: 1,
          settings: { delivery_paused: false },
        },
        {
          queue_id: "fallback-id",
          producers_total_count: 0,
          settings: { delivery_paused: true },
        },
        null,
        { queue_name: "" },
        { producers_total_count: 1 },
      ],
    });
    const depths = parseQueueDepths(stdout);
    expect(depths).toHaveLength(2);
    expect(depths[0]).toMatchObject({
      queueName: "trades",
      depth: 200,
      producers: 2,
      consumers: 1,
      paused: false,
      status: "backlogged",
    });
    expect(depths[1]).toMatchObject({
      queueName: "fallback-id",
      depth: 1000,
      paused: true,
      status: "paused",
    });
    expect(typeof depths[0]!.timestamp).toBe("string");
  });
});

describe("inferSecretType", () => {
  it("infers from naming conventions", () => {
    expect(inferSecretType("OPENAI_API_KEY")).toBe("api_key");
    expect(inferSecretType("access_token")).toBe("token");
    expect(inferSecretType("db_password")).toBe("password");
    expect(inferSecretType("DB_PASSWD")).toBe("password");
    expect(inferSecretType("client_secret")).toBe("secret");
    expect(inferSecretType("RANDOM_THING")).toBe("unknown");
  });
});

describe("parseSecretsList", () => {
  it("returns empty for blank/null JSON", () => {
    expect(parseSecretsList("")).toEqual([]);
    expect(parseSecretsList("not json")).toEqual([]);
  });

  it("parses single-worker envelope", () => {
    const out = parseSecretsList(
      JSON.stringify({
        worker: "trade-worker",
        secrets: ["API_KEY", "auth_token", 42, null],
      })
    );
    expect(out).toEqual([
      {
        name: "API_KEY",
        worker: "trade-worker",
        type: "api_key",
        source: "config",
      },
      {
        name: "auth_token",
        worker: "trade-worker",
        type: "token",
        source: "config",
      },
    ]);
  });

  it("returns empty when single-worker secrets is not an array", () => {
    expect(
      parseSecretsList(JSON.stringify({ worker: "w", secrets: "nope" }))
    ).toEqual([]);
  });

  it("parses all-workers envelope", () => {
    const out = parseSecretsList(
      JSON.stringify({
        a: ["KEY_A"],
        b: ["PASSWORD_B", 1],
        c: "skip",
      })
    );
    expect(out.map((s) => s.name)).toEqual(["KEY_A", "PASSWORD_B"]);
    expect(out[1]!.type).toBe("password");
  });

  it("returns empty for array root", () => {
    expect(parseSecretsList("[1,2]")).toEqual([]);
  });
});

describe("parseKvManifest + parseKvList", () => {
  it("parseKvManifest builds typed map", () => {
    const map = parseKvManifest(
      JSON.stringify({
        namespace: "CONFIG_KV",
        keys: [
          { key: "FLAG", type: "boolean", secret: false },
          { key: "COUNT", type: "number", secret: false },
          { key: "TOKEN", type: "string", secret: true },
          { key: "ODD", type: "weird", secret: false },
          { key: "", type: "string" },
          null,
          { type: "string" },
        ],
      })
    );
    expect(map.get("FLAG")).toEqual({ type: "boolean", secret: false });
    expect(map.get("COUNT")).toEqual({ type: "number", secret: false });
    expect(map.get("TOKEN")).toEqual({ type: "string", secret: true });
    expect(map.get("ODD")).toEqual({ type: "string", secret: false });
    expect(map.has("")).toBe(false);
  });

  it("parseKvManifest returns empty on garbage", () => {
    expect(parseKvManifest("")).toEqual(new Map());
    expect(parseKvManifest("not json")).toEqual(new Map());
    expect(parseKvManifest("{}")).toEqual(new Map());
  });

  it("parseKvList merges array form with manifest", () => {
    const manifest = new Map([
      ["SECRET_KEY", { type: "string" as const, secret: true }],
      ["PLAIN", { type: "number" as const, secret: false }],
    ]);
    const keys = parseKvList(
      JSON.stringify([
        {
          name: "SECRET_KEY",
          metadata: { value_size: 12, last_modified: "2026-01-01" },
        },
        { name: "PLAIN" },
        { name: "UNKNOWN" },
        null,
        { name: "" },
        {},
      ]),
      manifest
    );
    expect(keys).toEqual([
      {
        name: "SECRET_KEY",
        valueSize: 12,
        lastModified: "2026-01-01",
        isSecret: true,
        manifestType: "string",
      },
      {
        name: "PLAIN",
        valueSize: null,
        lastModified: null,
        isSecret: false,
        manifestType: "number",
      },
      {
        name: "UNKNOWN",
        valueSize: null,
        lastModified: null,
        isSecret: false,
        manifestType: null,
      },
    ]);
  });

  it("parseKvList accepts keys envelope form", () => {
    const keys = parseKvList(
      JSON.stringify({ keys: [{ name: "A" }] }),
      new Map()
    );
    expect(keys).toHaveLength(1);
    expect(keys[0]!.name).toBe("A");
  });

  it("parseKvList returns empty for bad shapes", () => {
    expect(parseKvList("", new Map())).toEqual([]);
    expect(parseKvList("nope", new Map())).toEqual([]);
    expect(parseKvList('{"other":[]}', new Map())).toEqual([]);
  });
});

describe("stripAnsi + parseKillSwitchStatus", () => {
  it("strips ANSI color codes", () => {
    expect(stripAnsi("\x1b[31mred\x1b[0m")).toBe("red");
  });

  it("engage/release ignore stdout text", () => {
    expect(parseKillSwitchStatus("engage", "whatever").engaged).toBe(true);
    expect(parseKillSwitchStatus("release", "whatever").engaged).toBe(false);
  });

  it("show detects on/halted and off/active phrasing", () => {
    expect(
      parseKillSwitchStatus("show", "Kill switch is ON — trading halted")
        .engaged
    ).toBe(true);
    expect(
      parseKillSwitchStatus("show", "Kill switch is off — system active")
        .engaged
    ).toBe(false);
  });

  it("show falls back to value: marker", () => {
    const on = parseKillSwitchStatus("show", "status value: true");
    expect(on.engaged).toBe(true);
    expect(on.rawValue).toBe("true");
    const off = parseKillSwitchStatus("show", "status value: false");
    expect(off.engaged).toBe(false);
  });

  it("show unknown output is fail-open released", () => {
    const unknown = parseKillSwitchStatus("show", "???");
    expect(unknown.engaged).toBe(false);
    expect(unknown.rawValue).toBeNull();
  });
});

describe("parseAgentHealth + parsePyneHealth", () => {
  it("parseAgentHealth skips bad providers", () => {
    expect(parseAgentHealth("")).toMatchObject({ providers: [] });
    expect(parseAgentHealth("nope")).toMatchObject({ providers: [] });
    const result = parseAgentHealth(
      JSON.stringify({
        providers: [
          {
            name: "openai",
            model: "gpt-4o",
            status: "online",
            latencyMs: 40,
            dailyRequests: 10,
          },
          { name: "bad", status: "weird", latencyMs: -1 },
          null,
          { model: "no-name" },
        ],
      })
    );
    expect(result.providers).toHaveLength(2);
    expect(result.providers[0]).toMatchObject({
      name: "openai",
      status: "online",
      latencyMs: 40,
      dailyRequests: 10,
    });
    expect(result.providers[1]).toMatchObject({
      name: "bad",
      status: "offline",
      latencyMs: null,
      model: "unknown",
    });
  });

  it("parsePyneHealth handles empty/invalid/valid", () => {
    expect(parsePyneHealth("").status).toBe("down");
    expect(parsePyneHealth("[]").status).toBe("down");
    const ok = parsePyneHealth(
      JSON.stringify({
        worker: "pyne-worker",
        url: "http://localhost:8787",
        status: "healthy",
        httpStatus: 200,
        latencyMs: 12,
      })
    );
    expect(ok).toMatchObject({
      status: "healthy",
      httpStatus: 200,
      latencyMs: 12,
      url: "http://localhost:8787",
    });
    expect(parsePyneHealth(JSON.stringify({ status: "nope" })).status).toBe(
      "down"
    );
  });
});

describe("extractNamespaceId", () => {
  it("returns null until CLI exposes namespace id", () => {
    expect(extractNamespaceId('{"namespace":"CONFIG_KV"}')).toBeNull();
  });
});

// ─── agentChatStream (standalone SSE) ─────────────────────────────────────────

describe("AI_MODEL_OPTIONS", () => {
  it("includes workers-ai and external providers", () => {
    expect(AI_MODEL_OPTIONS.length).toBeGreaterThanOrEqual(3);
    expect(AI_MODEL_OPTIONS.some((m) => m.id === "workers-ai")).toBe(true);
    expect(AI_MODEL_OPTIONS.every((m) => m.id && m.label && m.provider)).toBe(
      true
    );
  });
});

describe("agentChatStream", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function sseBody(chunks: string[]): ReadableStream<Uint8Array> {
    const encoder = new TextEncoder();
    let i = 0;
    return new ReadableStream({
      pull(controller) {
        if (i >= chunks.length) {
          controller.close();
          return;
        }
        controller.enqueue(encoder.encode(chunks[i]!));
        i++;
      },
    });
  }

  it("streams tokens and completes on [DONE]", async () => {
    const tokens: string[] = [];
    const statuses: string[] = [];
    globalThis.fetch = (async () =>
      new Response(
        sseBody([
          'data: {"content":"Hello"}\n',
          'data: {"content":" world"}\n',
          "data: [DONE]\n",
        ]),
        {
          status: 200,
          headers: { "Content-Type": "text/event-stream" },
        }
      )) as unknown as typeof fetch;

    const { finished } = agentChatStream(
      {
        messages: [{ role: "user", content: "hi", timestamp: "t1" }],
        model: "workers-ai",
      },
      "http://localhost:8787/",
      "tok",
      (t) => tokens.push(t),
      (s) => statuses.push(s)
    );
    await finished;
    expect(tokens.join("")).toBe("Hello world");
    expect(statuses).toContain("connected");
  });

  it("skips malformed SSE data lines", async () => {
    const tokens: string[] = [];
    globalThis.fetch = (async () =>
      new Response(
        sseBody([
          "data: not-json\n",
          'data: {"content":"ok"}\n',
          "data: [DONE]\n",
        ]),
        { status: 200 }
      )) as unknown as typeof fetch;

    const { finished } = agentChatStream(
      {
        messages: [{ role: "user", content: "x", timestamp: "t1" }],
        model: "openai:gpt-4o-mini",
        temperature: 0.2,
        maxTokens: 10,
      },
      "http://api.test",
      "",
      (t) => tokens.push(t)
    );
    await finished;
    expect(tokens).toEqual(["ok"]);
  });

  it("reconnects on HTTP failure then disconnects", async () => {
    let calls = 0;
    const statuses: string[] = [];
    globalThis.fetch = (async () => {
      calls++;
      return new Response("fail", { status: 503 });
    }) as unknown as typeof fetch;

    const { finished } = agentChatStream(
      { messages: [{ role: "user", content: "x", timestamp: "t1" }] },
      "http://localhost:9",
      "t",
      undefined,
      (s) => statuses.push(s)
    );
    await finished;
    expect(calls).toBeGreaterThanOrEqual(2);
    expect(statuses).toContain("reconnecting");
    expect(statuses).toContain("disconnected");
  }, 30_000);

  it("aborts while fetch is pending", async () => {
    globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const signal = init?.signal;
        if (signal?.aborted) {
          reject(new DOMException("Aborted", "AbortError"));
          return;
        }
        signal?.addEventListener(
          "abort",
          () => reject(new DOMException("Aborted", "AbortError")),
          { once: true }
        );
      })) as unknown as typeof fetch;

    const { abort, finished } = agentChatStream(
      { messages: [{ role: "user", content: "x", timestamp: "t1" }] },
      "http://localhost:9",
      "t"
    );
    // Abort on next microtask so fetch has registered the listener
    await Promise.resolve();
    abort.abort();
    await finished;
    expect(abort.signal.aborted).toBe(true);
  });
});

// ─── CliBridge methods with stubbed exec (real class) ─────────────────────────

function okExec(stdout: string, data: unknown = null): CliResult<unknown> {
  return {
    success: true,
    exitCode: 0,
    stdout,
    stderr: "",
    data,
    duration: 1,
    command: "hoox test",
    errorType: null,
  };
}

function failExec(stderr = "fail"): CliResult<unknown> {
  return {
    success: false,
    exitCode: 1,
    stdout: "",
    stderr,
    data: null,
    duration: 1,
    command: "hoox test",
    errorType: "non-zero-exit",
  };
}

describe("CliBridge methods (exec stubbed)", () => {
  const bridge = realCliBridge!;
  let originalExec: typeof bridge.exec;

  beforeEach(() => {
    expect(bridge).toBeTruthy();
    originalExec = bridge.exec.bind(bridge);
  });

  afterEach(() => {
    bridge.exec = originalExec;
  });

  it("dbQuery rejects non-readonly SQL without spawning", async () => {
    const calls: unknown[] = [];
    bridge.exec = (async (...a: unknown[]) => {
      calls.push(a);
      return okExec("[]");
    }) as typeof bridge.exec;

    const result = (await bridge.dbQuery("DROP TABLE x")) as CliResult<null>;
    expect(result.success).toBe(false);
    expect(result.stderr).toContain("Read-only validation failed");
    expect(calls).toHaveLength(0);
  });

  it("dbQuery parses success stdout", async () => {
    bridge.exec = (async () =>
      okExec(
        JSON.stringify([{ results: [{ id: 1 }], meta: { duration: 0.01 } }])
      )) as typeof bridge.exec;
    const result = (await bridge.dbQuery("SELECT 1")) as CliResult<{
      rowCount: number;
    }>;
    expect(result.success).toBe(true);
    expect(result.data?.rowCount).toBe(1);
  });

  it("monitorQueueDepth / monitorKillSwitch parse stdout", async () => {
    bridge.exec = (async () =>
      okExec(
        JSON.stringify({
          queues: [
            {
              queue_name: "q1",
              producers_total_count: 1,
              consumers_total_count: 0,
              settings: { delivery_paused: false },
            },
          ],
        })
      )) as typeof bridge.exec;
    const qd = (await bridge.monitorQueueDepth()) as CliResult<unknown[]>;
    expect(qd.success).toBe(true);
    expect(Array.isArray(qd.data)).toBe(true);
    expect((qd.data as unknown[]).length).toBe(1);

    bridge.exec = (async () =>
      okExec("Kill switch is ON — trading halted")) as typeof bridge.exec;
    const ks = (await bridge.monitorKillSwitch("show")) as CliResult<{
      engaged: boolean;
    }>;
    expect(ks.data?.engaged).toBe(true);

    bridge.exec = (async () => failExec()) as typeof bridge.exec;
    expect(
      ((await bridge.monitorKillSwitch("engage")) as CliResult<null>).data
    ).toBeNull();
    expect(
      ((await bridge.monitorQueueDepth()) as CliResult<null>).data
    ).toBeNull();
  });

  it("configKvList merges list + manifest", async () => {
    bridge.exec = (async (args: unknown) => {
      const a = args as string[];
      if (a.includes("manifest")) {
        return okExec(
          JSON.stringify({
            keys: [{ key: "FLAG", type: "boolean", secret: false }],
          })
        );
      }
      return okExec(JSON.stringify([{ name: "FLAG" }, { name: "OTHER" }]));
    }) as typeof bridge.exec;

    const result = (await bridge.configKvList()) as CliResult<{
      keys: { name: string }[];
    }>;
    expect(result.success).toBe(true);
    expect(result.data?.keys.map((k) => k.name)).toEqual(["FLAG", "OTHER"]);
  });

  it("configKvList surfaces list failure", async () => {
    bridge.exec = (async (args: unknown) => {
      const a = args as string[];
      if (a.includes("list") && !a.includes("manifest")) {
        return failExec("list boom");
      }
      return okExec("{}");
    }) as typeof bridge.exec;
    const result = (await bridge.configKvList()) as CliResult<null>;
    expect(result.success).toBe(false);
    expect(result.data).toBeNull();
  });

  it("configKvGet treats not found as success null", async () => {
    bridge.exec = (async () =>
      failExec(
        'Key "missing" not found in KV namespace'
      )) as typeof bridge.exec;
    const result = (await bridge.configKvGet("missing")) as CliResult<
      string | null
    >;
    expect(result.success).toBe(true);
    expect(result.data).toBeNull();
  });

  it("configKvGet returns trimmed value", async () => {
    bridge.exec = (async () =>
      okExec(
        JSON.stringify({ key: "k", value: "hello" })
      )) as typeof bridge.exec;
    const result = (await bridge.configKvGet("k")) as CliResult<string | null>;
    expect(result.data).toBe("hello");
  });

  it("configSecretsList / agentHealth / pyneHealth parse or null", async () => {
    bridge.exec = (async () =>
      okExec(
        JSON.stringify({ worker: "w", secrets: ["API_KEY"] })
      )) as typeof bridge.exec;
    const secrets = (await bridge.configSecretsList()) as CliResult<{
      secrets: { name: string }[];
    }>;
    expect(secrets.data?.secrets[0]?.name).toBe("API_KEY");

    bridge.exec = (async () =>
      okExec(
        JSON.stringify({
          providers: [
            {
              name: "openai",
              model: "gpt",
              status: "online",
              latencyMs: 1,
              dailyRequests: 0,
            },
          ],
        })
      )) as typeof bridge.exec;
    const health = (await bridge.agentHealthCheck()) as CliResult<{
      providers: unknown[];
    }>;
    expect(health.data?.providers).toHaveLength(1);

    bridge.exec = (async () =>
      okExec(
        JSON.stringify({
          worker: "pyne-worker",
          url: "http://x",
          status: "healthy",
          httpStatus: 200,
          latencyMs: 3,
        })
      )) as typeof bridge.exec;
    const pyne = (await bridge.pyneHealthCheck()) as CliResult<{
      status: string;
    }>;
    expect(pyne.data?.status).toBe("healthy");

    bridge.exec = (async () => failExec()) as typeof bridge.exec;
    expect(
      ((await bridge.configSecretsList()) as CliResult<null>).data
    ).toBeNull();
    expect(
      ((await bridge.agentHealthCheck()) as CliResult<null>).data
    ).toBeNull();
  });

  it("thin wrappers forward tags via exec args", async () => {
    const seen: string[][] = [];
    bridge.exec = (async (args: unknown) => {
      seen.push(args as string[]);
      return okExec("{}");
    }) as typeof bridge.exec;

    await bridge.deployAll();
    await bridge.deployWorker("trade-worker");
    await bridge.checkHealth();
    await bridge.checkHealthFix();
    await bridge.checkFix();
    await bridge.workerLogs("hoox");
    await bridge.configShow();
    await bridge.configValidate();
    await bridge.monitorStatus();
    await bridge.rebuild();
    await bridge.repairWorker("d1-worker");
    await bridge.checkSetup();
    await bridge.configKvSet("k", "v");

    expect(seen.some((a) => a[0] === "deploy" && a[1] === "all")).toBe(true);
    expect(seen.some((a) => a[0] === "deploy" && a[2] === "trade-worker")).toBe(
      true
    );
    expect(seen.some((a) => a[0] === "check" && a[1] === "health")).toBe(true);
    expect(seen.some((a) => a.includes("--fix"))).toBe(true);
    expect(seen.some((a) => a[0] === "check" && a[1] === "fix")).toBe(true);
    expect(seen.some((a) => a[0] === "logs")).toBe(true);
    expect(seen.some((a) => a[0] === "config" && a[1] === "show")).toBe(true);
    expect(seen.some((a) => a.includes("validate"))).toBe(true);
    expect(seen.some((a) => a[0] === "repair")).toBe(true);
    expect(seen.some((a) => a[0] === "check" && a[1] === "setup")).toBe(true);
    expect(
      seen.some((a) => a[0] === "config" && a[1] === "kv" && a[2] === "set")
    ).toBe(true);
  });

  it("onError sink receives validation failures; sink throw is swallowed", async () => {
    const events: unknown[] = [];
    const unsub = bridge.onError((d) => {
      events.push(d);
      throw new Error("sink boom");
    });
    // dbQuery validation path calls notifyError without going through exec
    await bridge.dbQuery("DELETE FROM users");
    expect(events.length).toBe(1);
    unsub();

    // After unsubscribe, further failures should not append
    const before = events.length;
    await bridge.dbQuery("DROP TABLE x");
    expect(events.length).toBe(before);
  });

  it("invalidateCache clears binary path cache", () => {
    bridge.invalidateCache();
    // no throw
    expect(typeof bridge.resolveBinary).toBe("function");
  });

  it("abort and dispose are safe with no active commands", () => {
    bridge.abort("missing-tag");
    bridge.dispose();
  });
});
