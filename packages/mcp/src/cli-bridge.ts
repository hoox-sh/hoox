/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Suggestion } from "./types.ts";

/**
 * Specifiers stay in variables so `tsc` does not pull the CLI (and shared)
 * into this package. Bun resolves them at runtime against the working tree,
 * which is what keeps the catalog in lockstep with `packages/cli`.
 */
const COMPLETION_SPEC = "../../cli/src/utils/completion.ts";
const CLI_SPEC = "../../cli/src/index.ts";
const ENV_SERVICE_SPEC = "../../cli/src/services/env/env-service.ts";

type CompletionModule = {
  suggestNextCommand: (commandPath: string) => Suggestion | undefined;
};

let completion: Promise<CompletionModule> | null = null;

function loadCompletion(): Promise<CompletionModule> {
  if (!completion) {
    completion = import(COMPLETION_SPEC) as Promise<CompletionModule>;
  }
  return completion;
}

/** CLI next-step map. `null` when the path has no suggestion. */
export async function suggestNextCommand(
  commandPath: string
): Promise<Suggestion | null> {
  const mod = await loadCompletion();
  return mod.suggestNextCommand(commandPath) ?? null;
}

/** The live Commander program. Callers cast it to the walker surface. */
export async function importCliProgram(): Promise<{ program: unknown }> {
  return (await import(CLI_SPEC)) as { program: unknown };
}

type EnvDefinition = {
  name: string;
  secret: boolean;
};

type EnvServiceModule = {
  EnvService: {
    getDefinitions: () => EnvDefinition[];
  };
};

/** Env catalog. Same variable-specifier rule as the Commander import. */
export async function importEnvDefinitions(): Promise<EnvDefinition[]> {
  const mod = (await import(ENV_SERVICE_SPEC)) as EnvServiceModule;
  return mod.EnvService.getDefinitions();
}
