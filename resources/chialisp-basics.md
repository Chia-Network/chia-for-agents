# ChiaLisp Basics

ChiaLisp is the smart coin programming language for Chia. It compiles to CLVM (Chia Lisp Virtual Machine) bytecode that runs on-chain.

## What is CLVM?

CLVM is a minimal Lisp-like virtual machine. Every coin on Chia is locked by a CLVM program (called a **puzzle**). To spend a coin, you provide a **solution** — the puzzle runs with the solution as input and outputs a list of **conditions** that the blockchain enforces.

```
Puzzle(Solution) → Conditions
```

## S-Expression Syntax (ChiaLisp)

> **Note:** The examples below are **ChiaLisp** (high-level), not raw CLVM. ChiaLisp compiles to CLVM. In raw CLVM, unquoted atoms are environment path references, not literals, and `if` is the macro form of the `i` operator. Use `run` to evaluate ChiaLisp; use `brun` to evaluate raw CLVM.

CLVM uses s-expressions (like Lisp):

```clvm
; Atoms
100          ; integer
0xcafef00d   ; hex bytes
"hello"      ; string (converted to bytes)

; Pairs / Lists
(1 2 3)              ; list of three atoms
(+ 5 10)             ; function call: 5 + 10 = 15
(if (= x 1) "yes" "no")  ; conditional
```

### Core Operators

| Operator | Description |
|----------|-------------|
| `(q . X)` | Quote — return X literally |
| `(a P S)` | Apply — run program P with solution S |
| `(i C T E)` | If — if C then T else E |
| `(c A B)` | Cons — create pair (A . B) |
| `(f X)` | First — head of pair |
| `(r X)` | Rest — tail of pair |
| `(+ A B)` | Add |
| `(- A B)` | Subtract |
| `(* A B)` | Multiply |
| `(= A B)` | Equal |
| `(sha256 A B ...)` | SHA256 hash |
| `(concat A B ...)` | Concatenate bytes |

### Argument References

In CLVM, the solution is a binary tree. Arguments are referenced by position numbers:

- `1` — the entire solution tree
- `2` — first element (first argument)
- `3` — rest of the list
- `4` — first of first
- `5` — first of rest (second argument)
- `6` — rest of first
- `11` — first of rest of rest (third argument)

**Function argument sequence:** for a function `(mod (A B C D E) ...)`, the arguments map to: `2, 5, 11, 23, 47` — these are the 1st through 5th positional arguments. This sequence is the standard mnemonic for ChiaLisp programming.

ChiaLisp (the higher-level language) uses named parameters instead.

> **Pitfall:** `(i C T E)` (if-then-else) evaluates *both* branches before selecting one. For lazy evaluation, use: `(a (i C (q . T) (q . E)) 1)` — this is a classic first-week ChiaLisp trap.

## Standard Transaction Puzzle

The most common puzzle is `p2_delegated_puzzle_or_hidden_puzzle` — the standard transaction puzzle. It:

1. Verifies a BLS signature from the coin owner
2. Runs a delegated puzzle provided in the solution
3. The delegated puzzle produces the actual conditions (CREATE_COIN, etc.)

This is what a normal XCH wallet uses. The puzzle hash is derived from the owner's public key.

## CATs (Chia Asset Tokens)

CATs are fungible tokens on Chia. They work by wrapping an inner puzzle (usually the standard transaction puzzle) in a CAT layer:

```
CAT Puzzle
├── TAIL (Token and Asset Issuance Limiter) — defines token rules
└── Inner Puzzle — controls spending (usually standard tx puzzle)
```

- **TAIL** determines what the token is and who can mint/burn
- **CAT puzzle hash** = hash of the CAT wrapper + TAIL hash + inner puzzle hash
- CATs preserve their identity across spends — the CAT layer ensures tokens can't be created or destroyed except by the TAIL rules
- Each CAT is identified by its **asset ID** (the TAIL hash)

## Singletons

Singletons are unique, non-fungible coins. The singleton layer ensures:

- Exactly one coin with this singleton ID exists at any time
- When spent, it must create exactly one successor coin with the same singleton layer
- The singleton persists across spends (same launcher ID)

Used for:

| Use Case | Description |
|----------|-------------|
| **NFTs** | Non-fungible tokens — each NFT is a singleton with metadata |
| **DIDs** | Decentralized Identifiers — identity singletons |
| **DAOs** | Decentralized governance |
| **DataLayer** | On-chain data store roots |

### Singleton Structure

```
Singleton Puzzle
├── Launcher ID — unique identifier (coin ID of the launcher coin)
├── Launcher Puzzle Hash — identifies this as a singleton
└── Inner Puzzle — the actual logic (NFT metadata, DID info, etc.)
```

## Puzzle Layers

Chia puzzles are composable via "layers" — wrappers that add functionality:

```
Outer Layer (e.g., CAT or Singleton)
└── Middle Layer (e.g., NFT ownership)
    └── Inner Puzzle (e.g., standard transaction)
```

Each layer can enforce its own rules while delegating to the inner puzzle for spending logic.

## Currying (Partial Application)

Currying is how Chia puzzles are parameterized. It bakes constant arguments into a puzzle before it's locked into a coin.

```
curry(puzzle, constant_arg) → specialized_puzzle
```

The resulting specialized puzzle has the constant embedded in its bytecode — no runtime argument needed for it. This is how CAT puzzles encode the TAIL hash:

```
CAT_puzzle = curry(CAT_template, TAIL_hash, inner_puzzle)
```

Every CAT with the same TAIL hash has the same outer puzzle hash (modulo the inner puzzle). Currying is why:
- Two coins with the same CAT type but different inner puzzles have **different puzzle hashes**
- The asset ID (TAIL hash) can be extracted from a CAT puzzle by un-currying the template

`clvm_tools` provides `curry` and `uncurry` helpers. `chia-wallet-sdk` exposes Rust implementations.

## Announcements

Announcements are ephemeral messages between coin spends within the **same spend bundle**. They are not stored on-chain.

| Condition | Effect |
|-----------|--------|
| `CREATE_COIN_ANNOUNCEMENT msg` | This coin announces `msg` |
| `ASSERT_COIN_ANNOUNCEMENT coin_id + msg` | This spend requires coin `coin_id` to have announced `msg` |
| `CREATE_PUZZLE_ANNOUNCEMENT msg` | This coin's puzzle announces `msg` (bound to puzzle hash, not coin ID) |
| `ASSERT_PUZZLE_ANNOUNCEMENT puzzle_hash + msg` | Requires the given puzzle hash to have announced `msg` |

**Why they matter:**
- **Atomic coordination:** An offer works because the maker's coin announces a message, and the taker's spend asserts that announcement — both must succeed or both fail.
- **Spend ordering:** Announcements create dependencies between spends in the same bundle.
- **Not storage:** Announcements cannot be read by future coins. They exist only during bundle validation.

## Where to Learn More

- **[chialisp.com](https://chialisp.com)** — ChiaLisp language reference, tutorials, and guides
- **[docs.chia.net](https://docs.chia.net)** — Official Chia documentation including primitives (CATs, NFTs, DIDs)
- **[chia-blockchain](https://github.com/Chia-Network/chia-blockchain)** — Reference implementation
- **[chialisp](https://github.com/Chia-Network/chialisp) (formerly clvm_tools_rs)** — CLVM compiler and tools (Rust)
- **[chia_rs](https://github.com/Chia-Network/chia_rs)** — Core Chia types and CLVM runtime (Rust)

---
*Last verified against chia-blockchain 2.x and chia-mcp 1.0.0 on 2026-09-21.*
