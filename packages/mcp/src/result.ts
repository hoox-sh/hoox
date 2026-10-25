/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

export function jsonResult(value: unknown, isError = false) {
  const text = JSON.stringify(value, null, 2);
  const structured = JSON.parse(text) as Record<string, unknown>;
  return {
    content: [{ type: "text" as const, text }],
    structuredContent: structured,
    isError,
  };
}
