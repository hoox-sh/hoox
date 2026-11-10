# OO board lifecycle smoke (throwaway)

**Date:** 2026-11-09  
**Seat:** oo-misc  
**Project:** hoox  
**Constraint:** no `oo board sync`; do not wipe columns.

## Fixture

`OO lifecycle fixture (throwaway misc 2026-11-09): do not keep`

## Observed transitions (MCP `oo_board_add` / `oo_board_update`, project=hoox)

| step | status | board cards | columns |
| --- | --- | --- | --- |
| add | Todo | 6 | Task, Owner, Status |
| update | Working | 6 | Task, Owner, Status |
| update | Ready for Review | 6 | Task, Owner, Status |
| update | Done | 6 | Task, Owner, Status |

Original five cards remained on every read of `hoox/.openorchestrate/board.md`. Header stayed `Task | Owner | Status`. Fixture row is Done.

## Known-bad / known-good

Fixture: known-bad `499754c7` assertion failed (`NOT_THE_TOKEN` vs `OK_lifecycle_no_wipe`); known-good `e6d08ca0` `python3 .openorchestrate/state/oo-lifecycle-smoke-check.py` → `OK_lifecycle_no_wipe`; artifact `8bbae685`. `oo proof verify` ok=true newestPassingId=`8bbae685`.

Smoke-test card: known-bad `d98a972e`; known-good `f0fa21fe`; artifact `c99cef47`. `oo proof verify` ok=true newestPassingId=`f0fa21fe`. Card status Ready for Review (Checker gate). Fixture remains Done.

## Not done

- Did not run `oo board sync`
- Did not delete the fixture (Ask-first)
- Did not push
