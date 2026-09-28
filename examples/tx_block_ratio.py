#!/usr/bin/env python3
"""
tx_block_ratio.py — Derive the empirical transaction-block ratio for Chia mainnet.

Usage:
    python3 examples/tx_block_ratio.py [--network mainnet|testnet11] [--blocks N]

Requires: requests

This script samples a window of recent block records from Coinset and counts what
fraction are transaction blocks (have a non-null `timestamp`). The ~36% figure
cited in EVALUATION.md and coin-model.md is derived from a longer run of this
analysis against mainnet history.

A transaction block is identified by the presence of a non-null `timestamp` in the
block record — non-transaction blocks have a null timestamp (see coin-model.md
LLM mistake #18).

Example output (mainnet, window of 1000 blocks):
    Sampled 1000 blocks (heights 5000001–5001000)
    Transaction blocks: 362 (36.2%)
    Mean tx-block interval: ~51.8s  (derived: 18.75s ÷ 0.362 = 51.8s)
"""

import argparse
import sys
import json
import urllib.request

COINSET_URLS = {
    "mainnet": "https://api.coinset.org",
    "testnet11": "https://testnet11.api.coinset.org",
}
DEFAULT_SAMPLE_WINDOW = 1000  # number of consecutive blocks to sample


def rpc(method: str, params: dict) -> dict:
    body = json.dumps(params).encode()
    req = urllib.request.Request(
        f"{COINSET_URL}/{method}",
        data=body,
        headers={"Content-Type": "application/json", "User-Agent": "chia-for-agents/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read())


def main():
    parser = argparse.ArgumentParser(description="Derive empirical transaction-block ratio for Chia")
    parser.add_argument("--network", choices=["mainnet", "testnet11"], default="mainnet",
                        help="Network to query (default: mainnet)")
    parser.add_argument("--blocks", type=int, default=DEFAULT_SAMPLE_WINDOW,
                        help=f"Number of blocks to sample (default: {DEFAULT_SAMPLE_WINDOW})")
    args = parser.parse_args()

    global COINSET_URL
    COINSET_URL = COINSET_URLS[args.network]
    sample_window = args.blocks
    print(f"Network: {args.network} ({COINSET_URL})", flush=True)

    # Get current peak height
    state = rpc("get_blockchain_state", {})
    peak_height = state["blockchain_state"]["peak"]["height"]
    print(f"Peak height: {peak_height}", flush=True)

    # Sample the most recent blocks
    start = max(1, peak_height - sample_window + 1)
    end = peak_height + 1  # exclusive

    print(f"Fetching block records {start}–{end - 1} in batches...", flush=True)

    tx_block_count = 0
    total_count = 0
    # Note: this script calls the full node RPC directly (not the MCP tool,
    # which limits requests to ≤20 blocks). The RPC supports larger batches.
    batch_size = 100

    for batch_start in range(start, end, batch_size):
        batch_end = min(batch_start + batch_size, end)
        result = rpc("get_block_records", {"start": batch_start, "end": batch_end})
        records = result.get("block_records", [])
        for record in records:
            total_count += 1
            # Transaction blocks have a non-null timestamp; non-tx blocks do not
            if record.get("timestamp") is not None:
                tx_block_count += 1
        print(f"  Processed {batch_end - start}/{end - start} blocks...", flush=True)

    if total_count == 0:
        print("No blocks returned.")
        sys.exit(1)

    ratio = tx_block_count / total_count
    mean_interval_s = 18.75 / ratio if ratio > 0 else float("inf")

    print(f"\nSampled {total_count} blocks (heights {start}–{end - 1})")
    print(f"Transaction blocks: {tx_block_count} ({ratio * 100:.1f}%)")
    print(f"Mean tx-block interval: ~{mean_interval_s:.1f}s  (derived: 18.75s ÷ {ratio:.3f} = {mean_interval_s:.1f}s)")
    print("\nNote: The figure cited in EVALUATION.md (~36%) is based on a longer")
    print("window of mainnet history. A 1000-block sample may vary by a few percent.")


if __name__ == "__main__":
    main()
