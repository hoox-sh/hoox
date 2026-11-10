#!/usr/bin/env python3
"""Assertion: OK_hoox_cli_review_lint_tests_smoke. Run from hoox root.

Re-runs the CLI review checks (eslint, targeted bun tests, --help smoke).
Does not touch okf/. Known-bad: pass --known-bad (missing file, exit 1).
"""
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CLI = ROOT / "packages" / "cli"
REVIEW = CLI / "CLI-REVIEW.md"
DESTRUCTIVE = CLI / "src" / "utils" / "destructive.ts"
TOKEN = "OK_hoox_cli_review_lint_tests_smoke"

TEST_FILES = [
    "src/utils/formatters.test.ts",
    "src/ui/banner.test.ts",
    "src/ui/menu.test.ts",
    "src/utils/completion.test.ts",
    "src/commands/infra/infra-command.test.ts",
    "src/commands/db/db-command.test.ts",
    "src/commands/waf/waf-command.test.ts",
    "src/commands/config/secrets-subcommands.test.ts",
]


def fail(msg: str) -> None:
    print(msg, file=sys.stderr)
    sys.exit(1)


def run(cmd: list[str], cwd: Path, env: dict[str, str] | None = None) -> subprocess.CompletedProcess[str]:
    merged = os.environ.copy()
    if env:
        for key, value in env.items():
            if value == "":
                merged.pop(key, None)
            else:
                merged[key] = value
    print("+", " ".join(cmd), flush=True)
    return subprocess.run(
        cmd,
        cwd=cwd,
        env=merged,
        text=True,
        capture_output=True,
        check=False,
    )


def main() -> None:
    if "--known-bad" in sys.argv:
        missing = CLI / "DOES-NOT-EXIST-cli-review.md"
        if missing.is_file():
            fail("known-bad file unexpectedly exists")
        fail("known-bad missing file")

    if not REVIEW.is_file():
        fail(f"missing artifact {REVIEW}")
    if not DESTRUCTIVE.is_file():
        fail(f"missing {DESTRUCTIVE}")

    lint = run(["bunx", "eslint", "src"], CLI)
    sys.stdout.write(lint.stdout + lint.stderr)
    if lint.returncode != 0:
        fail(f"packages/cli lint exit {lint.returncode}")

    missing_tests = [p for p in TEST_FILES if not (CLI / p).is_file()]
    if missing_tests:
        fail("missing test files: " + ", ".join(missing_tests))

    # Rich-mode zebra/status tests require color. The agent shell often has
    # NO_COLOR=1; that is not a product failure. Smoke below still uses NO_COLOR.
    test_env = {
        "NO_COLOR": "",
        "FORCE_COLOR": "1",
        "TERM": "xterm-256color",
    }
    tests = run(
        ["bun", "test", "--path-ignore-patterns", "**/workers/**", *TEST_FILES],
        CLI,
        env=test_env,
    )
    test_out = tests.stdout + tests.stderr
    sys.stdout.write(test_out)
    if tests.returncode != 0:
        fail(f"packages/cli targeted tests exit {tests.returncode}")
    if "\n0 fail" not in test_out and " 0 fail" not in test_out:
        fail("packages/cli targeted tests did not report 0 fail")

    help_env = {"HOOX_CLI_SILENT": "1", "NO_COLOR": "1"}
    smoke = run(["bun", "bin/hoox.js", "--help"], CLI, env=help_env)
    smoke_out = smoke.stdout + smoke.stderr
    sys.stdout.write(smoke_out)
    if smoke.returncode != 0:
        fail(f"CLI --help exit {smoke.returncode}")
    if "Usage" not in smoke_out and "usage" not in smoke_out.lower():
        fail("CLI --help missing Usage")
    if "\x1b" in smoke.stdout:
        fail("NO_COLOR=1 hoox --help still emitted ANSI")

    print(TOKEN)


if __name__ == "__main__":
    main()
