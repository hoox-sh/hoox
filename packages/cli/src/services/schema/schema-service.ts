/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import {
  WORKER_MANIFESTS,
  WORKER_NAMES,
  validateWranglerJsonc,
  validateRootSecrets,
  validateDevVars,
  type WorkerManifest,
  type ValidationError,
} from "@hoox-sh/hoox-shared";

export interface SchemaCheckResult {
  worker: string;
  passed: boolean;
  errors: ValidationError[];
}

export class SchemaService {
  constructor(private projectRoot: string = process.cwd()) {}

  getWorkerNames(): string[] {
    return WORKER_NAMES;
  }

  getManifest(name: string): WorkerManifest | undefined {
    return WORKER_MANIFESTS[name];
  }

  validateWorker(name: string): SchemaCheckResult {
    const manifest = WORKER_MANIFESTS[name];
    if (!manifest) {
      return {
        worker: name,
        passed: false,
        errors: [
          {
            worker: name,
            severity: "error",
            message: `Unknown worker "${name}"`,
          },
        ],
      };
    }

    const rootWranglerPath = resolve(this.projectRoot, "wrangler.jsonc");
    const workerWranglerPath = resolve(
      this.projectRoot,
      manifest.path,
      "wrangler.jsonc"
    );
    const devVarsPath = resolve(this.projectRoot, manifest.path, ".dev.vars");
    const tier = manifest.tier ?? "core";

    if (tier === "planned") {
      return {
        worker: name,
        passed: true,
        errors: [
          {
            worker: name,
            severity: "warning",
            message: `Planned worker — not shippable yet${manifest.aliases?.length ? ` (formerly ${manifest.aliases.join(", ")})` : ""}`,
          },
        ],
      };
    }

    if (tier === "optional" && !existsSync(workerWranglerPath)) {
      return {
        worker: name,
        passed: true,
        errors: [
          {
            worker: name,
            severity: "warning",
            message: `Optional worker not cloned. Enable with: hoox workers enable ${name}`,
          },
        ],
      };
    }

    const errors: ValidationError[] = [];

    // Check if we're in a valid Hoox project directory
    // Look for Hoox-specific markers: workers/ directory or root wrangler.jsonc
    const isHooxProject =
      existsSync(resolve(this.projectRoot, "wrangler.jsonc")) ||
      existsSync(resolve(this.projectRoot, "workers"));

    // Read and validate per-worker wrangler.jsonc
    try {
      const wranglerContent = readFileSync(workerWranglerPath, "utf-8");
      errors.push(...validateWranglerJsonc(name, manifest, wranglerContent));
    } catch (e: unknown) {
      // Provide a more helpful error message if not in project directory
      const isErrnoException = e instanceof Error && "code" in e;
      const isEnoent =
        isErrnoException && (e as NodeJS.ErrnoException).code === "ENOENT";
      const errMessage = e instanceof Error ? e.message : String(e);
      const message =
        isEnoent && !isHooxProject
          ? `Cannot read ${workerWranglerPath}: File not found. Are you in the Hoox project root directory?`
          : `Cannot read ${workerWranglerPath}: ${errMessage}`;
      errors.push({
        worker: name,
        severity: isEnoent && tier === "optional" ? "warning" : "error",
        message:
          isEnoent && tier === "optional"
            ? `Optional worker not cloned. Enable with: hoox workers enable ${name}`
            : message,
      });
    }

    // Read and validate root wrangler.jsonc (if exists)
    try {
      const rootContent = readFileSync(rootWranglerPath, "utf-8");
      errors.push(...validateRootSecrets(name, manifest, rootContent));
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      errors.push({
        worker: name,
        severity: "warning",
        message: `Cannot read root wrangler.jsonc: ${errMessage}`,
      });
    }

    // Read and validate .dev.vars (if exists)
    try {
      const devVarsContent = readFileSync(devVarsPath, "utf-8");
      errors.push(...validateDevVars(name, manifest, devVarsContent));
    } catch (e: unknown) {
      const errMessage = e instanceof Error ? e.message : String(e);
      errors.push({
        worker: name,
        severity: "warning",
        message: `Cannot read ${devVarsPath}: ${errMessage}`,
      });
    }

    return {
      worker: name,
      passed: errors.filter((e) => e.severity === "error").length === 0,
      errors,
    };
  }

  validateAll(): SchemaCheckResult[] {
    return WORKER_NAMES.filter(
      (name) => (WORKER_MANIFESTS[name]?.tier ?? "core") !== "planned"
    ).map((name) => this.validateWorker(name));
  }
}
