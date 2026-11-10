---
okf_lock: human
type: Reference
title: Architecture
description: The project shape and the OpenOrchestrate team.
tags: [architecture, openorchestrate]
status: stable
---

# Architecture

hoox uses OpenOrchestrate. Languages: not detected.

## Runtime surfaces

An open-core, edge-native trading mesh on Cloudflare Workers. Signals from
webhooks, email, Telegram, and PYNE strategy events are validated, run through
risk policy, and routed to CEX REST and DEX spot hops from colocated isolates.

- **Entry points:** the Workers under `workers/` (eleven compute surfaces
  joined by Service Bindings), the `hoox` / `hx` CLI, and the TUI.
- **Run:** `bun run dev` for local development, `bun run tui` for the terminal
  client, `bun run build` to build the workspaces.
- **Verify:** `./scripts/verify.sh` runs Prettier, `bun run lint`,
  `bun run typecheck`, and `bun run test`.

## The team

| Seat        | Title               | Agent        |
| ----------- | ------------------- | ------------ |
| Chief       | Chief of Staff      | `oo-chief`   |
| Ops         | Head of Operations  | `oo-ops`     |
| Checker     | Quality Gate        | `oo-checker` |
| Docs        | Head of Docs        | `oo-spec-1`  |
| Engineering | Head of Engineering | `oo-spec-2`  |
| Misc        | General Desk        | `oo-misc`    |

## The board

The board lives at `.openorchestrate/board.md`. It has five statuses:
Todo, Working, Blocked, Ready for Review, Done. A card moves to Done only with proof.

## Related

- [Development](/development.md)
- [Security](/security.md)
