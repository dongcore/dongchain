# Software Requirements Specification (SRS)
## Dong Chain — Technical Requirements

**Version:** 1.0
**Status:** Baseline
**Last Updated:** 2026-03-27

---

## 1. Introduction

### 1.1 Purpose

This SRS defines all functional and non-functional requirements for Dong Chain developers. It serves as the authoritative reference for sprint planning, technical design decisions, and acceptance testing.

### 1.2 Scope

This document covers:
- Bitcoin/OmniCore Layer-0 integration
- Substrate Parachain runtime
- RISC-V smart contract execution environment (pallet-revive)
- ERC-4337 Account Abstraction framework
- BitVM2 bridge protocol
- Relay Depository cross-chain protocol
- ZK proof integration

### 1.3 Definitions

| Term | Definition |
|---|---|
| PVM | PolkaVM — RISC-V virtual machine by Parity Technologies |
| REVM | Rust EVM — Ethereum Virtual Machine for backward compatibility |
| resolc | Revive Solidity compiler → PVM bytecode |
| UserOperation | ERC-4337 transaction object for Smart Accounts |
| Bundler | Node that aggregates UserOperations and submits to EntryPoint |
| Paymaster | Contract that sponsors gas fees |
| Solver | Liquidity agent that fills cross-chain orders instantly |
| MPC Allocator | Multi-Party Computation committee that signs cross-chain proofs |
| Collator | Substrate node that produces parachain blocks |
| PoV | Proof-of-Validity — block validity proof submitted to Relay Chain |

---

## 2. Functional Requirements

### FR1 — Layer-0: Bitcoin & OmniCore Integration

#### FR1.1 Bitcoin Full Node
- **REQ-1.1.1:** The system MUST run Bitcoin Core with `txindex=1` enabled
- **REQ-1.1.2:** The node MUST expose JSON-RPC on port 8332 (default)
- **REQ-1.1.3:** The node MUST stay synchronized within 1 block of the chain tip at all times
- **REQ-1.1.4:** Initial synchronization MUST complete before OmniCore parsing begins

#### FR1.2 OmniCore Integration
- **REQ-1.2.1:** OmniCore MUST parse all Layer B (multisig) and Layer C (OP_RETURN) transactions
- **REQ-1.2.2:** Asset issuance MUST be performed via `omni_sendissuancefixed` JSON-RPC call
- **REQ-1.2.3:** The system MUST expose OmniCore state queries: balance, ownership, property info
- **REQ-1.2.4:** OmniCore state indexing MUST complete within 90 minutes on reference hardware (16-core CPU, 64GB RAM, 2TB NVMe)

#### FR1.3 Bitcoin State Monitoring
- **REQ-1.3.1:** The bridge module MUST monitor Bitcoin for lock transactions to the BitVM2 contract address
- **REQ-1.3.2:** The monitor MUST wait for 6 Bitcoin block confirmations before triggering peg-in
- **REQ-1.3.3:** The monitor MUST emit events for: `PegInDetected`, `PegInConfirmed`, `PegOutRequested`, `PegOutSettled`

---

### FR2 — Substrate Network Layer (Dong Chain Node)

#### FR2.1 Node Initialization
- **REQ-2.1.1:** The Dong Chain node MUST be initialized using Polkadot SDK (Substrate)
- **REQ-2.1.2:** The Cumulus library MUST be integrated to enable Parachain mode
- **REQ-2.1.3:** The node MUST register with the Relay Chain via `register_para` extrinsic
- **REQ-2.1.4:** The node MUST synchronize with Relay Chain before producing parachain blocks

#### FR2.2 Runtime Configuration
- **REQ-2.2.1:** Runtime MUST include pallets: `frame_system`, `pallet_balances`, `pallet_revive`, `cumulus_pallet_xcmp_queue`, `pallet_xcm`
- **REQ-2.2.2:** DONG token MUST be configured as the native gas fee currency
- **REQ-2.2.3:** Block time target: 6 seconds
- **REQ-2.2.4:** Runtime MUST support forkless upgrades via `set_code` (WASM runtime upgrade)

#### FR2.3 XCM Configuration
- **REQ-2.3.1:** The runtime MUST configure XCM executor with asset filters for DONG and bridged OmniCore assets
- **REQ-2.3.2:** UMP, DMP, and HRMP channels MUST be functional for testnet launch
- **REQ-2.3.3:** XCMP channels with at least 2 partner parachains MUST be demonstrated before mainnet

---

### FR3 — Smart Contract Environment (pallet-revive)

#### FR3.1 RISC-V Execution
- **REQ-3.1.1:** pallet-revive MUST execute valid PVM (PolkaVM RISC-V) bytecode
- **REQ-3.1.2:** The PVM MUST deterministically trap on invalid RISC-V instructions
- **REQ-3.1.3:** Gas metering MUST be applied at per-instruction granularity as defined in the Yellow Paper
- **REQ-3.1.4:** All host functions (`seal_*`) MUST be implemented as specified in Yellow Paper Section 6.2

