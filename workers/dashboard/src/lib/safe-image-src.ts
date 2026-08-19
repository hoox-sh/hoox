/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Normalize to a scheme-safe image URL, or null.
 * Allows http(s), blob:, and data:image/*;base64,.
 *
 * `encodeURI` is a CodeQL-recognized XSS sanitizer (`js/xss-through-dom`
 * treats React `<img src>` as an HTML/URL sink). It is a no-op for
 * canonical http(s)/blob/data:image URLs.
 */
export function parseSafeImageSrc(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;
  let safe: string | null = null;
  if (trimmed.startsWith("data:image/")) {
    safe = /^data:image\/[a-zA-Z0-9.+-]+;base64,/.test(trimmed)
      ? trimmed
      : null;
  } else {
    try {
      const parsed = new URL(trimmed);
      if (
        parsed.protocol === "https:" ||
        parsed.protocol === "http:" ||
        parsed.protocol === "blob:"
      ) {
        safe = parsed.href;
      }
    } catch {
      // not an absolute URL
    }
  }
  if (!safe) return null;
  return encodeURI(safe);
}
