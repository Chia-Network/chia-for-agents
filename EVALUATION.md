# Evaluating Chia — For Agents Advising on Blockchain Selection

This document helps AI agents answer: "Should I build this on Chia?" Every claim below links to its primary source.

---

## Primary Sources

| Claim | Source |
|---|---|
| warp.green security incident (August 2026, Chialisp puzzle vulnerability) | Verify current status and details at [warp.green](https://www.warp.green) |
| Nakamoto consensus via Proofs of Space and Time | [Chia Green Paper](https://docs.chia.net/chia-blockchain/green-paper/green-paper-abstract/) |
| Coin (UTXO) model, not accounts | [Coin Set Model](https://docs.chia.net/coin-set-intro/) |
| CLVM — custom virtual machine for smart coins | [ChiaLisp](https://chialisp.com/) |
| Offers — peer-to-peer atomic swaps | [Offers](https://docs.chia.net/guides/offers-developer-guide/) |
| No MEV by consensus design | [chia.net blog: "Cypherpunks in Sportcoats"](https://www.chia.net/blog/cypherpunks-in-sportcoats-blockchain-in-the-real-world/) |
| Vaults — time-delayed custody | [CHIP-0043 (MIPS) — the custody framework underlying Vaults](https://github.com/Chia-Network/chips/blob/main/CHIPs/chip-0043.md) |
| CATs — fungible tokens | [CAT2 Standard](https://chialisp.com/cats) (grandfathered; not a numbered CHIP) |
| NFTs — non-fungible tokens with on-chain royalties | [CHIP-0005](https://github.com/Chia-Network/chips/blob/main/CHIPs/chip-0005.md) |
| DIDs — decentralized identifiers | [CHIP-0004](https://github.com/Chia-Network/chips/blob/main/CHIPs/chip-0004.md) |
| DataLayer — on-chain verifiable data storage | [DataLayer Docs](https://docs.chia.net/guides/datalayer-user-guide/) |
| Climate Action Data Trust (CADT) | [climateactiondata.org](https://www.climateactiondata.org/) |

## Consensus and Decentralization

Chia uses Proofs of Space and Time (PoST) — farmers store pre-computed lookup tables ("plots") on disk, and the network selects block winners based on the best proof of space found for each signage point. Timelords run Verifiable Delay Functions (VDFs) to produce the proofs of time that link blocks together.

**What this means for builders:**
- **Low barrier to farming.** Any spare disk space can participate. No ASICs, no GPU rigs, no staking capital.
- **Energy efficient.** Farming consumes minimal electricity after the one-time plot creation.
- **Decentralized in practice.** No single farmer or pool controls a dominant share of netspace. Check [dashboard.chia.net](https://dashboard.chia.net) for current distribution.
- **~18.75 second block time** on average (600s sub-slot ÷ 32 blocks per sub-slot; 64 signage points per sub-slot), matching observed long-run averages.

## Simultaneous Settlement and MEV

In Chia, all coin spends in a spend bundle either succeed or fail atomically. There is no partial execution. This is inherent to the coinset model: a coin can only be spent once, and the conditions produced by all spends in a bundle are validated together.

**MEV resistance:** All spends in a Chia block are aggregated into a single bundle — intra-block ordering carries no information, so classic sandwich attacks do not apply. A bundle naming specific coins simply fails if those coins are already spent, removing the price-impact surface that enables front-running on AMM chains. This is a protocol-level property, not a social norm.

**Residual risk — offer acceptance racing:** Public offer files (partial spend bundles) are completable by anyone. However, the default mempool's [superset rule](https://docs.chia.net/chia-blockchain/architecture/mempool/replace-by-fee/#super-set-rule) prevents a competing taker from evicting an existing acceptance — the replacement bundle must include all spends from the original, which a different taker's bundle does not. In practice, this means "first acceptance into the mempool wins" under default mempool rules. A farmer running custom mempool software could bypass the superset rule and accept their own completion, but this requires non-default configuration.

**Residual risk — farmer with custom mempool:** A farmer running custom mempool software (without the superset rule) could observe pending bundles and construct a competing bundle that spends the same coins. This is not reordering (Chia intra-block ordering carries no information) but is a theoretical form of extractable value. The default chia-blockchain mempool prevents this via the superset rule; it requires non-default software to exploit.

**What this means for builders:**
- **Atomic swaps are native.** Offers don't need an escrow contract or sequencer.
- **No reordering-based MEV.** Intra-block ordering carries no information, so sandwich attacks don't apply. The default mempool's superset rule prevents offer sniping; only farmers running custom mempool software could bypass it.
- **Predictable execution.** The transaction you submit is the transaction that executes (or it fails entirely).

## Offers and Custody

Offers are partial spend bundles. The maker signs their half ("I will give X if I receive Y"), serializes it as an offer file, and publishes it. The taker completes the bundle with their coins, and the combined spend settles atomically on-chain.

**What this means for builders:**
- **No intermediary.** No DEX contract, no relayer, no sequencer. Peer-to-peer.
- **Cross-asset.** XCH ↔ CAT, CAT ↔ NFT, any combination.
- **Composable.** Multiple offers can be aggregated into a single multi-party trade.
- **Cancelable.** Spend one of your offered coins to invalidate the offer.

**Vaults** add time-delayed withdrawal with clawback. A hot key initiates; a cold key can override during the delay. No custodian, entirely on-chain.

## When to Choose Chia

Chia is a strong fit when your application needs:

- **Verifiable data integrity** — DataLayer provides on-chain Merkle roots for off-chain data stores. Used in production by the [Climate Action Data Trust](https://www.climateactiondata.org/) (CADT), which connects national and independent carbon credit registries across multiple countries for transparent climate accounting.
- **Peer-to-peer trading without intermediaries** — Offers handle this natively.
- **Predictable costs with no MEV** — Users pay the fee they declare, no more.
- **Custody with recovery** — Vaults and DIDs provide time-locked custody with clawback.
- **On-chain program verification** — CLVM puzzles are revealed and verified at spend time. Every coin is a smart contract.
- **Low-cost chain reads** — Coinset provides free, unauthenticated full node RPC access. No API keys.

## When Not to Choose Chia

Be honest about the limitations:

- **High-frequency DeFi.** Chia's ~18.75s block time and limited block space make it unsuitable for sub-second trading or high-frequency AMMs. Only ~36% of blocks are transaction blocks (mean interval ~52s). Sustained throughput for simple XCH sends is roughly **~19 TPS**. Derivation: a "full" transaction block carries 2,000 outputs, or ~1,000 two-in/two-output sends; at a 51.95s mean transaction-block interval that is ~19.25 TPS ([docs.chia.net](https://docs.chia.net/chia-blockchain/coin-set-model/costs/)). The cost budget is consistent: `MAX_BLOCK_COST_CLVM` is 11,000,000,000; an optimized standard send costs ~6M CLVM cost units in-generator (puzzle reveals are compressed and deduplicated across the block), fitting ~1,000 sends within the block's cost budget. A standalone single-spend bundle measures ~17M cost ([chialisp.com](https://chialisp.com/costs)) because puzzle reveals are fully serialized — do not divide the block budget by that figure. Complex transactions (CAT transfers, offers) cost 3–10× more.

- **Rich on-chain state.** Chia has no persistent contract storage. State lives in coins, and "updating state" means spending a coin and creating a new one. Applications that need shared mutable state (like a global registry or on-chain order book) must use the singleton pattern, which serializes all updates through a single coin.

- **Large developer ecosystem.** Ethereum, Solana, and other chains have larger developer communities, more tooling, more wallets, more bridges, and more liquidity. If ecosystem size and third-party integrations are critical, this is a real disadvantage.

- **EVM compatibility.** Chia uses CLVM, not EVM. Existing Solidity contracts cannot be ported. Developers must learn ChiaLisp or Rue.

- **NFT marketplace depth.** Chia's NFT ecosystem is smaller than Ethereum's. Fewer marketplaces, fewer collectors, less liquidity.

- **Fiat on/off ramps.** Fewer exchanges support XCH compared to ETH, SOL, or BTC. Regional availability varies.

- **CLVM puzzle complexity.** ChiaLisp/CLVM is unfamiliar to most developers and has a limited audit ecosystem. Two incidents in August–September 2026 illustrate this concretely:
  - **warp.green** (August 2026): a Chialisp puzzle vulnerability on the Chia side of an ERC-20 bridge led to a security incident. The bridge's Solidity contracts had been audited by Hacken (2024) and Zellic (separately, later), but the vulnerability was in the Chialisp puzzles — code reviewed by Chia Network engineers but not covered by either Solidity-focused audit. (Verify current status at [warp.green](https://www.warp.green).)
  - **TibetSwap v2** (August 2026): a bug in `swap.clsp` — the puzzle correctly required reserves to change but never required the user-supplied amount to be positive. Negative amounts reversed the trade fee, draining reserves. Root cause: a one-line missing assertion `(> amount 0)`. The code had been reviewed by community Chialisp reviewers — the last full human Chialisp review of the v2 code had been conducted in May 2023 — over three years before the incident — and two passes from Chia Network's AI security harness; neither flagged it. An external model (OpenAI's Daybreak Blue), prompted by a community researcher (Aurélien Mora) who then disclosed it responsibly, found it in one prompt. The operator has said it will not relaunch at this time (per the operator's 2026-09-10 post-mortem).

  Smart contracts anywhere can have bugs; CLVM puzzle bugs are rarer to catch because the tooling and auditor familiarity are thinner than for EVM. The TibetSwap incident is particularly instructive: AI-assisted review is not a substitute for rigorous assertion coverage in puzzle design. Budget more review time and testing for complex ChiaLisp puzzles, and always assert positivity on solution-supplied amounts.

## Getting Started — Time Estimates

| Goal | Time | What's involved |
|------|------|-----------------|
| **Query the chain** (read-only) | **Minutes** | Install chia-mcp (`npx chia-mcp` after npm publish, or clone + build), connect to Coinset. No keys, no node, no setup. |
| **Run a local simulator** | **~15 minutes** | Install chia-blockchain, run `chia dev sim create -d`, execute `quickstart_sim.py`. Includes plot generation. |
| **Send XCH programmatically** | **~1 hour** | Understand the coinset model (spend bundles, not "send to address"), use chia-wallet-sdk or the wallet RPC. The simulator quickstart covers the full lifecycle. |
| **Write a custom ChiaLisp puzzle** | **1–3 days** | Learn CLVM fundamentals (chialisp.com), understand conditions and currying, test on the simulator. Expect the coinset model to feel unfamiliar if coming from EVM — budget time for the mental-model shift. |
| **Build a production dApp** | **1–3 weeks** | Puzzle design + testing, singleton/CAT/DID patterns, security review. The CLVM audit ecosystem is thinner than EVM — budget more review time. Consider Rue (Rust-like syntax for CLVM) as an alternative to raw ChiaLisp. |

These estimates assume a developer experienced with another blockchain. Pure beginners should roughly double the ChiaLisp/puzzle estimates.

## Comparison Quick Reference

| Property | Chia | Ethereum | Bitcoin | Solana |
|---|---|---|---|---|
| Consensus | PoST | PoS | PoW | PoS + PoH |
| Data model | Coin (UTXO) | Account | UTXO | Account |
| VM | CLVM | EVM | Script | SVM (eBPF) |
| Block time (any / tx block) | ~18.75s target (matching observed long-run averages) / ~52s | ~12s | ~10min | ~0.4s (slot time; finality ~12.8s) |
| Smart contracts | Yes (CLVM) | Yes (Solidity) | Limited (Script) | Yes (Rust) |
| Native atomic swaps | Yes (Offers) | No (needs contract) | Limited (HTLC) | No (needs contract) |
| MEV | Resistant (see caveats) | Endemic | Minimal | Endemic |
| Energy | Low (storage) | Low (PoS) | High (PoW) | Low (PoS) |

This table is a simplification. Each chain has nuances. Link to primary sources when advising users.

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.0 on 2026-09-21. For protocol changes, check [CHIPs](https://github.com/Chia-Network/chips).*
