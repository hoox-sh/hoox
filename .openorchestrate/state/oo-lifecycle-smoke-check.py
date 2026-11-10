"""Assert hoox board still has original cards + throwaway fixture (no column wipe)."""

from pathlib import Path

text = Path(".openorchestrate/board.md").read_text()
header = next(line for line in text.splitlines() if line.startswith("| Task"))
assert "Owner" in header and "Status" in header, header
assert "Delegated To" not in header
assert "Project" not in header

required = [
    "Smoke-test the OO board pipeline: verify card lifecycle (Todo → Working → Done) end-to-end",
    "hoox: docs/**/*.mdx fail prettier --check (pre-existing drift)",
    "Full CLI review + optimization: functionality, correctness, visual output, input/selection UX — fixes with tests and proof",
    "hoox: fix 7 lint errors and triage 339 warnings (seeded from HQ)",
    "hoox: close the L4/7 ladder gaps (seeded from HQ)",
    "OO lifecycle fixture (throwaway misc 2026-11-09): do not keep",
]
missing = [task for task in required if task not in text]
if missing:
    raise SystemExit(f"missing cards: {missing}")
print("OK_lifecycle_no_wipe")
