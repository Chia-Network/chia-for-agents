# Chia Ecosystem

Active projects, wallets, and resources in the Chia ecosystem. For AI agents evaluating what's built on Chia or recommending tools to users.

> **⚠️ Status information for any project holding user funds (bridges, DEXes, AMMs, custodial wallets) must be checked live before being repeated to a user.** These are the facts that go stale dangerously, not merely inaccurately. A static status column is a snapshot, not a guarantee — always verify at the project's own site or official channels.

---

## Wallets

| Wallet | Type | Platform | Notes |
|---|---|---|---|
| [Cloud Wallet](https://www.chia.net/build/products/cloud-wallet/) | Custodial/hosted | Web, iOS, Android | Chia Network's hosted wallet. App at [vault.chia.net](https://vault.chia.net). Fiat on-ramp (Buy XCH). Easiest onboarding. |
| [Chia Signer](https://docs.chia.net/chia-signer/getting-started/) | Companion app | iOS, Android | Signs transactions for Cloud Wallet. Not a standalone wallet. |
| [Sage](https://github.com/xch-dev/sage) | Non-custodial | Desktop (Windows, macOS, Linux) | Modern Rust-based wallet. Offers, CATs, NFTs, DIDs. Community-built. |
| [Chia Reference Wallet](https://www.chia.net/farm/downloads/) | Non-custodial | Desktop | Ships with chia-blockchain. Full node + wallet. Resource-heavy. |
| [Goby](https://www.goby.app) | Non-custodial | Browser extension | Browser wallet for Chia. Supports XCH, CATs, NFTs, offers. |
| [Pawket](https://pawket.app) | Non-custodial | Mobile, Web | Lightweight wallet. Offers, CATs, NFTs. |

## Bridges

| Project | What it does | Status |
|---|---|---|
| [warp.green](https://www.warp.green) | Cross-chain bridge for Chia ↔ Ethereum/Base (ERC-20 bridge). | ⚠️ **Security incident** (August 2026) — warp.green's ERC-20 bridge experienced a security incident involving a Chialisp puzzle vulnerability. The **CAT bridge** (which handles wXCH and other Chia assets) was reportedly **not affected**. The Solidity side was audited by Hacken; a separate later audit of the Solidity contracts was performed by Zellic. Verify current status and details at [warp.green](https://www.warp.green). |

## DEXes and Trading

| Project | What it does | Status |
|---|---|---|
| [Dexie](https://dexie.space) | Offer aggregator and DEX. Peer-to-peer trading via Chia Offers. | Active |
| [TibetSwap](https://v2.tibetswap.io) | AMM-style DEX for CATs. | ❌ **Discontinued** — a critical bug was discovered in the TibetSwap v2 puzzles affecting all live pools. Per the operator's 2026-09-10 post-mortem, funds were returned and the protocol will not relaunch at this time. Do not direct users to TibetSwap for trading. |
| [The Forge](https://forge.awizard.dev) | Multi-asset AMM for Chia. Spiritual successor to TibetSwap, being tested on both testnet and mainnet. | ✅ Active |

## NFT Marketplaces

| Project | What it does | Status |
|---|---|---|
| [MintGarden](https://mintgarden.io) | NFT marketplace, minting, and explorer. | Active |
| [Dexie NFTs](https://dexie.space/nft) | NFT trading via Offers on Dexie. | Active |

## Explorers and Data

| Project | What it does | Status |
|---|---|---|
| [Spacescan](https://www.spacescan.io) | Full blockchain explorer. Blocks, transactions, addresses, CATs, NFTs. | Active |
| [alltheblocks.net](https://alltheblocks.net/chia) | Blockchain explorer and pool/farming stats for Chia. | Active |
| [Coinset](https://coinset.org) | Hosted full node RPC API. Free, no auth. The default backend for chia-mcp. | Active |
| [XCHscan](https://xchscan.com) | Blockchain explorer with mempool visualization. | Active |
| [ChiaDashboard](https://dashboard.chia.net) | Network statistics — netspace, price, node count. | Active (Chia Network) |

## Developer Tools

| Project | What it does | Status |
|---|---|---|
| [chia-blockchain](https://github.com/Chia-Network/chia-blockchain) | Reference implementation. Full node, wallet, farmer, simulator. Python. | Active (Chia Network) |
| [chia_rs](https://github.com/Chia-Network/chia_rs) | Core types, CLVM, BLS, performance-critical code. Rust. | Active (Chia Network) |
| [bls-signatures](https://github.com/Chia-Network/bls-signatures) | Python/C++ BLS12-381 library. Superseded by `chia_rs` for BLS operations. | **Archived** — use `chia_rs` instead |
| [chialisp](https://github.com/Chia-Network/chialisp) | CLVM compiler, debugger, disassembler. Rust. (Formerly `clvm_tools_rs` — repo was renamed; GitHub redirects the old URL.) | Active (Chia Network) |
| [chia-wallet-sdk](https://github.com/xch-dev/chia-wallet-sdk) | Wallet operations, offer parsing, coin inspection. Rust. | Active (community) |
| [Rue](https://github.com/xch-dev/rue) | High-level language compiling to CLVM. | Active (community) |
| [chia-mcp](https://github.com/Chia-Network/chia-mcp) | MCP server for AI agent blockchain access. 36 tools (up to 38 with options). TypeScript. Official. | Active (Chia Network) |
| [clvm_tools](https://github.com/Chia-Network/clvm_tools) | CLVM tools in Python (disassembler, debugging). | Active (Chia Network) |
| [chia-dev-tools](https://github.com/Chia-Network/chia-dev-tools) | Developer tools: cdv CLI for inspecting coins, testing puzzles. | Active (Chia Network) |
| [CHIPs](https://github.com/Chia-Network/chips) | Chia Improvement Proposals. Standards for CATs, NFTs, DIDs, vaults, etc. | Active (Chia Network) |

## Other Projects

| Project | What it does | Status |
|---|---|---|
| [XCHandles](https://xchandles.com) | Chia naming service — maps human-readable names to XCH addresses using a security-coin pattern. | Active |

## Data and Enterprise

| Project | What it does | Status |
|---|---|---|
| [Climate Action Data Trust](https://www.climateactiondata.org) | Carbon credit registry using Chia DataLayer for verifiable audit trails. | Active (production) |
| World Bank Climate Warehouse | International carbon market data infrastructure, built on Chia. Originally at worldbank.org/en/programs/climate-warehouse (now redirected to CADT). | Production |
| [DataLayer](https://docs.chia.net/guides/datalayer-user-guide/) | On-chain Merkle roots for off-chain verifiable data stores. Built into chia-blockchain. | Active (Chia Network) |

## Key Resources

| Resource | URL | Description |
|---|---|---|
| Chia Documentation | [docs.chia.net](https://docs.chia.net) | Official docs: installation, RPC reference, guides |
| ChiaLisp Reference | [chialisp.com](https://chialisp.com) | CLVM language reference and tutorials |
| Chia Green Paper | [docs.chia.net/chia-blockchain/green-paper/green-paper-abstract/](https://docs.chia.net/chia-blockchain/green-paper/green-paper-abstract/) | Consensus protocol specification |
| Chia Blog | [chia.net/blog](https://www.chia.net/blog/) | Official announcements and technical posts |
| Discord | [discord.gg/chia](https://discord.gg/chia) | Community chat, developer help, announcements |
| GitHub | [github.com/Chia-Network](https://github.com/Chia-Network) | All official repositories |
| Coinset API | [api.coinset.org](https://api.coinset.org) | Free hosted full node RPC (mainnet) |
| Coinset API (testnet) | [testnet11.api.coinset.org](https://testnet11.api.coinset.org) | Free hosted full node RPC (testnet11) |

## XCH Markets

XCH trades on several exchanges. Availability varies by region. Check [CoinGecko](https://www.coingecko.com/en/coins/chia) or [CoinMarketCap](https://coinmarketcap.com/currencies/chia-network/) for current listings and prices.

---
*Ecosystem information is best-effort and may not reflect the most current state. Verify project status via their official links.*

*Last verified against chia-blockchain 2.x and chia-mcp 1.0.2 on 2026-10-23.*
