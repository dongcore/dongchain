# Environment Setup

This guide walks through setting up the complete Dong Chain development environment.

## 1. Clone the Repository

```bash
git clone https://github.com/dongchain/dong-chain
cd dong-chain

# Install git submodules (Substrate, pallet-revive, etc.)
git submodule update --init --recursive
```

## 2. Environment Variables

Create a `.env` file in the project root:

```bash
cp .env.example .env
```

Edit `.env`:
```bash
# Bitcoin/OmniCore RPC
BITCOIN_RPC_URL=http://localhost:8332
BITCOIN_RPC_USER=dongchain
BITCOIN_RPC_PASS=<your-strong-password>

# Dong Chain Node
DONGCHAIN_RPC_URL=http://localhost:9944
DONGCHAIN_WS_URL=ws://localhost:9944

# Deployer keys (NEVER commit real keys)
DEPLOYER_PRIVATE_KEY=0x...  # testnet only
MPC_ALLOCATOR_ADDRESS=0x...

# Bundler
BUNDLER_PORT=3000
ENTRY_POINT_ADDRESS=0x...   # set after deployment

# ZK Prover (optional)
RISC_ZERO_API_KEY=           # for BONSAI cloud proving
```

## 3. Build the Dong Chain Node

```bash
# Build release binary (~15-20 min first time)
cargo build --release -p dong-chain-node

# Verify build
./target/release/dong-chain-node --version
```

## 4. resolc Toolchain Verification

```bash
# Verify resolc can compile OpenZeppelin contracts
cd examples/contracts

# Compile ERC-20
resolc --target polkavm \
       --optimization 3 \
       --output-dir artifacts \
       ERC20.sol

ls artifacts/
# ERC20.polkavm  ERC20.abi  ERC20.metadata
```

## 5. Foundry Project Setup

```bash
cd contracts

# Install dependencies
forge install

# Install OpenZeppelin (if not already)
forge install OpenZeppelin/openzeppelin-contracts

# Verify tests compile
forge build

# Run tests
forge test
```

`foundry.toml`:
```toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"

[profile.polkavm]
src = "src"
out = "out-polkavm"
compiler = "resolc"

[rpc_endpoints]
dongchain = "${DONGCHAIN_RPC_URL}"
```

## 6. Hardhat Setup (Alternative)

```bash
cd contracts-hardhat
npm install

# Verify connection
npx hardhat compile
```

`hardhat.config.js`:
```javascript
require("@nomicfoundation/hardhat-toolbox");
require("@parity/hardhat-revive");   // resolc plugin

module.exports = {
  solidity: {
    version: "0.8.24",
    settings: { optimizer: { enabled: true, runs: 200 } }
  },
  revive: {
    compiler: "resolc",
    version: "0.1.0",
    target: "polkavm",
    optimization: "3",
  },
  networks: {
    dongchain_local: {
      url: process.env.DONGCHAIN_RPC_URL,
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 1337,   // Update with actual Dong Chain chainId
    },
    dongchain_testnet: {
      url: "https://rpc.testnet.dongchain.io",
      accounts: [process.env.DEPLOYER_PRIVATE_KEY],
      chainId: 9999,   // Update with actual testnet chainId
    },
  },
};
```

## 7. Metamask Configuration

Connect Metamask to local Dong Chain node:

| Field | Value |
|---|---|
| Network Name | Dong Chain Local |
| RPC URL | http://localhost:9944 |
| Chain ID | 1337 (or configured chainId) |
| Currency Symbol | DONG |
| Block Explorer | http://localhost:4000 (if running local explorer) |

## 8. Run Local Development Stack

```bash
# Terminal 1: Start Dong Chain node (development mode)
./target/release/dong-chain-node \
  --dev \
  --rpc-port 9944 \
  --ws-port 9945 \
  --tmp

# Terminal 2: Start Bundler (ERC-4337)
cd bundler
npm start

# Terminal 3: (Optional) Start Bitcoin/OmniCore testnet
omnicored -testnet \
  -txindex=1 \
  -rpcuser=dongchain \
  -rpcpassword=test \
  -rpcport=18332

# Terminal 4: Deploy contracts
cd contracts
forge script script/Deploy.s.sol \
  --rpc-url http://localhost:9944 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast
```

## 9. Verify Full Stack

```bash
# Check node is running
cast block-number --rpc-url http://localhost:9944

# Check chain ID
cast chain-id --rpc-url http://localhost:9944

# Send test transaction
cast send \
  --rpc-url http://localhost:9944 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  $RECIPIENT_ADDRESS \
  --value 1ether

# Deploy test ERC-20
forge create \
  --rpc-url http://localhost:9944 \
  --private-key $DEPLOYER_PRIVATE_KEY \
  src/tokens/TestERC20.sol:TestERC20
```

## Common Issues

### "OmniCore refused to start"
→ Check `txindex=1` is set in `bitcoin.conf`. Re-index may be required.

### "resolc: command not found"
→ Run `cargo install resolc` and ensure `~/.cargo/bin` is in PATH.

### "Substrate build fails on protobuf"
→ Install `protobuf-compiler`: `sudo apt-get install protobuf-compiler`

### "Metamask not connecting"
→ Ensure node is running with `--unsafe-rpc-external` or binding to `0.0.0.0` for external access.

## Next Steps

→ [Node Setup](./03-node-setup.md) — Production node configuration
→ [Quickstart](./04-quickstart.md) — Deploy your first contract
