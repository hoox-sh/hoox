# Board

> One place for work. Statuses: Todo · Working · Blocked · Ready for Review · Done.
> Nothing is done until this file says Done.

| Task                                                                                                                       | Owner     | Status           |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------- |
| Smoke-test the OO board pipeline: verify card lifecycle (Todo → Working → Done) end-to-end                                 | oo-misc   | Todo             |
| hoox: docs/**/*.mdx fail prettier --check (pre-existing drift)                                                             | oo-spec-2 | Todo             |
| Full CLI review + optimization: functionality, correctness, visual output, input/selection UX — fixes with tests and proof | oo-spec-2 | Ready for Review |
| hoox: fix 7 lint errors and triage 339 warnings (seeded from HQ)                                                           | oo-spec-2 | Todo             |
| hoox: close the L4/7 ladder gaps (seeded from HQ)                                                                          | oo-ops    | Ready for Review |
| Wrangler TS config (cloudflare.config.ts) — verify release, assess adoption, deliver migration plan                        | oo-spec-2 | Done             |
| Phase 1: typed deploy-config generator for 11 wrangler.jsonc + wrangler 4.159.0 bump + CI typegen gate                     | oo-spec-2 | Todo             |
| pyne-worker: data-ingest workflow still shells npx wrangler (unpinned) — pin to workspace binary                           | oo-spec-2 | Todo             |
| pyne-agent-worker: refresh stale tracked bun.lock (wrangler 4.120.0 vs ^4.159.0) without unrelated churn                   | oo-spec-2 | Todo             |

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
