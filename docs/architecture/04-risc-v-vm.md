# RISC-V Execution VM (pallet-revive / PolkaVM)

## Why RISC-V?

Dong Chain replaces both EVM and WASM with the **RISC-V Instruction Set Architecture** for smart contract execution. This is the most significant architectural decision in the entire system.

### EVM Limitations

| Problem | Impact |
|---|---|
| Stack machine — hard to optimize | High gas costs, performance bottlenecks |
| Precompile-only crypto | New elliptic curves need hard fork to add |
| No standard library access | Cryptographic code must be custom-written |

### WASM Limitations

| Problem | Impact |
|---|---|
| High-level structure requires global validation | Startup delays, potential validation bugs |
| Stack → register compilation is non-linear | Sub-optimal executable code |
| Wasmtime/Wasmer JIT has edge-case bugs | Consensus risks from runtime differences |

### RISC-V Advantages

| Advantage | Explanation |
|---|---|
| Register machine | Natural fit for modern CPU pipelines (IF→ID→EX→MEM→WB) |
| Deterministic traps | Invalid instructions trap — no complex global validation needed |
| Open ISA | No license fees, hardware manufacturers can build RISC-V chips |
| Standard toolchain | GCC, LLVM, Clang all target RISC-V |
| Any language | Rust, C, C++, JavaScript, Solidity (via resolc) — all compile to RISC-V |
| ZK-native | RISC Zero zkVM natively simulates RV32IM — zero integration cost |

## PolkaVM Architecture

PolkaVM is Parity Technologies' RISC-V virtual machine, used as the execution engine inside `pallet-revive`.

### Supported ISA

PolkaVM implements **RV32E** (embedded profile):
- 16 general-purpose registers (r0-r15)
- RV32I: base integer operations
- RV32M: multiplication and division

### Register Layout

```
r0  = zero (hardwired to 0)
r1  = return address (ra)
r2  = stack pointer (sp)
r3  = global pointer (gp)
r4  = a0 — function argument 0 / return value 0
r5  = a1 — function argument 1 / return value 1
r6  = a2 — function argument 2
r7  = a3 — function argument 3
r8  = s0 — callee-saved
r9  = s1 — callee-saved
r10 = s2 — callee-saved
r11 = s3 — callee-saved
r12 = t0 — temporary
r13 = t1 — temporary
r14 = t2 — temporary
r15 = t3 — temporary
```

### Gas Metering Table

| Instruction Type | Gas Cost | Notes |
|---|---|---|
| ADD, SUB, AND, OR, XOR | 1 | Single cycle |
| SLL, SRL, SRA (shifts) | 1 | Single cycle |
| MUL, MULH | 3 | 3-cycle multiplier |
| DIV, REM | 8 | Variable latency divider |
| LW, LH, LB (loads) | 4 | Worst-case cache miss |
| SW, SH, SB (stores) | 4 | Write-through penalty |
| BEQ, BNE, BLT (branches) | 2 | Pipeline flush |
| JAL, JALR (jumps) | 2 | Branch penalty |
| Host function call | variable | Benchmarked per function |

## pallet-revive Integration

### Dual Execution Backend

```
Contract Deployment
        │
        ├─── PVM bytecode (.polkavm) ──▶ PolkaVM backend (RISC-V native)
        │                                  Maximum performance
        │
        └─── EVM bytecode (.evm)    ──▶ REVM backend (Ethereum VM)
                                          Full EVM compatibility
```

**Choosing a backend:**
- Use **PVM** for new contracts, Rust contracts, or Solidity compiled via resolc
- Use **REVM** for existing audited contracts where EVM bytecode is the reference

### Host Functions (seal_* API)

Contracts communicate with the Dong Chain runtime via host functions:

