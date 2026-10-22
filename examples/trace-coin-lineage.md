# Example: Trace a Coin's Lineage

Follow a coin's parent chain to understand where it came from.

## Prerequisites

- `curl` and `jq` installed
- A starting coin ID

## Why Trace Lineage?

In Chia's coinset model, every coin (except farming rewards) was created by spending a parent coin. Tracing the parent chain reveals:

- Where funds originated (farming reward? Exchange withdrawal? Trade?)
- How many hops since the original source
- Whether the coin came from a coinbase (farming) reward

## Step-by-Step

### 1. Look Up the Starting Coin

Using a real testnet11 coin (a child of a block 1 farming reward):

```bash
COIN_ID="0x098ee6804b4932b5e60e451ab70137fd7ebf96d026fa3422dac82c656c18656e"

curl -s -X POST https://testnet11.api.coinset.org/get_coin_record_by_name \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$COIN_ID\"}" | jq '.coin_record'
```

Response:
```json
{
  "coin": {
    "parent_coin_info": "0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3",
    "puzzle_hash": "0x79acc2be50f26d312c418ca7010eeae77a6da9bc1cd4db57c3283e57bd124563",
    "amount": 18275000000000000000
  },
  "coinbase": false,
  "confirmed_block_index": 25104,
  "spent_block_index": 25115,
  "timestamp": 1701818413
}
```

**Note:** The `spent` boolean IS present in RPC JSON responses (via a compat shim), but prefer `spent_block_index > 0` — it is the canonical field and tells you WHEN the coin was spent. Note the `parent_coin_info` field — that's the next coin to look up.

### 2. Look Up the Parent

```bash
PARENT_ID="0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3"

curl -s -X POST https://testnet11.api.coinset.org/get_coin_record_by_name \
  -H "Content-Type: application/json" \
  -d "{\"name\": \"$PARENT_ID\"}" | jq '.coin_record'
```

Response:
```json
{
  "coin": {
    "parent_coin_info": "0x37a90eb5185a9c4439a91ddc98bbadce00000000000000000000000000000000",
    "puzzle_hash": "0x3ef7c233fc0785f3c0cae5992c1d35e7c955ca37a423571c1607ba392a9d12f7",
    "amount": 18375000000000000000
  },
  "coinbase": true,
  "confirmed_block_index": 1,
  "spent_block_index": 25104,
  "timestamp": 1701377993
}
```

`coinbase: true` — this is a farming reward from block 1. End of the lineage.

### 3. Repeat

Continue following `parent_coin_info` until you reach a coin where `coinbase: true` (a farming reward) or you've traced back far enough.

## Automated Script

```bash
#!/bin/bash
# trace-lineage.sh — trace a coin's parent chain
# Usage: ./trace-lineage.sh <coin_id> [max_depth]
# Use testnet11.api.coinset.org for testnet, api.coinset.org for mainnet

API_BASE="${API_BASE:-https://testnet11.api.coinset.org}"
COIN_ID="$1"
MAX_DEPTH="${2:-10}"
DEPTH=0

echo "Tracing lineage of $COIN_ID (max depth: $MAX_DEPTH)"
echo "---"

while [ $DEPTH -lt $MAX_DEPTH ]; do
  RESULT=$(curl -s -X POST "$API_BASE/get_coin_record_by_name" \
    -H "Content-Type: application/json" \
    -d "{\"name\": \"$COIN_ID\"}")

  SUCCESS=$(echo "$RESULT" | jq -r '.success')
  if [ "$SUCCESS" != "true" ]; then
    echo "Coin not found: $COIN_ID"
    break
  fi

  PARENT=$(echo "$RESULT" | jq -r '.coin_record.coin.parent_coin_info')
  # Use python3 for amount — jq loses precision on uint64 values > 2^53
  AMOUNT=$(echo "$RESULT" | python3 -c 'import sys,json; print(json.load(sys.stdin)["coin_record"]["coin"]["amount"])')
  COINBASE=$(echo "$RESULT" | jq -r '.coin_record.coinbase')
  HEIGHT=$(echo "$RESULT" | jq -r '.coin_record.confirmed_block_index')

  XCH=$(echo "scale=12; $AMOUNT / 1000000000000" | bc 2>/dev/null || echo "$AMOUNT mojos")

  echo "[$DEPTH] Coin: $COIN_ID"
  echo "    Amount: $XCH XCH ($AMOUNT mojos)"
  echo "    Created at height: $HEIGHT"
  echo "    Coinbase: $COINBASE"
  echo "    Parent: $PARENT"
  echo ""

  if [ "$COINBASE" = "true" ]; then
    echo "=== Reached coinbase (farming reward). End of lineage. ==="
    break
  fi

  COIN_ID="$PARENT"
  DEPTH=$((DEPTH + 1))
done

if [ $DEPTH -eq $MAX_DEPTH ]; then
  echo "=== Reached max depth ($MAX_DEPTH). Use a higher limit to continue. ==="
fi
```

## Expected Output

```
Tracing lineage of 0x098ee6804b4932b5e60e451ab70137fd7ebf96d026fa3422dac82c656c18656e (max depth: 10)
---
[0] Coin: 0x098ee6804b4932b5e60e451ab70137fd7ebf96d026fa3422dac82c656c18656e
    Amount: 18275000.000000000000 XCH (18275000000000000000 mojos)
    Created at height: 25104
    Coinbase: false
    Parent: 0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3

[1] Coin: 0x85ebd56f9a9844276433ff85e09518572084eb0b75da04c77fe2537eb02551f3
    Amount: 18375000.000000000000 XCH (18375000000000000000 mojos)
    Created at height: 1
    Coinbase: true
    Parent: 0x37a90eb5185a9c4439a91ddc98bbadce00000000000000000000000000000000

=== Reached coinbase (farming reward). End of lineage. ===
```

## Interpreting Results

- **Coinbase coins** are the origin — they're farming rewards created by the network
- **Amount changes** between hops show where value was split (change coins) or combined
- **Height gaps** show how long a coin sat unspent before being used
- A coin's parent may have created multiple children — this trace only follows one path

## Tracing Forward (Children)

To see what a coin created when it was spent:

```bash
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

This shows where the value went — typically a payment coin and a change coin.

## Notes

- Coinset endpoints are rate-limited — add a small delay between calls for deep traces
- Coinbase (farming reward) coins have `parent_coin_info` set to a special value, not a real parent coin
- Some coins (e.g., CAT coins) may have complex inner structures — the lineage still works at the coin level
- Use `testnet11.api.coinset.org` for testnet, `api.coinset.org` for mainnet

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.1 on 2026-10-15.*
