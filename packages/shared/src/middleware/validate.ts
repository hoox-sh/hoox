/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Validation middleware for Cloudflare Workers
 * Uses Zod for runtime schema validation.
 *
 * @available — Available for consumer use. Import from "@hoox-sh/hoox-shared/middleware".
 */

import { z } from "zod";
import type { Result } from "../types";

/** Default body size cap for JSON request parsing (1 MiB). */
export const DEFAULT_MAX_JSON_BODY_BYTES = 1_048_576;

export interface ParseJsonBodyOptions {
  /** Reject bodies larger than this many bytes (Content-Length or measured). */
  maxBytes?: number;
}

/**
 * Validate unknown data against a Zod schema, returning a Result type.
 * Provides structured error messages from Zod issue paths.
 */
export function validateJson<T extends z.ZodTypeAny>(
  schema: T,
  data: unknown
): Result<z.infer<T>> {
  const result = schema.safeParse(data);
  if (!result.success) {
    return {
      ok: false as const,
      error: result.error.issues
        .map((i) => `${i.path.join(".")}: ${i.message}`)
        .join("; "),
    };
  }
  return { ok: true as const, value: result.data };
}

/**
 * Parse a Request body as JSON and validate against a Zod schema.
 * Enforces an optional max body size to stay within Workers memory limits.
 *
 * @example
 * const parsed = await parseJsonBody(request, WebhookPayloadSchema);
 * if (!parsed.ok) return Errors.badRequest(parsed.error);
 * const payload = parsed.value;
 */
export async function parseJsonBody<T extends z.ZodTypeAny>(
  request: Request,
  schema: T,
  options: ParseJsonBodyOptions = {}
): Promise<Result<z.infer<T>>> {
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_JSON_BODY_BYTES;

  const contentLength = request.headers.get("content-length");
  if (contentLength !== null) {
    const declared = Number(contentLength);
    if (Number.isFinite(declared) && declared > maxBytes) {
      return {
        ok: false as const,
        error: `Request body too large (max ${maxBytes} bytes)`,
      };
    }
  }

  let text: string;
  try {
    text = await request.text();
  } catch {
    return { ok: false as const, error: "Failed to read request body" };
  }

  // TextEncoder length approximates UTF-8 byte size for enforcement.
  const byteLength = new TextEncoder().encode(text).byteLength;
  if (byteLength > maxBytes) {
    return {
      ok: false as const,
      error: `Request body too large (max ${maxBytes} bytes)`,
    };
  }

  let data: unknown;
  try {
    data = text.length === 0 ? null : JSON.parse(text);
  } catch {
    return { ok: false as const, error: "Invalid JSON in request body" };
  }

  return validateJson(schema, data);
}

/**
 * Legacy signature: parse request body as JSON object.
 * Kept for backward compatibility with existing workers.
 */
export async function validateJsonLegacy(
  request: Request
): Promise<Result<Record<string, unknown>>> {
  try {
    const body = await request.json();
    if (typeof body !== "object" || body === null || Array.isArray(body)) {
      return { ok: false, error: "Request body must be a JSON object" };
    }
    return { ok: true, value: body as Record<string, unknown> };
  } catch {
    return { ok: false, error: "Invalid JSON in request body" };
  }
}

/** Require `field` on a parsed JSON body; fail with a missing-field error. */
export function requireField<T>(
  body: Record<string, unknown>,
  field: string
): Result<T> {
  if (!(field in body)) {
    return { ok: false, error: `Missing required field: ${field}` };
  }
  return { ok: true, value: body[field] as T };
}

/** Read `field` from a parsed JSON body, or `defaultValue` when absent. */
export function optionalField<T>(
  body: Record<string, unknown>,
  field: string,
  defaultValue: T
): T {
  if (!(field in body)) return defaultValue;
  return body[field] as T;
}
