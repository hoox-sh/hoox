# Changelog

All notable changes to **HOOX** (`hoox-sh/hoox`) are documented here.

Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/); versions
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

`VERSION` is the single source of truth for the monorepo. `packages/cli` ships on
the `v*` tags; `packages/shared` ships on its own `shared-v*` tags because it is a
published dependency of the CLI and the TUI.

---

## [Unreleased]

## [0.16.0] - 2026-10-25

Minor: package audit of `shared`, `cli`, and `tui` — correctness, fail-closed setup, JSON-safe CLI output, and TUI Settings that actually drive the shell.

### Added

- Shared **`VIEW_IDS`** tuple is the single source for TUI view identifiers. Session restore, Settings, and the TUI registry consume it.
- Session restore returns **`fromDisk`**. A missing file opens Settings `defaultView` instead of always dashboard.
- CLI **`createCliSpinner`**: `--json` / `--quiet` never mix clack ANSI with machine stdout. Human non-TTY still prints `stop()` lines.

### Changed

- **Wrangler 4.152.0** across the monorepo and worker submodules (`workerd` 1.20261019.1). Source maps upload on deploy by default from 4.150.0.
- Regenerated `worker-configuration.d.ts` in every TypeScript isolate (`bun run types:workers`).
- Dependency refresh: eslint 10.13, prettier 3.9.10, bun-types 1.4.4, Next.js 16.4, `@opennextjs/cloudflare` 1.20. CI Bun pin is 1.4.3.
- Wizard LLM secrets are **`OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GOOGLE_API_KEY`**. `buildConfig` enables only selected base workers. Vectorize index is `my-rag-index`.
- `hoox monitor kill-switch` reads and writes both `trade:kill_switch` and `global:kill_switch`. `--json` emits `{ engaged, keys }`.
- TUI queue, KV, secrets, dashboard kill-switch, PYNE health, and model health poll on Settings **`refreshIntervalMs`**.
- GitHub Releases use the matching **`CHANGELOG.md`** section (`scripts/changelog-notes.ts`). Auto-generated commit lists are off.

### Fixed

- Keep `@cloudflare/workers-types` on `5.20261001.1` (bun-types `ExecutionContext` clash on newer 5.20261025.1).
- **Queue handler**: Cloudflare `attempts` is 1-based; retry index is `delivery-1`. Successful handlers and DLQ paths `ack()` so messages are not redelivered. Hook throws are isolated.
- **SSE**: AbortController cancel, clean EOF reconnects, `data:` lines with an optional space.
- JSONC parse reports errors; wrangler `queues` is one object; producer binding is `TRADE_QUEUE`.
- `writeConfigSync` rethrows I/O errors. `hooxDir()` / `configPath()` honor `HOOX_HOME`. `isInsideDir` treats a trailing separator as inside.
- Analytics skip without `INTERNAL_KEY_BINDING`. Rate-limit `checkKey` is windowed. Exchange GET sends the query string.
- `wrangler rollback [version-id] --name --yes` (Wrangler 4.120+). WAF uses Rulesets (`http_request_firewall_custom`, `http_ratelimit`) plus `security_level`.
- `ensureD1Database` fails closed. Check tables, repair rebuild, init deploy, and `hoox tui` child exit report failure when the process fails.
- `createDevVars` writes only matching integration secrets. `config env --json` redacts secret values. Placeholder detection is one helper.
- `secretDelete` falls back to `--name` when the worker wrangler path is missing.
- TUI `configKvGet` unwraps `{key,value}`. Kill-switch display uses `isTruthyKillSwitchFlag`. Worker-settings hard-fails a bad `agent:config` get. Service Manager ignores ctrl/alt/meta. Settings Check Setup is a prop, not `globalThis`.

### Packages

| Package                | Version |
| ---------------------- | ------- |
| `@hoox-sh/hoox-cli`    | 0.16.0  |
| `@hoox-sh/hoox-tui`    | 0.4.0   |
| `@hoox-sh/hoox-shared` | 1.6.0   |

## [0.15.0] - 2026-10-25

Minor: a stdio MCP server over the hoox CLI, and JSON output for deploy task lists.

### Added

- **Hoox MCP server** (`packages/mcp`, private, not published). One MCP tool per runnable `hoox` command, generated from the live Commander tree, plus `hoox_catalog`, `hoox_describe`, `hoox_plan`, `hoox_snapshot`, and `hoox_advise`. Mutating calls return a confirm token and do not run until that token is presented. Secrets go to stdin and are redacted in results. `bun run mcp` starts it. Grok loads `.grok/config.toml`. The OpenCode template is `opencode.jsonc.example` (`opencode.jsonc` stays local).
- Operator page: `docs/devops/mcp`.

### Changed

- `hoox deploy all --json`, and other `runRichTasks` callers that do not print their own summary, write the task-result array. `--quiet` still prints nothing.

### Fixed

- **npm no longer refuses to run in this repo (`EOVERRIDE`).** The root `package.json` declared `@cloudflare/workers-types` as a devDependency at `^5.20261001.1` while `overrides` pinned it to `^5.20260708.1`. npm rejects an override that contradicts a direct dependency, which left `npm pack` and `npm install` both dead. Removed the override; the single-version guarantee it existed to provide is already enforced by all 14 `package.json` files specifying the identical range. The `@radix-ui/react-slot` override is untouched — it is a transitive pin with no direct dependency to conflict with.
- **Removed `brand/email-signatures`.** Unreferenced HTML email signature blocks. Nothing in source, docs, tests, or build referenced the path, so they were dead weight in the published npm tarball. The rest of `brand/` (fonts, png, svg, generators) is untouched.

### Packages

| Package                | Version |
| ---------------------- | ------- |
| `@hoox-sh/hoox-cli`    | 0.15.0  |
| `@hoox-sh/hoox-tui`    | 0.3.2   |
| `@hoox-sh/hoox-shared` | 1.5.0   |

> **Risk note.** The MCP server can run mutating hoox commands after a confirm token. `HOOX_MCP_ALLOW_MUTATIONS` stays off unless a trusted local process sets it.

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

[0.16.0]: https://github.com/hoox-sh/hoox/releases/tag/v0.16.0
[0.15.0]: https://github.com/hoox-sh/hoox/releases/tag/v0.15.0
[0.14.0]: https://github.com/hoox-sh/hoox/releases/tag/v0.14.0
