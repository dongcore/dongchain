# ZK Integration — Zero-Knowledge Proofs & Bitcoin Finality

## Overview

Dong Chain uses RISC-V's native ZK compatibility to batch thousands of state transitions into a single zk-STARK proof anchored to Bitcoin. This provides:

- **Scalability:** 1000+ transactions per proof, with O(1) Bitcoin anchor cost
- **Security:** Bitcoin-level finality for all Dong Chain state changes
- **Privacy:** NIZK proofs can verify validity without revealing transaction details

## Why RISC-V Is ZK-Native

RISC Zero's zkVM natively simulates **RV32IM** (32-bit RISC-V with multiply extension) — the same ISA used by PolkaVM. This means:

1. Dong Chain's runtime code runs identically inside and outside the zkVM
2. No separate ZK circuit development — the RISC-V binary IS the circuit
3. New cryptographic algorithms automatically get ZK proof support

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              DONG CHAIN (1000 blocks)               │
│  block₁, block₂, ..., block₁₀₀₀                    │
│  S₀ → S₁ → S₂ → ... → S₁₀₀₀                        │
└──────────────────┬──────────────────────────────────┘
                   │ batch submission
                   ▼
┌─────────────────────────────────────────────────────┐
│            RISC Zero zkVM (ZK Prover)               │
│  Guest: RISC-V binary (Dong Chain state verifier)   │
│  Host: High-performance GPU server                  │
│                                                     │
│  Input:  (S₀_root, transactions[], chain_params)    │
│  Output: (S₁₀₀₀_root, π) — zk-STARK proof          │
└──────────────────┬──────────────────────────────────┘
                   │ proof inscription
                   ▼
┌─────────────────────────────────────────────────────┐
│          BITCOIN L0 (via BitVM payload)             │
│  Permanently anchored proof                         │
│  Verifiable by anyone with Bitcoin node             │
└─────────────────────────────────────────────────────┘
```

## RISC Zero Guest Program

The guest program runs inside the zkVM and its correct execution is proven:

```rust
// guest/src/main.rs
// This code runs inside RISC Zero zkVM
// Its execution is proven via zk-STARK

#![no_main]
use risc0_zkvm::guest::env;
use dong_chain_core::{Block, StateTree, Transaction};

risc0_zkvm::guest::entry!(main);

fn main() {
    // Read public inputs from journal
    let prev_state_root: [u8; 32] = env::read();
    let blocks: Vec<Block> = env::read();
    let expected_block_count: u64 = env::read();

    assert_eq!(blocks.len() as u64, expected_block_count, "Block count mismatch");

    // Reconstruct state from root
    let mut state = StateTree::from_root(prev_state_root);

    // Process each block
    for block in &blocks {
        // Verify block signature (Collator)
        assert!(block.verify_collator_signature(), "Invalid block signature");

        // Apply all transactions
        for tx in &block.transactions {
            assert!(state.apply(tx).is_ok(), "Invalid transaction");
        }
    }

    // Commit new state root as public output
    env::commit(&state.root());
    env::commit(&blocks.last().unwrap().number);
}
```

## Host Program (ZK Prover)

The host runs on a GPU server and orchestrates proof generation:

```rust
// host/src/main.rs
use risc0_zkvm::{default_prover, ExecutorEnv};
use dong_chain_core::{fetch_blocks, StateTree};

