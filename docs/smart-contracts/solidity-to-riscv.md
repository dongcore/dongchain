# Solidity → RISC-V Compilation Guide

## Overview

Dong Chain uses `resolc` (Revive Solidity Compiler) to compile standard Solidity contracts to PolkaVM (RISC-V) bytecode. Existing Solidity code (including OpenZeppelin) works without modification.

## Compilation Pipeline

```
Solidity (.sol)
    │
    ▼  solc v0.8.24+
  Yul IR (intermediate representation)
    │
    ▼  resolc frontend
  LLVM IR (target: riscv32-unknown-none-elf)
    │
    ▼  LLVM optimization passes (O3)
  Optimized RISC-V assembly
    │
    ▼  PolkaVM linker
  .polkavm binary (RISC-V bytecode)
```

## resolc Installation

```bash
# Method 1: cargo install
cargo install resolc

# Method 2: Download binary
# https://github.com/paritytech/resolc/releases
wget https://github.com/paritytech/resolc/releases/download/v0.1.0/resolc-linux-x86_64
chmod +x resolc-linux-x86_64
sudo mv resolc-linux-x86_64 /usr/local/bin/resolc

# Verify
resolc --version
```

## Basic Usage

```bash
# Compile single file
resolc --target polkavm MyContract.sol

# Compile with optimization
resolc --target polkavm --optimization 3 MyContract.sol

# Specify output directory
resolc --target polkavm --output-dir ./artifacts MyContract.sol

# Compile multiple files
resolc --target polkavm --output-dir ./artifacts src/*.sol

# Include OpenZeppelin library path
resolc --target polkavm \
       --optimization 3 \
       --output-dir ./artifacts \
       --base-path . \
       --include-path lib \
       src/MyContract.sol
```

## Output Files

For each compiled contract:

| File | Description |
|---|---|
| `MyContract.polkavm` | RISC-V bytecode for deployment |
| `MyContract.abi` | ABI JSON (same format as EVM) |
| `MyContract.metadata` | Compiler metadata and settings |

## Foundry Integration

```toml
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"

# Enable resolc compiler for PVM target
[profile.polkavm]
src = "src"
out = "out-polkavm"
# resolc integration is WIP — check Foundry docs for latest plugin
```

**Deployment via Foundry:**
```bash
# Deploy from pre-compiled .polkavm file
forge create \
  --rpc-url $DONGCHAIN_RPC \
  --private-key $PRIVATE_KEY \
  --artifact-path artifacts/MyContract.polkavm \
  --abi artifacts/MyContract.abi \
  --constructor-args <args>
```

## Hardhat Integration

```bash
npm install @parity/hardhat-revive
```

```javascript
// hardhat.config.js
require("@parity/hardhat-revive");

module.exports = {
  solidity: "0.8.24",
  revive: {
    compiler: "resolc",
    version: "0.1.0",
    target: "polkavm",
    optimization: "3",
  },
  networks: {
    dongchain: {
      url: process.env.DONGCHAIN_RPC_URL,
      accounts: [process.env.PRIVATE_KEY],
    },
  },
};
```

```bash
# Compile
npx hardhat compile

# Deploy
npx hardhat run scripts/deploy.js --network dongchain
```

## Compiler Version Pinning

**Critical:** Always pin resolc version in CI/CD to prevent unexpected behavior from compiler updates.

```bash
# .resolc-version file
0.1.0
```

```yaml
# .github/workflows/compile.yml
- name: Install resolc
  run: |
    RESOLC_VERSION=$(cat .resolc-version)
    cargo install resolc --version $RESOLC_VERSION
```

## OpenZeppelin Compatibility

All standard OpenZeppelin contracts compile successfully:

```bash
# Install OpenZeppelin
forge install OpenZeppelin/openzeppelin-contracts

# Compile ERC-20
resolc --target polkavm \
       --optimization 3 \
       --output-dir artifacts \
       --base-path . \
       --include-path lib \
       src/MyERC20.sol

# Compile ERC-721
resolc --target polkavm \
       --optimization 3 \
       --output-dir artifacts \
       --base-path . \
       --include-path lib \
       src/MyERC721.sol

# Compile ERC-1155
resolc --target polkavm \
       --optimization 3 \
       --output-dir artifacts \
       --base-path . \
       --include-path lib \
       src/MyERC1155.sol
```

## Known Limitations & Differences

| Feature | EVM | PVM (RISC-V) | Notes |
|---|---|---|---|
| `block.basefee` | Yes | Partial | Gas model differs |
| `tx.gasprice` | Yes | Adapted | RISC-V gas metering |
| `SELFDESTRUCT` | Deprecated | Unsupported | Use withdraw pattern |
| `EXTCODECOPY` | Yes | Limited | Check resolc docs |
| Inline assembly | Yes | Restricted | No raw EVM opcodes |
| Precompiles (e.g., ecrecover) | Via opcode | Via seal_ecdsa_recover | Different calling convention |

## Cross-Compilation Audit Requirements

**Before mainnet deployment**, contracts compiled via resolc MUST undergo:

1. **Source audit** — Standard Solidity audit (e.g., Trail of Bits, OpenZeppelin Security)
2. **PVM bytecode audit** — Verify the RISC-V output matches Solidity intent
   - Key risk: LLVM optimization may introduce semantic differences from Yul IR
3. **Differential testing** — Run same inputs against EVM and PVM backends, compare outputs
4. **Fuzzing** — Foundry invariant tests + Echidna on compiled PVM

```bash
# Differential testing setup
forge test --match-contract DifferentialTest \
  --rpc-url $DONGCHAIN_RPC    # PVM backend
# vs.
forge test --match-contract DifferentialTest \
  --rpc-url $ETHEREUM_RPC     # EVM baseline
```

## Rust Contracts (Native RISC-V)

For maximum performance, write contracts directly in Rust targeting RISC-V:

```rust
// src/lib.rs — Native Rust smart contract for Dong Chain
#![no_std]
#![no_main]

use polkavm_derive::polkavm_export;

#[polkavm_export]
fn transfer(to: [u8; 20], amount: u64) -> u32 {
    // Direct RISC-V contract logic
    // No EVM compatibility layer needed
    0 // success
}
```

```bash
# Compile Rust to RISC-V
cargo build \
  --target riscv32e-unknown-none-elf \
  --release

# Output: target/riscv32e-unknown-none-elf/release/my_contract
```

## Gas Optimization Tips

1. **Use `uint256` over smaller types** — RISC-V is a 32-bit architecture; packing doesn't save gas the same way as EVM
2. **Prefer batch operations** — fewer cross-contract calls saves overhead
3. **Storage access patterns** — RISC-V memory is sequential; cache-friendly access patterns help
4. **Avoid recursive calls** — stack depth limits apply similarly to EVM

## Troubleshooting

### "resolc: unsupported Solidity feature"
→ Check if you're using inline assembly with EVM opcodes. Replace with Solidity equivalents or `seal_*` host functions.

### "Compilation succeeds but contract behaves differently"
→ This is the LLVM optimization semantic drift risk. File a bug report with the resolc team and revert to optimization level 1 temporarily.

### "ABI mismatch between resolc and solc"
→ ABI should be identical. If not, this is a resolc bug — report immediately.

## Related Docs

- [RISC-V VM Architecture](../architecture/04-risc-v-vm.md)
- [Token Standards](./token-standards.md)
- [Deployment Guide](./deployment-guide.md)
