# Changelog

All notable changes to **HOOX** (`hoox-sh/hoox`) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`VERSION` is the single source of truth for the monorepo. `packages/cli` ships on
the `v*` tags; `packages/shared` ships on its own `shared-v*` tags because it is a
published dependency of the CLI and the TUI.

---

## [0.14.0] - 2026-10-13

Minor: DEX spot execution, opt-in tenant isolation across the mesh, and a first
pass at entitlement scopes.

### Added

- **DEX spot execution (P1)**: `trade-worker` routes DEX spot orders alongside CEX,
  and `web3-wallet-worker` signs Uniswap V3 (Ethereum/Arbitrum) and Jupiter Swap V2
  (Solana) transactions. Private keys and mnemonics stay in the Cloudflare® Secrets
  Store and never enter a Worker's public surface.
- **Gateway `/wallet` proxy**: `hoox-worker` proxies wallet traffic to
  `web3-wallet-worker` with idempotency and an explicit gas policy. Routing now
  resolves `/wallet` **before** the gateway catch-all (P0 fix — the catch-all was
  swallowing it).
- **CLI auto-provisioning for the DEX path**: `hoox onboard` now provisions the DEX
  mesh key, Solana seed, and RPC defaults, and seeds the dashboard settings
  prefixes so a fresh install wires the wallet isolate without hand-editing config.
- **Opt-in tenant isolation across the mesh**: `packages/shared` exports a
  `TenantEnv` / `TenantScope` helper and payload attribution. When enabled, the
  gateway forwards tenant context to `trade-worker` and `agent-worker`,
  `d1-worker` isolates rows by `tenant_id` (schema migration included), and
  `agent-worker` isolates routine keys. Off by default — existing single-tenant
  installs are unaffected.
- **Entitlement scopes**: `EntitlementScope` / `EntitledContext` types plus
  `hasScope()` and `verifyCacheKey()` in `packages/shared`, including the
  `axis:run` scope. **Types and bearer classification only — no enforcement yet**,
  so no existing request changes behaviour.
- **OKF bundle**: an Open Knowledge Format cache of the repo is compiled on every
  commit, with `hoox okf:query` / `okf:context` / `okf:lint` for agent context.

### Changed

- Dependency refresh: `wrangler` 4.145.0 across the mesh, plus the `trade-worker`
  DEX wiring fix that came with it.
- **The unit suite is green end to end**: 5,173 tests, exit 0
  (`test(all): make the full unit suite green`). Coverage for the CLI
  provisioner/secrets paths reached 100% lines.
- CI: Codecov uploads split per flag (the per-suite `lcov` files were being
  overwritten by Bun's `--coverage-dir` default), action bumped to v7, `@clack/prompts`
  pinned to 1.3.0, Bun pinned to 1.4.0, and `shared` dist is built before the
  workspace typecheck.
- Docs: real badges and stack cross-links in the README, a unified stack footer,
  and corrections to the mesh ports, email ingress, and DEX spot guides.
- CLI audit pass — update plan, worker validation, env quoting, parallel checks.

### Fixed

- `/wallet` is routed before the gateway catch-all (P0).
- `hoox-worker` P0/P1 audit fixes; `web3-wallet-worker` bumped accordingly.
- Entitlement hook note placement; `axis:run` scope added.
- README Bun badge and CLI table.

### Packages

| Package                | Version |
| ---------------------- | ------- |
| `@hoox-sh/hoox-cli`    | 0.14.0  |
| `@hoox-sh/hoox-tui`    | 0.3.2   |
| `@hoox-sh/hoox-shared` | 1.5.0   |

> **Risk note.** DEX signing is new surface on a mesh that previously held only
> CEX credentials. Review gas policy and idempotency before pointing it at funds,
> and keep `agent-worker` risk controls enabled.

---

## [0.13.1] - 2026-09-05

Previous release. See the [GitHub release history](https://github.com/hoox-sh/hoox/releases)
for the 0.13.x line.

[0.14.0]: https://github.com/hoox-sh/hoox/releases/tag/v0.14.0
