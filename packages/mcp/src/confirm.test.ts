/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, expect, test } from "bun:test";
import { createConfirmCodec, hashSecret } from "./confirm.ts";

const claims = {
  path: "secrets set",
  argv: ["secrets", "set", "trade-worker", "API", "--json", "--yes"],
  cwd: "/repo",
  secretHash: hashSecret("super-secret"),
};

describe("confirm tokens", () => {
  test("round-trips and rejects a changed argv or secret", () => {
    const codec = createConfirmCodec("test-secret", () => 1_000);
    const issued = codec.issue(claims);
    expect(codec.verify(issued.token, claims).ok).toBe(true);
    expect(
      codec.verify(issued.token, {
        ...claims,
        argv: [...claims.argv, "--env", "staging"],
      }).ok
    ).toBe(false);
    expect(
      codec.verify(issued.token, {
        ...claims,
        secretHash: hashSecret("other"),
      }).ok
    ).toBe(false);
  });

  test("expires", () => {
    let now = 0;
    const codec = createConfirmCodec("test-secret", () => now);
    const issued = codec.issue(claims);
    now = 10 * 60 * 1000 + 1;
    const result = codec.verify(issued.token, claims);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toContain("expired");
  });

  test("rejects a tampered payload", () => {
    const codec = createConfirmCodec("test-secret", () => 1_000);
    const issued = codec.issue(claims);
    const [version, payload, sig] = issued.token.split(".");
    const flipped = `${version}.${payload}x.${sig}`;
    expect(codec.verify(flipped, claims).ok).toBe(false);
  });
});
