/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, it } from "bun:test";
import { formatEnvValue, parseEnvFile, serializeEnvLine } from "./env-file.js";

describe("env-file", () => {
  it("leaves safe values bare", () => {
    expect(formatEnvValue("abc123")).toBe("abc123");
    expect(formatEnvValue("a@b.com")).toBe("a@b.com");
    expect(serializeEnvLine("K", "v1")).toBe("K=v1");
  });

  it("quotes values with spaces, hashes, or quotes", () => {
    expect(formatEnvValue("hello world")).toBe('"hello world"');
    expect(formatEnvValue("abc#def")).toBe('"abc#def"');
    expect(formatEnvValue('say "hi"')).toBe('"say \\"hi\\""');
    expect(formatEnvValue("")).toBe('""');
  });

  it("round-trips tricky values exactly", () => {
    const values = [
      "plain",
      "with space",
      "hash#tag",
      'quote"inside',
      "back\\slash",
      "back\\n-not-newline",
      "line1\nline2",
      "tab\there",
      "dollar$var",
      "semi;colon",
      "trailing ",
      " unicode ✓ ",
    ];
    for (const v of values) {
      const line = serializeEnvLine("SECRET_KEY", v);
      expect(parseEnvFile(line + "\n").get("SECRET_KEY")).toBe(v);
    }
  });

  it("parses legacy bare files unchanged", () => {
    const map = parseEnvFile(
      "# comment\n\nA=1\nB=hello world\nEMPTY=\nNOEQUALS\n"
    );
    expect(map.get("A")).toBe("1");
    expect(map.get("B")).toBe("hello world");
    expect(map.get("EMPTY")).toBe("");
    expect(map.has("NOEQUALS")).toBe(false);
  });

  it("handles export prefix and single quotes", () => {
    const map = parseEnvFile("export A=1\nB='two words'\n");
    expect(map.get("A")).toBe("1");
    expect(map.get("B")).toBe("two words");
  });
});
