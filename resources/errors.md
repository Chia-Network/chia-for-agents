# Chia Error Reference

Complete error catalogue for Chia RPC interactions. Extracted from [REFERENCE.md](../REFERENCE.md) for standalone use.

---


Common errors returned by `push_tx` and what they mean. The consensus-layer `Err` name is at `structuredError.data.error` (not `structuredError.code` — see Structured Errors above). Total: 57 push_tx errors + 1 PENDING status + 25 RPC-level + 7 client/MCP-layer = 90 entries.

> **Note on PENDING:** Three conditions (`MEMPOOL_CONFLICT`, `ASSERT_HEIGHT_ABSOLUTE_FAILED`, `ASSERT_HEIGHT_RELATIVE_FAILED`) are returned by the node as `status: "PENDING"` rather than as errors. They will NOT appear as TRANSACTION_FAILED errors. chia-mcp surfaces a `warning` field when `status == "PENDING"`.

| Error / Status | Meaning | What to do |
|---|---|---|
| ⚠️ **`status: PENDING`** | Bundle held in conflict or pending-height cache — NOT queued for inclusion. Node does not expose which error caused it. `MEMPOOL_CONFLICT` and height-assertion failures both return PENDING. | Check for double-spend conflicts (`get_mempool_items_by_coin_name`) or wait for the required block height. Do not report as success. |
| `MEMPOOL_NOT_INITIALIZED` | Node is still syncing or starting up — mempool not ready | Wait for the node to finish syncing before submitting |
| `INVALID_FEE_TOO_CLOSE_TO_ZERO` | Fee too low for mempool admission | Increase fee (check `get_fee_estimate`) |
| `DOUBLE_SPEND` | One of the coins is already spent | Re-query coin records, rebuild with unspent coins |
| `MINTING_COIN` | Spend creates more value than it destroys | Fix the solution — sum(outputs) + fee must equal sum(inputs) |
| `UNKNOWN_UNSPENT` | Referenced coin doesn't exist or is already spent | Verify coin ID exists and is unspent |
| `INVALID_CONDITION` | CLVM execution produced an invalid condition | Check puzzle/solution — likely a CLVM error |
| `ASSERT_HEIGHT_ABSOLUTE_FAILED` | *(Returns as PENDING, not error — see above)* Time-lock condition not yet satisfied | Wait for the required block height — the bundle is in the pending-height cache |
| `ASSERT_SECONDS_ABSOLUTE_FAILED` | Time-lock condition not yet satisfied | Wait for the required timestamp |
| `ASSERT_MY_COIN_ID_FAILED` | Puzzle expected a different coin ID | Wrong coin or wrong puzzle for this coin |
| `ASSERT_ANNOUNCE_CONSUMED_FAILED` | Expected announcement (coin or puzzle) not found in bundle | Missing a required coin spend that produces the announcement |
| `GENERATOR_RUNTIME_ERROR` | CLVM execution error (cost exceeded, infinite loop) | Reduce spend count or puzzle complexity — MAX_BLOCK_COST_CLVM is a consensus constant and cannot be raised |
| `BAD_AGGREGATE_SIGNATURE` | BLS signature verification failed | Check signing key, message, AGG_SIG variant, and genesis challenge (different per network) |
| `MEMPOOL_CONFLICT` | *(Returns as PENDING, not error — see above)* Another bundle already spends one of these coins | Rebuild with different coins, or wait for conflicting bundle to confirm |
| `ALREADY_INCLUDING_TRANSACTION` | Duplicate submission — bundle already in mempool | Usually harmless — the transaction is already pending |
| `DUPLICATE_OUTPUT` | Two identical CREATE_COINs (same puzzle hash + amount from same parent) | Change one output's amount or puzzle hash |
| `RESERVE_FEE_CONDITION_FAILED` | RESERVE_FEE assertion not met — fee is below the declared minimum | Increase fee (fee = inputs − outputs) to meet or exceed RESERVE_FEE amount |
| `INVALID_SPEND_BUNDLE` | Malformed spend bundle — deserialization failed | Check bundle structure, coin fields, puzzle/solution serialization |
| `ASSERT_HEIGHT_RELATIVE_FAILED` | *(Returns as PENDING, not error — see above)* Time-lock: not enough blocks since coin creation | Wait for the required number of blocks — the bundle is in the pending-height cache |
| `ASSERT_SECONDS_RELATIVE_FAILED` | Time-lock: not enough time since coin creation | Wait for the required duration |
| `ASSERT_BEFORE_SECONDS_ABSOLUTE_FAILED` | Offer/spend expired — current time past the deadline | The spend is no longer valid. Rebuild with a new deadline or no time constraint |
| `ASSERT_BEFORE_HEIGHT_ABSOLUTE_FAILED` | Offer/spend expired — current height past the deadline | The spend is no longer valid |
| `ASSERT_MY_PARENT_ID_FAILED` | Puzzle expected a different parent coin ID | Wrong coin for this puzzle |
| `ASSERT_MY_PUZZLEHASH_FAILED` | Puzzle expected a different puzzle hash | Wrong puzzle reveal for this coin |
| `ASSERT_MY_AMOUNT_FAILED` | Puzzle expected a different amount | Wrong coin or wrong puzzle parameters |
| `INVALID_COST_RESULT` | Declared cost doesn't match actual CLVM execution cost | Re-evaluate puzzle/solution cost; do not hand-supply cost claims |
| `INVALID_BLOCK_FEE_AMOUNT` | Fee arithmetic inconsistency in the bundle | Verify fee = sum(inputs) − sum(outputs) is consistent |
| `WRONG_PUZZLE_HASH` | Puzzle reveal doesn't hash to the coin's `puzzle_hash` | Ensure the correct puzzle is revealed for this coin |
| `IMPOSSIBLE_HEIGHT_ABSOLUTE_CONSTRAINTS` | `ASSERT_HEIGHT_ABSOLUTE` and `ASSERT_BEFORE_HEIGHT_ABSOLUTE` are mutually unsatisfiable | Check time-lock conditions — the spend window is empty |
| `IMPOSSIBLE_SECONDS_ABSOLUTE_CONSTRAINTS` | `ASSERT_SECONDS_ABSOLUTE` and `ASSERT_BEFORE_SECONDS_ABSOLUTE` are mutually unsatisfiable | Check time-lock conditions — the spend window is empty |
| `IMPOSSIBLE_HEIGHT_RELATIVE_CONSTRAINTS` | `ASSERT_HEIGHT_RELATIVE` and `ASSERT_BEFORE_HEIGHT_RELATIVE` are mutually unsatisfiable | Check relative time-lock conditions — the spend window is empty |
| `IMPOSSIBLE_SECONDS_RELATIVE_CONSTRAINTS` | `ASSERT_SECONDS_RELATIVE` and `ASSERT_BEFORE_SECONDS_RELATIVE` are mutually unsatisfiable | Check relative time-lock conditions — the spend window is empty |
| `UNKNOWN` | Catch-all error — returned when CLVM cost is 0 (puzzle ran but reported no cost) or as a fallback for unclassified failures | Re-examine puzzle/solution — a zero-cost result usually indicates a degenerate puzzle |
| `INVALID_COIN_ID` | Coin ID in the spend does not match the computed hash of its fields | Check amount encoding (see mistake #23 — minimal-byte big-endian) |
| `COINBASE_NOT_YET_SPENDABLE` | Farming reward coin has not yet reached maturity | Wait for the farming reward to mature before spending |
| `BLOCK_COST_EXCEEDS_MAX` | Spend bundle cost exceeds the per-bundle ceiling (default: `MAX_BLOCK_COST_CLVM // 2` = 5.5e9; configurable per-node). The full block budget is 11e9, but a single bundle is capped at half that. | Split into multiple smaller bundles (~550 inputs max at ~10M cost each) |
| `COIN_AMOUNT_EXCEEDS_MAXIMUM` | Coin amount exceeds max uint64 | Check amount computation |
| `MESSAGE_NOT_SENT_OR_RECEIVED` | SEND_MESSAGE/RECEIVE_MESSAGE condition not satisfied | Missing a required companion spend in the bundle |
| `INVALID_FEE_LOW_FEE` | Fee too low for mempool admission or replacement of an existing bundle | Two contexts: (a) **admission** — fee-per-cost is below the mempool's minimum rate; (b) **replacement (RBF)** — requires: (1) strict superset of the original spends, (2) strictly higher fee-per-cost (any increase), (3) at least 10,000,000 mojos more in absolute fees, (4) no change to effective time-lock constraints (assert_height, assert_before_height, assert_before_seconds), and (5) preserved fast-forward/dedup eligibility on coin spends that had them. Increase fee accordingly. |
| `ASSERT_CONCURRENT_SPEND_FAILED` | Opcode 64 — expected concurrent coin spend not in bundle | Add the required concurrent coin spend |
| `ASSERT_CONCURRENT_PUZZLE_FAILED` | Opcode 65 — expected concurrent puzzle hash not in bundle | Add a spend with the required puzzle hash |
| `ASSERT_EPHEMERAL_FAILED` | Opcode 76 — coin asserted to be ephemeral but has a prior confirmed record | The coin was already spent in a previous block; remove the ephemeral assertion |
| `EPHEMERAL_RELATIVE_CONDITION` | A relative time-lock or relative height condition was applied to an ephemeral coin, which has no confirmed block index to measure from | Remove relative conditions from ephemeral coin spends |
| `INVALID_SOFTFORK_CONDITION` | A SOFTFORK condition (Opcode 90) invokes an unknown extension in mempool mode | The extension is not yet activated — check the current soft-fork status |
| `INVALID_SOFTFORK_COST` | The first argument to the SOFTFORK condition is not a valid cost value | Fix the cost argument in the SOFTFORK condition |
| `TOO_MANY_ANNOUNCEMENTS` | A spend issues too many ASSERT_SPEND_ANNOUNCEMENT, ASSERT_PUZZLE_ANNOUNCEMENT, CREATE_COIN_ANNOUNCEMENT, or CREATE_PUZZLE_ANNOUNCEMENT conditions in aggregate | Split the spend across multiple bundles to reduce announcement count |
| `INVALID_MESSAGE_MODE` | The message mode in a SEND_MESSAGE (Opcode 66) or RECEIVE_MESSAGE (Opcode 67) condition is not a valid mode value | Check the mode argument; see CHIP for valid SEND_MESSAGE/RECEIVE_MESSAGE mode values |
| `ASSERT_MY_BIRTH_SECONDS_FAILED` | Opcode 74 — coin's confirmation timestamp doesn't match assertion | Wrong puzzle parameters or wrong coin for this puzzle |
| `ASSERT_MY_BIRTH_HEIGHT_FAILED` | Opcode 75 — coin's confirmed block height doesn't match assertion | Wrong puzzle parameters or wrong coin for this puzzle |
| `ASSERT_BEFORE_SECONDS_RELATIVE_FAILED` | Spend must happen before a relative time — deadline has passed | The spend opportunity has expired; cannot be submitted after this point |
| `ASSERT_BEFORE_HEIGHT_RELATIVE_FAILED` | Spend must happen before a relative block offset — deadline has passed | The spend opportunity has expired |
| `TOO_MANY_SPENDS` | Bundle contains more coin spends than allowed | Split into multiple smaller bundles |
| `INVALID_COIN_SOLUTION` | Coin solution is malformed or cannot be deserialized | Check puzzle/solution serialization |
| `COIN_AMOUNT_NEGATIVE` | Coin amount is negative (invalid for uint64) | Fix amount computation |
| `DOUBLE_SPEND_IN_FORK` | Double-spend detected in a fork/reorg scenario | Re-query chain state and rebuild with current coins |
| `SEXP_ERROR` | Condition parsing failed — the puzzle or solution produced malformed CLVM s-expression data that the condition parser could not interpret | Check puzzle/solution output; typically a bug in the puzzle or solution construction — conditions must be valid CLVM lists of the form `(opcode . args)` |
| `TIMEOUT` (Err 152) | CLVM / spend-bundle validation exceeded the wall-clock timeout | Reduce bundle complexity (fewer coin spends, simpler puzzles) rather than raising the fee. The timeout is a node-enforced safety limit, not a resource pricing signal. |
| `COMPLEX_GENERATOR_RECEIVED` (Err 153) | The block generator is too complex for the node to process within its resource limits | Split the spend bundle into smaller bundles. Generators become complex when a bundle references many distinct puzzle reveals — deduplicate puzzle reveals where possible and batch related spends together. |

### RPC-Level Errors

These are returned by the RPC layer (not from CLVM/consensus) and appear as `success: false` with structured error codes. Branch on `structuredError.code`, not HTTP status. The codes below are the top-level discriminators you will encounter most; the full `RpcErrorCodes` enum has 45 members.

| RPC Error Code | When it occurs | What to do |
|---|---|---|
| `TRANSACTION_FAILED` | `push_tx` consensus rejection — the specific `Err` is at `structuredError.data.error` | Branch on `structuredError.data.error` for the Err name (e.g. `DOUBLE_SPEND`). See the push_tx catalogue above. |
| `VALIDATION_ERROR` | CLVM validation failure — integer error code at `structuredError.data.error_code` | Map `error_code` to the `Err` enum; common causes: bad puzzle, cost exceeded, invalid condition |
| `CONSENSUS_ERROR` | Consensus-layer rejection outside the mempool path | Re-check bundle construction; may indicate a protocol-level issue |
| `PROTOCOL_ERROR` | Malformed RPC request or unexpected protocol state | Check request format and bundle structure |
| `TIMESTAMP_ERROR` | Timestamp-related validation failure | Check time-based conditions in the bundle |
| `API_ERROR` | General RPC API error not matching a more specific code | Check the `error` string for details |
| `INTERNAL_ERROR` | Unexpected server-side error | Retry; if persistent, the node may be in a bad state |
| `COIN_RECORD_NOT_FOUND` | `get_coin_record_by_name` with an unknown or spent coin ID | Normal not-found — check coin ID computation or query again with `include_spent_coins: true` |
| `TX_NOT_IN_MEMPOOL` | `get_mempool_item_by_tx_id` when bundle has confirmed or was never submitted | Check confirmed status via `get_coin_record_by_name` |
| `BLOCK_NOT_FOUND` | `get_block`, `get_block_spends`, `get_puzzle_and_solution` with an unknown header hash | Normal not-found for block lookup — verify the header hash or height is below the current peak |
| `BLOCK_HEIGHT_NOT_FOUND` | `get_block_record_by_height` with a height beyond the current peak | Node is still syncing or the height is in the future |
| `BLOCK_HASH_NOT_FOUND` | Block hash lookup when height has no canonical hash | Reorg in progress or non-canonical chain tip |
| `NEWER_BLOCK_NOT_FOUND` | `get_network_space` with an unknown newer header hash | Verify the header hash exists — it may be from a reorged or future block |
| `OLDER_BLOCK_NOT_FOUND` | `get_network_space` with an unknown older header hash | Verify the header hash exists — it may be from a reorged or future block |
| `INVALID_HEIGHT_FOR_COIN` | `get_puzzle_and_solution` with wrong height | Pass `spent_block_index` from `get_coin_record_by_name` — this field is the exact height required. **Coinset note:** Coinset-hosted nodes never return this code; they return `PUZZLE_SOLUTION_FAILED` for all `get_puzzle_and_solution` failures (wrong height, unspent coins, puzzle mismatch). |
| `PUZZLE_SOLUTION_FAILED` | Puzzle reveal doesn't execute against the solution, OR (on Coinset) any `get_puzzle_and_solution` failure | On upstream nodes: check puzzle/solution mismatch — distinct from wrong height. On Coinset: this code covers all failure cases including wrong height and unspent coins. |
| `HEIGHT_NOT_IN_BLOCKCHAIN` | Querying past the current peak or a pruned height | Node still syncing, or height is beyond the tip |
| `BLOCK_IN_FORK` | Block exists in a fork branch, not the canonical chain | Reorg in progress — re-query after a few blocks |
| `INVALID_BLOCK_OR_GENERATOR` | Block has no generator (non-transaction block) | Only transaction blocks have puzzles/solutions; check mistake #18 in coin-model.md |
| `PEAK_IS_NONE` | Node is still syncing — no known chain tip yet | Wait for the node to finish syncing |
| `NEW_AND_OLD_MUST_DIFFER` | `get_network_space` called with identical start/end heights | Pass different start and end heights |
| `REQUEST_MUST_CONTAIN_EXACTLY_ONE` | `get_fee_estimate` given both `cost` and `spend_bundle` (or neither) | Pass exactly one of `cost`, `spend_bundle`, or `spend_type` |
| `INVALID_COST` | `get_fee_estimate` received a cost value ≤ 0 | Pass a positive CLVM cost value |
| `NO_TRANSACTIONS_WHILE_SYNCING` | Node is still syncing and cannot accept transactions | Wait for the node to finish syncing before submitting transactions. Common when running your own node during initial sync. |
| `*_NOT_IN_REQUEST` family (14 codes) | Required parameter missing from the RPC request body (e.g., `NAME_NOT_IN_REQUEST`, `PUZZLE_HASH_NOT_IN_REQUEST`, `HINT_NOT_IN_REQUEST`, `SPEND_BUNDLE_NOT_IN_REQUEST`, etc.) | Add the missing parameter to the request body. Check the RPC endpoint documentation for required fields. |

> **Coinset note on `get_fee_estimate`:** Coinset hosted nodes may return different error codes for these edge cases: `INVALID_FEE_ESTIMATE_REQUEST` (when `cost` is missing) and `SPEND_BUNDLE_NOT_ALLOWED` (when both `cost` and `spend_bundle` are provided). The canonical codes above are what a standard chia-blockchain node returns; branch on both sets when targeting Coinset.

> **Coinset-layer note:** Coinset hosted nodes may impose their own gateway-level range limits on certain RPCs (such as `get_block_records`). These are provider constraints, not canonical node errors, and may produce HTTP-level or gateway-level responses rather than structured error codes. Refer to Coinset documentation for current limits.

**Key rule:** `INVALID_HEIGHT_FOR_COIN` is the most common RPC-layer error on upstream chia-blockchain nodes. On Coinset-hosted nodes, this error code is never returned — Coinset collapses all `get_puzzle_and_solution` failures into `PUZZLE_SOLUTION_FAILED`. In both cases, the fix is the same: `get_puzzle_and_solution` requires `height` to equal exactly `spent_block_index` from the coin record — not the current height, not the confirmed height. Always pass `spent_block_index`.

### Client-Side / MCP-Layer Errors

These are generated by the chia-mcp server itself (not the Chia node) and appear in the MCP tool error response body.

| Error message | Cause | What to do |
|---|---|---|
| `Request to <url> timed out after 20s` | The Chia node did not respond within the 20-second timeout | The node may be under load or unreachable. Retry once; if persistent, check node status or switch to a different Coinset endpoint. |
| `SSL error / certificate verify failed` (mTLS hint) | `CHIA_FULL_NODE_URL` points at a local node that requires mutual TLS | Local Chia nodes use mTLS (client certificates). chia-mcp does not support mTLS. Use Coinset hosted endpoints, or place a reverse proxy in front of the local node. |
| `Invalid JSON response from <url>` | The node returned non-JSON (HTML error page, proxy error, or empty response) | The URL may be wrong, or the node is returning a proxy/gateway error. Check `CHIA_FULL_NODE_URL` and the node's health endpoint. |
| `HTTP 429 Too Many Requests` (logged; retried once) | Coinset rate-limited the request | The server retries once with backoff. If the retry also fails, the error surfaces. Reduce request frequency or add explicit delays. |
| `network_mismatch: true` in response envelope | The connected node's reported network differs from `CHIA_NETWORK` | Verify `CHIA_FULL_NODE_URL` and `CHIA_NETWORK` agree. Addresses may have wrong prefix (xch vs txch). |
| `truncated: true` in response body | Response exceeded 50KB and was automatically trimmed | **Do not sum amounts from a truncated response** — the result is incomplete. Use `get_address_summary` which pages through records and returns a `complete` flag, or narrow the query with `start_height`/`end_height`. |
| `complete: false` from `get_address_summary` | Pagination was cut short (page truncated, sparse early exit, or max pages exhausted) | The returned total is a **lower bound**, not the full balance. Check `incomplete_reason` for the cause. Do not report this as the account balance. |

> **`network_verified` behavior:** The `network_verified` field starts as `"pending"` until the first successful RPC probe, then resolves to `true` (match) or `false` (mismatch). If the configured node is unreachable, it resolves to `false` (probe failed).

### Error Format Inconsistency (Known)

Different tools return errors in slightly different formats. This is a known inconsistency targeted for future normalization:

- `address_decode` returns a plain text string: `"Error decoding address: …"`
- `decode_offer` returns JSON: `{"error": "Failed to decode offer: …"}`

Branch on the structured MCP tool error envelope first; only inspect the body format for additional detail. Do not assume a consistent JSON/text distinction across all tools.


---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.2 on 2026-10-23.*
