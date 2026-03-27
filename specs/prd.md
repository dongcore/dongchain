# Product Requirements Document (PRD)
## Dong Chain — Multi-task Blockchain for RWA & Gaming Assets

**Version:** 1.0
**Status:** Approved for Development
**Last Updated:** 2026-03-27

---

## 1. Product Vision

**Dong Chain is the optimal asset tokenization engine** — combining Bitcoin's immutability with RISC-V hardware processing speed.

The product solves three core problems:
1. **Liquidity fragmentation** — assets locked in silos cannot move across chains without centralized custodians
2. **Gas complexity** — Web2 users cannot deal with gas tokens, private keys, and multi-wallet management
3. **Gaming asset centralization** — game publishers control player assets; no true sovereignty

Dong Chain delivers Web2 experience to Web3 users while maintaining Web3-grade security through Bitcoin settlement.

---

## 2. Target Audiences

### 2.1 Financial Organizations & RWA Projects
**Profile:** Banks, real estate funds, commodity traders, regulated issuers
**Need:** Tokenize real-world assets on a secure, auditable network with complex programmable logic
**Value:** Bitcoin L0 immutability for issuance + RISC-V smart contracts for AMMs, lending, compliance logic

### 2.2 Web3 / DeFi Users
**Profile:** Crypto-native users who interact with DeFi protocols
**Need:** Gasless transactions, no private key management complexity, instant cross-chain transfers
**Value:** ERC-4337 Account Abstraction + Relay Depository instant cross-chain

### 2.3 Blockchain Developers
**Profile:** Solidity developers, Rust/WASM substrate developers
**Need:** Reuse existing code (OpenZeppelin), familiar tooling (Foundry, Hardhat, Metamask)
**Value:** resolc compiles existing Solidity to RISC-V; 100% Ethereum JSON-RPC compatible

### 2.4 Game Studios & Gaming Users
**Profile:** Web3 game developers, competitive gaming communities
**Need:** High-throughput NFT minting/trading, cross-game asset portability, player sovereignty
**Value:** ERC-721/1155 on RISC-V (speed), ERC-6551 token-bound accounts, session keys for UX

---

## 3. Key Features & User Stories

### Feature 1: Gas Abstraction via ERC-4337 Account Abstraction

**Goal:** Users transact without owning native DONG tokens

**User Stories:**
- As a **new user**, I want to sign up with FaceID/Google and immediately mint an NFT without topping up a gas wallet
- As a **game studio**, I want to sponsor all gas fees for my players so they never leave the game interface to manage crypto
- As a **RWA investor**, I want to pay transaction fees in the same stablecoin I use to purchase assets

**Acceptance Criteria:**
- [ ] EntryPoint contract deployed on Dong Chain (non-upgradable)
- [ ] Paymaster supports: (a) sponsor mode, (b) ERC-20 token payment mode
- [ ] Bundler node operational and aggregating UserOperations
- [ ] Smart Account factory supports: ECDSA, P-256 (biometric), multi-sig
- [ ] Gasless flow works end-to-end via Hardhat/Foundry test

---

### Feature 2: Multi-Standard Smart Contracts on RISC-V

**Goal:** Full ERC-20/721/1155 support compiled to RISC-V for maximum throughput

**User Stories:**
- As a **developer**, I want to compile my existing ERC-1155 Solidity contract to RISC-V without rewriting code
- As a **game studio**, I want to batch-transfer 1000 in-game items in a single transaction
- As a **RWA issuer**, I want to deploy a compliant ERC-20 token representing tokenized real estate shares

**Acceptance Criteria:**
- [ ] resolc compiler successfully compiles OpenZeppelin ERC-20, ERC-721, ERC-1155
- [ ] pallet-revive executes compiled PVM bytecode correctly
- [ ] EVM-equivalent JSON-RPC enables Hardhat/Foundry/Metamask interaction
- [ ] Gas costs benchmarked and documented vs. equivalent EVM deployment

