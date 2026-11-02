/**
 * Copyright (c) 2026 HOOX · HOOX · jango-blockchained (hoox-sh)
 * SPDX-License-Identifier: Apache-2.0
 */

export {
  ensureWorkerInStack,
  requireCatalogWorker,
  loadWorkerOrWire,
  wireCallerBindings,
  cloneWorkerIfMissing,
  createWorkspaceConfigService,
} from "./stack-service.js";
export type {
  EnsureWorkerOptions,
  EnsureWorkerResult,
} from "./stack-service.js";
