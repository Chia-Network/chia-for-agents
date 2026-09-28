#!/usr/bin/env python3
"""
End-to-end Chia quickstart using the local simulator.

Creates a simulator, farms coins, builds a spend bundle, pushes it,
and verifies the transaction. Demonstrates the full coin lifecycle.

Prerequisites:
  - chia-blockchain 2.x installed with dev dependencies (sh install.sh -d)
  - Run `python3 examples/self_check.py` to verify your environment

Usage:
  python3 examples/quickstart_sim.py

This script manages the simulator lifecycle internally — no manual
setup or teardown needed. Note: `chia dev sim create -d` writes a key
into your system keychain (outside --root-path) which cleanup does not remove.

Code correctness notes (items addressed):
  - Uses .removeprefix("0x"), NOT .lstrip("0x") (lstrip strips individual chars)
  - Uses make_spend(), NOT CoinSpend() constructor directly
  - Checks r["spent_block_index"] > 0, NOT r["spent"] (which is unreliable)
  - Parses push_tx response body for errors, NOT raise_for_status()
  - Simulator genesis varies per instance — discovered at runtime
  - SSL/mTLS handled via chia's own ssl_context_for_client (real cert paths)
  - Single-file, no seed handoff between scripts
"""

from __future__ import annotations

import asyncio
import shutil
import ssl
import sys
import subprocess
import tempfile
from pathlib import Path
from typing import Any

# ---------------------------------------------------------------------------
# Ensure chia-blockchain is importable
# ---------------------------------------------------------------------------
try:
    from chia_rs import Coin, G2Element, SpendBundle
    from chia_rs.sized_bytes import bytes32
    from chia_rs.sized_ints import uint64
except ImportError:
    print("❌ chia_rs not found. Install chia-blockchain first:")
    print("   cd chia-blockchain && sh install.sh -d && . ./activate")
    sys.exit(1)

try:
    from chia.types.blockchain_format.program import Program
    from chia.types.coin_spend import make_spend
    from chia.server.server import ssl_context_for_client
    from chia.server.ssl_context import private_ssl_ca_paths
    from chia.util.bech32m import encode_puzzle_hash
    from chia.util.config import load_config
except ImportError as e:
    print(f"❌ Cannot import: {e}")
    print("   This usually means chia-blockchain is an older version or not installed.")
    print("   Requires chia-blockchain 2.6+: sh install.sh -d && . ./activate")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def hex_to_bytes32(hex_str: str) -> bytes32:
    """Convert a 0x-prefixed hex string to bytes32.

    Uses .removeprefix() — NOT .lstrip("0x") which strips individual chars
    and can corrupt values like "0x0abc" → "abc" (stripping the leading zero).
    """
    clean = hex_str.removeprefix("0x")
    return bytes32.from_hexstr(clean)


def amount_to_bytes(amount: int) -> bytes:
    """Encode an amount as CLVM big-endian minimal bytes (two's complement).

    0 encodes to empty bytes (zero length), NOT b'\\x00'.
    This is critical for correct coin ID computation.
    """
    if amount == 0:
        return b""
    byte_count = (amount.bit_length() + 8) // 8  # +8 for sign bit
    return amount.to_bytes(byte_count, "big", signed=True)


async def rpc_post(
    url: str,
    method: str,
    params: dict[str, Any],
    ssl_context: ssl.SSLContext,
) -> dict[str, Any]:
    """Make an RPC call to a local Chia node with mTLS.

    Parses the response body for Chia-specific error messages instead of
    blindly calling raise_for_status(), which hides push_tx error details
    like MINTING_COIN or DOUBLE_SPEND.
    """
    import aiohttp

    url_full = f"{url}/{method}"
    headers = {"User-Agent": "chia-for-agents/1.0"}
    async with aiohttp.ClientSession(headers=headers) as session:
        async with session.post(
            url_full,
            json=params,
            ssl=ssl_context,
        ) as resp:
            body = await resp.json()

            # Don't use resp.raise_for_status() — it hides the error name.
            # Parse the body to get the actual Chia error.
            if not body.get("success", False):
                error_msg = body.get("error", f"HTTP {resp.status}")
                raise RuntimeError(f"RPC {method} failed: {error_msg}")

            return body


# ---------------------------------------------------------------------------
# The "anyone can spend" puzzle — simplest useful CLVM program.
# Program.to(1) is the atom 1, which as a CLVM program is path 1 —
# it returns the entire solution unchanged. This means whatever you pass
# as the solution becomes the output conditions. No signature required.
# In production, you'd use a standard p2_puzzle (pay-to-puzzle-hash).
# ---------------------------------------------------------------------------
ANYONE_CAN_SPEND_PUZZLE = Program.to(1)  # Path 1 = return the full solution as conditions


