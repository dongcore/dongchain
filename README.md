# Dong Chain — Technical Wiki

> **Multi-task Layer-1 Blockchain for Real-World Assets & Gaming Digital Assets**
>
> Bitcoin-secured · RISC-V powered · Substrate/Polkadot native · EVM compatible

---

## What is Dong Chain?

Dong Chain is a Layer-1 Substrate Parachain that positions Bitcoin (via OmniCore) as an immutable Layer-0 settlement layer and replaces EVM/WASM with a **RISC-V instruction set architecture** for smart contract execution. It supports:

- **RWA Tokenization** — Real-world assets minted on Bitcoin via OmniCore, bridged through BitVM2
- **Gaming Digital Assets** — ERC-721/ERC-1155 NFTs representing in-game sovereignty, items, and characters, compiled to RISC-V for throughput-grade performance
- **Gasless UX** — ERC-4337 Account Abstraction with Paymaster sponsorship
- **Cross-chain Liquidity** — Relay Depository model with MPC Allocators and instant Solvers

---

## Documentation Index

### Formal Specifications

| Document | Description |
|---|---|
| [Yellow Paper](./yellow-paper/dong-chain-yellow-paper.md) | Formal technical specification — cryptographic primitives, state machine, tokenomics |
| [Product Requirements (PRD)](./specs/prd.md) | Vision, target audience, user stories |
| [Software Requirements (SRS)](./specs/srs.md) | Functional & non-functional requirements |

### Architecture

| Document | Description |
|---|---|
| [System Overview](./docs/architecture/00-overview.md) | Full layer diagram, component relationships |
| [Layer 0 — Bitcoin & OmniCore](./docs/architecture/01-layer0-bitcoin.md) | Bitcoin PoW settlement, OmniCore asset tokenization |
| [BitVM2 Bridge](./docs/architecture/02-bitvm2-bridge.md) | Trust-minimized peg-in/peg-out protocol |
| [Substrate Parachain](./docs/architecture/03-substrate-parachain.md) | Substrate SDK, Cumulus, Relay Chain shared security |
| [RISC-V Execution VM](./docs/architecture/04-risc-v-vm.md) | pallet-revive, PolkaVM, resolc compiler toolchain |
| [XCM Messaging](./docs/architecture/05-xcm-messaging.md) | Cross-consensus messaging, XCMP/HRMP |
| [Depository & Relay Protocol](./docs/architecture/06-depository-relay.md) | Cross-chain liquidity, Solver/Allocator mechanics |
| [ZK Integration](./docs/architecture/07-zk-integration.md) | zk-STARKs, RISC Zero zkVM, Bitcoin finality proofs |

### Getting Started (Dev Team)

| Document | Description |
|---|---|
| [Prerequisites](./docs/getting-started/01-prerequisites.md) | Hardware, software, knowledge requirements |
| [Environment Setup](./docs/getting-started/02-environment-setup.md) | Rust, Substrate, resolc toolchain installation |
| [Node Setup](./docs/getting-started/03-node-setup.md) | Bitcoin/OmniCore node, Substrate parachain node |
| [Quickstart](./docs/getting-started/04-quickstart.md) | Deploy first contract end-to-end |

### Component Deep-Dives

| Document | Description |
|---|---|
| [OmniCore Node](./docs/components/omnicore-node.md) | Node configuration, RPC interface, asset issuance |
| [pallet-revive](./docs/components/pallet-revive.md) | RISC-V runtime module, gas metering, dual backend |
| [ERC-4337 Account Abstraction](./docs/components/erc4337-account-abstraction.md) | EntryPoint, Bundler, Paymaster deployment |
| [Depository Contract](./docs/components/depository-contract.md) | Contract interface, signature verification logic |

### Smart Contracts

| Document | Description |
|---|---|
| [Solidity → RISC-V](./docs/smart-contracts/solidity-to-riscv.md) | resolc compiler workflow, optimization flags |
| [Token Standards](./docs/smart-contracts/token-standards.md) | ERC-20, ERC-721, ERC-1155 on RISC-V |
| [Deployment Guide](./docs/smart-contracts/deployment-guide.md) | Deploy contracts via Hardhat/Foundry |

### Use Cases

| Document | Description |
|---|---|
| [RWA Tokenization](./docs/use-cases/rwa-tokenization.md) | Real-world asset lifecycle end-to-end |
| [Gaming Assets](./docs/use-cases/gaming-assets.md) | In-game sovereignty NFTs, gaming industry integration |

### Security

| Document | Description |
|---|---|
| [Security Model](./docs/security/security-model.md) | Trust assumptions, threat model, attack vectors |
| [Audit Checklist](./docs/security/audit-checklist.md) | Pre-deployment security checklist |

---

## Quick Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                   CROSS-CHAIN LAYER                         │
│         Relay.link Depository · MPC Allocators · Solvers    │
│              (EVM chains, Solana, external networks)        │
└────────────────────────┬────────────────────────────────────┘
                         │ EIP-712 / Ed25519
┌────────────────────────▼────────────────────────────────────┐
│                 DONG CHAIN (Layer 1)                        │
│    Substrate Parachain · pallet-revive · PolkaVM (RISC-V)  │
│    ERC-4337 · XCM · ERC-20/721/1155 via resolc compiler    │
└────────────────────────┬────────────────────────────────────┘
                         │ BitVM2 (1-of-n liveness honesty)
┌────────────────────────▼────────────────────────────────────┐
│               LAYER 0 — MOTHERBOARD                        │
│         Bitcoin PoW · OmniCore · OP_RETURN metadata        │
│         Immutable RWA Registry · UTXO state tracking       │
└─────────────────────────────────────────────────────────────┘
```

---

## Tech Stack At a Glance

| Layer | Technology |
|---|---|
| Settlement | Bitcoin Core + OmniCore (txindex=1) |
| Bridge | BitVM2 (SNARK fraud proofs, 1-of-n honesty) |
| Consensus framework | Polkadot SDK (Substrate) + Cumulus |
| Smart contract VM | RISC-V ISA via pallet-revive / PolkaVM |
| EVM compatibility | REVM backend + pallet-revive-eth-rpc |
| Solidity compiler | resolc → PVM bytecode (via LLVM/Yul IR) |
| Account abstraction | ERC-4337 (EntryPoint, Bundler, Paymaster) |
| Cross-chain | XCM/XCMP + Relay Depository (EIP-712) |
| ZK proofs | RISC Zero zkVM, zk-STARKs → Bitcoin finality |
| Languages | Solidity, Rust, C, C++, JavaScript (all → RISC-V) |

---

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for how to join development, propose changes, and run the local dev environment.

## License

Apache 2.0 — Open source, multi-party development welcome.
