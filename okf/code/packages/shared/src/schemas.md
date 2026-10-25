---
type: "Code Module"
title: "packages/shared/src/schemas"
description: "Worker Manifest Schema — canonical definition of what each worker expects."
resource: "packages/shared/src/schemas"
tags: [code, packages, schemas, shared]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-10-25T16:53:44Z
sources:
  - id: tree
    resource: "packages/shared/src/schemas"
    title: "packages/shared/src/schemas"
    author: process:git
okf_lock: generated
---

# Files

* `index.ts` — CALLED_BY, D1BindingDef, DOBindingDef, InfraBindings, KVBindingDef, QueueBindingDef, R2BindingDef, ServiceBindingDef, ValidationError, ValidationReport, VarDef, VectorizeBindingDef
* `registry.ts` — CALLED_BY, WORKER_CATALOG, WORKER_MANIFESTS, WORKER_NAMES, WorkerCatalogEntry, getWorkerDefaultEnabled
* `types.ts` — D1BindingDef, DOBindingDef, InfraBindings, KVBindingDef, QueueBindingDef, R2BindingDef, ServiceBindingDef, ValidationError, ValidationReport, VarDef, VectorizeBindingDef, WorkerManifest
* `validators.ts` — generateDevVars, generateWranglerJsonc, validateAll, validateDevVars, validateRootSecrets, validateWranglerJsonc

# Packages

`jsonc-parser`

# Used by

* [scripts](/code/scripts.md)
