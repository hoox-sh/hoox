#!/usr/bin/env bun
/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

if (typeof globalThis.Bun === "undefined") {
  process.stderr.write(
    "Error: hoox-mcp requires Bun >= 1.2.\n  Install Bun: curl -fsSL https://bun.sh/install | bash\n"
  );
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));
const src = resolve(here, "..", "src", "main.ts");
const dist = resolve(here, "..", "dist", "main.js");
const entry = existsSync(src) ? src : dist;
if (!existsSync(entry)) {
  process.stderr.write(
    "Error: hoox-mcp entry not found. Run bun install from the Hoox repo.\n"
  );
  process.exit(1);
}
await import(entry);
