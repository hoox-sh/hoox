# Board sweep

- **Owner:** Ops (`oo-ops`)
- **Schedule:** daily at 09:00
- **Input:** this agency board and git status
- **Output:** an updated board and one message per problem owner
- **Check:** every stale card has an owner and a next action
- **Approval:** none for board edits; ask before messaging anyone external

## State file

The runner's own `inputHash` covers only this file and the routine definition, so
it cannot tell you the board changed. Gate on real input instead.

Before reading anything else:

```sh
STATE=.openorchestrate/state/board-sweep.json
HASH=$( {
  cat .openorchestrate/board.md
  git status --porcelain
} | sha256sum | cut -d' ' -f1 )

if [ -f "$STATE" ] && grep -q "\"boardHash\": \"$HASH\"" "$STATE"; then
  echo UNCHANGED
else
  echo CHANGED
fi
```

If the result is `UNCHANGED`: stop. Write nothing, send nothing, read nothing
else. That is the whole run.

Write the new hash back when the sweep finishes. An empty run costs one `cat`
and one `git status`, not a full context reload.

## Prompt

```text
Run daily at 09:00 or when the trigger fires. Stop before reading anything if
the state-file hash in .openorchestrate/state/board-sweep.json is unchanged.

Sweep this agency board only. Never sweep HQ. Never run `oo board sync`.

Find: failing checks, review comments, conflicts, and stale cards.
Send each problem back to its owner with the exact gap.
Move nothing that is not yours.

Input: this agency board and git status
Output: an updated board and one message per problem owner

If nothing changed since the last run, say nothing.
If something needs me, send one message:
what happened, what you did, what you need from me.
If a step fails, say which step and stop.
Ask me before anything outside the approval list.
```
