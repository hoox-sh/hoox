/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { describe, it, expect } from "bun:test";
import { existsSync } from "node:fs";
import {
  resolveLauncherEntry,
  shouldLaunchStartScreen,
} from "./opentui-launch.js";
import { isRichMode } from "../utils/format-mode.js";

/** Temporarily override `isTTY` on stdin/stdout. */
function stubTty(value: boolean): () => void {
  const restores: Array<() => void> = [];
  for (const stream of [process.stdin, process.stdout]) {
    const target = stream as { isTTY?: boolean };
    const hadOwn = Object.prototype.hasOwnProperty.call(stream, "isTTY");
    const previous = target.isTTY;
    Object.defineProperty(stream, "isTTY", {
      value,
      configurable: true,
      writable: true,
    });
    restores.push(() => {
      if (hadOwn) {
        Object.defineProperty(stream, "isTTY", {
          value: previous,
          configurable: true,
          writable: true,
        });
      } else {
        Reflect.deleteProperty(stream, "isTTY");
      }
    });
  }
  return () => {
    for (const restore of restores.reverse()) restore();
  };
}

/** Run `fn` with the given environment values, restoring afterwards. */
function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => void
): void {
  const previous = new Map<string, string | undefined>();
  for (const [key, value] of Object.entries(vars)) {
    previous.set(key, process.env[key]);
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of previous) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe("resolveLauncherEntry", () => {
  it("finds the monorepo launcher entry", () => {
    const entry = resolveLauncherEntry();
    expect(entry).toBeTruthy();
    expect(existsSync(entry!)).toBe(true);
    expect(entry).toMatch(/launcher\.(tsx|js)$/);
  });
});

describe("shouldLaunchStartScreen", () => {
  it("is false when HOOX_NO_LAUNCHER=1", () => {
    const prev = process.env.HOOX_NO_LAUNCHER;
    process.env.HOOX_NO_LAUNCHER = "1";
    try {
      expect(shouldLaunchStartScreen()).toBe(false);
    } finally {
      if (prev === undefined) delete process.env.HOOX_NO_LAUNCHER;
      else process.env.HOOX_NO_LAUNCHER = prev;
    }
  });

  it("stays eligible with NO_COLOR in a TTY, while color output is still stripped", () => {
    const restoreTty = stubTty(true);
    try {
      withEnv(
        {
          NO_COLOR: "1",
          CI: undefined,
          TERM: "xterm-256color",
          HOOX_NO_LAUNCHER: undefined,
        },
        () => {
          // NO_COLOR governs color, not the launcher's existence.
          expect(shouldLaunchStartScreen()).toBe(true);
          // The color-stripping path is unchanged: NO_COLOR still disables
          // rich output even when stdout is a TTY.
          expect(isRichMode()).toBe(false);
        }
      );
    } finally {
      restoreTty();
    }
  });
});
