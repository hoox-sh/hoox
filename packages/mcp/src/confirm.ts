/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

const TTL_MS = 10 * 60 * 1000;

export interface ConfirmClaims {
  path: string;
  argv: string[];
  cwd: string;
  secretHash: string;
  exp: number;
}

export interface ConfirmCodec {
  issue(claims: Omit<ConfirmClaims, "exp">): {
    token: string;
    expiresAt: string;
  };
  verify(
    token: string,
    expected: Omit<ConfirmClaims, "exp">
  ): { ok: true } | { ok: false; message: string };
}

export function hashSecret(value: string | undefined): string {
  return createHash("sha256")
    .update(value ?? "", "utf8")
    .digest("hex");
}

export function createConfirmCodec(
  secret: string,
  now: () => number = Date.now
): ConfirmCodec {
  return {
    issue(claims) {
      const body: ConfirmClaims = {
        path: claims.path,
        argv: claims.argv,
        cwd: claims.cwd,
        secretHash: claims.secretHash,
        exp: now() + TTL_MS,
      };
      const payload = Buffer.from(JSON.stringify(body), "utf8").toString(
        "base64url"
      );
      const token = `v1.${payload}.${sign(secret, payload)}`;
      return { token, expiresAt: new Date(body.exp).toISOString() };
    },
    verify(token, expected) {
      const parts = token.split(".");
      if (parts.length !== 3 || parts[0] !== "v1" || !parts[1] || !parts[2]) {
        return { ok: false, message: "confirm token is malformed" };
      }
      const expectedSig = sign(secret, parts[1]);
      const a = Buffer.from(expectedSig);
      const b = Buffer.from(parts[2]);
      if (a.length !== b.length || !timingSafeEqual(a, b)) {
        return {
          ok: false,
          message: "confirm token signature does not match",
        };
      }
      let parsed: ConfirmClaims;
      try {
        parsed = JSON.parse(
          Buffer.from(parts[1], "base64url").toString("utf8")
        ) as ConfirmClaims;
      } catch {
        return { ok: false, message: "confirm token payload is not JSON" };
      }
      if (typeof parsed.exp !== "number" || parsed.exp < now()) {
        return { ok: false, message: "confirm token has expired" };
      }
      if (
        parsed.path !== expected.path ||
        parsed.cwd !== expected.cwd ||
        parsed.secretHash !== expected.secretHash ||
        JSON.stringify(parsed.argv) !== JSON.stringify(expected.argv)
      ) {
        return {
          ok: false,
          message: "confirm token does not match this command",
        };
      }
      return { ok: true };
    },
  };
}

let processCodecCache: ConfirmCodec | null = null;

/** One codec per process so a token from hoox_plan works on the command tool. */
export function processCodec(): ConfirmCodec {
  if (!processCodecCache) {
    const secret =
      process.env.HOOX_MCP_CONFIRM_SECRET ?? randomBytes(32).toString("hex");
    processCodecCache = createConfirmCodec(secret);
  }
  return processCodecCache;
}

function sign(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}
