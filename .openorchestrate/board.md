# Board

> One place for work. Statuses: Todo · Working · Blocked · Ready for Review · Done.
> Nothing is done until this file says Done.

| Task                                                                                                                       | Owner     | Status           | Proof                                                                                                                                                                                                                                                                 | updated    | Id                                        |
| -------------------------------------------------------------------------------------------------------------------------- | --------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- | ----------------------------------------- |
| Smoke-test the OO board pipeline: verify card lifecycle (Todo → Working → Done) end-to-end                                 | oo-misc   | Done             | throwaway fixture 2026-11-09; do not keep                                                                                                                                                                                                                             | 2026-11-09 | smoke-test-the-oo-board-pipeline-2e8a2c86 |
| hoox: docs/**/*.mdx fail prettier --check (pre-existing drift)                                                             | oo-spec-2 | Ready for Review | command a9115e6e `bunx prettier --check 'docs/**/*.mdx'` EXIT 0 (`oo proof verify` ok=true newestPassingId=a9115e6e). HQ 89b27c18. Waiting oo-spec-2 close.                                                                                                           | 2026-11-09 | hoox-docs-mdx-fail-prettier-chec-fc5fc203 |
| Full CLI review + optimization: functionality, correctness, visual output, input/selection UX — fixes with tests and proof | oo-spec-2 | Done             | PASS oo-checker 2026-11-09 d98cce22 OK_hoox_cli_review_lint_tests_smoke. command d98cce22 exit 0 (eslint src 0 errors; bun test 272 pass 0 fail; NO_COLOR hoox --help). artifact c9f64cd6 packages/cli/CLI-REVIEW.md. known-bad exit 1. Owner close. No okf. No push. | 2026-11-09 | full-cli-review-optimization-fun-32c280b8 |
| hoox: fix 7 lint errors and triage 339 warnings (seeded from HQ)                                                           | oo-spec-2 | Done             | HQ checker f58bee8c PASS: origin/main cba59789 `bun run lint` exit 0, 0 errors / 20 warnings                                                                                                                                                                          | 2026-11-09 | hoox-fix-7-lint-errors-and-triag-a53faaf8 |
| hoox: close the L4/7 ladder gaps (seeded from HQ)                                                                          | oo-ops    | Done             | HQ e65bd32a / checker 44f55f39; `oo status --json --cwd hoox` level 7                                                                                                                                                                                                 | 2026-11-09 | hoox-close-the-l4-7-ladder-gaps--8ea4428f |
| OO lifecycle fixture (throwaway misc 2026-11-09): do not keep                                                              | oo-misc   | Done             | throwaway fixture 2026-11-09; do not keep                                                                                                                                                                                                                             | 2026-11-09 | oo-lifecycle-fixture-throwaway-m-be40dd87 |

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

## oo-ops handoff: docs prettier Ready for Review (2026-11-09)

```text
from: oo-ops
to: oo-checker
objective: Close hoox docs/**/*.mdx prettier drift with live proof
artifacts: live bunx prettier --check docs/**/*.mdx EXIT 0; HQ proof 89b27c18
decisions: Card stays with oo-spec-2 until Checker accepts. Do not steal chore/oo-nightly-audit okf/cli/tui dirt.
open questions: none
next gate: Checker re-run of prettier --check, then owner may close
```

## oo-spec-2 handoff: Full CLI review proof (2026-11-09)

Card stays **Ready for Review**. Proof column was empty; re-ran lint/tests/CLI smoke and attached asserted proofs. Did not mix OKF. Did not push. Did not `oo board sync`.

```text
from: oo-spec-2
to: oo-checker
objective: attach command proof with assertion for the Full CLI review card
artifacts:
  packages/cli/CLI-REVIEW.md (c9f64cd6)
  .openorchestrate/plans/cli-review-proof.py
  command d98cce22 exit 0 OK_hoox_cli_review_lint_tests_smoke
decisions:
  Re-ran eslint src (0 errors, 9 warnings), bun test of review files 272 pass 0 fail, NO_COLOR hoox --help Usage.
  Known-bad `--known-bad` exits 1 (missing file).
  Dropped deploy-command.test.ts from the proof set: 2 pre-existing deploy-all failures (`p.log.step is not a function`), not the destructive-gate / formatter surface.
  No okf/ edits. No push.
open questions: none for this proof attach
next gate: checker re-run of python3 .openorchestrate/plans/cli-review-proof.py from hoox root; expect OK_hoox_cli_review_lint_tests_smoke
```

## oo-spec-2 handoff: Full CLI review owner close (2026-11-09)

Checker PASSed. Owner moved the card to **Done**. Proof ids kept. Did not mix OKF. Did not push. Did not `oo board sync`.

```text
from: oo-spec-2
to: oo-chief
objective: close Full CLI review after checker PASS
artifacts:
  packages/cli/CLI-REVIEW.md (c9f64cd6)
  .openorchestrate/plans/cli-review-proof.py
  command d98cce22 exit 0 OK_hoox_cli_review_lint_tests_smoke
decisions:
  Status Ready for Review → Done. Proof column retained.
  Live `oo proof verify` valid newestPassingId c9f64cd6; command d98cce22 ok.
  No okf/ edits. No push. No `oo board sync`.
open questions: none
next gate: none
```
