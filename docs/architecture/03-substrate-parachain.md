# Substrate Parachain Architecture

## Overview

Dong Chain is built using the **Polkadot SDK (Substrate)** and operates as a Parachain secured by the Relay Chain's shared validator set. This gives Dong Chain enterprise-grade security without needing to bootstrap its own independent validator network from scratch.

## Key Components

| Component | Role |
|---|---|
| **Substrate SDK** | Core primitives: networking, cryptography, database |
| **FRAME** | Modular pallet system for runtime logic |
| **Cumulus** | Extends Substrate to make it a Parachain |
| **Relay Chain** | Provides shared security and cross-chain coordination |
| **Collator Nodes** | Produce parachain blocks, submit PoV to Relay Chain |
| **XCM** | Cross-consensus messaging format |

## Runtime Composition

```rust
// runtime/src/lib.rs
#[frame_support::runtime]
mod runtime {
    #[runtime::runtime]
    #[runtime::derive(
        RuntimeCall, RuntimeEvent, RuntimeError, RuntimeOrigin,
        RuntimeTask, RuntimeHoldReason, RuntimeFreezeReason,
    )]
    pub struct Runtime;

    // ── Core ──────────────────────────────────────────────────────────────
    #[runtime::pallet_index(0)]
    pub type System = frame_system::Pallet<Runtime>;

    #[runtime::pallet_index(1)]
    pub type Timestamp = pallet_timestamp::Pallet<Runtime>;

    #[runtime::pallet_index(2)]
    pub type ParachainSystem = cumulus_pallet_parachain_system::Pallet<Runtime>;

    // ── Token & Fees ───────────────────────────────────────────────────────
    #[runtime::pallet_index(10)]
    pub type Balances = pallet_balances::Pallet<Runtime>;

    #[runtime::pallet_index(11)]
    pub type TransactionPayment = pallet_transaction_payment::Pallet<Runtime>;

    // ── Smart Contracts (RISC-V) ───────────────────────────────────────────
    #[runtime::pallet_index(20)]
    pub type Contracts = pallet_revive::Pallet<Runtime>;

    #[runtime::pallet_index(21)]
    pub type EthRpc = pallet_revive_eth_rpc::Pallet<Runtime>;

    // ── XCM & Cross-chain ─────────────────────────────────────────────────
    #[runtime::pallet_index(30)]
    pub type XcmpQueue = cumulus_pallet_xcmp_queue::Pallet<Runtime>;

    #[runtime::pallet_index(31)]
    pub type PolkadotXcm = pallet_xcm::Pallet<Runtime>;

    #[runtime::pallet_index(32)]
    pub type CumulusXcm = cumulus_pallet_xcm::Pallet<Runtime>;

    // ── Governance ────────────────────────────────────────────────────────
    #[runtime::pallet_index(40)]
    pub type Democracy = pallet_democracy::Pallet<Runtime>;

    #[runtime::pallet_index(41)]
    pub type Council = pallet_collective::Pallet<Runtime, Instance1>;
}
```

## Shared Security Model

```
Relay Chain Validators (e.g., Polkadot/Kusama)
    │
    │ validates Proof-of-Validity (PoV)
    │ ensures state transition correctness
    ▼
Dong Chain Collators
    │
    │ produce blocks
    │ submit PoV to Relay Chain
    ▼
Dong Chain State
```

**Security inheritance:** If an attacker wants to revert a Dong Chain block, they must attack the Relay Chain — requiring control of the entire Relay Chain validator set, not just Dong Chain nodes.

## Collator Node Setup

### Node Configuration

```bash
# Start collator node
./dong-chain-node \
  --collator \
  --chain ./chain-spec.json \
  --base-path /data/dong-chain \
  --port 30333 \
  --rpc-port 9944 \
  --bootnodes /ip4/X.X.X.X/tcp/30333/p2p/<peer-id> \
  -- \
  --chain ./relay-chain-spec.json \
  --port 30343 \
  --rpc-port 9945

# The -- separates parachain args from relay chain (embedded relay node) args
```

### Chain Spec Generation

```bash
# Generate chain spec
./dong-chain-node build-spec --disable-default-bootnode > chain-spec-raw.json

# Export genesis state
./dong-chain-node export-genesis-state > genesis-state.hex

# Export genesis WASM runtime
./dong-chain-node export-genesis-wasm > genesis-wasm.hex
```

## Block Production Flow

```
1. Collator receives XCM messages from Relay Chain (DMP)
2. Collator collects transactions from mempool
3. Collator executes transactions using RISC-V VM (pallet-revive)
4. Collator constructs block with:
   - Transaction data
   - State root
   - Parent hash
5. Collator generates PoV (Proof-of-Validity):
   - PoV includes compact block data
   - State witness (Merkle proofs for accessed keys)
   - Compiled runtime STF blob
6. Collator submits PoV to Relay Chain validators
7. Relay Chain validators verify PoV using the STF
8. If valid: block is included in Relay Chain ledger
9. Parachain state is finalized
```

## Parachain Registration

To launch Dong Chain as a Parachain:

```bash
# 1. Reserve ParaID on Relay Chain
# (via governance or parachain slot auction)

# 2. Register genesis state and runtime
polkadot-js-api tx.paras.addTrustedValidationCode \
  --ws wss://relay-chain.example.com \
  --seed <sudo-key>

# 3. Initialize parachain with genesis state
polkadot-js-api tx.paras.forceSetCurrentHead \
  --paraId <dong-chain-para-id> \
  --head ./genesis-state.hex

# 4. Set parachain WASM validation function
polkadot-js-api tx.paras.forceSetCurrentCode \
  --paraId <dong-chain-para-id> \
  --code ./genesis-wasm.hex
```

## Runtime Upgrades

Substrate supports forkless runtime upgrades — the WASM runtime is stored on-chain:

```bash
# Compile new runtime
cargo build --release -p dong-chain-runtime
# Produces: target/release/wbuild/dong-chain-runtime/dong_chain_runtime.wasm

# Submit upgrade via governance
polkadot-js-api tx.system.setCode \
  --code ./dong_chain_runtime.wasm \
  --sudo

# Runtime upgrades take effect at next block
```

**Important:** Runtime upgrades only change execution logic, NOT the stored state. All user balances and contract storage persist through upgrades.

## XCM Message Routing

```
Dong Chain → Relay Chain (UMP):
  XCM message sent to relay for staking, governance

Relay Chain → Dong Chain (DMP):
  Governance decisions applied to Dong Chain

Dong Chain → Other Parachains (HRMP/XCMP):
  Asset transfers, cross-chain contract calls
```

Configuration:
```rust
// XCM execution config in runtime
impl pallet_xcm::Config for Runtime {
    type RuntimeCall = RuntimeCall;
    type XcmExecutor = XcmExecutor<XcmConfig>;
    type ExecuteXcmOrigin = EnsureXcmOrigin<RuntimeOrigin, LocalOriginToLocation>;
    type XcmTeleportFilter = Everything;
    type XcmReserveTransferFilter = Everything;
    type Weigher = FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;
    type UniversalLocation = UniversalLocation;
    // ...
}
```

## Related Docs

- [RISC-V VM](./04-risc-v-vm.md) — Smart contract execution engine
- [XCM Messaging](./05-xcm-messaging.md) — Cross-chain communication details
- [Getting Started — Node Setup](../getting-started/03-node-setup.md) — Full node configuration
