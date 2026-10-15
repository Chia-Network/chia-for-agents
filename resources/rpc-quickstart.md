# Chia RPC Quickstart

Quick reference for the most common Chia full node RPCs.

## Endpoints

### Coinset Hosted (No Auth Required)

| Network | Base URL |
|---------|----------|
| Mainnet | `https://api.coinset.org` |
| Testnet11 | `https://testnet11.api.coinset.org` |

### Local Node

If running a local Chia node, the full node RPC is at `https://localhost:8555` with TLS client certificates (found in `~/.chia/mainnet/config/ssl/`).

## How to Call

All RPCs are **HTTP POST** with a JSON body. The endpoint path is the RPC method name.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/<method> \
  -H "Content-Type: application/json" \
  -d '<json_body>'
```

> ⚠️ **403 on Python urllib's default User-Agent:** Both `api.coinset.org` and `mcp.coinset.org` return HTTP 403 when the request uses Python `urllib`'s default `User-Agent` string (`Python-urllib/3.x`). `curl` works fine with its default agent. Always set an explicit `User-Agent` header as shown above (for `urllib`, pass `headers={"User-Agent": "chia-for-agents/1.0"}` to `urllib.request.Request`). The chia-mcp server sets `User-Agent: chia-mcp/1.0` automatically.

## Common RPCs

### Get Blockchain State

Returns current sync status, peak height, difficulty, and mempool size.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" \
  -d '{}'
```

**Response fields:**
- `blockchain_state.peak.height` — current block height
- `blockchain_state.sync.synced` — whether the node is synced
- `blockchain_state.mempool_size` — number of transactions in mempool
- `blockchain_state.difficulty` — current network difficulty

### Get Block

Fetch a block by header hash.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_block \
  -H "Content-Type: application/json" \
  -d '{"header_hash": "0x..."}'
```

### Get Block by Height

Get the block record at a specific height.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_block_record_by_height \
  -H "Content-Type: application/json" \
  -d '{"height": 1000000}'
```

### Look Up a Coin by ID

Find a coin record by its coin ID (name).

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_coin_record_by_name \
  -H "Content-Type: application/json" \
  -d '{"name": "0x<coin_id_hex>"}'
```

**Response fields:**
- `coin_record.coin.parent_coin_info` — parent coin ID
- `coin_record.coin.puzzle_hash` — puzzle hash locking this coin
- `coin_record.coin.amount` — value in mojos
- `coin_record.spent_block_index` — block height where it was spent (0 if unspent); use `spent_block_index > 0` to check if spent
- `coin_record.confirmed_block_index` — block height where it was created

### Find Coins by Puzzle Hash

Find all coins locked to a specific puzzle hash. Useful for checking a wallet's coins.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_coin_records_by_puzzle_hash \
  -H "Content-Type: application/json" \
  -d '{
    "puzzle_hash": "0x<puzzle_hash_hex>",
    "include_spent_coins": false
  }'
```

Set `include_spent_coins: true` to also return spent coins.

⚠️ **Malformed puzzle hash trap:** If you pass a malformed puzzle hash (e.g., `garbage`, `0xZZZZ`, or a short/invalid hex string), the RPC returns `success: true` with an empty `coin_records` array — indistinguishable from "no coins at this address." There is no error. Always validate that your puzzle hash is a valid 0x-prefixed 64-character hex string before querying. The chia-mcp server validates hex format at the schema layer (via Zod), preventing this class of silent error.

### Get Coin Records by Parent

Find all coins created by a specific parent coin.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_coin_records_by_parent_ids \
  -H "Content-Type: application/json" \
  -d '{
    "parent_ids": ["0x<parent_coin_id>"],
    "include_spent_coins": true
  }'
```

### Push Transaction

Submit a spend bundle to the mempool.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/push_tx \
  -H "Content-Type: application/json" \
  -d '{"spend_bundle": { ... }}'
```

