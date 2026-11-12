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
| `bun test --path-ignore-patterns 'packages/cli/workers/**' packages/cli/src` | 1370 pass / 1 fail | 1378 pass / 0 fail |

## Findings

**F1–F5 are all fixed.** F2, F3 and F4 were closed on 2026-11-12 with the
regression tests cited below.

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

### F2 — fixed: `NO_COLOR` no longer disables the interactive launcher

`src/ui/opentui-launch.ts:114` previously returned `false` when `NO_COLOR`
was set. `NO_COLOR` governs color output only, so a user with `NO_COLOR=1`
in a TTY silently got static help instead of the launcher.

Fix: removed the `NO_COLOR` guard. Color is still stripped by the existing
`isRichMode()` gate used by the formatters and banner. Regression test:
`src/ui/opentui-launch.test.ts` — "stays eligible with NO_COLOR in a TTY,
while color output is still stripped" asserts the launcher stays eligible
and `isRichMode()` is still `false`.

### F3 — fixed: menu argv no longer splits on whitespace

`src/ui/menu.ts` interpolated prompt values into command strings and
`runCommand` split them with `commandStr.split(" ")`. A value containing a
space became extra argv tokens.

Fix: `runCommand` now takes a real `string[]` argv end to end. Every call
site passes arrays; prompt values (`deploy worker`, `config set`,
`secrets set`, `logs worker`) are single elements. Static menu IDs are
mapped to argv literals in `DEVELOP_ARGV`, `MONITOR_ARGV`, and
`TOOLS_ARGV`. Regression tests: `src/ui/menu.test.ts` — the four
`runInteractiveTUI argv` tests assert a space-containing deploy worker,
config value, secrets worker/secret name, and logs worker each arrive as
exactly one argument.

### F4 — fixed: a failed menu command no longer poisons the session exit code

`src/ui/menu.ts` caught command errors but left `process.exitCode` set, so
`src/index.ts:174` skipped the completion footer and `src/index.ts:441`
exited non-zero after any earlier failure.

Fix: `runCommand` resets `process.exitCode = 0` after formatting a menu
command error. The reset is scoped to the interactive loop; a normal
(non-menu) CLI failure still exits non-zero. Regression tests:
`src/ui/menu.test.ts` — "clears a failed menu command so later successes
exit 0" and "keeps a genuine non-menu failure non-zero".

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
