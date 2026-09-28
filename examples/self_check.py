#!/usr/bin/env python3
"""
Verify the local environment is ready for the Chia quickstart.

Checks:
  - Python version (3.10+)
  - chia-blockchain installed and version (2.x)
  - Simulator available (chia dev sim)
  - Key dependencies (chia_rs, clvm_tools_rs)

Run:  python3 examples/self_check.py
"""

import sys
import subprocess
import importlib


def check(label: str, ok: bool, detail: str = "") -> bool:
    status = "✅" if ok else "❌"
    msg = f"{status} {label}"
    if detail:
        msg += f"  ({detail})"
    print(msg)
    return ok


def main() -> int:
    all_ok = True

    # Python version
    v = sys.version_info
    all_ok &= check(
        "Python 3.10+",
        v >= (3, 10),
        f"found {v.major}.{v.minor}.{v.micro}",
    )

    # chia-blockchain
    #
    # constants.json declares chia_blockchain_version ">=2.7.0", so check against
    # that floor rather than a bare "2.x". This matters because a plain
    # `pip install chia-blockchain` can silently resolve to 2.6.0: chia 2.7.x
    # requires zstd>=1.5.7.3, and 1.5.7.3 is YANKED on PyPI ("buggy - not thread
    # safe"), so pip backtracks to the newest release that avoids it. A user can
    # therefore end up on 2.6.0 while believing they are on the documented floor.
    try:
        import chia

        ver = getattr(chia, "__version__", "unknown")

        def parse(v: str) -> tuple[int, ...]:
            parts: list[int] = []
            for chunk in v.split(".")[:3]:
                digits = "".join(c for c in chunk if c.isdigit())
                parts.append(int(digits) if digits else 0)
            return tuple(parts)

        meets_floor = parse(ver) >= (2, 7, 0)
        all_ok &= check("chia-blockchain >=2.7.0", meets_floor, f"found {ver}")
        if not meets_floor and ver.startswith("2."):
            print("     ↳ chia 2.7.x depends on zstd>=1.5.7.3, which is yanked on PyPI,")
            print("       so pip may silently install 2.6.0 instead. To force 2.7.x:")
            print("         pip install 'zstd==1.5.7.3' 'chia-blockchain>=2.7.0'")
            print("       (installs a yanked dependency — see repo README for context)")
    except ImportError:
        all_ok &= check("chia-blockchain installed", False, "not found — run: sh install.sh -d")

    # chia_rs
    try:
        import chia_rs  # noqa: F401

        all_ok &= check("chia_rs", True)
    except ImportError:
        all_ok &= check("chia_rs", False, "not found")

    # clvm_tools_rs
    try:
        import clvm_tools_rs  # noqa: F401

        all_ok &= check("clvm_tools_rs", True)
    except ImportError:
        all_ok &= check("clvm_tools_rs", False, "not found")

    # Simulator CLI
    try:
        result = subprocess.run(
            ["chia", "dev", "sim", "--help"],
            capture_output=True,
            text=True,
            timeout=10,
        )
        all_ok &= check("chia dev sim", result.returncode == 0)
    except (FileNotFoundError, subprocess.TimeoutExpired):
        all_ok &= check("chia dev sim", False, "'chia' CLI not found or not in PATH — activate your environment: . ./activate")

    # Check that chia CLI is co-located with the active interpreter.
    # quickstart_sim.py uses launch_start_daemon(), which resolves chia as a
    # sibling of sys.executable. In a system-wide pip install, sys.executable
    # may be /usr/bin/python3 while chia lives at /usr/local/bin/chia — those
    # two paths are in different directories, so launch_start_daemon() fails.
    from pathlib import Path
    sibling = Path(sys.executable).parent / "chia"
    all_ok &= check(
        "chia CLI is a sibling of the active interpreter",
        sibling.exists(),
        "" if sibling.exists() else f"expected {sibling} — activate the venv: . ./activate",
    )

    print()
    if all_ok:
        print("All checks passed. Ready to run quickstart_sim.py.")
    else:
        # Check if chia package is importable but CLI is missing — likely needs activation
        chia_importable = False
        try:
            import chia as _chia_check  # noqa: F401
            chia_importable = True
        except ImportError:
            pass

        if chia_importable:
            print("Some checks failed. The chia package is installed but the CLI is not in PATH.")
            print("Activate your environment first:")
            print("  cd /path/to/chia-blockchain && . ./activate")
        else:
            print("Some checks failed. Install chia-blockchain first:")
            print("  git clone https://github.com/Chia-Network/chia-blockchain.git")
            print("  cd chia-blockchain && sh install.sh -d && . ./activate")

    return 0 if all_ok else 1


if __name__ == "__main__":
    sys.exit(main())