---

### Feature 3: Relay Depository Cross-Chain Payment

**Goal:** Instant cross-chain asset transfers without waiting for bridge finality

**User Stories:**
- As a **DeFi user**, I want to move USDC from Dong Chain to Ethereum in under 30 seconds
- As a **Solver**, I want to pre-advance capital on the destination chain and get reimbursed from the Depository
- As a **game player**, I want to sell my NFT character on Ethereum's OpenSea without waiting 30 minutes for a bridge

**Acceptance Criteria:**
- [ ] DongChainDepository deployed (non-upgradable) with `depositNative`, `depositErc20`, `execute`
- [ ] EIP-712 signature verification passes all test vectors
- [ ] Nonce replay protection verified via fuzzing
- [ ] MPC Allocator testnet operational with simulated Solver network
- [ ] End-to-end transfer Dong Chain → Ethereum < 60 seconds on testnet

---

### Feature 4: Bitcoin RWA Tokenization

**Goal:** Issue regulated real-world assets on Bitcoin L0 via OmniCore, bridge to Dong Chain

**User Stories:**
- As a **financial institution**, I want to issue tokenized treasury bonds on Bitcoin's immutable ledger
- As an **auditor**, I want to independently verify all token issuances via the Bitcoin blockchain explorer
- As a **user**, I want to use my Bitcoin-issued RWA tokens as collateral in DeFi protocols on Dong Chain

**Acceptance Criteria:**
- [ ] OmniCore node operational with txindex=1
- [ ] RWA token issuance via `omni_sendissuancefixed` documented and tested
- [ ] BitVM2 peg-in bridges token to Dong Chain with 1-of-n operator setup
- [ ] Wrapped token on Dong Chain is 1:1 backed by Bitcoin L0 state

---

### Feature 5: Gaming Asset Sovereignty

**Goal:** Player-sovereign in-game assets that exist independently of game servers

**User Stories:**
- As a **player**, I want my rare sword NFT to remain mine even if the game company shuts down
- As a **player**, I want to sell my character's entire inventory atomically in one transaction
- As a **game developer**, I want session keys so players don't need to approve every in-game action
- As a **player**, I want to use my character in multiple compatible games across different blockchains

**Acceptance Criteria:**
- [ ] ERC-721 character NFT deployed (no admin burn/transfer)
- [ ] ERC-1155 item contract with batch transfer
- [ ] ERC-6551 token-bound accounts linking characters to item inventory
- [ ] Session key module in Smart Account with selector + spend + expiry limits
- [ ] XCM transfer of ERC-721 to another Polkadot parachain demonstrated

---

## 4. Non-Goals (Out of Scope for v1.0)

- Building a custom consensus mechanism (uses Substrate's existing BABE/GRANDPA)
- Native mobile wallet (v1 targets web extension wallets + SDK)
- DEX AMM (can be built by community as a separate parachain)
- L2 on top of Dong Chain (deferred to post-mainnet)

---

## 5. Success Metrics (KPIs)

| Metric | Target (6 months post-mainnet) |
|---|---|
| Active addresses | 10,000+ |
| Daily transactions | 50,000+ |
| RWA assets tokenized | $10M+ total value |
| Gaming projects deployed | 3+ live games |
| Developer tooling adoption | 100+ GitHub stars on SDK |
| Cross-chain volume (Depository) | $1M+ monthly |
| Bridge security incidents | 0 |

---

## 6. Dependencies & Risks

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| pallet-revive instability | Medium | High | Pin to tested version; maintain REVM fallback |
| BitVM2 protocol changes | Low | High | Modular bridge design; monitor BitVM2 repo |
| resolc compiler security bug | Medium | Critical | Full audit before mainnet; slow rollout |
| MPC Allocator availability | Low | Medium | 5-of-9 MPC setup; geographic distribution |
| OmniCore node hardware cost | High | Medium | Cloud provider partnerships; light client research |
