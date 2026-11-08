---
type: Policy
title: Security
description: Permission model, gates, and secret handling.
tags: [security, gates, secrets]
status: stable
---

# Security

## Shared machine

All OpenCode agents share one machine. Separate agent names are not separate
security zones. Use permissions and gates, not trust.

## Gate rules

- Ask first before spending money or buying anything.
- Ask first before changing permissions or logins.
- Ask first before running database migrations or destructive commands.
- Ask first before deploying to production.
- Ask first before deleting data.
- Ask first before messaging people outside my team.

When rules conflict, Ask-first wins.

## Secrets

Never commit API keys, tokens, or credentials. Use environment variables.
`oo doctor` scans generated files for common key patterns.
