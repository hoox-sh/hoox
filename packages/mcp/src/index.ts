/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

export { advise } from "./advise.ts";
export { findEntry, walkCatalog } from "./catalog.ts";
export {
  codeModeEnabled,
  createHandlers,
  registerCodeMode,
} from "./codemode/tools.ts";
export type { CodeModeOptions } from "./codemode/tools.ts";
export {
  buildBwrapPlan,
  buildSubprocessPlan,
  resolveSandboxKind,
  runInSandbox,
} from "./codemode/sandbox.ts";
export type {
  SandboxDeps,
  SandboxKind,
  SandboxPlan,
} from "./codemode/sandbox.ts";
export type {
  CodeModeHandlers,
  CodeModeLimits,
  SandboxRequest,
  SandboxResult,
} from "./codemode/protocol.ts";
export { searchEntries } from "./codemode/view.ts";
export type { SearchEntry } from "./codemode/view.ts";
export { describeCommand } from "./describe.ts";
export { loadHooxCatalog } from "./load-catalog.ts";
export { createHooxMcpServer } from "./server.ts";
export type { HooxServerOptions } from "./server.ts";
export { executeEntry } from "./runner.ts";
export { snapshot } from "./snapshot.ts";
export type { CatalogEntry, ToolPayload } from "./types.ts";
