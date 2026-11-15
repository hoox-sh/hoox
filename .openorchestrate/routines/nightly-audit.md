# Nightly audit

- **Owner:** Engineering (`oo-spec-2`)
- **Schedule:** daily at 03:00
- **Input:** the repository and the last audit state file
- **Output:** small PRs with proof, never merged
- **Check:** the verify command passes and the PR links its evidence
- **Approval:** ask before merging, deploying, or deleting anything

## State file

The runner's own `inputHash` covers only this file and the routine definition, so
it cannot tell you the tree changed. Gate on real input instead.

Before reading anything else:

```sh
STATE=.openorchestrate/state/nightly-audit.json
HASH=$( {
  git rev-parse HEAD
  git status --porcelain
} | sha256sum | cut -d' ' -f1 )

if [ -f "$STATE" ] && grep -q "\"treeHash\": \"$HASH\"" "$STATE"; then
  echo UNCHANGED
else
  echo CHANGED
fi
```

If the result is `UNCHANGED`: stop. Write nothing, send nothing, read nothing
else. That is the whole run.

Write the new hash back when the audit finishes. An empty run costs one
`git rev-parse` and one `git status`, not a full context reload.

## Test

`config.json` gives this routine a `testCommand`; a run is `passed` only when it
exits 0. It asserts three things, cheaply and with no writes:

1. `treeHash` appears **before** `## Prompt` in this file, so the gate is read
   before anything else (a gate placed after the prompt is not a gate);
2. if a state file exists it contains `treeHash`, otherwise the gate could never
   match and the audit would go silent forever (absent file = first run);
3. `oo board lint --json` reports `"ok": true`, which fails on any
   `done-without-proof` card — the audit may not leave an unproven claim.

## Prompt

```text
Run daily at 03:00 or when the trigger fires. Stop before reading anything if
the state-file hash in .openorchestrate/state/nightly-audit.json is unchanged.

Audit this agency codebase: dead code, load time, bundle size, failing checks.
Open small PRs with proof. Never merge. Never run `oo board sync`.

Input: the repository and the last audit state file
Output: small PRs with proof, never merged

If nothing changed since the last run, say nothing.
If something needs me, send one message:
what happened, what you did, what you need from me.
If a step fails, say which step and stop.
Ask me before anything outside the approval list.
```
