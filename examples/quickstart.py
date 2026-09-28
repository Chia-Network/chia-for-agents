#!/usr/bin/env python3
"""
Chia quickstart dispatcher — run against the simulator or testnet11.

Usage:
  python3 examples/quickstart.py --network sim       # Local simulator (full lifecycle)
  python3 examples/quickstart.py --network testnet11  # Read-only queries via Coinset
  python3 examples/quickstart.py --network mainnet   # Read-only queries via Coinset (mainnet)

The simulator path (quickstart_sim.py) demonstrates the full coin lifecycle:
create, spend, confirm. Requires chia-blockchain installed locally.

The testnet11 path demonstrates read-only blockchain queries via the public
Coinset API — no local node or installation needed.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any


# ---------------------------------------------------------------------------
# Coinset RPC helper (no mTLS needed for hosted nodes)
# ---------------------------------------------------------------------------

COINSET_URLS = {
    "mainnet": "https://api.coinset.org",
    "testnet11": "https://testnet11.api.coinset.org",
}


# Errors that are normal lookup results, not server failures.
# Per REFERENCE.md: "A success: false response with a known code is a normal lookup result."
_LOOKUP_NOT_FOUND_CODES = {
    "COIN_RECORD_NOT_FOUND",
    "TX_NOT_IN_MEMPOOL",
    "BLOCK_NOT_FOUND",
    "NOT_FOUND",
}


def coinset_rpc(
    network: str,
    method: str,
    params: dict[str, Any] | None = None,
    allow_not_found: bool = False,
) -> dict[str, Any]:
    """Call a Coinset-hosted Chia full node RPC. No authentication needed.

    Returns the response body on success.
    Raises RuntimeError on server/transport errors.
    If allow_not_found=True, returns the body (with success=False) for known
    not-found codes instead of raising — allowing callers to handle gracefully.
    """
    url = f"{COINSET_URLS[network]}/{method}"
    data = json.dumps(params or {}).encode()
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Content-Type": "application/json",
            "User-Agent": "chia-for-agents/1.0",
        },
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=20) as resp:
            body = json.loads(resp.read())
    except urllib.error.HTTPError as e:
        raise RuntimeError(f"RPC {method} HTTP {e.code}: {e.reason}. URL: {url}") from e
    except urllib.error.URLError as e:
        raise RuntimeError(f"RPC {method} connection failed: {e.reason}. URL: {url}") from e
    if not body.get("success", False):
        error_code = body.get("error", "unknown")
        if allow_not_found and error_code in _LOOKUP_NOT_FOUND_CODES:
            return body  # Caller handles not-found gracefully
        raise RuntimeError(f"RPC {method} failed: {error_code}")
    return body


def compute_coin_id(parent_hex: str, puzzle_hash_hex: str, amount: int) -> str:
    """Compute a coin ID from its three fields.

    Amount encoding: big-endian minimal bytes, two's complement.
    0 encodes to empty bytes (zero length), NOT b'\\x00'.
    """
    parent = bytes.fromhex(parent_hex.removeprefix("0x"))
    ph = bytes.fromhex(puzzle_hash_hex.removeprefix("0x"))

    if amount == 0:
        amount_bytes = b""
    else:
        byte_count = (amount.bit_length() + 8) // 8
        amount_bytes = amount.to_bytes(byte_count, "big", signed=True)

    return "0x" + hashlib.sha256(parent + ph + amount_bytes).hexdigest()


# ---------------------------------------------------------------------------
# Testnet11 read-only quickstart
# ---------------------------------------------------------------------------

def run_read_only(network: str = "testnet11") -> None:
    """Demonstrate read-only blockchain queries via Coinset."""
    print("=" * 60)
    print(f"Chia Quickstart — {network} (Read-Only via Coinset)")
    print("=" * 60)

    # Step 1: Blockchain state
    print("\n🔗 Step 1: Get blockchain state")
    state = coinset_rpc(network, "get_blockchain_state")
    bs = state["blockchain_state"]
    peak = bs["peak"]
    print(f"   Peak height: {peak['height']}")
    print(f"   Synced: {bs['sync']['synced']}")
    print(f"   Difficulty: {bs['difficulty']}")
    print(f"   Mempool size: {bs['mempool_size']}")

    # Step 2: Look up a block
    print("\n📦 Step 2: Look up the peak block")
    block = coinset_rpc(network, "get_block_record_by_height", {"height": peak["height"]})
    br = block["block_record"]
    header_hash = br["header_hash"]
    print(f"   Header hash: {header_hash[:18]}...")
    ts = br.get('timestamp')
    if ts:
        print(f"   Timestamp: {ts}")
    else:
        print(f"   Timestamp: N/A (non-transaction block — only ~36% of blocks carry a timestamp; this is normal)")
    print(f"   Farmer puzzle hash: {br['farmer_puzzle_hash'][:18]}...")

    # Step 3: Find coins at the farmer's puzzle hash
    print("\n🪙 Step 3: Look up coins at the farmer's puzzle hash")
    farmer_ph = br["farmer_puzzle_hash"]
    coins = coinset_rpc(network, "get_coin_records_by_puzzle_hash", {
        "puzzle_hash": farmer_ph,
        "include_spent_coins": False,
        "start_height": max(0, peak["height"] - 100),
    })
    records = coins.get("coin_records", [])
    print(f"   Found {len(records)} unspent coins (last 100 blocks)")

    if records:
        # Step 4: Compute and verify a coin ID
        print("\n🔢 Step 4: Compute and verify a coin ID")
        cr = records[0]
        coin = cr["coin"]
        computed_id = compute_coin_id(
            coin["parent_coin_info"],
            coin["puzzle_hash"],
            coin["amount"],
        )
        print(f"   Parent:      {coin['parent_coin_info'][:18]}...")
        print(f"   Puzzle hash: {coin['puzzle_hash'][:18]}...")
        # Use python3 for uint64 arithmetic — never jq (precision loss)
        amt = coin['amount']
        print(f"   Amount:      {amt} mojos ({amt // 10**12}.{amt % 10**12:012d} XCH)")
        print(f"   Computed ID: {computed_id[:18]}...")

        # Verify by looking it up.
        # Use allow_not_found=True: a missing coin returns success:false with
        # COIN_RECORD_NOT_FOUND — a normal lookup result, not a server error.
        lookup = coinset_rpc(
            network, "get_coin_record_by_name", {"name": computed_id},
            allow_not_found=True,
        )
        if lookup.get("coin_record"):
            print("   ✅ Verified — coin exists on chain")
            lr = lookup["coin_record"]
            # Check spent status correctly: spent_block_index > 0, NOT ["spent"]
            is_spent = lr["spent_block_index"] > 0
            print(f"   Spent: {is_spent}")
            print(f"   Confirmed at height: {lr['confirmed_block_index']}")
        elif lookup.get("error") in _LOOKUP_NOT_FOUND_CODES:
            print("   ❌ Coin not found (COIN_RECORD_NOT_FOUND — may have been spent or the ID is wrong)")
        else:
            print("   ❌ Coin not found (may have been spent)")

    else:
        print("\n🔢 Step 4: Skipped — no coins found in the last 100 blocks to verify")

    # Step 5: Fee estimation
    print("\n💰 Step 5: Estimate fees")
    # cost is CLVM cost units (not mojos). ~17,000,000 for a standard two-input two-output XCH send.
    fees = coinset_rpc(network, "get_fee_estimate", {
        "target_times": [60, 300, 600],
        "cost": 17000000,
    })
    print("   Fee estimates (total mojos for the supplied cost):")
    for time_s, est in zip(fees.get("target_times", []), fees.get("estimates", [])):
        print(f"     {time_s:>4}s target: {est} mojos")

    print()
    print("=" * 60)
    print(f"✅ {network} quickstart complete!")
    print()
    print("What happened:")
    print("  1. Queried blockchain state from Coinset (no local node)")
    print("  2. Looked up the peak block")
    print("  3. Found coins at the farmer's puzzle hash")
    if records:
        print("  4. Computed and verified a coin ID (SHA256 of 3 fields)")
    else:
        print("  4. Skipped coin ID verification (no coins found in range)")
    print("  5. Estimated transaction fees")
    print()
    print("Next steps:")
    print("  - Run with --network sim for the full spend lifecycle")
    print("  - Read resources/coin-model.md for the coinset model")
    print("  - Use chia-mcp (MCP server) for tool-based agent access")
    print("=" * 60)


def main() -> None:
    parser = argparse.ArgumentParser(description="Chia quickstart")
    parser.add_argument(
        "--network",
        choices=["sim", "testnet11", "mainnet"],
        default="testnet11",
        help="Network to use: sim (local simulator), testnet11 (Coinset hosted), or mainnet (Coinset hosted, read-only)",
    )
    args = parser.parse_args()

    if args.network == "sim":
        # Import and run the simulator quickstart
        try:
            from quickstart_sim import main as sim_main
            sim_main()
        except ImportError:
            # Try relative import
            import importlib.util

            spec = importlib.util.spec_from_file_location(
                "quickstart_sim",
                str(Path(__file__).parent / "quickstart_sim.py"),
            )
            if spec and spec.loader:
                mod = importlib.util.module_from_spec(spec)
                spec.loader.exec_module(mod)
                mod.main()
            else:
                print("❌ Could not import quickstart_sim.py")
                sys.exit(1)
    else:
        run_read_only(args.network)


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as e:
        print(f"\n❌ Error: {e}", file=sys.stderr)
        print("   Run examples/self_check.py to verify your environment.", file=sys.stderr)
        sys.exit(1)
    except KeyboardInterrupt:
        print("\nInterrupted.", file=sys.stderr)
        sys.exit(130)
