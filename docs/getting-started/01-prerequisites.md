# Prerequisites

Before setting up Dong Chain development environment, ensure you have the following.

## Hardware Requirements

| Component | Minimum | Recommended |
|---|---|---|
| CPU | 8 cores | 16+ cores |
| RAM | 32 GB | 64 GB |
| Storage | 1 TB NVMe | 2 TB NVMe |
| Network | 100 Mbps | 1 Gbps |
| GPU (ZK prover only) | NVIDIA RTX 3080 | NVIDIA A100 |

**Note:** The 1TB minimum is for running Bitcoin + OmniCore full node. For contract development only (no Bitcoin node), 100 GB SSD is sufficient.

## Operating System

- **Linux** (Ubuntu 22.04 LTS recommended)
- macOS 13+ (for local development, not production)
- Windows WSL2 (development only)

## Required Software

### Rust Toolchain
```bash
# Install rustup
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source ~/.cargo/env

# Install required targets and components
rustup update stable
rustup target add riscv32e-unknown-none-elf     # For RISC-V contract compilation
rustup target add wasm32-unknown-unknown        # For Substrate runtime WASM
rustup component add rust-src clippy rustfmt

# Verify
rustc --version   # >= 1.78.0
cargo --version
```

### Substrate Build Dependencies

```bash
# Ubuntu/Debian
sudo apt-get update && sudo apt-get install -y \
    build-essential \
    clang \
    curl \
    git \
    libssl-dev \
    llvm \
    pkg-config \
    protobuf-compiler \
    cmake

# macOS
brew install cmake llvm openssl protobuf
```

### resolc (Revive Solidity Compiler)

```bash
# Install from source
cargo install resolc

# Or download binary release (check GitHub releases)
# https://github.com/paritytech/resolc/releases

resolc --version   # Verify installation
```

### Bitcoin Core + OmniCore

```bash
# Ubuntu
sudo add-apt-repository ppa:bitcoin/bitcoin
sudo apt-get update
sudo apt-get install bitcoind

# OmniCore (replaces bitcoind)
# Download from: https://github.com/OmniLayer/omnicore/releases
wget https://github.com/OmniLayer/omnicore/releases/download/v0.12.0/omnicore-0.12.0-x86_64-linux-gnu.tar.gz
tar -xzf omnicore-*.tar.gz
sudo mv omnicore-*/bin/* /usr/local/bin/
```

### Node.js & npm (for Hardhat/Bundler)
```bash
# NVM recommended
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
nvm install 20
nvm use 20
node --version   # >= 20.0.0
npm --version
```

### Foundry

```bash
curl -L https://foundry.paradigm.xyz | bash
foundryup
forge --version   # >= 0.2.0
cast --version
```

## Knowledge Prerequisites

| Area | Level Required | Resources |
|---|---|---|
| Rust programming | Intermediate | [The Rust Book](https://doc.rust-lang.org/book/) |
| Substrate/Polkadot basics | Beginner | [Substrate Docs](https://docs.substrate.io) |
| Solidity smart contracts | Intermediate | [Solidity Docs](https://docs.soliditylang.org) |
| Ethereum JSON-RPC | Basic | [Ethereum JSON-RPC Spec](https://ethereum.org/en/developers/docs/apis/json-rpc/) |
| Bitcoin/UTXO model | Basic | [Bitcoin Developer Guide](https://developer.bitcoin.org/devguide/) |
| ERC-4337 Account Abstraction | Basic | [ERC-4337 Spec](https://eips.ethereum.org/EIPS/eip-4337) |

## Development Tools (Optional but Recommended)

```bash
# cargo-contract (for ink! contracts, optional)
cargo install cargo-contract

# subkey (Substrate key generation)
cargo install subkey

# polkadot-js/api (JavaScript SDK)
npm install -g @polkadot/api

# cast (Foundry transaction tool)
# included with foundry
```

## Next Steps

→ [Environment Setup](./02-environment-setup.md)
