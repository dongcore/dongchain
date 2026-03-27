---
layout: home

hero:
  name: "Dong Chain"
  text: "Bitcoin-Secured · RISC-V Powered"
  tagline: Multi-task Layer-1 Blockchain for Real-World Assets & Gaming Digital Asset Sovereignty
  image:
    src: /logo.svg
    alt: Dong Chain
  actions:
    - theme: brand
      text: Get Started →
      link: /docs/getting-started/01-prerequisites
    - theme: alt
      text: Yellow Paper
      link: /yellow-paper/dong-chain-yellow-paper
    - theme: alt
      text: Architecture Overview
      link: /docs/architecture/00-overview

features:
  - icon: ₿
    title: Bitcoin Layer-0 Security
    details: All assets anchored to Bitcoin's Proof-of-Work network via OmniCore. Zero consensus changes required — maximum censorship resistance.

  - icon: ⚡
    title: RISC-V Smart Contracts
    details: PolkaVM executes contracts at near-native hardware speed. Solidity compiles directly to RISC-V via resolc — 2-4x faster than EVM.

  - icon: 🌉
    title: BitVM2 Trust-Minimized Bridge
    details: 1-of-n liveness honesty model. Only one honest operator needed to keep funds safe. SNARK fraud proofs settled on Bitcoin.

  - icon: 🎮
    title: Gaming Asset Sovereignty
    details: ERC-721/1155 characters and items with no admin burn/transfer. Session keys for seamless gameplay. ERC-6551 character-owned inventory.

  - icon: 🏦
    title: RWA Tokenization
    details: Issue real-world assets (real estate, bonds, commodities) on Bitcoin L0 via OmniCore. Bridge to programmable RISC-V smart contracts.

  - icon: 🔗
    title: Instant Cross-Chain
    details: Relay Depository with Solver network — transfer assets across Ethereum, Base, and Solana in under 60 seconds via EIP-712 proofs.

  - icon: 👤
    title: Gasless UX (ERC-4337)
    details: Smart Account wallets with Paymaster sponsorship. FaceID/biometric via P-256. Session keys. Zero gas tokens needed for end users.

  - icon: 🔒
    title: ZK Bitcoin Finality
    details: RISC Zero zkVM batches 1000 blocks into a single zk-STARK proof anchored to Bitcoin — full security at fractional cost per user.
---

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/dongcore/dongchain
cd dongchain

# 2. Build the node
cargo build --release -p dong-chain-node

# 3. Start local dev node
./target/release/dong-chain-node --dev --tmp

# 4. Compile and deploy your first contract
resolc --target polkavm --optimization 3 MyContract.sol
forge create --rpc-url http://localhost:9944 --private-key $KEY MyContract.sol:MyContract
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│              EXTERNAL NETWORKS (Ethereum · Base · Solana)           │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ EIP-712 cross-chain proofs
┌───────────────────────────▼─────────────────────────────────────────┐
│           DONG CHAIN — LAYER 1 (Substrate Parachain)                │
│   pallet-revive · PolkaVM (RISC-V) · ERC-4337 · XCM · resolc       │
└───────────────────────────┬─────────────────────────────────────────┘
                            │ BitVM2 (1-of-n honesty)
┌───────────────────────────▼─────────────────────────────────────────┐
│              LAYER 0 — MOTHERBOARD                                  │
│        Bitcoin PoW · OmniCore · OP_RETURN · ZK finality             │
└─────────────────────────────────────────────────────────────────────┘
```

## Documentation Map

| Section | Description |
|---|---|
| [Yellow Paper](/yellow-paper/dong-chain-yellow-paper) | Formal technical specification with cryptographic proofs |
| [PRD](/specs/prd) | Product requirements, user stories, success metrics |
| [SRS](/specs/srs) | All functional & non-functional requirements |
| [Architecture](/docs/architecture/00-overview) | Layer-by-layer system design |
| [Getting Started](/docs/getting-started/01-prerequisites) | Dev environment setup guide |
| [Smart Contracts](/docs/smart-contracts/solidity-to-riscv) | Solidity → RISC-V compilation |
| [RWA Use Case](/docs/use-cases/rwa-tokenization) | Real-world asset lifecycle |
| [Gaming Use Case](/docs/use-cases/gaming-assets) | In-game sovereignty model |
| [Security](/docs/security/security-model) | Threat model & audit checklist |
