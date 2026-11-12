# Board

> One place for work. Statuses: Todo · Working · Blocked · Ready for Review · Done.
> Nothing is done until this file says Done.

| Task                                                                                                                                                   | Owner     | Status           |
| ------------------------------------------------------------------------------------------------------------------------------------------------------ | --------- | ---------------- |
| Smoke-test the OO board pipeline: verify card lifecycle (Todo → Working → Done) end-to-end                                                             | oo-misc   | Done             |
| hoox: prettier --check drift — 77 files under okf/, 2 under examples/, 0 under packages/cli or docs/** (measured 2026-11-11; blocks scripts/verify.sh) | oo-spec-2 | Ready for Review |
| hoox: packages/mcp/src/live.test.ts:71 expects AXIS_MCP_KEY / PYNE_WORKER_API_KEY — secret-name drift, blocks scripts/verify.sh                        | oo-spec-2 | Ready for Review |
| Full CLI review + optimization: functionality, correctness, visual output, input/selection UX — fixes with tests and proof                             | oo-spec-2 | Ready for Review |
| hoox: fix 7 lint errors and triage 339 warnings (seeded from HQ)                                                                                       | oo-spec-2 | Todo             |
| hoox: close the L4/7 ladder gaps (seeded from HQ)                                                                                                      | oo-ops    | Done             |
| Wrangler TS config (cloudflare.config.ts) — verify release, assess adoption, deliver migration plan                                                    | oo-spec-2 | Done             |
| Phase 1: typed deploy-config generator for 11 wrangler.jsonc + wrangler 4.159.0 bump + CI typegen gate                                                 | oo-spec-2 | Todo             |
| pyne-worker: data-ingest workflow still shells npx wrangler (unpinned) — pin to workspace binary                                                       | oo-spec-2 | Todo             |
| pyne-agent-worker: refresh stale tracked bun.lock (wrangler 4.120.0 vs ^4.159.0) without unrelated churn                                               | oo-spec-2 | Todo             |
| pyne-worker + pyne-agent-worker: duplicate `optionalSkills` keys in config (second silently wins) — merge to one key                                   | oo-spec-2 | Done             |
| L3/L1 ladder hygiene: run `oo hooks compose`, give both routines a testCommand (routine runs currently record as manual)                               | oo-ops    | Todo             |
| oo board lint exits 0 on error done-without-proof (JSON ok:false only); not in verify.sh/pre-commit — hand-edited Done card reported, blocks nothing   | oo-spec-2 | Todo             |
| oo board: cards table is upsert-only, no transition history — status changes overwritten, board not auditable after the fact (proofs append-only)      | oo-spec-2 | Todo             |

## Proof

- `optionalSkills` duplicate merge (oo-spec-2, 2026-11-11): `workers/pyne-worker/.openorchestrate/config.json` and `workers/pyne-agent-worker/.openorchestrate/config.json` each went 2 → 1 `optionalSkills` key (`grep -n` now returns one hit per file: line 175 / line 167). Shadowed first key held `enabledPacks: []` in both files — pure dedupe, zero packs lost. Token-level duplicate scan (recursive-descent, fails on repeats) reports `duplicates=0` and exit 0 on both whole configs; it reported `duplicates=1` / exit 1 before the edit. Effective readback unchanged: `enabledPacks = catalog/addyosmani-agent-skills, catalog/cloudflare-security-audit, catalog/google-elephant-goldfish, catalog/kepano-obsidian-skills, catalog/mattpocock-skills`. Diff is 3 deletions per file, no reformatting. Working-tree only — no commit, no push, no submodule ref update (`git -C <repo> status --porcelain` = ` M .openorchestrate/config.json`).

## Rules

- Every card has one owner.
- Five statuses, no more: Todo · Working · Blocked · Ready for Review · Done.
- If you are stuck, set Blocked, write why, and ping the Chief.
- Pass work as a handoff, not a transcript.
- A card moves to Done only with proof attached.

## Handoff format

```text
from:
to:
objective:
artifacts:
decisions:
open questions:
next gate:
```