#### FR3.2 EVM Compatibility (REVM Backend)
- **REQ-3.2.1:** pallet-revive MUST support REVM backend for EVM bytecode contracts
- **REQ-3.2.2:** The system MUST allow deploying contracts as either PVM or REVM at deployment time
- **REQ-3.2.3:** Cross-contract calls between PVM and REVM contracts MUST work via ABI encoding

#### FR3.3 Ethereum JSON-RPC (pallet-revive-eth-rpc)
- **REQ-3.3.1:** The RPC layer MUST implement `eth_sendRawTransaction`, `eth_call`, `eth_estimateGas`, `eth_getLogs`, `eth_getTransactionReceipt`
- **REQ-3.3.2:** Metamask MUST successfully connect and send transactions via the RPC endpoint
- **REQ-3.3.3:** Hardhat and Foundry MUST be able to deploy contracts and run tests without modification

#### FR3.4 resolc Compiler Toolchain
- **REQ-3.4.1:** The team MUST maintain a resolc binary compatible with the deployed pallet-revive version
- **REQ-3.4.2:** resolc MUST successfully compile: OpenZeppelin ERC-20, ERC-721, ERC-1155 contracts
- **REQ-3.4.3:** Compilation output MUST include size, gas estimates, and ABI JSON
- **REQ-3.4.4:** The dev team MUST document resolc version pinning in all contract repositories

---

### FR4 — Account Abstraction (ERC-4337)

#### FR4.1 Core Contract Deployment
- **REQ-4.1.1:** EntryPoint contract MUST be deployed (non-upgradable) at a deterministic address
- **REQ-4.1.2:** Smart Account Factory MUST support counterfactual wallet address computation
- **REQ-4.1.3:** Paymaster contract MUST support at minimum: (a) free sponsor mode, (b) ERC-20 payment mode

#### FR4.2 Signature Schemes
- **REQ-4.2.1:** Smart Account `validateUserOp` MUST support ECDSA (secp256k1) as baseline
- **REQ-4.2.2:** Smart Account SHOULD support P-256 (secp256r1) for WebAuthn/biometric authentication
- **REQ-4.2.3:** Smart Account SHOULD support 2-of-3 multi-sig for enterprise users

#### FR4.3 Bundler Infrastructure
- **REQ-4.3.1:** A Bundler node MUST maintain a dedicated UserOperation mempool
- **REQ-4.3.2:** Bundler MUST simulate UserOperations before inclusion (call `simulateValidation`)
- **REQ-4.3.3:** Bundler MUST submit aggregated UserOperation bundles to EntryPoint
- **REQ-4.3.4:** The Bundler MUST expose `eth_sendUserOperation` and `eth_getUserOperationReceipt` RPC methods

#### FR4.4 Gaming Session Keys
- **REQ-4.4.1:** Smart Account MUST support session key registration with: allowed selectors, spend limits, expiry
- **REQ-4.4.2:** Session key module MUST reject calls to non-whitelisted selectors
- **REQ-4.4.3:** Session key MUST expire automatically at configured timestamp

---

### FR5 — Bridge & Relay Depository

#### FR5.1 BitVM2 Peg-in
- **REQ-5.1.1:** SNARK verification circuit MUST be deployed as a Taproot script tree on Bitcoin
- **REQ-5.1.2:** Peg-in oracle MUST verify 6 Bitcoin block confirmations before minting wrapped asset
- **REQ-5.1.3:** The challenge period MUST be 7 days; any party can submit fraud proof during this window
- **REQ-5.1.4:** Fraud proof submission MUST slash operator collateral on Bitcoin

#### FR5.2 BitVM2 Peg-out
- **REQ-5.2.1:** User MUST burn wrapped asset on Dong Chain to initiate peg-out
- **REQ-5.2.2:** Operator MUST pre-sign Bitcoin payout transaction before accepting peg-out request
- **REQ-5.2.3:** Operator fund recovery MUST be possible after challenge period without dispute

#### FR5.3 Depository Contract
- **REQ-5.3.1:** `depositNative(depositor, orderId)` MUST accept native DONG and emit `OrderCreated` event
- **REQ-5.3.2:** `depositErc20(depositor, token, amount, orderId)` MUST transfer ERC-20 tokens and emit `OrderCreated`
- **REQ-5.3.3:** `execute(request, signature)` MUST: (a) reconstruct EIP-712 hash, (b) call ecrecover, (c) verify against MPC_ALLOCATOR address, (d) check nonce not used, (e) check deadline not expired, (f) release funds to Solver
- **REQ-5.3.4:** The contract MUST NOT contain upgrade patterns (no proxy, no delegatecall to mutable target)
- **REQ-5.3.5:** The contract MUST use Solady's SafeTransferLib for all token transfers

