# Hoox CLI review — `packages/cli`

Reviewed: 2026-11-11 · base commit `7adee96f` · reviewer: `oo-spec-2`

This document is the review artifact for the card "Full CLI review +
optimization". The proof attached on 2026-11-09 pointed at
`.openorchestrate/plans/cli-review-proof.py` and this file; neither existed.
The review below was performed during gate remediation on 2026-11-11. It is a
targeted review of the entry point, interactive input/selection UX, visual
output helpers, and the setup service tests — not a line-by-line audit of all
221 TypeScript files.

## Verification baseline

Measured 2026-11-12 on this machine, repo root, with the fixes below applied.

Command: `./scripts/verify.sh`

- Exit: `0` — `✔ all passed (5 passed, 0 skipped)`
  (Format 26.7s, Lint 122.9s, Typecheck 5.5s, OKF 0.1s, Tests 53.3s).
- Format: `bunx prettier --check .` exits 0 with "All matched files use
  Prettier code style!". The 77 `okf/` and 2 `examples/` files are formatted,
  and submodule trees are no longer walked.
- `bun test packages/mcp` → `42 pass, 1 fail, 1 error`. The failure is not in
  `packages/mcp`: bare discovery also walks the stale untracked tree at
  `packages/cli/workers/hoox-worker/packages/mcp/src/`, whose `live.test.ts`
  cannot resolve `@modelcontextprotocol/server`. With the repo's own ignore
  (`--path-ignore-patterns 'packages/cli/workers/**'`): `22 pass, 0 fail`,
  308 `expect()` calls across 6 files. The `AXIS_MCP_KEY` /
  `PYNE_WORKER_API_KEY` secret-name drift is fixed in
  `packages/mcp/src/redact.ts`.

CLI-scoped checks (this machine):

| Check                                                                        | Before             | After              |
| ---------------------------------------------------------------------------- | ------------------ | ------------------ |
| `bunx eslint packages/cli/src packages/cli/bin`                              | 3 warnings         | 0                  |
| `(cd packages/cli && bun check --no-script)`                                 | 0 errors           | 0 errors           |
| `bun test --path-ignore-patterns 'packages/cli/workers/**' packages/cli/src` | 1370 pass / 1 fail | 1371 pass / 0 fail |

## Findings

**F2, F3 and F4 are open and unstarted.** Only F1 and F5 below are fixed; no
code has been changed for the other three, and this document does not close
them.

### F1 — fixed: leaked prototype mock breaks another test file

`src/commands/setup/setup-command.test.ts:68-70` replaces
`SetupService.prototype.checkAuth` with a mock that always resolves `true`,
but the `finally` block restored only `runAll`
(`src/commands/setup/setup-command.test.ts:85` before the fix). In a shared
test process the mock leaks into
`src/services/setup/setup-service.test.ts:168-176`, whose assertion
`expect(result).toBe(false)` then receives `true`.

Fix: capture `origAuth` at `src/commands/setup/setup-command.test.ts:66` and
restore it in `finally` at `src/commands/setup/setup-command.test.ts:89`.
Regression evidence: the CLI-scoped suite went from 1 fail to 0; the existing
`setup-service` test is the regression test.

### F2 — open: `NO_COLOR` disables the interactive launcher

`src/ui/opentui-launch.ts:118` returns `false` when `NO_COLOR` is set. The
`NO_COLOR` convention only governs color output; it should not remove the
menu/selection UI. A user with `NO_COLOR=1` in a TTY silently gets the static
help text instead of the launcher.

Suggested fix: remove the `NO_COLOR` guard and let the theme/formatters strip
color. Add a `shouldLaunchStartScreen()` test that sets `NO_COLOR` and asserts
the launcher is still eligible.

### F3 — open: menu command strings split on whitespace

`src/ui/menu.ts:655` tokenizes with `commandStr.split(" ")`, while prompt
values are interpolated unquoted at `src/ui/menu.ts:292`
(`deploy worker ${name}`), `src/ui/menu.ts:421`
(`config set ${key} ${value}`), `src/ui/menu.ts:469`
(`secrets set ${worker} ${secretName}`), and `src/ui/menu.ts:553`
(`logs worker ${name}`). Any value containing a space becomes multiple argv
tokens.

Suggested fix: pass a `string[]` argv to `runCommand`, or quote user input and
use a quote-aware tokenizer.

### F4 — open: a failed menu command poisons the session exit code

`src/ui/menu.ts:643-680` catches command errors but never resets
`process.exitCode`. `src/index.ts:174` skips the completion footer while it is
non-zero, and `main()` calls `process.exit(process.exitCode)` at
`src/index.ts:441`. After one failed command in the interactive loop, later
successes still leave a non-zero exit.

Suggested fix: reset `process.exitCode = 0` after formatting a menu command
error.

### F5 — fixed: formatting and intentional-control-regex warnings

- `src/commands/trace/trace-service.ts:308` and
  `src/services/perf/observability-reader.test.ts:50` were reformatted with
  `eslint --fix` (prettier/prettier).
- `src/utils/wrangler-output.ts:28` now documents the intentional ESC match
  with `eslint-disable-next-line no-control-regex`.

## Scope not covered

- 30 command modules were not individually audited.
- `packages/cli/workers/` contains a stale nested tree; the repo test command
  excludes it (`package.json:12`), but bare `bun test` discovery still picks
  it up unless `--path-ignore-patterns 'packages/cli/workers/**'` is passed.

## Reproduce

```bash
./scripts/verify.sh
bunx eslint packages/cli/src packages/cli/bin
(cd packages/cli && bun check --no-script)
bun test --path-ignore-patterns 'packages/cli/workers/**' packages/cli/src
```