**Response:** `{"success": true, "status": "SUCCESS"}` when queued for block inclusion. **Always check `status` as well as `success`** — `push_tx` can return `success: true` with `status: "PENDING"`, meaning the bundle was received but placed in a side cache (conflict or pending-height cache) and is **not** queued for inclusion (see coin-model.md, "Common LLM Mistakes", `push_tx` PENDING item). A consensus rejection returns `success: false` with the `Err` name at `structuredError.data.error`.

### Get Fee Estimate

Estimate fees for different confirmation time targets.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_fee_estimate \
  -H "Content-Type: application/json" \
  -d '{"target_times": [60, 300, 600], "cost": 5000000}'
```

Returns the total estimated fee in mojos for the supplied cost. `current_fee_rate` is mojos per CLVM cost unit.

The `cost` parameter is in CLVM cost units (not mojos). CLVM cost measures computational cost of puzzle evaluation, distinct from mojos which measure XCH value. 5,000,000 is the node's standard fee-estimation sample bucket; an actual standard two-input two-output XCH send costs roughly 17M CLVM cost units (per [chialisp.com](https://chialisp.com/costs)). Omit when providing a `spend_bundle` instead.

### Get Puzzle and Solution

Get the puzzle reveal and solution for a spent coin.

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_puzzle_and_solution \
  -H "Content-Type: application/json" \
  -d '{
    "coin_id": "0x<coin_id_hex>",
    "height": 1000000
  }'
```

Requires the block height where the coin was spent.

## Common Patterns

### "What's the current height?"

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" -d '{}' | jq '.blockchain_state.peak.height'
```

### "Find all unspent coins for an address"

Convert the address to a puzzle hash first:

```bash
# xch1/txch1 addresses are bech32m-encoded puzzle hashes.
# Decode with any of these methods:

# With chia-mcp: use the address_decode tool to convert any xch1/txch1 address

# With the chia CLI:
chia wallet get_address  # shows your wallet address (decode to puzzle hash below)

# With Python:
python3 -c "from chia.util.bech32m import decode_puzzle_hash; print('0x' + decode_puzzle_hash('txch1...').hex())"
```

Then query:

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_coin_records_by_puzzle_hash \
  -H "Content-Type: application/json" \
  -d '{"puzzle_hash": "0x<puzzle_hash>", "include_spent_coins": false}'
```

### "Check if a transaction confirmed"

Look up the coin ID that was supposed to be created. Check `confirmed_block_index` (and use `spent_block_index > 0` for spent status — don't rely on the `spent` compat field):

```bash
curl -s -X POST -H "User-Agent: chia-for-agents/1.0" https://api.coinset.org/get_coin_record_by_name \
  -H "Content-Type: application/json" \
  -d '{"name": "0x<expected_coin_id>"}' | jq '.coin_record.confirmed_block_index'
```

If `success: false` with `COIN_RECORD_NOT_FOUND`, the transaction has not yet confirmed (or was never submitted).

### "Trace a coin's parent chain"

Recursively look up `parent_coin_info` — see [examples/trace-coin-lineage.md](../examples/trace-coin-lineage.md).

## Notes

- All hashes and IDs are hex-encoded with `0x` prefix
- Amounts are in **mojos** (1 XCH = 10¹² mojos)
- **chia-mcp returns the following fields as strings** (not numbers) for JSON precision safety: `amount`, `timestamp`, `fee`, `cost`, `space`, `weight`, `total_iters`, `sub_slot_iters`, `required_iters`, `mempool_cost`, `mempool_max_total_cost`, `mempool_min_fee_per_cost`. Use BigInt or Python integers for arithmetic — never JavaScript Number or jq.
- Coinset hosted endpoints have rate limits — be respectful
- For full RPC documentation: [docs.chia.net Full Node RPC](https://docs.chia.net/reference-client/rpc-reference/full-node-rpc/)

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.1 on 2026-10-15.*