fn generate_proof(
    start_block: u64,
    end_block: u64,
    prev_state_root: [u8; 32],
) -> anyhow::Result<Receipt> {
    // Fetch blocks from Dong Chain node
    let blocks = fetch_blocks(start_block, end_block)?;
    let block_count = blocks.len() as u64;

    // Build execution environment for guest
    let env = ExecutorEnv::builder()
        .write(&prev_state_root)?
        .write(&blocks)?
        .write(&block_count)?
        .build()?;

    // Generate zk-STARK proof
    // This takes ~5 minutes for 1000 blocks on GPU hardware
    let prover = default_prover();
    let receipt = prover.prove(env, DONG_CHAIN_VERIFIER_ELF)?;

    // Verify proof locally before broadcasting
    receipt.verify(DONG_CHAIN_VERIFIER_IMAGE_ID)?;

    Ok(receipt)
}
```

## Proof Structure (zk-STARK)

```
Receipt {
    journal: {
        new_state_root: [u8; 32],    // Public output: new Merkle root
        last_block_number: u64,       // Public output: covered range
    },
    proof: StarkProof {
        // Algebraic Intermediate Representation (AIR) components
        // Instruction decode trace
        // Register read/write trace
        // Memory access trace
        // Compressed via FRI (Fast Reed-Solomon IOP)
    },
    image_id: [u32; 8],  // Identifies the RISC-V guest binary
}
```

## Bitcoin Anchoring via BitVM

```rust
// Inscribe proof into Bitcoin
fn anchor_to_bitcoin(
    receipt: &Receipt,
    bitcoin_rpc: &BitcoinRpc,
) -> anyhow::Result<Txid> {
    // Serialize proof (compressed)
    let proof_bytes = receipt.encode_compressed()?;

    // Create BitVM payload
    let payload = BitVMPayload {
        protocol_version: 1,
        prev_state_root: receipt.journal.prev_state_root,
        new_state_root: receipt.journal.new_state_root,
        block_range: (receipt.journal.first_block, receipt.journal.last_block_number),
        proof_commitment: keccak256(&proof_bytes),
        // Full proof stored off-chain (too large for OP_RETURN)
        // Only commitment goes on-chain
    };

    // Embed commitment in Bitcoin OP_RETURN
    let anchor_tx = bitcoin_rpc.send_op_return(
        BITVM_ANCHOR_ADDRESS,
        &payload.encode(),
    ).await?;

    Ok(anchor_tx)
}
```

## Proof Verification (On-chain)

On Dong Chain, a verifier contract can check proofs from other parties:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ZKStateVerifier
/// @notice Verifies RISC Zero proofs of Dong Chain state transitions
///         Used for cross-chain proof submission and dispute resolution
contract ZKStateVerifier {
    // RISC Zero verifier address
    IRiscZeroVerifier public immutable RISC_ZERO_VERIFIER;

    // Image ID of the approved guest program binary
    bytes32 public immutable DONG_CHAIN_IMAGE_ID;

    event StateProofVerified(
        bytes32 prevStateRoot,
        bytes32 newStateRoot,
        uint64 blockStart,
        uint64 blockEnd
    );

    constructor(address verifier, bytes32 imageId) {
        RISC_ZERO_VERIFIER = IRiscZeroVerifier(verifier);
        DONG_CHAIN_IMAGE_ID = imageId;
    }

    function verifyStateTransition(
        bytes calldata seal,       // STARK proof
        bytes32 prevStateRoot,
        bytes32 newStateRoot,
        uint64 blockStart,
        uint64 blockEnd
    ) external {
        // Encode public journal (what the guest committed to)
        bytes memory journal = abi.encode(
            newStateRoot,
            blockEnd,
            prevStateRoot,
            blockStart
        );

        // Verify the proof — reverts if invalid
        RISC_ZERO_VERIFIER.verify(seal, DONG_CHAIN_IMAGE_ID, sha256(journal));

        emit StateProofVerified(prevStateRoot, newStateRoot, blockStart, blockEnd);
    }
}
```

## Privacy with NIZK Proofs

For private RWA transactions, NIZK (Non-Interactive Zero-Knowledge) proofs verify validity without revealing amounts:

```
User proves:
  "I am sending a valid amount from an account I own"
  WITHOUT revealing:
  - Exact amount
  - Sender address
  - Transaction history

Verifier checks:
  - Proof is valid
  - No double-spend (nullifier set)
  - Asset compliance rules satisfied
```

This uses Groth16 or PLONK proofs compiled to RISC-V and deployed as smart contracts.

## Proving Infrastructure

### Hardware Requirements

| Hardware | Proof Time (1000 blocks) | Monthly Cost (cloud) |
|---|---|---|
| NVIDIA RTX 3080 (consumer) | ~15 minutes | ~$300 |
| NVIDIA A100 (data center) | ~4 minutes | ~$2,000 |
| Multi-GPU cluster (8x A100) | ~1 minute | ~$15,000 |

### BONSAI Cloud Proving (RISC Zero)

For teams without GPU infrastructure:

```bash
# Set API key
export BONSAI_API_KEY=<your-key>
export BONSAI_API_URL=https://api.bonsai.xyz

# Proofs are generated in RISC Zero's cloud
# Cost: ~$0.01-0.10 per proof (varies by complexity)
```

## Batch Strategy

| Batch Size | Proof Time | Bitcoin Anchor Cost | Use Case |
|---|---|---|---|
| 100 blocks | ~1 min | ~$0.50 | Fast finality (testnet) |
| 1,000 blocks | ~5 min | ~$0.50 | Standard mainnet |
| 10,000 blocks | ~30 min | ~$0.50 | Cost-optimized |

Bitcoin anchor cost is fixed regardless of batch size — all amortization benefit goes to users.

## Related Docs

- [BitVM2 Bridge](./02-bitvm2-bridge.md) — Bitcoin anchoring mechanism
- [RISC-V VM](./04-risc-v-vm.md) — Why RISC-V is ZK-native
- [Security Model](../security/security-model.md)
