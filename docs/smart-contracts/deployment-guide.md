# Contract Deployment Guide

## Overview

Contracts on Dong Chain can be deployed via:
1. **Foundry** (recommended for new development)
2. **Hardhat** (for teams migrating from Ethereum)
3. **Substrate RPC** (direct, for advanced use)

## Pre-Deployment Checklist

- [ ] Contract compiled with resolc to `.polkavm` (for PVM) or `solc` (for REVM)
- [ ] All tests pass: `forge test` with 100% branch coverage
- [ ] Fuzz tests run: `forge test --fuzz-runs 100000`
- [ ] Security audit complete (for mainnet/any funds)
- [ ] resolc version pinned in repository
- [ ] Constructor arguments verified
- [ ] Non-upgradeability confirmed (for Depository/EntryPoint)

## Foundry Deployment

### Setup

```bash
# foundry.toml
[profile.default]
src = "src"
out = "out"
libs = ["lib"]
solc_version = "0.8.24"

[rpc_endpoints]
dongchain_local = "http://localhost:9944"
dongchain_testnet = "https://rpc.testnet.dongchain.io"
dongchain_mainnet = "https://rpc.mainnet.dongchain.io"

[etherscan]
dongchain_testnet = { key = "none", url = "https://explorer.testnet.dongchain.io/api" }
```

### Deployment Script

```solidity
// script/Deploy.s.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DongChainDepository.sol";
import "../src/EntryPoint.sol";
import "../src/DongChainAccountFactory.sol";
import "../src/DongChainSponsorPaymaster.sol";

contract DeployDongChain is Script {
    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address mpcAllocator = vm.envAddress("MPC_ALLOCATOR_ADDRESS");

        console.log("Deployer:", deployer);
        console.log("MPC Allocator:", mpcAllocator);

        vm.startBroadcast(deployerKey);

        // 1. Deploy EntryPoint (ERC-4337)
        EntryPoint entryPoint = new EntryPoint();
        console.log("EntryPoint:", address(entryPoint));

        // 2. Deploy Account Factory
        DongChainAccountFactory factory = new DongChainAccountFactory(address(entryPoint));
        console.log("AccountFactory:", address(factory));

        // 3. Deploy Paymaster
        DongChainSponsorPaymaster paymaster = new DongChainSponsorPaymaster(entryPoint);
        paymaster.deposit{value: 1 ether}();  // Fund paymaster
        console.log("Paymaster:", address(paymaster));

        // 4. Deploy Depository (non-upgradable)
        DongChainDepository depository = new DongChainDepository(mpcAllocator);
        console.log("Depository:", address(depository));

        vm.stopBroadcast();

        // Write deployment addresses
        _saveDeployment(address(entryPoint), address(factory), address(paymaster), address(depository));
    }

    function _saveDeployment(
        address entryPoint,
        address factory,
        address paymaster,
        address depository
    ) internal {
        string memory json = string.concat(
            '{"entryPoint":"', vm.toString(entryPoint),
            '","factory":"', vm.toString(factory),
            '","paymaster":"', vm.toString(paymaster),
            '","depository":"', vm.toString(depository), '"}'
        );
        vm.writeFile("./deployments/dongchain.json", json);
    }
}
```

```bash
# Deploy to local node
forge script script/Deploy.s.sol \
  --rpc-url dongchain_local \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  -vvvv

# Deploy to testnet
forge script script/Deploy.s.sol \
  --rpc-url dongchain_testnet \
  --private-key $DEPLOYER_PRIVATE_KEY \
  --broadcast \
  --verify \
  -vvvv
```

### Verify Deployment

```bash
# Verify contract on block explorer
forge verify-contract \
  --chain-id 9999 \
  --etherscan-api-key none \
  --verifier-url https://explorer.testnet.dongchain.io/api \
  $CONTRACT_ADDRESS \
  src/DongChainDepository.sol:DongChainDepository \
  --constructor-args $(cast abi-encode "constructor(address)" $MPC_ALLOCATOR)
```

## Hardhat Deployment

```javascript
// scripts/deploy.js
const { ethers } = require("hardhat");
const fs = require("fs");

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("Deployer:", deployer.address);
    console.log("Balance:", ethers.formatEther(await ethers.provider.getBalance(deployer.address)));

    const MPC_ALLOCATOR = process.env.MPC_ALLOCATOR_ADDRESS;

    // Deploy EntryPoint
    const EntryPoint = await ethers.getContractFactory("EntryPoint");
    const entryPoint = await EntryPoint.deploy();
    await entryPoint.waitForDeployment();
    console.log("EntryPoint:", await entryPoint.getAddress());

    // Deploy Depository
    const Depository = await ethers.getContractFactory("DongChainDepository");
    const depository = await Depository.deploy(MPC_ALLOCATOR);
    await depository.waitForDeployment();
    console.log("Depository:", await depository.getAddress());

    // Save addresses
    const deployment = {
        entryPoint: await entryPoint.getAddress(),
        depository: await depository.getAddress(),
        network: (await ethers.provider.getNetwork()).name,
        block: await ethers.provider.getBlockNumber(),
    };

    fs.writeFileSync(
        `./deployments/${deployment.network}.json`,
        JSON.stringify(deployment, null, 2)
    );
}

main().catch((err) => { console.error(err); process.exit(1); });
```

```bash
npx hardhat run scripts/deploy.js --network dongchain_testnet
```

## Using Deployed Contracts

### JavaScript/TypeScript

```typescript
import { ethers } from "ethers";
import DepositoryABI from "./artifacts/DongChainDepository.abi.json";
import deployment from "./deployments/dongchain.json";

const provider = new ethers.JsonRpcProvider(process.env.DONGCHAIN_RPC_URL);
const signer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

const depository = new ethers.Contract(
    deployment.depository,
    DepositoryABI,
    signer
);

// Deposit ERC-20
const tx = await depository.depositErc20(
    depositorAddress,
    tokenAddress,
    ethers.parseEther("100"),
    ethers.randomBytes(32)  // orderId
);
await tx.wait();
console.log("Deposited:", tx.hash);
```

### Cast (Foundry CLI)

```bash
# Read from contract
cast call $DEPOSITORY "MPC_ALLOCATOR()(address)" --rpc-url $DONGCHAIN_RPC

# Check if nonce used
cast call $DEPOSITORY "usedNonces(bytes32)(bool)" 0x$(openssl rand -hex 32) --rpc-url $DONGCHAIN_RPC

# Send transaction
cast send $DEPOSITORY \
  "depositNative(address,bytes32)" \
  $DEPOSITOR_ADDRESS \
  0x$(openssl rand -hex 32) \
  --value 1ether \
  --rpc-url $DONGCHAIN_RPC \
  --private-key $PRIVATE_KEY
```

## Deployment Addresses Registry

Track all deployments in `deployments/`:

```
deployments/
├── dongchain-local.json      # Local development
├── dongchain-testnet.json    # Public testnet
└── dongchain-mainnet.json    # Mainnet (TBD)
```

Format:
```json
{
  "network": "dongchain-testnet",
  "chainId": 9999,
  "deployedAt": "2026-03-27T00:00:00Z",
  "block": 100000,
  "deployer": "0x...",
  "contracts": {
    "EntryPoint": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
    "AccountFactory": "0x...",
    "Paymaster": "0x...",
    "Depository": "0x..."
  }
}
```

## Related Docs

- [Solidity → RISC-V](./solidity-to-riscv.md)
- [Token Standards](./token-standards.md)
- [Quickstart](../getting-started/04-quickstart.md)
