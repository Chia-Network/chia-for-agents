# Example: Look Up a Coin by ID

Find a specific coin on the Chia blockchain and inspect its details.

## Prerequisites

- `curl` and `jq` installed, OR
- An MCP client with chia-mcp configured

## What You Need

A **coin ID** (also called "coin name") — a 32-byte hex value with `0x` prefix. The coin ID is the SHA256 hash of `parent_coin_info + puzzle_hash + amount_bytes`.

Example (testnet11 farming reward coin from block 1):

```
0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3
```

## Using curl (Coinset API)

```bash
# Testnet11 example (use api.coinset.org for mainnet)
curl -s -X POST https://testnet11.api.coinset.org/get_coin_record_by_name \
  -H "Content-Type: application/json" \
  -d '{"name": "0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3"}' | jq '.'
```

## Expected Output

```json
{
  "coin_record": {
    "coin": {
      "parent_coin_info": "0x37a90eb5185a9c4439a91ddc98bbadce00000000000000000000000000000000",
      "puzzle_hash": "0x3ef7c233fc0785f3c0cae5992c1d35e7c955ca37a423571c1607ba392a9d12f7",
      "amount": 18375000000000000000
    },
    "coinbase": true,
    "confirmed_block_index": 1,
    "spent_block_index": 25104,
    "timestamp": 1701377993
  },
  "success": true
}
```

**Note:** The `spent` boolean IS present in RPC JSON responses (injected by a compatibility shim), but do not rely on it — use `spent_block_index > 0` instead. It is the canonical serialized field, tells you WHEN the coin was spent (not just whether), and does not depend on a compat shim that could be removed.

## Interpreting Results

**Note:** The coin ID itself is not in the response — it's the `name` you passed in the request. The response contains the coin's three fields (parent, puzzle hash, amount) and its on-chain status.

| Field | Meaning |
|-------|---------|
| `coin.parent_coin_info` | The coin ID of the parent coin that created this one |
| `coin.puzzle_hash` | Hash of the puzzle (CLVM program) locking this coin |
| `coin.amount` | Value in mojos (divide by 10¹² for XCH) |
| `confirmed_block_index` | Block height where this coin was created |
| `spent_block_index` | Block height where this coin was spent (0 if unspent); use `spent_block_index > 0` to check if spent |
| `coinbase` | `true` if this is a farming reward coin |
| `timestamp` | Unix timestamp of the block that confirmed this coin |

## What You Can Do Next

1. **Check if the coin is spent.** If `spent_block_index == 0`, the coin still exists and holds value.
2. **Trace its parent.** Look up `parent_coin_info` to see where this coin came from.
3. **Find its children.** Use `get_coin_records_by_parent_ids` with this coin's ID to see what it created when spent.
4. **Inspect the puzzle.** Use `get_puzzle_and_solution` (requires `spent_block_index`) to see the puzzle program and solution used to spend it.

## Finding Children of a Spent Coin

```bash
# Find what coins were created when this coin was spent
curl -s -X POST https://testnet11.api.coinset.org/get_coin_records_by_parent_ids \
  -H "Content-Type: application/json" \
  -d '{
    "parent_ids": ["0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3"],
    "include_spent_coins": true
  }' | jq '.coin_records[] | {puzzle_hash: .coin.puzzle_hash, spent_block_index: .spent_block_index, confirmed_block_index: .confirmed_block_index}'
# Note: use spent_block_index > 0 to check if spent; .spent is not a JSON field
# Note: use python3 to extract amounts safely (jq loses precision on uint64):
# python3 -c 'import sys,json; [print(r["coin"]["amount"]) for r in json.load(sys.stdin)["coin_records"]]'
```

Expected output:
```json
{
  "puzzle_hash": "0x79acc2be50f26d312c418ca7010eeae77a6da9bc1cd4db57c3283e57bd124563",
  "spent_block_index": 25115,
  "confirmed_block_index": 25104
}
{
  "puzzle_hash": "0xd10f61f1a1991d6e0ca50408aeca75defc409e5dcba8c71a2533a1e2a6a3e1b9",
  "spent_block_index": 0,
  "confirmed_block_index": 25104
}
```

This shows the coin was split into two children: one is spent (`spent_block_index > 0`) and one is still unspent.

## Using chia-mcp

Call the `get_coin_record_by_name` tool with:
```json
{"name": "0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3"}
```

## Notes

- If the coin doesn't exist, the response will have `"success": false`
- The coin ID you query with is computed as `SHA256(parent_coin_info + puzzle_hash + amount_bytes)` — it's not returned in the response
- Use `testnet11.api.coinset.org` for testnet, `api.coinset.org` for mainnet
- A spent coin's value has moved to its child coins — look them up via `get_coin_records_by_parent_ids`

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.0 on 2026-09-21.*
