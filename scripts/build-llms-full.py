#!/usr/bin/env python3
"""Regenerate llms-full.txt from its source files.

llms-full.txt is a concatenation of the repo's documentation, served at
chia.net/llms-full.txt. It was previously maintained by hand, which meant an
edit to any source file silently desynchronised it: check-drift.js verifies
llms-full.txt by *sampling* phrases, so appended content (a new recipe, a new
table row) does not register as drift and the check passes on a stale file.

Run this after editing any source document, and commit the result:

    python3 scripts/build-llms-full.py          # rewrite llms-full.txt
    python3 scripts/build-llms-full.py --check  # verify it is current (CI)

--check exits 1 if llms-full.txt differs from what the sources produce, which
turns the sampled check into a complete one.
"""
from __future__ import annotations

import sys
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "llms-full.txt"

# Order matters: this is the order an agent reads the corpus in. Keep the
# routing pages first, reference material next, examples and data last.
SOURCES = [
    "README.md",
    "AGENTS.md",
    "REFERENCE.md",
    "EVALUATION.md",
    "ECOSYSTEM.md",
    "resources/coin-model.md",
    "resources/chialisp-basics.md",
    "resources/rpc-quickstart.md",
    "SECURITY.md",
    "chia-blockchain/chia-blockchain-AGENTS.md",
    "chia-blockchain/chia-blockchain-AGENTS-new.md",
    "chia-mcp/README.md",
    "examples/query-blockchain-state.md",
    "examples/lookup-coin.md",
    "examples/trace-coin-lineage.md",
    "constants.json",
]

HEADER = "# Chia Blockchain — Complete Agent Reference"


def build(generated: str) -> str:
    parts = [f"{HEADER}\n\nGenerated: {generated}\n\n---\n"]
    for rel in SOURCES:
        path = ROOT / rel
        if not path.exists():
            print(f"❌ missing source file: {rel}", file=sys.stderr)
            sys.exit(1)
        body = path.read_text(encoding="utf-8").rstrip("\n")
        parts.append(f"\n# --- {rel} ---\n\n{body}\n")
    return "\n".join(parts).rstrip("\n") + "\n"


def existing_generated_date() -> str:
    """Reuse the existing Generated: date so --check is not defeated by the clock."""
    if OUT.exists():
        for line in OUT.read_text(encoding="utf-8").splitlines()[:6]:
            if line.startswith("Generated:"):
                return line.split(":", 1)[1].strip()
    return date.today().isoformat()


def main() -> int:
    check_only = "--check" in sys.argv
    stamp = existing_generated_date() if check_only else date.today().isoformat()
    content = build(stamp)

    if check_only:
        if not OUT.exists():
            print("❌ llms-full.txt does not exist. Run: python3 scripts/build-llms-full.py")
            return 1
        if OUT.read_text(encoding="utf-8") != content:
            print("❌ llms-full.txt is STALE — it does not match its source files.")
            print("   A source document changed without regenerating the corpus.")
            print("   Fix: python3 scripts/build-llms-full.py && git add llms-full.txt")
            return 1
        size_kib = len(content.encode("utf-8")) / 1024
        print(f"✅ llms-full.txt is current ({len(SOURCES)} sources, {size_kib:.0f} KiB).")
        return 0

    OUT.write_text(content, encoding="utf-8")
    size_kib = len(content.encode("utf-8")) / 1024
    print(f"✅ Wrote llms-full.txt — {len(SOURCES)} sources, {size_kib:.0f} KiB.")
    print("   Update the size figure in llms.txt if it moved outside ±15%.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
