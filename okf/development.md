---
type: Guide
title: Development
description: Setup, checks, and the pre-commit hook.
tags: [development, verification]
status: stable
---

# Development

## Checks

```sh
bunx prettier --check .
bun run lint
bun run typecheck
bun run test
./scripts/verify.sh
```

`./scripts/verify.sh` runs format, lint, typecheck, OKF validation, and tests.
Pass `pre-commit` or `pre-push` to match the hooks.

The pre-commit hook runs format, lint, typecheck, and OKF validation. The
pre-push hook adds the test suite. Skip a step for one run with:

```sh
OO_SKIP="lint,typecheck" git commit ...
```

Set `OO_STRICT=1` to fail instead of skipping a missing tool.

## Hooks

The hooks live in `.githooks/` and run through `scripts/verify.sh`. Install or
repair them with:

```sh
./scripts/install-hooks.sh
```

## Related

- [Architecture](architecture.md)
- [Security](security.md)
