# Dong Chain Yellow Paper
## Formal Technical Specification v0.1.0

**Status:** Draft — Research & Development
**Authors:** Dong Chain Research Lab
**Date:** 2026-03-27
**License:** Apache 2.0

---

## Abstract

This Yellow Paper presents the formal technical specification of **Dong Chain** — a multi-task Layer-1 blockchain designed for Real-World Asset (RWA) tokenization and gaming digital asset sovereignty. Dong Chain positions Bitcoin's Proof-of-Work network as an immutable Layer-0 settlement motherboard, bridges assets via the BitVM2 trust-minimized protocol, executes smart contracts on a RISC-V virtual machine (PolkaVM) within a Substrate Parachain framework, and facilitates cross-chain liquidity through a cryptographically-secured Relay Depository protocol.

The system achieves three primary goals: (1) maximal security inheritance from Bitcoin PoW without Bitcoin consensus changes; (2) enterprise-grade throughput via RISC-V ISA pipeline efficiency; (3) seamless EVM developer experience through backward-compatible Solidity compilation and Ethereum-equivalent JSON-RPC.

---

## Table of Contents

1. [System Model & Notation](#1-system-model--notation)
2. [Layer-0: Bitcoin Settlement Motherboard](#2-layer-0-bitcoin-settlement-motherboard)
3. [OmniCore Asset Tokenization](#3-omnicore-asset-tokenization)
4. [BitVM2 Trust-Minimized Bridge](#4-bitvm2-trust-minimized-bridge)
5. [Substrate Parachain Architecture](#5-substrate-parachain-architecture)
6. [RISC-V Execution Environment](#6-risc-v-execution-environment)
7. [Account Abstraction — ERC-4337 Extension](#7-account-abstraction--erc-4337-extension)
8. [Relay Depository Protocol](#8-relay-depository-protocol)
9. [Zero-Knowledge State Proofs](#9-zero-knowledge-state-proofs)
10. [Tokenomics & Gas Model](#10-tokenomics--gas-model)
11. [Gaming Asset Model](#11-gaming-asset-model)
12. [Security Analysis](#12-security-analysis)
13. [Complexity & Scalability Bounds](#13-complexity--scalability-bounds)
14. [Trade-offs & Open Problems](#14-trade-offs--open-problems)

---

## 1. System Model & Notation

### 1.1 Formal Notation

Let the system **Σ** be defined as a tuple:

```
Σ = (L₀, B, R, V, D, Z)
```

Where:
- **L₀** = Layer-0 state machine (Bitcoin + OmniCore)
- **B** = BitVM2 bridge protocol
- **R** = Relay Chain state machine (Substrate Parachain)
- **V** = RISC-V virtual machine execution environment (PolkaVM)
- **D** = Relay Depository cross-chain protocol
- **Z** = Zero-Knowledge proof system (zk-STARK / RISC Zero)

### 1.2 Global State

The global state **Ω** at time **t** is:

```
Ω(t) = { σ_BTC(t), σ_Omni(t), σ_Bridge(t), σ_Chain(t), σ_ZK(t) }
```

Where:
- `σ_BTC(t)` — Bitcoin UTXO set at block height t
- `σ_Omni(t)` — OmniLayer asset registry (balances, ownership)
- `σ_Bridge(t)` — BitVM2 locked asset state
- `σ_Chain(t)` — Dong Chain Parachain state (accounts, contracts, storage)
- `σ_ZK(t)` — ZK proof accumulator for Bitcoin finality batch

### 1.3 Cryptographic Primitives

| Primitive | Function |
|---|---|
| `SHA256(·)` | Bitcoin block hashing, OmniCore transaction hashing |
| `RIPEMD160(·)` | Bitcoin address derivation |
| `Keccak256(·)` | EVM-compatible contract address, storage key hashing |
| `ECDSA(sk, m)` | Ethereum-compatible transaction signing |
| `ecrecover(sig, m)` | Allocator signature verification in Depository |
| `EIP712Hash(domain, msg)` | Structured data hashing for cross-chain proofs |
| `Schnorr(sk, m)` | Taproot-based BitVM2 commitments |
| `SNARK_Verify(π, x)` | BitVM2 fraud proof verification |
| `STARK_Prove(T)` | ZK batch proof generation for Bitcoin finality |
| `Ed25519(sk, m)` | Solana-side Allocator signatures |

---

## 2. Layer-0: Bitcoin Settlement Motherboard

### 2.1 Role & Rationale

Bitcoin's Proof-of-Work consensus provides the highest Nakamoto coefficient of any public blockchain. Rather than building a new security layer, Dong Chain **inherits** Bitcoin security through state anchoring.

**Definition 2.1 (Layer-0 Finality):** A state change `Δσ` is considered **L0-final** if and only if it is committed to the Bitcoin blockchain at depth `d ≥ 6` blocks, where the expected reversion cost exceeds:

```
Cost_reversion(d) = Σ(i=1 to d) block_reward(i) + fees(i)
```

As of 2026, this exceeds $300,000 USD per block, making L0 finality economically prohibitive to attack.

### 2.2 Bitcoin Node Requirements

A compliant Dong Chain validator MUST operate a Bitcoin full node with:

```toml
[bitcoin-core]
txindex = 1          # REQUIRED: full transaction index
rpcuser = <user>
rpcpassword = <pass>
rpcport = 8332
server = 1
```

**Critical:** Without `txindex=1`, OmniCore refuses to start. Initial re-indexing requires 6-24 hours depending on hardware.

### 2.3 UTXO State Tracking

The Bitcoin UTXO set at height `h` is defined as:

```
UTXO(h) = { (txid, vout, amount, scriptPubKey) | unspent at height h }
```

OmniCore maintains a parallel overlay state `σ_Omni` tracking asset ownership by parsing OP_RETURN outputs in each block:

```
σ_Omni(h) = Parse_Omni(σ_Omni(h-1), Block(h))
```

---

## 3. OmniCore Asset Tokenization

### 3.1 Protocol Architecture

OmniCore operates as an application-layer meta-protocol above Bitcoin, analogous to HTTP over TCP/IP. It encodes asset metadata into standard Bitcoin transactions without modifying Bitcoin consensus rules.

**Encoding Mechanisms:**

**Layer B (Multisig encoding):**
```
OP_1 <data_pubkey_1> <data_pubkey_2> <signing_pubkey> OP_3 OP_CHECKMULTISIG
```
Up to 66 bytes per pubkey slot used for data embedding.

**Layer C (OP_RETURN encoding):**
```
OP_RETURN <0x6f6d6e69> <omni_data_bytes>  // max 80 bytes
```
Where `0x6f6d6e69` is the Omni protocol marker. The payload encodes:
- Transaction type (CREATE_PROPERTY, SEND, etc.)
- Asset identifier (property_id: uint32)
- Amount (uint64, divisible or indivisible)

### 3.2 Asset Issuance

To issue a new RWA token on Layer 0:

```bash
omnicore-cli omni_sendissuancefixed \
  <fromaddress> \
  <ecosystem: 1=main, 2=test> \
  <type: 1=indivisible, 2=divisible> \
  <previousid: 0> \
  <category> \
  <subcategory> \
  <name> \
  <url> \
  <data> \
  <amount>
```

**Formal property:** Once issued on Bitcoin L0, an OmniCore asset's total supply is immutable unless the issuing address performs an additional transaction — providing audit-grade immutability.

### 3.3 Asset Lifecycle State Machine

```
[Issued on Bitcoin L0]
        │
        ▼ (BitVM2 peg-in)
[Locked in BitVM2 contract on Bitcoin]
        │
        ▼ (Oracle minting on Dong Chain)
[Wrapped asset on Dong Chain Parachain]
        │
        ├──▶ [Smart contract interaction on RISC-V VM]
        │
        ├──▶ [Cross-chain via Relay Depository]
        │
        ▼ (BitVM2 peg-out)
[Unlocked on Bitcoin L0]
```

---

## 4. BitVM2 Trust-Minimized Bridge

### 4.1 Design Philosophy

The fundamental challenge: Bitcoin Script is not Turing-complete, yet we need to verify Substrate state transitions on Bitcoin. BitVM2 solves this using **optimistic verification with fraud proofs** — computation occurs off-chain; Bitcoin only adjudicates disputes.

### 4.2 Cryptographic Primitives

**Bit Commitment Scheme:**

For each bit `b ∈ {0,1}` in a computation, the prover commits:
```
commit(b=0) = reveal(hash_preimage_0)  // reveals preimage of H0
commit(b=1) = reveal(hash_preimage_1)  // reveals preimage of H1
```

**Equivocation = Fraud Proof:** If prover reveals BOTH preimages for the same bit position, any verifier can construct a fraud proof and slash the prover's collateral on Bitcoin.

**Boolean Circuit Representation:**

Any computable function `f: {0,1}^n → {0,1}^m` is decomposed into NAND gates:

```
NAND(a, b) = NOT(AND(a, b))
```

A complete SNARK verification circuit is represented as `G = (V, E)` where each `v ∈ V` is a NAND gate. This circuit is committed to a Taproot address:

```
taproot_addr = P + H(P || script_tree) · G
```

Where the script tree contains one leaf per gate, allowing selective gate revelation.

### 4.3 BitVM2 Trust Model

**Theorem 4.1 (Liveness Honesty):** In a BitVM2 operator set of size `n`, user funds are safe if and only if at least `k ≥ 1` operator remains honest and responsive. Formally:

```
Safe(assets) ⟺ ∃ o ∈ Operators : honest(o) ∧ liveness(o)
```

This is a significant improvement over threshold multisig `(t-of-n)` which requires `t > n/2`.

### 4.4 Peg-in Protocol

```
1. User locks OmniCore asset A into BitVM2 contract on Bitcoin:
   lock_tx = { input: UTXO(A), output: taproot(bitvm2_script_tree) }

2. Operator set monitors lock_tx confirmation (6 blocks)

3. Decentralized oracle submits proof to Dong Chain:
   mint_tx = { asset: A.property_id, amount: A.amount, recipient: user_parachain_addr }

4. pallet-revive mints wrapped asset W(A) on Dong Chain

5. Challenge period: 7 days
   - Any party can challenge by revealing a fraudulent gate computation
   - If unchallenged: peg-in finalized
   - If challenged: fraud proof verified on Bitcoin, slashing executed
```

### 4.5 Peg-out Protocol

```
1. User burns W(A) on Dong Chain
2. Operator pre-signs Bitcoin payout transaction
3. After challenge period without dispute:
   payout_tx releases BTC/OmniCore assets to user's Bitcoin address
4. Operator recovers funds from BitVM2 contract via operator_recovery_script
```

---

## 5. Substrate Parachain Architecture

### 5.1 Runtime Architecture

Dong Chain's runtime is a FRAME-based Substrate runtime compiled to native binary and WASM (for on-chain upgrades only):

```rust
// Runtime composition (simplified)
construct_runtime!(
    pub enum Runtime {
        System: frame_system,
        Timestamp: pallet_timestamp,
        Balances: pallet_balances,           // Native token
        TransactionPayment: pallet_transaction_payment,
        Contracts: pallet_revive,             // RISC-V smart contracts
        EthRpc: pallet_revive_eth_rpc,        // Ethereum-compatible RPC
        XcmpQueue: cumulus_pallet_xcmp_queue, // Cross-chain messaging
        PolkadotXcm: pallet_xcm,
        // Governance, staking, etc.
    }
);
```

### 5.2 Shared Security Model

**Definition 5.1 (Parachain Security Inheritance):** The Dong Chain Parachain inherits security from the Relay Chain validator set `V_R`. A block `B_p` on the parachain is valid iff:

```
Valid(B_p) ⟺ ∃ v ∈ V_R : v.backed(B_p) ∧ STF_valid(B_p, parent(B_p))
```

Where `STF_valid` verifies the State Transition Function blob submitted by Collator nodes.

**State Reversion Guarantee:** If the Relay Chain reverts block `n`, ALL connected parachains revert synchronously:

```
Revert(Relay, n) ⟹ ∀ p ∈ Parachains : Revert(p, n_p)
```

This ensures no parachain can produce an irreconcilable fork with the Relay Chain.

### 5.3 Collator Node Responsibilities

Collator nodes perform:
1. Maintain full parachain state
2. Execute RISC-V smart contract transactions
3. Batch transactions into parachain blocks
4. Produce Proof-of-Validity (PoV) blob for Relay Chain validators
5. Propagate PoV to Relay Chain via `submit_pvf()`

**PoV structure:**
```
PoV = {
    block_data: CompactBlock,
    witness: MerkleProof(state_root, accessed_keys),
    stf_blob: RISC_V_compiled_runtime
}
```

### 5.4 XCM Messaging

XCM is a semantic format for cross-consensus instructions. Key message types used in Dong Chain:

```
// Transfer asset from Dong Chain to another parachain
Xcm::TransferAssets {
    assets: MultiAssets,
    dest: MultiLocation,
    beneficiary: MultiLocation,
    fee_asset_item: u32,
    weight_limit: WeightLimit,
}

// Execute arbitrary call on destination
Xcm::Transact {
    origin_kind: OriginKind,
    call: DoubleEncoded<Call>,
}
```

**Message routing:**
- UMP (Parachain → Relay Chain): parachain to relay governance/staking
- DMP (Relay Chain → Parachain): relay-initiated actions
- XCMP/HRMP (Parachain ↔ Parachain): direct inter-parachain calls

---

## 6. RISC-V Execution Environment

### 6.1 Why RISC-V?

**Theorem 6.1 (Register Machine Efficiency):** For equivalent computation `C`, a RISC-V register machine requires fewer memory bus transactions than an EVM stack machine:

```
mem_access_RISCV(C) ≤ mem_access_EVM(C) / k
```

Where `k ≥ 2` for typical smart contract workloads (empirically observed from pallet-revive benchmarks).

**Additional advantages:**
- RISC-V instructions trap deterministically on invalid opcodes — no global pre-validation required (unlike WASM)
- Maps directly to physical CPU pipeline stages: IF → ID → EX → MEM → WB
- Native SIMD capabilities for cryptographic operations
- Future hardware acceleration: physical RISC-V chips can run validator nodes

### 6.2 PolkaVM (PVM) Specification

PolkaVM is a register-based virtual machine implementing a subset of RISC-V RV32E (embedded profile, 16 registers):

**Register file:**
```
r0  = zero (hardwired)
r1  = return address
r2  = stack pointer
r3  = global pointer
r4-r7   = function arguments / return values
r8-r15  = callee-saved registers
```

**Supported instruction extensions:**
- RV32I (base integer)
- RV32M (multiplication/division)
- Custom host call instructions for blockchain-specific operations

**Host functions exposed to contracts:**
```rust
// Storage
seal_set_storage(key_ptr, key_len, val_ptr, val_len) -> u32
seal_get_storage(key_ptr, key_len, out_ptr, out_len_ptr) -> u32
seal_clear_storage(key_ptr, key_len) -> u32

// Blockchain context
seal_caller(out_ptr, out_len_ptr)
seal_value_transferred(out_ptr, out_len_ptr)
seal_block_number(out_ptr, out_len_ptr)

// Cryptography
seal_hash_keccak_256(input_ptr, input_len, out_ptr)
seal_hash_blake2_256(input_ptr, input_len, out_ptr)
seal_ecdsa_recover(sig_ptr, msg_hash_ptr, out_ptr) -> u32

// Cross-contract
seal_call(callee_ptr, gas, value, input_ptr, input_len, ...) -> u32
seal_instantiate(code_hash_ptr, gas, value, input_ptr, ...) -> u32
```

### 6.3 Gas Metering

Gas in PolkaVM is metered per-instruction with deterministic costs:

| Instruction Class | Gas Cost | Rationale |
|---|---|---|
| Integer ALU (ADD, SUB, XOR...) | 1 | Single cycle on reference hardware |
| Multiply (MUL) | 3 | 3-cycle multiply unit |
| Divide (DIV) | 8 | Variable-latency divider |
| Memory load (LW, LB) | 4 | Cache miss worst-case |
| Memory store (SW, SB) | 4 | Write-through cost |
| Branch (BEQ, BNE...) | 2 | Pipeline flush |
| Host function call | variable | Benchmarked per function |

**Gas limit per block:**
```
gas_limit_block = block_weight_limit / gas_per_weight_unit
```

The runtime uses worst-case memory access latencies for conservative gas estimation, ensuring deterministic consensus across all validator hardware.

### 6.4 Dual Execution Backend

pallet-revive supports two backends selectable per contract deployment:

```
Backend A: PVM (PolkaVM)
  Input: .polkavm bytecode (produced by resolc compiler)
  Performance: Maximum — native RISC-V execution speed
  Use case: New contracts, Rust/C contracts, optimized Solidity

Backend B: REVM (Ethereum VM)
  Input: Standard EVM bytecode (produced by solc)
  Performance: Standard EVM — fully compatible
  Use case: Existing audited contracts, quick migration
```

### 6.5 resolc Compiler Pipeline

```
Solidity Source (.sol)
        │
        ▼ solc (Ethereum Solidity compiler)
   Yul IR / EVM Assembly
        │
        ▼ resolc (Revive compiler)
   LLVM IR (target: riscv32-unknown-none-elf)
        │
        ▼ LLVM backend
   RISC-V binary (.polkavm)
        │
        ▼ pallet-revive upload
   On-chain code hash (stored in runtime storage)
```

**resolc compilation command:**
```bash
resolc --target polkavm \
       --optimization 3 \
       --output-dir ./artifacts \
       MyContract.sol
```

**Security note:** All contracts compiled via resolc MUST be cross-audited to verify no semantic drift occurs during Yul IR → LLVM IR → RISC-V lowering. The LLVM optimization pipeline may introduce behavior not present in the original Solidity source.

---

## 7. Account Abstraction — ERC-4337 Extension

### 7.1 Architecture

Dong Chain implements ERC-4337 Account Abstraction, enabling:
- Gasless transactions (sponsored by Paymaster)
- Social recovery wallets
- Biometric authentication (P-256/WebAuthn)
- Multi-signature schemes
- Session keys for gaming (bounded authorization)

### 7.2 Core Contracts

**EntryPoint Contract:**
```solidity
// Non-upgradable — deployed once, never modified
contract EntryPoint {
    function handleOps(
        UserOperation[] calldata ops,
        address payable beneficiary
    ) external;

    function simulateValidation(
        UserOperation calldata userOp
    ) external returns (ValidationResult memory);
}
```

**Smart Account Interface:**
```solidity
interface IAccount {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}
```

**Validation data encoding:**
```
validationData = uint256(authorizer) | (uint256(validUntil) << 160) | (uint256(validAfter) << 208)
```

Where:
- `authorizer = 0` → valid signature
- `authorizer = 1` → invalid signature (SIG_VALIDATION_FAILED)
- `authorizer = <addr>` → deferred to aggregator

### 7.3 UserOperation Structure

```solidity
struct UserOperation {
    address sender;           // Smart Account address
    uint256 nonce;
    bytes initCode;           // Factory + calldata (for new accounts)
    bytes callData;           // Actual call to execute
    uint256 callGasLimit;
    uint256 verificationGasLimit;
    uint256 preVerificationGas;
    uint256 maxFeePerGas;
    uint256 maxPriorityFeePerGas;
    bytes paymasterAndData;   // Paymaster address + data
    bytes signature;          // ECDSA, P-256, or multi-sig
}
```

### 7.4 Gaming Session Keys

For gaming use cases, Smart Accounts support **session key authorization** — a limited-scope key that can perform specific actions without full wallet signature:

```solidity
struct SessionKey {
    address key;              // Session key address
    uint256 validUntil;       // Expiry timestamp
    bytes4[] allowedSelectors; // Permitted function calls
    uint256 spendLimit;       // Max ETH/token spend
    address[] allowedTargets; // Permitted contract addresses
}
```

This enables game clients to hold session keys that can mint/transfer in-game assets without exposing the user's master private key.

---

## 8. Relay Depository Protocol

### 8.1 Protocol Overview

The Relay Depository enables cross-chain asset transfer with instant finality from the user's perspective, using optimistic solver pre-funding and cryptographic settlement.

**Reference contract:** `0x4cD00E387622C35bDDB9b4c962C136462338BC31` (Base/Ethereum)

### 8.2 Depository Contract Specification

```solidity
// SPDX-License-Identifier: Apache-2.0
// NON-UPGRADABLE — no proxy pattern allowed
contract DongChainDepository {
    using SafeTransferLib for address;
    using EIP712 for bytes32;

    address public immutable MPC_ALLOCATOR;
    mapping(bytes32 => bool) public usedNonces;

    // Deposit native token with unique order ID
    function depositNative(
        address depositor,
        bytes32 orderId
    ) external payable;

    // Deposit ERC-20 token
    function depositErc20(
        address depositor,
        address token,
        uint256 amount,
        bytes32 orderId
    ) external;

    // Execute withdrawal with cryptographic proof
    function execute(
        CallRequest calldata request,
        bytes calldata signature
    ) external;
}
```

### 8.3 EIP-712 Structured Data

**Domain separator:**
```solidity
bytes32 DOMAIN_SEPARATOR = keccak256(abi.encode(
    keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
    keccak256("DongChainDepository"),
    keccak256("1"),
    block.chainid,
    address(this)
));
```

**CallRequest type hash:**
```solidity
bytes32 CALL_REQUEST_TYPEHASH = keccak256(
    "CallRequest(address solver,address token,uint256 amount,bytes32 orderId,uint256 nonce,uint256 deadline)"
);
```

**On-chain verification:**
```solidity
function execute(CallRequest calldata req, bytes calldata sig) external {
    // 1. Reconstruct hash
    bytes32 structHash = keccak256(abi.encode(
        CALL_REQUEST_TYPEHASH,
        req.solver, req.token, req.amount,
        req.orderId, req.nonce, req.deadline
    ));
    bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));

    // 2. Recover signer
    address signer = ecrecover(digest, req.v, req.r, req.s);

    // 3. Validate
    require(signer == MPC_ALLOCATOR, "Invalid allocator signature");
    require(!usedNonces[req.nonce], "Nonce already used");
    require(block.timestamp <= req.deadline, "Expired");

    // 4. Mark nonce and release funds
    usedNonces[req.nonce] = true;
    req.token.safeTransfer(req.solver, req.amount);
}
```

### 8.4 Full Execution Flow

```
User (Dong Chain) ──depositErc20──▶ Depository (Dong Chain)
                                          │
                                          │ event: OrderCreated(orderId, amount, destChain)
                                          ▼
                                   Solver Network
                                          │
                                          │ fill on destination chain
                                          ▼
                              User receives assets (Ethereum/Solana/...)
                                          │
                                          │ Solver requests reimbursement
                                          ▼
                                   MPC Allocator
                                          │ verifies fill on-chain
                                          │ signs EIP-712 CallRequest
                                          ▼
                              Solver calls execute(request, signature)
                                          │
                                          ▼
                         Depository verifies ecrecover(sig) == MPC_ALLOCATOR
                                          │ releases funds to Solver
                                          ▼
                                   [Settlement Complete]
```

### 8.5 Security Properties

**Property 8.1 (Replay Protection):** The nonce mapping `usedNonces: bytes32 → bool` ensures each `CallRequest` can only be executed once:
```
∀ req: usedNonces[req.nonce] = true after first execute(req, sig)
```

**Property 8.2 (Domain Isolation):** The domain separator includes `chainId` and `verifyingContract`, preventing signature replay across chains:
```
sig_valid_on_chain_A ≠ sig_valid_on_chain_B  (domain_separator_A ≠ domain_separator_B)
```

**Property 8.3 (Non-upgradeability):** The Depository contains no `delegatecall`, `selfdestruct`, or proxy patterns. Logic is immutable post-deployment.

---

## 9. Zero-Knowledge State Proofs

### 9.1 ZK Integration Architecture

Dong Chain integrates with RISC Zero zkVM to batch thousands of state transitions into a single zk-STARK proof, which is then anchored to Bitcoin L0:

```
[N parachain blocks] → RISC Zero zkVM (RISC-V execution) → π (zk-STARK proof)
                                                                    │
                                                                    ▼
                                                          Bitcoin L0 (via BitVM payload)
```

### 9.2 RISC Zero zkVM

RISC Zero natively simulates RV32IM (32-bit RISC-V with multiply extension). A **guest program** running inside the zkVM can:
1. Verify all transactions in a batch
2. Compute new state root
3. Produce a receipt (proof) that the computation was correct

**Mathematical formulation:**

Let `T = {tx₁, tx₂, ..., txₙ}` be a batch of transactions and `S_prev` the previous state root.

The zkVM proves:
```
∃ execution trace E : RISC-V_exec(batch_verifier, T, S_prev) = (S_new, E)
∧ valid(E)
```

The verifier (on Bitcoin via BitVM) needs only `(S_prev, S_new, π)` — not the full trace.

### 9.3 Proof Aggregation for Bitcoin Finality

```
Epoch = 1000 blocks of Dong Chain

For each epoch:
  1. Collator produces batch: B = { block₁, ..., block₁₀₀₀ }
  2. ZK Prover computes: π = STARK_Prove(B, S_prev) → (S_new, π)
  3. π is inscribed into Bitcoin via BitVM payload
  4. Per-user cost: O(1/1000) of a Bitcoin transaction fee
```

**Security guarantee:** Bitcoin miners securing the anchor transaction provide the same PoW security to all 1000 parachain blocks in the batch.

---

## 10. Tokenomics & Gas Model

### 10.1 Native Token (DONG)

| Property | Value |
|---|---|
| Name | Dong Chain Token |
| Symbol | DONG |
| Total Supply | TBD (governance vote) |
| Decimals | 18 |
| Role | Gas fees, parachain slot bonding, governance |

### 10.2 Gas Pricing Model

Gas price follows an EIP-1559-inspired mechanism adapted for Substrate:

```
effective_gas_price = base_fee + priority_fee
base_fee(n+1) = base_fee(n) × (1 + α × (gas_used(n)/gas_target - 1))
```

Where `α = 0.125` (adjustment factor, same as Ethereum EIP-1559).

**Economic separation from Bitcoin:**
- Execution costs priced in DONG (not satoshis)
- Bitcoin L0 settlement uses BTC fee market independently
- No interference between Dong Chain gas economy and Bitcoin fee market

### 10.3 Paymaster Gas Abstraction

With ERC-4337, Paymasters can:
1. **Sponsor users:** dApp pays gas on behalf of user (free transactions)
2. **Token payment:** User pays gas in any ERC-20 (stablecoin); Paymaster converts to DONG
3. **OmniCore stablecoin gas:** Users holding OmniCore-issued stablecoins can pay gas directly

```solidity
interface IPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);

    function postOp(
        PostOpMode mode,
        bytes calldata context,
        uint256 actualGasCost
    ) external;
}
```

### 10.4 ZK Batch Cost Amortization

```
cost_per_user = (bitcoin_anchor_fee + zk_proving_cost) / users_in_batch

At 1000 users per batch:
  cost_per_user ≈ ($5 + $50) / 1000 ≈ $0.055 per user for Bitcoin-level finality
```

---

## 11. Gaming Asset Model

### 11.1 In-Game Asset Standards

Dong Chain supports all major NFT standards compiled to RISC-V for gaming:

**ERC-1155 Multi-Token (Recommended for gaming):**
```solidity
// Efficient batch transfers for in-game items
function safeBatchTransferFrom(
    address from,
    address to,
    uint256[] calldata ids,    // Item type IDs
    uint256[] calldata amounts, // Quantities
    bytes calldata data
) external;
```

**ERC-6551 Token Bound Accounts:**
Allows NFT characters to own their own assets — each game character has an on-chain account:
```solidity
// Character NFT (ERC-721) owns items (ERC-1155) via ERC-6551
character_nft_address → owns → inventory_items[]
```

### 11.2 Gaming Asset Properties

| Property | Standard | Example |
|---|---|---|
| Character/Avatar | ERC-721 | Unique hero NFT |
| Items/Equipment | ERC-1155 | Sword x5, Shield x2 |
| In-game currency | ERC-20 | Gold coins |
| Land/Territory | ERC-721 | Plot coordinates |
| Achievement/Badge | ERC-1155 (SBT) | Non-transferable achievements |
| Character inventory | ERC-6551 | Character-owned item wallet |

### 11.3 Sovereignty Model

**Definition 11.1 (Asset Sovereignty):** A gaming asset `A` is considered **player-sovereign** if and only if:
1. `A` is represented as an on-chain token with the player's address as owner
2. No game developer address can burn, transfer, or modify `A` without player's cryptographic authorization
3. `A` persists on-chain regardless of game server uptime

Dong Chain enforces this through non-upgradable ERC-721/1155 contracts with no admin burn/mint functions post-launch.

### 11.4 Cross-Game Interoperability

Via XCM, gaming assets on Dong Chain can:
- Move to other Polkadot parachains
- Bridge to Ethereum via Relay Depository
- Be used as collateral in DeFi protocols on other chains

---

## 12. Security Analysis

### 12.1 Threat Model

| Threat | Mitigation | Residual Risk |
|---|---|---|
| 51% attack on Dong Chain | Shared security from Relay Chain validators | Requires attacking entire Polkadot network |
| BitVM2 bridge exploit | 1-of-n honest operator; fraud proofs | Requires ALL operators colluding |
| MPC Allocator collusion | Cannot drain Depository without valid deposits | Could produce invalid EIP-712 proofs |
| Depository upgrade exploit | Non-upgradable contracts | None (code immutable) |
| resolc compiler bug | Cross-audit of Yul → RISC-V lowering | Edge-case semantic drift |
| Replay attack on Depository | Nonce + domain separator | None (cryptographically prevented) |
| Session key abuse (gaming) | Bounded selectors, spend limits, expiry | Needs careful game client implementation |

### 12.2 Non-Upgradeability Invariants

The following contracts MUST NOT contain:
- `delegatecall` to mutable addresses
- `selfdestruct`
- `UUPS` or `TransparentProxy` patterns
- Owner-controlled logic modification

**Contracts under non-upgradeability requirement:**
- `DongChainDepository`
- `EntryPoint` (ERC-4337)
- Core token contracts (if supply immutable)

### 12.3 Smart Contract Audit Requirements

Before mainnet deployment, ALL contracts compiled via resolc MUST undergo:
1. Source-level Solidity audit (standard practice)
2. PVM bytecode audit (verify RISC-V output matches Solidity intent)
3. Fuzzing with Echidna/Foundry invariant tests
4. Formal verification of Depository `execute()` function (using K Framework or Certora)

---

## 13. Complexity & Scalability Bounds

### 13.1 Transaction Throughput

**Substrate baseline:**
- Block time: 6 seconds
- Block size: ~5MB (adjustable via governance)

**RISC-V performance advantage:**
- Empirical benchmark: RISC-V execution is 2-8x faster than EVM for equivalent contract logic (pallet-revive internal benchmarks)
- Memory access patterns optimized for register architecture

**Theoretical TPS:**
```
TPS = (block_size / avg_tx_size) / block_time
    ≈ (5,000,000 bytes / 250 bytes) / 6 seconds
    ≈ 3,333 TPS (without ZK batching)
```

With ZK batching and parallel parachain execution: theoretically unlimited (horizontal scaling via parachain slots).

### 13.2 Bitcoin Finality Latency

```
L0_finality_time = zk_proving_time + bitcoin_confirmation_time
                 ≈ 5 minutes (STARK proof) + 60 minutes (6 BTC blocks)
                 ≈ 65 minutes

Note: Dong Chain instant finality (6 seconds) is still available
      for intra-chain and XCM transactions.
      Bitcoin L0 finality is only required for maximum-security anchoring.
```

### 13.3 Storage Complexity

| Component | Storage Requirement |
|---|---|
| Bitcoin full node + OmniCore | ~700 GB (2026) + ~10 GB/year growth |
| Dong Chain parachain node | ~50 GB initial + ~20 GB/year |
| ZK proof archive | ~100 MB/day (compressed STARK proofs) |

---

## 14. Trade-offs & Open Problems

### 14.1 Known Trade-offs

**OmniCore Hardware Requirements:** Full node operation requires substantial storage. Light node support for OmniCore is not currently available — this limits node operator decentralization.

**RISC-V Toolchain Maturity:** pallet-revive and resolc are experimental. The EVM battle-tested ecosystem (OpenZeppelin, Foundry, security auditors) has not yet validated the RISC-V compilation pipeline at scale.

**MPC Centralization:** The Relay Depository's MPC Allocator represents a semi-trusted federation. Transition path to fully decentralized ZK bridging is required as zkVM proving costs decrease.

### 14.2 Open Research Problems

1. **Optimal gas metering for RISC-V:** Current worst-case memory latency estimates are conservative. Research into tighter bounds while maintaining deterministic consensus is needed.

2. **zkVM proving cost reduction:** Current STARK proof generation for 1000 blocks takes ~5 minutes. Reducing to <1 minute would enable near-real-time Bitcoin finality anchoring.

3. **Light client for OmniCore:** Developing a Bitcoin light client with Omni Layer SPV support would dramatically reduce validator hardware requirements.

4. **Session key security model for gaming:** Formal verification of session key bounds under adversarial game client conditions.

5. **Cross-parachain NFT composability:** Standardized XCM message formats for ERC-721/1155 transfers across Polkadot parachains.

---

## Appendix A: Contract Addresses (Testnet)

| Contract | Address | Network |
|---|---|---|
| Depository (reference) | `0x4cD00E387622C35bDDB9b4c962C136462338BC31` | Base Mainnet |
| EntryPoint ERC-4337 | TBD | Dong Chain Testnet |
| DongChainDepository | TBD | Dong Chain Testnet |

## Appendix B: Key Parameters

| Parameter | Value | Configurable |
|---|---|---|
| Block time | 6 seconds | Via governance |
| Challenge period (BitVM2) | 7 days | Fixed at bridge deployment |
| Bitcoin confirmation depth | 6 blocks | Fixed |
| ZK batch size | 1000 blocks | Runtime configurable |
| Max OmniCore OP_RETURN size | 80 bytes | Bitcoin consensus fixed |
| EIP-1559 adjustment factor α | 0.125 | Via governance |
| Session key max validity | 7 days | Per-game configurable |

## Appendix C: References

1. Nakamoto, S. (2008). *Bitcoin: A Peer-to-Peer Electronic Cash System*
2. Linus, R. et al. (2023). *BitVM: Compute Anything on Bitcoin*
3. BitVM2: *n-of-n to 1-of-n Trust Model with SNARK Fraud Proofs*
4. Wood, G. et al. *Polkadot: Vision for a Heterogeneous Multi-Chain Framework*
5. Parity Technologies. *pallet-revive: RISC-V Smart Contracts for Substrate*
6. RISC-V International. *RISC-V Instruction Set Manual, Volume I: Unprivileged ISA*
7. Johnson, P. et al. *ERC-4337: Account Abstraction via Entry Point Contract*
8. RISC Zero. *The RISC Zero zkVM: A Fully Open-Source ZK Prover*
9. Ethereum Foundation. *EIP-712: Typed Structured Data Hashing and Signing*
10. Wilcox-O'Hearn, Z. *OmniCore Protocol Documentation*

---

*This Yellow Paper is a living document. Protocol parameters are subject to change via governance before mainnet launch.*
