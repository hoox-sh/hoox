# OpenOrchestrate Playbook

Project: **hoox**
Owner: the person running this project
Autonomy: **draft**

## The team

- **Chief** (`oo-chief`) — Chief of Staff
- **Ops** (`oo-ops`) — Head of Operations
- **Checker** (`oo-checker`) — Quality Gate
- **Docs** (`oo-spec-1`) — Head of Docs
- **Engineering** (`oo-spec-2`) — Head of Engineering
- **Misc** (`oo-misc`) — General Desk

## Operating principles

1. One bot, one domain, one name.
2. Rules live in the description, not in memory.
3. A check the bot can run before "done".
4. One front door that routes and never builds.
5. A board, not a group chat.
6. Skill first, routine second, silent when nothing changed.
7. Routines live on their own bot, never on the one you chat with.
8. Approvals expire: allow the action or stop at a draft.
9. Gate on the price of undo.
10. One shared computer is not six security zones.
11. Same answer every time? A script, not a model call.
12. Wake-ups times re-reads is your bill.

## The board

Path: `.openorchestrate/board.md`

Five statuses: Todo, Working, Blocked, Ready for Review, Done.

A handoff contains: from, to, objective, artifacts, decisions, open questions, next gate.

## The gate

- Ask first before spending money or buying anything.
- Ask first before changing permissions or logins.
- Ask first before running database migrations or destructive commands.
- Ask first before deploying to production.
- Ask first before deleting data.
- Ask first before messaging people outside my team.

When rules conflict, Ask first wins. Add an Allow rule only after the same action has been approved five times in a row.

## The clock

Routines are enabled. See `.openorchestrate/routines/`.

Every routine uses the same frame:

```text
Run at [time] or when [event] happens.
Input: [where it comes from]. Output: [format, location].
If nothing changed since the last run, say nothing.
If something needs me, send one message:
what happened, what you did, what you need from me.
If a step fails, say which step and stop.
Ask me before anything outside [approval list].
```

## Memory

Keep slow facts. Fetch fast ones.

| Place | Holds | Written by |
| --- | --- | --- |
| Description | The job and the hard rules | You |
| Skill | How to do a repeatable task | Shared |
| Memory | Stable decisions and definitions | Slow to change |
| Live source | Status, price, plan, assignee | Fetched |
| Task state | What this run is doing now | The board |

If being wrong about a fact could change an action, fetch it. Do not remember it.

Fix a recurring failure in this order: setup, check, skill or rule, memory.

## Friday receipt

For every routine: runs, passed, needed a human, repeated failures, cost per finished job. Keep, fix, or delete. Ask: would I notice if it disappeared tomorrow?