```rust
// Storage operations
fn seal_set_storage(key_ptr: u32, key_len: u32, val_ptr: u32, val_len: u32) -> u32;
fn seal_get_storage(key_ptr: u32, key_len: u32, out_ptr: u32, out_len_ptr: u32) -> u32;
fn seal_clear_storage(key_ptr: u32, key_len: u32) -> u32;
fn seal_storage_size(key_ptr: u32, key_len: u32) -> u32;

// Execution context
fn seal_caller(out_ptr: u32, out_len_ptr: u32);
fn seal_address(out_ptr: u32, out_len_ptr: u32);
fn seal_value_transferred(out_ptr: u32, out_len_ptr: u32);
fn seal_block_number(out_ptr: u32, out_len_ptr: u32);
fn seal_now(out_ptr: u32, out_len_ptr: u32);
fn seal_gas_left(out_ptr: u32, out_len_ptr: u32);

// Cryptographic operations
fn seal_hash_keccak_256(input_ptr: u32, input_len: u32, out_ptr: u32);
fn seal_hash_blake2_256(input_ptr: u32, input_len: u32, out_ptr: u32);
fn seal_hash_sha2_256(input_ptr: u32, input_len: u32, out_ptr: u32);
fn seal_ecdsa_recover(sig_ptr: u32, msg_hash_ptr: u32, out_ptr: u32) -> u32;

// Contract interaction
fn seal_call(
    flags: u32, callee_ptr: u32, gas: u64,
    value_ptr: u32, input_ptr: u32, input_len: u32,
    out_ptr: u32, out_len_ptr: u32
) -> u32;
fn seal_instantiate(
    code_hash_ptr: u32, gas: u64, value_ptr: u32,
    input_ptr: u32, input_len: u32,
    address_ptr: u32, out_ptr: u32, out_len_ptr: u32
) -> u32;
fn seal_terminate(beneficiary_ptr: u32);

// Events
fn seal_deposit_event(
    topics_ptr: u32, topics_len: u32,
    data_ptr: u32, data_len: u32
);
```

## resolc Compiler

### What is resolc?

`resolc` (Revive Solidity Compiler) is the official Parity Technologies compiler that translates Solidity smart contracts to PolkaVM (RISC-V) bytecode.

### Compilation Pipeline

```
Solidity (.sol)
     │
     ▼  solc (Ethereum Solidity compiler)
   Yul IR / EVM Assembly
     │
     ▼  resolc (Revive compiler frontend)
   LLVM IR (target: riscv32-unknown-none-elf)
     │
     ▼  LLVM backend + optimizations
   RISC-V binary
     │
     ▼  PolkaVM linker
  .polkavm artifact
     │
     ▼  pallet-revive upload_code
  Code hash stored on-chain
```

### Basic Usage

```bash
# Install resolc
cargo install resolc

# Compile single file
resolc --target polkavm MyContract.sol

# Compile with optimizations
resolc --target polkavm \
       --optimization 3 \
       --output-dir ./artifacts \
       MyContract.sol

# Output:
# artifacts/MyContract.polkavm   - RISC-V bytecode
# artifacts/MyContract.abi       - ABI JSON
# artifacts/MyContract.metadata  - Compiler metadata
```

### Foundry Integration

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]

# Use resolc instead of solc
compiler = "resolc"
compiler_version = "0.1.0"   # pin to tested version

[profile.default.resolc]
target = "polkavm"
optimization = "3"
```

### Hardhat Integration

```javascript
// hardhat.config.js
require("@parity/hardhat-revive");

module.exports = {
  solidity: "0.8.24",
  revive: {
    compiler: "resolc",
    version: "0.1.0",
    target: "polkavm",
  },
  networks: {
    dongchain: {
      url: "http://localhost:9944",
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

## Cryptographic Agnosticism

Because RISC-V emulates a complete computer architecture, contracts can use **any cryptographic library** without precompiles:

```rust
// Example: Verify a BLS12-381 signature in a RISC-V contract
// No precompile needed — pure RISC-V computation
use bls12_381::{G1Affine, G2Affine, pairing, Scalar};

pub fn verify_bls_signature(
    pubkey: G1Affine,
    message: &[u8],
    signature: G2Affine,
) -> bool {
    let h = hash_to_g2(message);
    pairing(&pubkey, &h) == pairing(&G1Affine::generator(), &signature)
}
```

This enables:
- Custom ZK proof verifiers deployed as contracts
- Post-quantum cryptographic schemes
- Novel signature schemes for specific use cases
- All without hard forks

## Performance Benchmarks

| Operation | EVM Gas | RISC-V Gas (PVM) | Speedup |
|---|---|---|---|
| ERC-20 transfer | 21,000 | ~9,000 | 2.3x |
| ERC-721 mint | 85,000 | ~35,000 | 2.4x |
| Keccak-256 hash | 30 gas/word | 12 gas/word | 2.5x |
| ECDSA recovery | 3,000 | 1,200 | 2.5x |
| 100-instruction loop | variable | ~100 | significant |

*Benchmarks are preliminary estimates from pallet-revive internal testing. Official benchmarks to be published pre-mainnet.*

## Related Docs

- [Solidity → RISC-V Compilation](../smart-contracts/solidity-to-riscv.md)
- [Substrate Parachain](./03-substrate-parachain.md)
- [ZK Integration](./07-zk-integration.md)
