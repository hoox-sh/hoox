# Changelog

All notable changes to `@hoox-sh/hoox-cli` are documented here.
This project adheres loosely to [Semantic Versioning](https://semver.org/).

## Unreleased

## [0.13.1] — 2026-09-05

### Fixed

- **Never persist Cloudflare API tokens** in `wrangler.jsonc` or `.wizard-state.json`. Init writes a placeholder; use `CLOUDFLARE_API_TOKEN` or `wrangler login`.
- **Materialize worker configs**: copy `wrangler.jsonc.example` → `wrangler.jsonc` on init/setup (dashboard OpenNext, analytics, pyne-worker).
- **npm global abort**: `prepare-publish.ts` rewrites `optionalDependencies` `workspace:*` so the next tarball does not fail npm install.
- **Docker**: default Bun 1.4.1; gateway volume is `workers/hoox-worker`; entrypoint builds `packages/shared` and copies wrangler examples.
- **D1 name**: wizard provisions `trade-data-db` (matches worker configs).
- **Vectorize**: gateway example no longer requires a placeholder index; init can create `hoox-rag-index`.
- **`hoox init --self-hosted`**: prints the Docker / `server.js` path (does not invent a Cloudflare-free JSONC).

### Docs

- Cloudflare token permission matrix (D1:Edit, Queues, Vectorize). Bun-only install. `./hoox-tui` root shortcut.

## [0.13.0] — 2026-08-13

### Added

- **Workers mesh security hardening** (ships with current worker submodules + `@hoox-sh/hoox-shared@1.4.0`):
  - Gateway two-phase idempotency (reserve / commit / release), sharded DO keys, fail-closed missing DO
  - Atomic rate-limit Durable Object (`RATE_LIMITER`) with KV/memory fallback
  - Telegram notify chatId allowlists (hoox + telegram-worker), 64 KiB body caps
  - Named D1 RPCs: list-signals, list-system-logs, list-open-positions
  - Env-first AI provider secrets on agent-worker; Google key via header
  - Mesh-wide `safeWaitUntil` (including DO lifecycle on trade-worker)
  - report-worker body gate, chatId policy, auth fail-closed tests
  - Deploy checklist: `workers/hoox-worker/DEPLOY.md` (DO migrations v1/v2 + allowlist secrets)

### Changed

- Parallel KV bulk gets (`kvGetMany`), dashboard parallel settings/secrets probes
- Trade HTTP idempotency stores only after success; REST-only order placement
- Time-bucketed auto fingerprints; softer trade log sampling

## [0.11.9] — 2026-08-11

### Fixed

- **TUI global install crash** (`@hoox-sh/hoox-tui@0.3.2`): remove `@opentui-ui/dialog` (nested second OpenTUI core → `OPENTUI_FORCE_WCWIDTH` dual-register). In-house `DialogProvider` / `showConfirm` only.

## [0.11.8] — 2026-08-11

### Fixed

- **TUI startup crash** (`@hoox-sh/hoox-tui@0.3.1`): remove dual-OpenTUI toast mount that re-registered `OPENTUI_FORCE_WCWIDTH` and crashed global `hoox-tui` installs. Toast helpers are fail-closed; status bar + alerts remain.

## [0.11.7] — 2026-08-11

### Added

- **TUI quality release** (ships with `@hoox-sh/hoox-tui@0.3.0` + `@hoox-sh/hoox-shared@1.3.0`): reconnect controller, overlay-safe keyboard, Service Manager/Dashboard keyboard ops, fail-closed prefs path, auth/Access parity, diagnostics palette.

### Notes

- CLI surface unchanged; monorepo release tag for TUI/shared publish + Docker.

## [0.11.6] — 2026-08-11

### Added

- **Monorepo auto-detect & remember**: on startup resolve root via `HOOX_REPO` → walk-up from cwd → `~/.hoox/config/monorepo.json` → `~/.hoox/repo`, persist the path, set session `HOOX_REPO`, and `chdir` so `hx` works from any directory (e.g. `~/Videos`).
- **Doctor**: shows **Remembered** monorepo path and accurate resolution **Source**.
- **Docs**: installation, quick-start, CLI reference, glossary, cli-features, monorepo README updated for any-cwd usage.

### Fixed

- **`isHooxSetupRoot`**: accept fresh-clone markers (`wrangler.jsonc.example`, `workers/`, `.gitmodules`) without requiring gitignored `wrangler.jsonc`.

## [0.11.5] — 2026-08-10

### Added

- **Linear Rail banner**: default CLI banner is compact `◆ H · O · O · X` with tagline/version; TTY assemble → pulse → settle animation; polished `horizon` / `signal` variants; compact `◆ Hoox · v…` line.

### Fixed

- **`hoox check setup` secrets UX**: no longer warns for healthy local secrets or “remote listed OK”; remote check parses secret names and only fails when declared secrets are missing on Cloudflare (with `hoox secrets sync` hints).

## [0.11.4] — 2026-08-10

### Fixed / hardened

- **Onboard**: do not run setup when init cancels/incomplete (require `wrangler.jsonc` after step 1).
- **ensurePackages**: detect built packages via `dist/*.js` directory scan (no more always-rebuild).
- **Workers gate**: abort setup when worker trees are still missing after submodule clone.
- **`--skip-keys`**: load mesh keys from `.keys/setup.env` so secrets can still push.
- **`hoox keys generate`**: also write `setup.env` + chmod `0700`/`0600` on key material.
- **Secret files**: chmod `0600` on `.dev.vars` / `.env.local` writers (init, env, secrets, setup).
- **formatError**: emit on **stderr** (mirrored to stdout for compatibility).
- **Secrets missing config**: recovery text points to `hoox onboard` / `hoox init`.
- **Release workflow**: idempotent TUI re-publish; fail only when CLI/auth fails.
- **Docs**: `logs worker` / `check setup` (removed stale `logs tail` / `check-setup`).

## [0.11.3] — 2026-08-10

### Fixed / ship-readiness (CLI bootstrap & exit codes)

- **`verifyRepoRoot`**: accept pre-init monorepo markers (`packages/cli` + `wrangler.jsonc.example` / `workers/` / `.gitmodules`) so fresh clones can run `hoox init` / `onboard` without a gitignored root config.
- **Init cancel / risk decline / bad token**: always `return` after cancel or failed non-interactive validation (no fall-through config write).
- **Onboard**: do not run setup when init fails; keep `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` for setup; auth gate with actionable hints.
- **Setup `generateKeys`**: merge mesh keys into existing `.dev.vars` (preserve integration secrets); honor `--skip-secrets`; chmod `.keys` `0700` and secret files `0600`.
- **Exit codes**: Commander `exitOverride` rethrows so process exit matches card codes; unknown command / missing args → exit `2`; help/version stay `0`.
- **Double error print**: suppress Commander default lines when we emit a formatted card; completion footer respects `--json` / `--quiet`.
- **Wrangler preAction**: check-only by default (set `HOOX_AUTO_UPDATE_WRANGLER=1` to auto-install).
- **Bun guard** in `bin/hoox.js` before imports; recovery text uses `hoox onboard` / `hoox init` (not `config init`).
- **Defaults / hints**: D1 fallback `trade-data-db`; schema unknown worker throws with known list; next-step map onboard → check setup → deploy.
- **Docs**: CLI command tree, installation flow, README no-args behavior aligned with code.

## [0.11.2] — 2026-08-10

### Fixed / hardened (mesh)

- **Signal path hardening** (workers + shared): unified kill-switch helper (`@hoox-sh/hoox-shared/kill-switch`), trade-worker entry idempotency, pyne→trade mesh auth + safe event mapping, exchange↔D1 position reconciliation on agent housekeeping.
- **Idempotency alignment**: gateway forwards resolved `Idempotency-Key` to trade-worker (binding + queue); queue consumer stores dedupe keys only after successful execute.
- **Operator SSE**: `/v1/trades/stream` and `/v1/logs/stream` poll live trade-worker feeds (no longer one-shot stubs).
- Depends on `@hoox-sh/hoox-shared@^1.2.1`.

## [0.11.1] — 2026-08-09

### Fixed

- **`hoox secrets sync`**: always pass `-c <worker wrangler config>` (and `--name`) so wrangler does not walk up to the monorepo root meta-config. Falls back to `wrangler.jsonc.example` when the real config is gitignored (e.g. hoox-worker).
- **Worker wrangler configs**: remove invalid `smart_placement` and monorepo-only `secrets` arrays that made `wrangler secret put` fail validation.

## [0.11.0] — 2026-08-09

### Added

- **`hoox pyne` command group** for the Python pyne-worker isolate:
  - `health` — probe `GET /health` (JSON/table)
  - `run` — evaluate a `.pine` script via `POST /run`
  - `scripts list|get|deploy|delete` — R2 script registry
  - `cron jobs|run`, `feed refresh` — bar-close scheduler helpers
  - `ingest` — wrap `scripts/fetch_and_ingest.py`
  - `sync-vendor` / `deploy` — vendor pynescript then `wrangler deploy`
- **pyne-worker** in deploy order, env catalog (`API_KEY`, `ALERT_WEBHOOK_URL`, `PYNE_API_KEY`, `PYNE_WORKER_URL`), worker manifest registry, interactive menu Tools, and shell completions.
- Configurable **agent cron** (1–1440 min) and setup secrets UX improvements.
- **TUI 0.2.0** (optional `@hoox-sh/hoox-tui`): dashboard PYNE health, full 16-view session restore, Ctrl+digit / Ctrl+Alt navigation coverage, broader operator views polish.

### Fixed / hardened

- **TUI reliability**: SSE `stopStreams()` teardown, stale `fetchWorkers` drop, safe-mode skip of network/CLI/SSE, stable global keyboard handler.
- **Remote auth fail-closed**: Bearer (`HOOX_API_TOKEN`) and/or Cloudflare Access service-token pair; CLI fallback never used in remote mode.
- **CLI bridge**: abort signals, timeout kill escalation, noise-tolerant JSON parse, argv secret redaction in logs/status.
- **State paths**: session path resolves at call time; TUI state path traversal rejected; atomic JSON state writes.

### Dependencies

- Requires `@hoox-sh/hoox-shared@^1.2.0` (workspace-aligned). Optional TUI: `@hoox-sh/hoox-tui@^0.2.0`.

## [0.10.1] — 2026-07-26

### Added

- Outside-repo TUI resolution: global `@hoox-sh/hoox-tui` install, bun/npm global paths, `hoox-tui` on PATH.
- `hoox doctor --fix-runtime` clones `github.com/hoox-sh/hoox` (auto-removes broken `~/.hoox/repo` symlinks).

### Fixed

- Clearer TUI missing-entry guidance (`bun add -g @hoox-sh/hoox-tui` or fix-runtime).

## [0.10.0] — 2026-07-26

Operator security plane for remote TUI/CLI. Requires matching `@hoox-sh/hoox-shared@1.1.0` and a gateway deploy that includes authenticated `/v1/*` routes (`OPERATOR_API_KEY`).

### Added

- **`hoox tui --remote` / `--api-url` / `--token` / `--debug` / `--allow-insecure`**
  - Fail-closed remote launch: requires Bearer (`HOOX_API_TOKEN` / `--token`), Access service-token env (`CF_ACCESS_CLIENT_ID` + `CF_ACCESS_CLIENT_SECRET`), or explicit `--allow-insecure`.
  - Forwards `HOOX_TUI_MODE`, operator token, debug flags, and optional `HOOX_TRANSPORT` from `~/.hoox/config.json`.
- **Operator transport profile** (via shared package): `public` | `access` | `mtls` | `tunnel`
  - Client attaches `Authorization: Bearer …` and optional Cloudflare Access service-token headers.
  - `HOOX_TRANSPORT` env overrides; config fallbacks via `hoox config transport`.
- **`hoox doctor --security`** — hygiene checks + optional anonymous/authed `GET /v1/health` probes (Access gate vs open surface).
- **`hoox tunnel check`** — detect `cloudflared`, print private-ingress guidance, optional management probes.
- **`hoox config transport` / `transport set`** — show/persist operator transport preference (`0600` config file).
- **Management API contract** (gateway): `GET /v1/health`, `/v1/workers`, SSE `/v1/trades/stream` & `/v1/logs/stream` behind `requireOperatorAuth` (`OPERATOR_API_KEY` preferred, `INTERNAL_API_KEY` legacy).
- **Docs:** private ingress runbook, zero-trust CLI section, TUI security posture, open-core vs Enterprise split updates.

### Security

- Config writes use owner-only modes (`~/.hoox` `0700`, `config.json` `0600`).
- TUI debug log redacts nested secret keys, Bearer strings, and env-style token assignments.
- Doctor/tunnel output never prints secret values.

### Changed

- TUI HTTP/SSE paths use versioned operator routes: `/v1/workers`, `/v1/trades/stream`, `/v1/logs/stream`.
- Completion script includes `doctor` and `tunnel`.

### Upgrade notes

```bash
# Worker (once per environment)
wrangler secret put OPERATOR_API_KEY   # same value as client token

# Client
export HOOX_API_TOKEN=…
# optional Access:
export CF_ACCESS_CLIENT_ID=…
export CF_ACCESS_CLIENT_SECRET=…
export HOOX_TRANSPORT=access

hoox doctor --security --api-url https://mgmt.example.com
hoox tui --remote --api-url https://mgmt.example.com
```

Prefer a **mgmt hostname** behind Cloudflare Access; keep TradingView `/webhook` separate. See `docs/devops/deployment/private-ingress.mdx`.

## [0.9.5] — 2026-07-20

### Removed

- **`hoox pine` command group** and all pine-worker / pyne-worker submodule requirements. Pine Script tooling is no longer part of the open-core CLI.

### Fixed

- **`hoox monitor queue-depth`** — wrangler ≥4.x removed `queues list --json`. The command now runs the human table form and parses it for `--json` output.
- **`hoox monitor kill-switch` / KV resolve** — wrangler version banners on stdout broke `JSON.parse` and polluted KV values. Namespace list uses `extractJsonArray`; `kv get` strips banners so kill-switch reports `on`/`off` correctly.
- **`hoox check health`** — no longer uses long-lived `wrangler tail` (hung ~50s+ per worker). Probes each worker with HTTP `GET /health` (8s timeout) and reports latency.
- **`hoox db list` (local)** — root monorepo `wrangler.jsonc` is a Hoox meta-config without D1 bindings. Local D1 ops now pass `-c workers/d1-worker/wrangler.jsonc` when present (`HOOX_WRANGLER_CONFIG` override supported).
- **`hoox repair check`** — prints a per-step status table (and full JSON with `--json`) instead of only `"N check(s) failed"`.

- **`hoox trace destinations`** — defaults to listing destinations when no subcommand is given (was help + exit 1).

## [0.9.3] — 2026-07-11

### Added

- **Dramatically extended hop-level tracing and observability for performance measurement** (key for the HOOX arXiv paper):
  - `hoox perf fastpath` now emits and reports much finer-grained hops (e.g. `hoox:hoox-gateway`, `trade-worker:trade-worker-receive`, preflight, DO mutex, binding dispatch, etc.).
  - `ObservabilityReader` improved to parse explicit `hop` fields in addition to legacy per-service timings.
  - Structured JSON logs (`probe_id`, `hop`, `duration_ms`) for easy correlation with `hoox trace` and Analytics Engine.
  - `hoox perf fastpath report` and `hoox trace` now support detailed per-hop reconstruction and full trace timelines.
  - Added rich hop breakdown tables and trace collection guidance in the paper's evaluation + reproducibility sections.

- Updated reproducibility commands and documentation to highlight the new extended tracing capabilities.

### Changed

- Minor internal improvements to fast-path probe handling and observability parsing for richer measurement data.

### Documentation

- Updated `hoox-arxiv-paper*` (core + full), `arxiv-submission.md`, `A-reproducibility.tex`, and related sections to reference the richer hop/traces support and Smart Placement rationale.
- Implementation table now lists CLI v0.9.3.

## [0.9.2] — 2026-06-26

### Fixed

- **formatBadge now matches the v0.9.0 CHANGELOG claim** (which the code hadn't implemented): the badge style is now "colored glyph + colored text" (Vercel / Linear style) — e.g. `✓ ok`, `✗ fail`, `⚠ warn`, `ℹ info` — instead of high-contrast background chips. `BADGE_STYLE` restructured to `{ icon, color, defaultLabel }`; default labels are lowercase to match the modern-minimal palette.

- **5 previously-failing tests now pass** (CI was red on v0.9.1):
  - `formatBadge > pads short custom text to 4 chars` — moot after the rewrite.
  - `formatHint > emits a dimmed hint line in rich mode` — test now clears `process.env.NO_COLOR` in its `beforeEach` (the local shell env had `NO_COLOR=1`, which made `isRichMode()` return false and the function bail).
  - `formatCompletion > renders success + message + duration in human mode` — same NO_COLOR fix.
  - `formatCompletion > renders a 'next: ...' line when a suggestion is provided` — same NO_COLOR fix.
  - `ConfigService > load() falls back to current directory when home config missing` — test now creates a real `wrangler.jsonc` in a tmp cwd and `process.chdir`s into it before calling `load()`. The code's "fall back to cwd" branch was never being exercised by the test.

- **Dev test suite no longer hangs `bun test` / `bun test --coverage`**. Root cause: `withErrorHandling` was calling `process.exit(1)` on caught errors, which killed the test runner mid-suite. The fix is the bigger one in "Changed" below — the wrapper now sets `process.exitCode` only.

- **3 pre-existing test bugs** surfaced by the now-functional coverage summary:
  - `registerConfigCommand > registers the 'config' command on the program` — assertion matched an outdated summary string.
  - `registerRepairCommand > repair worker <name> > calls deploy for the specified worker` — test was missing `ConfigService` prototype mocks for `load()` and `getWorker()`.
  - `registerFastpathCommand > rejects invalid --action values with exit code 2` / `rejects --n > 1000 with exit code 2` — tests mocked `process.exit` directly; the wrapper no longer calls it.

- **`format-mode.test.ts` ORIGINAL_ENV snapshot is now describe-scoped** (with `beforeAll`/`afterAll` symmetry) so cross-file test pollution from `process.env` mutations doesn't leak.

- **Coverage for `trace-service.ts` (1.79% → 100%)** — added 29 unit tests covering the constructor/credentials validation, `query` (events/calculations/invocations views), `queryEvents`, `queryMetrics`, `listKeys`, `listValues`, destinations CRUD, `getUsage`, live tail, and the `cfApi` error paths (HTTP error, network error, Auth header).

- **Coverage for `setup-service.ts` (35% → 99.89%)** — added 14 unit tests covering the actual execution paths: `generateKeys` (with real file writes), `applySchema` (spawn success/failure/missing schema), `setSecrets` (success and CloudflareService.putSecret failure), `rebuildDashboard` (build + deploy + missing dir), and `runAll` orchestration (all-flags, skip flags, failure path).

- **Coverage for `error-handler.ts` (44% → ~95%)** and **`prerequisites-command.ts` (30% → ~95%)** — added tests for `withErrorHandling` (all error branches + service name prefix) and `suggestForCommand` (short input, no match, close match, nested subcommand walk).

### Changed

- **Removed all 13 `process.exit()` calls** from `src/index.ts` and `src/utils/error-handler.ts`. Every error path now sets `process.exitCode = X` instead. A single `process.exit(process.exitCode)` in `main()`'s `finally` block is the only exit point. This is what fixes the dev test hang, and it also lets test runners intercept via Commander's `exitOverride` without monkey-patching `process.exit`.

- **Refactored `src/index.ts` (411 → 320 lines)**:
  - All 36 imports moved to a single block at the top of the file.
  - `hoox completion` extracted into its own folder: `src/commands/completion/{index.ts,completion-command.ts,completion-command.test.ts}` (5 new tests).
  - Dev/deploy preAction update hooks moved into `src/commands/dev/register.ts` and `src/commands/deploy/register.ts`, gated by a shared `src/utils/update-check.ts > attachUpdateCheck()` helper (4 new tests). Subcommand renames can no longer silently disable the check.
  - `(thisCmd as Command & { _hooxStartedAt?: number })` casts replaced with a module-level `WeakMap<Command, number>`.

- **Replaced dead `theme.corner` export** with a `theme.box` family of named primitives (`topLeft`, `topRight`, `bottomLeft`, `bottomRight`, `horizontal`, `vertical`). `src/ui/banner.ts` now uses `theme.box.*` for its box-drawing characters instead of hand-rolling them with `theme.textFaint` (the Horizon variant keeps its inline rounded corners since those aren't in the square-corner set).

- **`bin/hoox.js` now falls back to `src/index.ts` when `dist/index.js` is missing**. The fallback lets contributors and CI jobs that haven't yet run `bun run build` still execute the CLI directly via `bun bin/hoox.js` or a `bun link`-based install. Production releases continue to build first (the `prepublishOnly` script enforces this).

- **`ConfigService.load` split into two methods**. New `tryLoad(configPath?)` returns `ConfigResult` — a typed `Result<HooxConfig, ConfigError>` with a discriminated `ConfigError` union (`not-found | invalid-jsonc | not-object`). The old `load(configPath?)` is preserved as a thin wrapper that throws with a clear English message — backward-compatible with the 15+ existing callers, but new code can use `tryLoad()` for explicit error handling. `ConfigError` is exported from `src/services/config/index.ts`.

### Added

- **Per-file coverage gate**: `bun run coverage:check` runs `scripts/check-coverage.ts`, which parses `coverage/lcov.info` and fails on any `packages/cli/src/**` file (excluding tests, barrel `index.ts` re-exports, and files < 10 source lines) below the 50% line-coverage floor. The floor is intentionally low so future PRs can ratchet it up incrementally as more files get tests. Wired into the root `package.json` scripts.

### Verification

| Check                                   | Before (0.9.1)        | After (0.9.2)                      |
| --------------------------------------- | --------------------- | ---------------------------------- |
| `bun run typecheck` (all 14 workspaces) | ✅                    | ✅                                 |
| `bun run lint` (CLI)                    | ✅                    | ✅                                 |
| `bun test` (CLI)                        | ❌ 5 fail / 728 total | ✅ 0 fail / 794 total              |
| `bun test --coverage` (CLI)             | ❌ hangs (no summary) | ✅ completes, prints table         |
| `bun run coverage:check`                | ❌ no gate            | ✅ 8 src/ offenders (down from 16) |
| `process.exit()` in handlers            | 13                    | 0                                  |
| `src/index.ts` line count               | 411                   | 320                                |

### Audit

Full audit at `.opencode/audit/2026-06-26-full-audit.md`. Task tree at `.opencode/tasks/cli-audit-2026-06-26/`. Coverage gate script at `scripts/check-coverage.ts`.

## [0.9.1] — 2026-06-25

### Fixed

- **Banner version lookup broken in global install**: `ui/banner.ts` used a relative path (`../../package.json`) that works from source but not from the bundled `dist/index.js` in a globally-installed package. When the user ran `hoox` with no args, the banner tried to read `/path/to/install/@hoox-sh/package.json` (which doesn't exist) and threw `ENOENT`. The fix walks up from `import.meta.url` looking for the hoox-cli `package.json` by name, working in both layouts.

## [0.9.0] — 2026-06-24

### Added

- **New `--no-color` global flag** to disable all ANSI color output (alongside `--json` and `--quiet`).
- **`NO_COLOR` env var honored** (https://no-color.org standard).
- **`formatCompletion(message, { durationMs, suggestion })`** — new formatter that prints a "✓ Done in 1.2s" footer with an optional "→ next: hoox …" suggestion. Wired into the global `program` postAction hook.
- **"Did you mean …" suggestions** for unknown commands via Levenshtein distance. A typo like `hoox deplpy` now suggests `hoox deploy`.
- **Custom help formatter** — `hoox --help` and per-command `--help` render with sectioned layout (Usage / Options / Examples / See also) and refined colors.
- **`formatNumber(n)`** — compact notation (1.2K, 1.5M, 2.5B) used by `formatTable` number auto-alignment and by perf/monitor/trace.
- **`formatBytes(n, { binary? })`** — SI (KB/MB) or binary (KiB/MiB).

### Changed

- **Theme palette refined** to a modern-minimal aesthetic (zinc/slate base, single indigo-400 accent, de-saturated status colors). Visual change ripples through every command; information content unchanged.
- **Badge style** — `formatBadge()` no longer uses high-contrast background chips; now renders colored glyph + colored text (Vercel / Linear style).
- **Spinner** — uses braille dots (`⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏`) instead of plain ASCII.
- **`formatTable` options** — now supports `zebra`, `alignNumbers`, `colorizeStatus`, `compact` (all default to on, except `compact` which defaults to off). Backward compatible.
- **`formatError` options** — now accepts `suggestions: string[]` and `inCard: boolean`. JSON output includes a new `suggestions` field.
- **Banner default** — now `minimal` (was `legacy`).

### Fixed

- **Banner version drift**: `ui/banner.ts` was hardcoded to `v0.3.0` while the package was at `v0.8.0`. Now reads dynamically from `package.json`.