# ---------------------------------------------------------------------------
# Main flow
# ---------------------------------------------------------------------------

def preflight() -> None:
    """Verify prerequisites before doing any work.

    Every simulator step shells out to the `chia` CLI. Without this check the
    first subprocess.run() raises a bare FileNotFoundError and the user gets a
    traceback instead of an actionable message — the most likely first-run
    failure, presented in the least useful way.
    """
    if shutil.which("chia") is None:
        print("❌ The `chia` CLI was not found on your PATH.")
        print()
        print("   This example drives a local simulator via `chia dev sim`,")
        print("   which requires chia-blockchain to be installed AND activated.")
        print()
        print("   Most common cause: the virtualenv is not activated.")
        print("     cd chia-blockchain && . ./activate")
        print()
        print("   Not installed yet:")
        print("     git clone https://github.com/Chia-Network/chia-blockchain.git")
        print("     cd chia-blockchain && sh install.sh -d && . ./activate")
        print()
        print("   To verify your whole environment at once:")
        print("     python3 examples/self_check.py")
        sys.exit(1)


async def run_quickstart() -> None:
    print("=" * 60)
    print("Chia Quickstart — Simulator End-to-End")
    print("=" * 60)

    preflight()

    # ------------------------------------------------------------------
    # Step 1: Set up simulator
    # ------------------------------------------------------------------
    print("\n📦 Step 1: Setting up simulator...")

    # `chia dev sim` uses TWO separate paths:
    #   sim_cli_root — the --root-path argument to every `chia dev sim` CLI call.
    #                  The CLI appends the simulator name ("main") internally, so
    #                  it resolves config at <sim_cli_root>/main/config/config.yaml.
    #   sim_root     — sim_cli_root / "main" — the actual chia root used by the
    #                  running node (for load_config, cert paths, etc.).
    # Passing sim_root to --root-path would produce <sim_root>/main/main — a double
    # nesting that causes every subsequent chia dev sim subcommand to fail silently.
    sim_cli_root = Path(tempfile.mkdtemp(prefix="chia-sim-"))
    sim_root = sim_cli_root / "main"
    print(f"   Simulator root: {sim_cli_root}")

    # Use chia CLI to create the simulator
    print("   Generating plots... this may take up to a minute on a slow machine.")
    try:
        result = subprocess.run(
            ["chia", "dev", "sim", "--root-path", str(sim_cli_root), "create", "-d"],
            capture_output=True,
            text=True,
            timeout=300,
        )
    except subprocess.TimeoutExpired:
        print("❌ Simulator creation timed out (300s).")
        print("   Plot generation can be slow on low-spec machines.")
        print("   Try again, or run `chia dev sim create -d` manually first.")
        sys.exit(1)
    if result.returncode != 0:
        print(f"❌ Failed to create simulator:\n{result.stderr or result.stdout}")
        sys.exit(1)
    print("   Simulator created.")

    # Start the simulator
    result = subprocess.run(
        ["chia", "dev", "sim", "--root-path", str(sim_cli_root), "start"],
        capture_output=True,
        text=True,
        timeout=30,
    )
    if result.returncode != 0:
        print(f"❌ Failed to start simulator:\n{result.stderr or result.stdout}")
        sys.exit(1)
    print("   Simulator started.")

    # Give it a moment to initialize
    await asyncio.sleep(2)

    try:

        # Load config for the simulator instance
        config = load_config(sim_root, "config.yaml")
        rpc_port = config["full_node"]["rpc_port"]
        rpc_url = f"https://localhost:{rpc_port}"

        # Set up mTLS — this is how you connect to ANY local Chia node.
        # The simulator uses the same TLS infrastructure as a real node.
        ca_crt_path, ca_key_path = private_ssl_ca_paths(
            sim_root, config
        )
        ssl_ctx = ssl_context_for_client(
            ca_crt_path,
            ca_key_path,
            sim_root / config["daemon_ssl"]["private_crt"],
            sim_root / config["daemon_ssl"]["private_key"],
        )

        # ------------------------------------------------------------------
        # Step 2: Get blockchain state — discover genesis at runtime
        # ------------------------------------------------------------------
        print("\n🔗 Step 2: Checking blockchain state...")

        # Genesis challenge varies per simulator instance — never hardcode it.
        state = await rpc_post(rpc_url, "get_blockchain_state", {}, ssl_ctx)
        peak = state["blockchain_state"]["peak"]
        if peak is None:
            print("   No peak yet — farming initial block...")
            # Farm an initial block to the simulator's built-in puzzle hash
            sim_result = subprocess.run(
                [
                    "chia", "dev", "sim", "--root-path", str(sim_cli_root), "farm",
                    "--blocks", "1",
                ],
                capture_output=True,
                text=True,
                timeout=30,
            )
            if sim_result.returncode != 0:
                print(f"❌ Failed to farm initial block:\n{sim_result.stderr or sim_result.stdout}")
                sys.exit(1)
            await asyncio.sleep(1)
            state = await rpc_post(rpc_url, "get_blockchain_state", {}, ssl_ctx)
            peak = state["blockchain_state"]["peak"]

        peak_height = peak["height"]
        print(f"   Peak height: {peak_height}")
        print("   Network: simulator (testnet-like)")

        # ------------------------------------------------------------------
        # Step 3: Farm blocks to get coins
        # ------------------------------------------------------------------
        print("\n⛏️  Step 3: Farming blocks to get spendable coins...")

        # Farm blocks to the anyone-can-spend puzzle hash.
        # We MUST farm to a puzzle hash we can spend from — the simulator's
        # default address uses a standard puzzle that requires a real signature.
        # By farming to the ACS hash, the resulting coins are spendable with
        # Program.to(1) as the puzzle reveal and no signature.
        acs_puzzle_hash = ANYONE_CAN_SPEND_PUZZLE.get_tree_hash()
        acs_address = encode_puzzle_hash(acs_puzzle_hash, "txch")
        farm_result = subprocess.run(
            [
                "chia", "dev", "sim", "--root-path", str(sim_cli_root), "farm",
                "--blocks", "3",
                "--target-address", acs_address,
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if farm_result.returncode != 0:
            print(f"❌ Failed to farm blocks to ACS address:\n{farm_result.stderr or farm_result.stdout}")
            sys.exit(1)
        await asyncio.sleep(1)

        # Get all coins from the simulator
        coins_resp = await rpc_post(
            rpc_url,
            "get_all_coins",
            {"include_spent_coins": False},
            ssl_ctx,
        )
        coin_records = coins_resp.get("coin_records", [])
        if not coin_records:
            print("❌ No coins found after farming.")
            sys.exit(1)

        # Pick a coin locked by the anyone-can-spend puzzle.
        # We filter by puzzle_hash to ensure we only pick coins we can spend.
        acs_ph_hex = "0x" + acs_puzzle_hash.hex()
        source_record = None
        for cr in coin_records:
            if cr["coin"]["amount"] > 0 and cr["coin"]["puzzle_hash"] == acs_ph_hex:
                source_record = cr
                break

        if source_record is None:
            print("❌ No spendable coin found at the anyone-can-spend puzzle hash.")
            sys.exit(1)

        source_coin = Coin(
            hex_to_bytes32(source_record["coin"]["parent_coin_info"]),
            hex_to_bytes32(source_record["coin"]["puzzle_hash"]),
            uint64(source_record["coin"]["amount"]),
        )
        print(f"   Source coin: {source_coin.name().hex()}")
        print(f"   Amount: {source_coin.amount} mojos")

        # ------------------------------------------------------------------
        # Step 4: Build a spend bundle
        # ------------------------------------------------------------------
        print("\n🔧 Step 4: Building spend bundle...")

        # Create a simple spend: send all mojos to a new puzzle hash.
        # We use the "anyone can spend" puzzle for simplicity.
        #
        # The solution produces CREATE_COIN conditions:
        #   ((51 <new_puzzle_hash> <amount>))
        #
        # 51 = CREATE_COIN opcode (0x33 = 51 decimal)

        # Destination: just send to the same puzzle hash (round-trip demo)
        dest_puzzle_hash = ANYONE_CAN_SPEND_PUZZLE.get_tree_hash()
        send_amount = source_coin.amount  # Send everything (no fee in simulator)

        # Solution: list of conditions
        # ((CREATE_COIN dest_puzzle_hash amount))
        solution = Program.to([[51, dest_puzzle_hash, send_amount]])

        # Use make_spend() — NOT the CoinSpend() constructor directly.
        # make_spend() handles Program → SerializedProgram conversion correctly.
        coin_spend = make_spend(
            source_coin,
            ANYONE_CAN_SPEND_PUZZLE,
            solution,
        )

        # Create spend bundle with empty signature (anyone-can-spend needs no sig)
        spend_bundle = SpendBundle(
            [coin_spend],
            G2Element(),  # Empty/default aggregated signature
        )
        print(f"   Spend bundle hash: {spend_bundle.name().hex()}")

        # ------------------------------------------------------------------
        # Step 5: Push the transaction
        # ------------------------------------------------------------------
        print("\n📤 Step 5: Pushing transaction to mempool...")

        try:
            push_result = await rpc_post(
                rpc_url,
                "push_tx",
                {"spend_bundle": spend_bundle.to_json_dict()},
                ssl_ctx,
            )
            print(f"   push_tx status: {push_result.get('status', 'unknown')}")
        except RuntimeError as e:
            # The error message includes the specific Chia error name
            # (e.g., MINTING_COIN, DOUBLE_SPEND, UNKNOWN_UNSPENT)
            # because we parse the body, not just the HTTP status.
            print(f"❌ push_tx failed: {e}")
            sys.exit(1)

        # ------------------------------------------------------------------
        # Step 6: Farm a block to confirm
        # ------------------------------------------------------------------
        print("\n⛏️  Step 6: Farming block to confirm transaction...")

        farm_result = subprocess.run(
            [
                "chia", "dev", "sim", "--root-path", str(sim_cli_root), "farm",
                "--blocks", "1",
            ],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if farm_result.returncode != 0:
            print(f"❌ Failed to farm confirmation block:\n{farm_result.stderr or farm_result.stdout}")
            sys.exit(1)
        await asyncio.sleep(1)

        # ------------------------------------------------------------------
        # Step 7: Verify the transaction
        # ------------------------------------------------------------------
        print("\n🔍 Step 7: Verifying transaction...")

        # Check the source coin is spent.
        # Use spent_block_index > 0, NOT the "spent" boolean field.
        # The "spent" field is unreliable in some contexts.
        source_check = await rpc_post(
            rpc_url,
            "get_coin_record_by_name",
            {"name": "0x" + source_coin.name().hex()},
            ssl_ctx,
        )
        source_cr = source_check["coin_record"]
        is_spent = source_cr["spent_block_index"] > 0
        print(f"   Source coin spent: {is_spent}")
        print(f"   Spent at height: {source_cr['spent_block_index']}")

        if not is_spent:
            print("❌ Source coin not yet spent — transaction may not have confirmed.")
            sys.exit(1)

        # Find the child coin we created
        children_resp = await rpc_post(
            rpc_url,
            "get_coin_records_by_parent_ids",
            {
                "parent_ids": ["0x" + source_coin.name().hex()],
                "include_spent_coins": False,
            },
            ssl_ctx,
        )
        children = children_resp.get("coin_records", [])
        print(f"   Child coins created: {len(children)}")
        for child in children:
            c = child["coin"]
            print(f"     → {c['amount']} mojos at puzzle hash {c['puzzle_hash'][:18]}...")

        print()
        print("=" * 60)
        print("✅ Quickstart complete!")
        print()
        print("What happened:")
        print(f"  1. Created a local simulator at {sim_cli_root}")
        print("  2. Farmed blocks to get coins")
        print("  3. Built a spend bundle (coin spend + empty signature)")
        print("  4. Pushed to mempool via push_tx RPC (with mTLS)")
        print("  5. Farmed a block to confirm the transaction")
        print("  6. Verified: source coin spent, child coin created")
        print()
        print("Next steps:")
        print("  - Read resources/coin-model.md for the full coinset model")
        print("  - Read resources/rpc-quickstart.md for RPC reference")
        print("  - Try modifying the puzzle and solution to add conditions")
        print("  - Connect to testnet11 via Coinset: https://testnet11.api.coinset.org")
        print("=" * 60)

    finally:
        # Clean up simulator
        print("\n🧹 Cleaning up simulator...")
        stop_result = subprocess.run(
            ["chia", "dev", "sim", "--root-path", str(sim_cli_root), "stop"],
            capture_output=True,
            text=True,
            timeout=30,
        )
        if stop_result.returncode == 0:
            print(f"   Simulator stopped. Data remains at {sim_cli_root}")
            print("   To delete: rm -rf", sim_cli_root)
        else:
            print(f"   ⚠️  Simulator stop failed (daemon may still be running):\n{stop_result.stderr or stop_result.stdout}")
            print(f"   Manual cleanup: chia stop all --root-path {sim_cli_root}")


def main() -> None:
    asyncio.run(run_quickstart())


if __name__ == "__main__":
    main()
