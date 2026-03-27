# Architecture Overview

## System Layers

```
┌─────────────────────────────────────────────────────────────────────┐
│                     EXTERNAL NETWORKS                               │
│              Ethereum · Base · Solana · Other EVMs                  │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ EIP-712 / Ed25519 cross-chain proofs
┌──────────────────────────▼──────────────────────────────────────────┐
│                   RELAY DEPOSITORY LAYER                            │
│         DongChainDepository contract (non-upgradable)               │
│         MPC Allocator · Solver Network · EIP-712 settlement         │
└──────────────────────────┬──────────────────────────────────────────┘
                           │ XCM messages
┌──────────────────────────▼──────────────────────────────────────────┐
│                 DONG CHAIN — LAYER 1 (PARACHAIN)                    │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │              SMART CONTRACT EXECUTION                        │   │
│  │    pallet-revive · PolkaVM (RISC-V) · REVM (EVM compat)    │   │
│  │    resolc compiler · Solidity/Rust/C/C++ → RISC-V           │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │             ACCOUNT ABSTRACTION (ERC-4337)                   │   │
│  │    EntryPoint · Bundler · Paymaster · Smart Accounts        │   │
│  │    Session Keys · P-256 biometric · Multi-sig               │   │
│  └─────────────────────────────────────────────────────────────┘   │
│                                                                     │
│  ┌─────────────────────────────────────────────────────────────┐   │
│  │               SUBSTRATE RUNTIME (FRAME)                      │   │
│  │    Balances · Governance · Timestamp · XCM · Cumulus        │   │
│  └─────────────────────────────────────────────────────────────┘   │
└──────────────────────────┬──────────────────────────────────────────┘
                           │
               ┌───────────┴───────────┐
               │ BitVM2 Bridge         │ XCM to Polkadot
               │ (1-of-n honesty)      │ Parachains
               │ SNARK fraud proofs    │
               └───────────┬───────────┘
                           │
┌──────────────────────────▼──────────────────────────────────────────┐
│                   LAYER 0 — MOTHERBOARD                             │
│                                                                     │
│  ┌─────────────────────────┐  ┌────────────────────────────────┐   │
│  │  Bitcoin Core (PoW)     │  │  OmniCore                      │   │
│  │  txindex=1              │  │  OP_RETURN metadata             │   │
│  │  UTXO state             │  │  RWA token registry             │   │
│  │  6-block finality       │  │  Layer B/C encoding             │   │
│  └─────────────────────────┘  └────────────────────────────────┘   │
│                                                                     │
│  ┌───────────────────────────────────────────────────────────────┐  │
│  │  ZK Finality Anchoring                                        │  │
│  │  RISC Zero zkVM → zk-STARK proof → BitVM payload → Bitcoin   │  │
│  └───────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | Technology |
|---|---|---|
| Bitcoin Core | PoW security, UTXO settlement | Bitcoin Core v25+ |
| OmniCore | RWA asset tokenization registry | OmniCore (txindex=1) |
| BitVM2 Bridge | Trust-minimized BTC↔Dong Chain bridge | BitVM2, Taproot, SNARK |
| Relay Chain | Shared security, block validation | Polkadot SDK (Substrate) |
| Collator Nodes | Block production, PoV generation | Cumulus |
| pallet-revive | RISC-V smart contract execution | PolkaVM + REVM |
| pallet-revive-eth-rpc | Ethereum-compatible JSON-RPC | Substrate JSON-RPC |
| resolc | Solidity → RISC-V compiler | resolc (Parity) |
| ERC-4337 EntryPoint | Smart Account transaction hub | Solidity (non-upgradable) |
| Bundler | UserOperation aggregation | Node.js / Rust |
| Paymaster | Gas sponsorship | Solidity |
| DongChainDepository | Cross-chain liquidity vault | Solidity (non-upgradable) |
| MPC Allocator | Cross-chain proof signing | Multi-Party Computation |
| Solver Network | Instant cross-chain order filling | Off-chain agents |
| RISC Zero zkVM | ZK batch proof generation | RISC Zero |

## Data Flow: RWA Asset Full Lifecycle

```
[Institution] → omni_sendissuancefixed → [Bitcoin L0: OP_RETURN]
                                                │
                                    [BitVM2 peg-in lock]
                                                │
                                    [Oracle confirms: 6 BTC blocks]
                                                │
                                    [Dong Chain: mint wrapped asset]
                                                │
                                    [RISC-V smart contract interaction]
                                    (AMM, lending, compliance logic)
                                                │
                                    [Cross-chain: Relay Depository]
                                                │
                    ┌───────────────────────────┼────────────────────────────┐
                    │                           │                            │
             [Ethereum DeFi]            [Solana ecosystem]          [Other Parachain]
                    │                           │                            │
                    └───────────────────────────┴────────────────────────────┘
                                                │
                                    [ZK-STARK batch proof]
                                                │
                                    [Bitcoin L0 finality anchor]
```

## Network Topology

```
                    ┌─────────────────┐
                    │   Relay Chain   │ (Polkadot or custom)
                    │   Validators    │
                    └────────┬────────┘
                             │ Cumulus / XCMP
           ┌─────────────────┼─────────────────┐
           │                 │                 │
    ┌──────▼──────┐  ┌───────▼───────┐  ┌─────▼────────┐
    │ Dong Chain  │  │  DeFi Para    │  │  Gaming Para  │
    │ (Main Para) │  │  (AMM, LP)    │  │  (NFT, Items) │
    └──────┬──────┘  └───────────────┘  └──────────────┘
           │
           │ BitVM2 Bridge
           │
    ┌──────▼──────┐
    │  Bitcoin L0  │
    │  + OmniCore  │
    └─────────────┘
```

## Security Model Summary

| Threat | Protection |
|---|---|
| 51% attack on Dong Chain | Inherited from Relay Chain validator set |
| Bitcoin reorg (< 6 blocks) | Peg-in waits for 6-block confirmation |
| BitVM2 operator collusion | 1-of-n liveness: only 1 honest operator needed |
| Depository contract upgrade | Non-upgradable; no proxy patterns |
| Replay attack on cross-chain proof | EIP-712 domain separator + nonce |
| Invalid EIP-712 signature | ecrecover verification vs. MPC_ALLOCATOR |

## Further Reading

- [Layer 0 — Bitcoin & OmniCore](./01-layer0-bitcoin.md)
- [BitVM2 Bridge](./02-bitvm2-bridge.md)
- [Substrate Parachain](./03-substrate-parachain.md)
- [RISC-V Execution VM](./04-risc-v-vm.md)
- [XCM Messaging](./05-xcm-messaging.md)
- [Depository & Relay Protocol](./06-depository-relay.md)
- [ZK Integration](./07-zk-integration.md)
