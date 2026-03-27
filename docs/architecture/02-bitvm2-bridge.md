# BitVM2 — Trust-Minimized Bridge

## Overview

The BitVM2 bridge connects Bitcoin Layer-0 (OmniCore assets) to the Dong Chain parachain without requiring any Bitcoin consensus changes (no soft fork, no hard fork).

**Trust model:** 1-of-n liveness honesty — only ONE honest operator in the entire set is needed to ensure funds are safe.

## How BitVM2 Works

BitVM2 uses **optimistic verification with fraud proofs**, similar to Optimistic Rollups:

1. Computation happens off-chain (complex SNARK verification)
2. Bitcoin only acts as a dispute resolution layer
3. If no fraud is detected in the challenge period → transaction finalized
4. If fraud is detected → fraud proof submitted, attacker slashed on Bitcoin

### Key Cryptographic Primitives

#### Bit Commitment
For every bit `b` in a computation, the prover commits via hash locks:

```
If b=0: reveal preimage of H0 (computed as SHA256(secret_0))
If b=1: reveal preimage of H1 (computed as SHA256(secret_1))

Equivocation = revealing BOTH preimages for the same bit
             → this is the fraud proof that slashes the prover
```

#### Boolean Circuit (Universal NAND gates)
Any computable function `f(x)` is decomposed into NAND gates:
```
NAND(a, b) = NOT(AND(a, b))
```

A SNARK verification circuit with billions of gates is committed to a **Taproot tree**:
```
taproot_address = P + H(P || script_tree) · G

script_tree = {
    gate_0_script: IF reveal(H0_a) AND reveal(H0_b) → NAND output = 1
    gate_1_script: ...
    gate_N_script: SNARK_verify_final_step
}
```

Each leaf in the Taproot tree represents one gate in the SNARK verification circuit. Any single gate can be selectively executed for fraud proof purposes.

## Peg-In Flow (Bitcoin → Dong Chain)

```
Step 1: User initiates peg-in
  User holds OmniCore asset (e.g., property_id=42, amount=1000)
  User requests peg-in via Dong Chain frontend

Step 2: Lock asset on Bitcoin
  User sends OmniCore transfer to BitVM2 bridge address:
    omnicore-cli omni_send <user_addr> <bitvm2_bridge_addr> 42 1000

  Lock transaction confirmed on Bitcoin (6 block wait)

Step 3: Oracle submits peg-in to Dong Chain
  Decentralized oracle detects confirmed lock
  Submits mint extrinsic to Dong Chain:
    pallet_revive::mint_wrapped_asset(property_id=42, amount=1000, recipient=user_parachain_addr)

Step 4: Challenge period (7 days)
  ┌── No challenge → Peg-in finalized, user has wrapped tokens on Dong Chain
  └── Challenge raised:
        Challenger reveals fraudulent gate in Taproot script
        BitVM2 contract on Bitcoin verifies gate
        If fraud confirmed → operator's collateral slashed
        Peg-in reversed, user's Bitcoin assets returned
```

## Peg-Out Flow (Dong Chain → Bitcoin)

```
Step 1: User initiates peg-out on Dong Chain
  User calls: depository.burnWrappedForPegout(amount=1000, btc_dest_addr="bc1q...")

  Wrapped tokens burned on Dong Chain

Step 2: Operator pre-signs payout
  Operator observes burn event
  Creates and pre-signs Bitcoin payout transaction:
    payout_tx = { input: bitvm2_utxo, output: user's btc_addr, amount: 1000 }

Step 3: Challenge period (7 days)
  ┌── No challenge → Operator broadcasts payout_tx, user receives BTC/OmniCore assets
  └── Challenge raised:
        Requires proving operator was dishonest (e.g., double-spend attempt)
        Challenge resolved on-chain via fraud proof

Step 4: Operator fund recovery
  After peg-out settled, operator calls operator_recovery_script
  Recovers collateral from BitVM2 contract
```

## Operator Set Configuration

```toml
[bitvm2]
# Number of operators in the setup ceremony
operator_count = 9

# Minimum collateral per operator (in BTC)
collateral_per_operator = 1.5  # Must exceed total locked assets per operator slot

# Challenge period
challenge_period_days = 7

# Fraud proof submission window
fraud_proof_window_blocks = 1008  # ~7 days at 144 blocks/day
```

### Operator Setup Ceremony

The setup is a one-time **n-party computation** ceremony:
1. All n operators jointly generate the Taproot script tree
2. Each operator pre-signs the necessary Bitcoin transactions
3. Pre-signatures are stored in a distributed key management system
4. No single operator holds all keys — only 1 honest operator needed to enforce safety

## Security Analysis

| Attack | Outcome |
|---|---|
| All operators collude | Users lose funds (only scenario where funds are at risk) |
| 1 operator remains honest | Fraud proofs prevent any loss |
| Operator goes offline | Other operators can proceed; 1-of-n liveness |
| Invalid SNARK submitted | Fraud proof detected within 7-day window |
| Bitcoin reorg (< 6 blocks) | Peg-in waits 6 confirmations before minting |
| Bitcoin reorg (≥ 6 blocks) | Catastrophic — probability < 10^-10 per event |

## SNARK Verifier Circuit

The core of BitVM2 is a SNARK verifier circuit that proves Dong Chain's state transitions are valid. This circuit:

1. Takes as public input: `(S_prev_root, S_new_root, batch_hash)`
2. Verifies: the RISC Zero zkVM proof that transitions `S_prev → S_new` under `batch_hash`
3. Outputs: `valid = true/false`

This circuit, once committed to Taproot, allows Bitcoin to verify complex Dong Chain computations through the fraud proof mechanism.

## Implementation Notes

### SNARK Circuit Code (Rust, compiled to RISC-V for zkVM)

```rust
// Guest program for RISC Zero zkVM
// This code runs inside the zkVM and its execution is proven
use risc0_zkvm::guest::env;

fn main() {
    // Read public inputs from journal
    let prev_state_root: [u8; 32] = env::read();
    let transactions: Vec<Transaction> = env::read();

    // Process all transactions
    let mut state = StateTree::from_root(prev_state_root);
    for tx in &transactions {
        state.apply(tx);
    }

    // Commit new state root to journal (public output)
    env::commit(&state.root());
}
```

## Current Status & Roadmap

| Milestone | Status |
|---|---|
| BitVM2 protocol specification review | Done |
| Operator setup ceremony design | In Progress |
| SNARK circuit implementation | In Progress |
| Testnet peg-in/peg-out | Planned Q3 2026 |
| Mainnet bridge launch | Planned Q4 2026 |

## Related Docs

- [Layer 0 — Bitcoin & OmniCore](./01-layer0-bitcoin.md)
- [ZK Integration](./07-zk-integration.md)
- [Security Model](../security/security-model.md)
