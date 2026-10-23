# Example: Query Blockchain State

Get the current state of the Chia blockchain — height, sync status, difficulty, and mempool info.

## Prerequisites

- `curl` and `jq` installed, OR
- An MCP client with chia-mcp configured

## Using curl (Coinset API)

```bash
# Testnet11 (use api.coinset.org for mainnet)
curl -s -X POST https://testnet11.api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" \
  -d '{}' | jq '.'
```

## Expected Output

The response includes the current peak, sync status, difficulty, and mempool info:

> **Note:** Values below are illustrative — query the live endpoint for current data.

```json
{
  "blockchain_state": {
    "peak": {
      "height": 4570563,
      "header_hash": "0x713f5feabd2cffcb424162f2e63850ccc6d982c0977c83b8173822fc947d4501",
      "weight": 2564455427954
    },
    "sync": {
      "sync_mode": false,
      "synced": true
    },
    "difficulty": "<current_difficulty>",
    "mempool_size": 0,
    "mempool_cost": 0,
    "mempool_min_fees": {
      "cost_5000000": 0
    },
    "space": "<network_space_bytes>"
  },
  "success": true
}
```

Snapshot values are illustrative. Query the live endpoint for current values. Testnet11 space is typically much smaller than mainnet.

## Interpreting Results

| Field | Meaning |
|-------|---------|
| `peak.height` | The latest block height. New blocks arrive roughly every 18.75 seconds. |
| `sync.synced` | `true` if the node is fully synced to the network. |
| `difficulty` | Current network difficulty (use a recent value). Adjusts every 4608 blocks (~24 hours). |
| `mempool_size` | Number of unconfirmed transactions waiting to be included in a block. |
| `space` | Estimated total network storage (in bytes). Divide by 2⁶⁰ (approximately 1.15 × 10¹⁸) for EiB, or by 10¹⁸ for EB (exabytes). These are different units. |

## Quick One-Liners

**Just the height:**
```bash
curl -s -X POST https://testnet11.api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" -d '{}' | jq '.blockchain_state.peak.height'
```

**Check if synced:**
```bash
curl -s -X POST https://testnet11.api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" -d '{}' | jq '.blockchain_state.sync.synced'
```

**Mempool size:**
```bash
curl -s -X POST https://testnet11.api.coinset.org/get_blockchain_state \
  -H "Content-Type: application/json" -d '{}' | jq '.blockchain_state.mempool_size'
```

## Using chia-mcp

If you have chia-mcp configured as an MCP server, call the `get_blockchain_state` tool with no parameters. The response is the same JSON structure.

## Notes

- Coinset endpoints require no authentication
- Mainnet: `https://api.coinset.org`
- Testnet11: `https://testnet11.api.coinset.org`
- The response is real-time — peak height updates with every new block

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.2 on 2026-10-23.*
