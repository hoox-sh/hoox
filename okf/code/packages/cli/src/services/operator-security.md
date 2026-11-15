---
type: "Code Module"
title: "packages/cli/src/services/operator-security"
description: "Operator-plane security checks for hoox doctor --security and hoox tunnel check."
resource: "packages/cli/src/services/operator-security"
tags: [cli, code, packages, services]
status: stable
generated:
  by: process:axis-okf/1
  at: 2026-11-11T22:31:35Z
sources:
  - id: tree
    resource: "packages/cli/src/services/operator-security"
    title: "packages/cli/src/services/operator-security"
    author: process:git
okf_lock: generated
---

# Files

- `index.ts` — classifyOperatorProbeStatus, collectSecurityHygiene, detectCloudflared, formatProbeSecurityLines, probeOperatorManagement, securityChecksFailed
- `operator-security-service.test.ts`
- `operator-security-service.ts` — CloudflaredStatus, FetchLike, OperatorProbeResult, ProbeClassification, SecurityCheckLine, SecurityCheckSeverity, classifyOperatorProbeStatus, collectSecurityHygiene, detectCloudflared, formatProbeSecurityLines, probeOperatorManagement, securityChecksFailed

# Packages

`@hoox-sh/hoox-shared`, `bun:test`
