# Chia for Agents

Tools for AI agents working with the Chia blockchain (XCH). Query coin records by puzzle hash, check wallet address balances in mojos, trace transaction lineage via coin IDs (0x-prefixed 32-byte hashes), look up CATs and NFTs by hint, inspect spend bundles and offer files, and verify xch1/txch1 addresses — all through the [chia-mcp](https://github.com/Chia-Network/chia-mcp) MCP server or direct [Coinset](https://coinset.org) RPC calls.

| I want to… | Go to |
|---|---|
| Check a balance or query coins | [Common Tasks](#common-tasks) below |
| **Build my first transaction / send XCH** | [examples/quickstart_sim.py](examples/quickstart_sim.py) — full lifecycle: create, spend, confirm |
| Evaluate whether to build on Chia | [EVALUATION.md](EVALUATION.md) |
| Understand coins, CLVM, spend bundles | [resources/coin-model.md](resources/coin-model.md) |
| Look up token standards, error codes, dApp patterns | [REFERENCE.md](REFERENCE.md) |
| Diagnose an RPC or push_tx error | [REFERENCE.md#error-catalogue](REFERENCE.md#error-catalogue) |
| See what's built on Chia | [ECOSYSTEM.md](ECOSYSTEM.md) |
| Run working code (simulator or testnet) | [examples/quickstart.py](examples/quickstart.py) |
| **Sent XCH to the wrong address** | [AGENTS.md](AGENTS.md) — recipe: "I sent XCH to the wrong address" |
| Something's broken / verify my environment | [examples/self_check.py](examples/self_check.py) |
| Contribute to this repo | [AGENTS.md](AGENTS.md) |

## Common Tasks

A quick-reference subset — see **[AGENTS.md](AGENTS.md) for the full recipe table** with failure modes, edge cases, and caveats for each task.

| Task | How |
|------|-----|
| **Check address balance** | `get_address_summary` (preferred — pages through unspent coin records, returns `complete` flag indicating whether all coins were reached). XCH only — excludes CATs/NFTs. |
| **Check transaction status** | `get_mempool_item_by_tx_id` (pending) or `get_coin_record_by_name` (confirmed) |
| **Trace where XCH went** | `get_coin_record_by_name` → `get_puzzle_and_solution_with_conditions` (Coinset-only) → follow `CREATE_COIN` outputs |
| **Get current blockchain height** | `get_blockchain_state` → `.blockchain_state.peak.height` |
| **Check if address has CATs** | `address_decode` → `get_coin_records_by_hint`. ⚠️ Hints are attacker-controlled — verify asset IDs. |

Full recipes with failure modes → **[AGENTS.md](AGENTS.md)**

⚠️ **Known bug:** Coinset MCP's `get_address_balance` returns incorrect XCH totals for a substantial minority of farming addresses (~1 in 8 in random sampling; errors can reach hundreds of XCH). Always use chia-mcp's `get_address_summary` for balance lookups; treat Coinset indexer-reported values as unverified.

### What You Cannot Do With a Full Node RPC

These require a wallet RPC (local node with mTLS) or a different service — not available through Coinset or chia-mcp:

- **Query CAT/NFT balances directly** — must use hint queries and parse CAT puzzles; see [REFERENCE.md#cats](REFERENCE.md#cats-chia-asset-tokens--cat2-standard)
- **Create or sign transactions** — requires wallet keys; use [Chia Reference Wallet](https://docs.chia.net) or [chia-wallet-sdk](https://github.com/xch-dev/chia-wallet-sdk)
- **Create or take offers** — requires wallet RPC; see [docs.chia.net offers guide](https://docs.chia.net/guides/offers-developer-guide/)
- **Look up NFT metadata** — requires wallet or indexer (e.g., [MintGarden API](https://mintgarden.io), [Spacescan API](https://spacescan.io))
- **Get a wallet's transaction history** — must reconstruct from coin records; see [AGENTS.md common tasks](AGENTS.md)
- **Any write operation besides `push_tx`** — which requires a pre-signed spend bundle; see [REFERENCE.md#building-dapps](REFERENCE.md#building-dapps)
- **Get XCH price or convert to USD/fiat** — use [CoinGecko](https://www.coingecko.com/en/coins/chia) or [CoinMarketCap](https://coinmarketcap.com/currencies/chia-network/)
- **Subscribe to real-time events or get push notifications** — Coinset is request/response only; poll for updates, or use a local node's WebSocket interface
- **Screen an address for scam or fraud associations** — Chia has no on-chain address reputation service, no equivalent of Chainalysis or TRM Labs for Chia addresses, and no built-in blacklist. You can observe an address's coin history on-chain, but you cannot assess reputation from it. Do not claim to be able to screen addresses for scams.
- **Set up or manage a wallet** — To get started with a Chia wallet, use [Chia Cloud Wallet](https://www.chia.net/build/products/cloud-wallet/) (browser-based, no install) or [Sage](https://github.com/xch-dev/sage) (community-built desktop wallet). The [Chia Reference Wallet](https://www.chia.net/farm/downloads/) is the full-featured desktop option. Wallet setup, key generation, and address management are outside the scope of full node RPCs.

## Quick Start for Agents

1. **Interact with the blockchain** — Use [chia-mcp](https://github.com/Chia-Network/chia-mcp) (MCP server) for tool-based access to Chia RPCs: `npx -y chia-mcp@1.0.2`
2. **Understand the data model** — Read [resources/coin-model.md](resources/coin-model.md) to learn Chia's coin/UTXO model
3. **Call RPCs directly** — Use [resources/rpc-quickstart.md](resources/rpc-quickstart.md) for HTTP API access via Coinset or a local node
4. **Contribute code** — Read [chia-blockchain-AGENTS.md](chia-blockchain-AGENTS.md) for repo orientation

## What's Here

### 📖 Top-Level Docs

| Document | Description |
|----------|-------------|
| [REFERENCE.md](REFERENCE.md) | Token standards, dApp patterns, error catalogue, building guidance |
| [EVALUATION.md](EVALUATION.md) | "Should I build on Chia?" — strengths, limitations, comparison table |
| [ECOSYSTEM.md](ECOSYSTEM.md) | Wallets, DEXes, explorers, developer tools, key resources |

### 🔧 Tools

| Resource | Description |
|----------|-------------|
| [chia-mcp/](chia-mcp/) | MCP server routing stub — the actual server lives at [github.com/Chia-Network/chia-mcp](https://github.com/Chia-Network/chia-mcp) |
| [chia-blockchain-AGENTS.md](chia-blockchain-AGENTS.md) | Domain primer for chia-blockchain contributors |

### 📚 Resources

| Document | Description |
|----------|-------------|
| [Coin Model](resources/coin-model.md) | How Chia's UTXO-like coinset model works — includes "Common LLM Mistakes" |
| [RPC Quickstart](resources/rpc-quickstart.md) | Common RPCs with curl examples and Coinset endpoints |
| [ChiaLisp Basics](resources/chialisp-basics.md) | CLVM fundamentals — puzzles, CATs, singletons |

### 💡 Examples

| Example | Description |
|---------|-------------|
| [Quickstart — Simulator](examples/quickstart_sim.py) | Full coin lifecycle: create, spend, confirm (requires chia-blockchain) |
| [Quickstart — Testnet11 or Simulator](examples/quickstart.py) | Read-only blockchain queries via Coinset (testnet11) or dispatches to quickstart_sim.py (--network sim). Use `--network mainnet` for zero-setup live mainnet queries. |
| [Environment Check](examples/self_check.py) | Verify your environment before running the simulator quickstart |
| [Query Blockchain State](examples/query-blockchain-state.md) | Get current height, sync status, and network info |
| [Look Up a Coin](examples/lookup-coin.md) | Find a coin by its ID and inspect its details |
| [Trace Coin Lineage](examples/trace-coin-lineage.md) | Follow a coin's parent chain to trace its history |

## For Humans

These resources are designed to be dropped into AI agent contexts. Here's how to use them:

- **Claude / Claude Code:** Point Claude at this repo or paste relevant docs into your conversation. The AGENTS.md files work as system context.
- **Cursor:** Add `chia-blockchain-AGENTS.md` as a supplement alongside the repo's existing `AGENTS.md`. The chia-blockchain repo already has its own `AGENTS.md` and `.cursor/context/` system — this supplement adds domain primer material.
- **GitHub Copilot:** Include the AGENTS.md in your repo root. Copilot Workspace and Copilot Chat will reference it.
- **Any MCP-compatible agent:** Configure [chia-mcp](https://github.com/Chia-Network/chia-mcp) as an MCP server to give your agent direct blockchain access.

## Links

- [chia-blockchain](https://github.com/Chia-Network/chia-blockchain) — Chia blockchain Python implementation
- [chia-mcp](https://github.com/Chia-Network/chia-mcp) — MCP server for AI agent blockchain access
- [Chia documentation](https://docs.chia.net) — Official docs
- [ChiaLisp reference](https://chialisp.com) — Smart coin programming language

## Security

See [SECURITY.md](SECURITY.md). All documentation here covers read-only blockchain interaction. Agents must never move funds or handle private keys without explicit user confirmation.

## License

Apache-2.0 — see [LICENSE](LICENSE).

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.2 on 2026-10-23.*