#### FR5.4 Solver & Allocator Network
- **REQ-5.4.1:** MPC Allocator MUST monitor both source and destination chains for order events
- **REQ-5.4.2:** Allocator MUST produce EIP-712 signatures only after verifying fill on destination chain
- **REQ-5.4.3:** Allocator MUST use Ed25519 signatures for Solana-side fills
- **REQ-5.4.4:** Solver network MUST support at minimum: Ethereum, Base, and Solana as destination chains for testnet

---

### FR6 — ZK Proof System

#### FR6.1 Batch Proof Generation
- **REQ-6.1.1:** The ZK prover MUST aggregate 1000 Dong Chain blocks into a single zk-STARK proof
- **REQ-6.1.2:** Proof generation MUST complete within 10 minutes on reference hardware (GPU-enabled)
- **REQ-6.1.3:** The guest program (RISC-V) MUST verify all transactions in the batch against the state root

#### FR6.2 Bitcoin Anchoring
- **REQ-6.2.1:** zk-STARK proof MUST be inscribed into Bitcoin via BitVM payload
- **REQ-6.2.2:** Proof inscription MUST occur at minimum every 24 hours on mainnet
- **REQ-6.2.3:** The anchoring transaction MUST reference the Dong Chain block range covered by the proof

---

## 3. Non-Functional Requirements

### NFR1 — Performance

| Metric | Requirement |
|---|---|
| Block time | 6 seconds (target), 10 seconds (maximum) |
| Transaction finality (parachain) | 12 seconds (2 blocks) |
| Cross-chain settlement (Depository) | < 60 seconds end-to-end |
| Smart contract deployment | < 30 seconds |
| RPC response time | < 500ms for read calls |
| Bundler aggregation latency | < 5 seconds |

### NFR2 — Security

- **NFR2.1:** Core contracts (Depository, EntryPoint) MUST be non-upgradable
- **NFR2.2:** All contracts compiled via resolc MUST undergo both source-level and PVM bytecode audits before mainnet
- **NFR2.3:** BitVM2 operator collateral MUST exceed 150% of locked asset value
- **NFR2.4:** MPC Allocator MUST require at least 5-of-9 threshold signature for mainnet
- **NFR2.5:** Session key spend limits MUST be enforced at the Smart Account level, not off-chain

### NFR3 — Interoperability

- **NFR3.1:** The Ethereum JSON-RPC layer MUST pass the Ethereum RPC conformance test suite
- **NFR3.2:** Metamask, Rainbow, and WalletConnect MUST work without custom configuration
- **NFR3.3:** OpenZeppelin contracts compiled via resolc MUST produce identical ABI and behavior

### NFR4 — Reliability

- **NFR4.1:** Collator nodes MUST maintain 99.9% uptime SLA
- **NFR4.2:** OmniCore node MUST reconnect automatically after Bitcoin RPC failure within 30 seconds
- **NFR4.3:** Bundler MUST persist UserOperation mempool across restarts

### NFR5 — Maintainability

- **NFR5.1:** All pallet code MUST have >80% test coverage
- **NFR5.2:** All smart contracts MUST have 100% branch coverage in Foundry tests
- **NFR5.3:** resolc version MUST be pinned in all contract repositories via lockfile
- **NFR5.4:** Breaking changes to the Depository contract ABI MUST require deploying a new contract (no in-place upgrades)

### NFR6 — Hardware Requirements (Reference Node)

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 8 cores @ 3.0 GHz | 16 cores @ 3.5 GHz |
| RAM | 32 GB | 64 GB |
| Storage | 1 TB NVMe | 2 TB NVMe RAID |
| Network | 100 Mbps | 1 Gbps |
| GPU (ZK prover only) | NVIDIA RTX 3080 | NVIDIA A100 |

---

## 4. External Interfaces

### 4.1 Bitcoin RPC
```
Method: POST http://localhost:8332
Auth: Basic (rpcuser:rpcpassword)
Content-Type: application/json
```

### 4.2 Dong Chain Ethereum-compatible RPC
```
Method: POST http://localhost:9944
Content-Type: application/json
Methods: Standard Ethereum JSON-RPC (eth_*)
```

### 4.3 Substrate Native RPC
```
WebSocket: ws://localhost:9944
Methods: system_*, author_*, chain_*, state_*
```

### 4.4 Bundler RPC
```
Method: POST http://localhost:3000
Content-Type: application/json
Methods: eth_sendUserOperation, eth_getUserOperationByHash, eth_getUserOperationReceipt
```

---

## 5. Constraints

1. **Bitcoin consensus:** No Bitcoin soft fork or hard fork is required — all integration is via meta-protocol
2. **pallet-revive version:** Must use Parity Technologies official release; no forks
3. **Non-upgradeability:** Depository and EntryPoint contracts are immutable after deployment
4. **Open source:** All code MUST be Apache 2.0 licensed
5. **Language:** Substrate runtime in Rust; contracts in Solidity (via resolc) or Rust (via ink!/RISC-V); no proprietary languages
