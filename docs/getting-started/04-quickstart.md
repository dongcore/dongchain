# Quickstart — Deploy Your First Contract

This guide takes you from zero to a deployed ERC-20 token on Dong Chain in under 10 minutes.

## Step 1: Start Local Node

```bash
./target/release/dong-chain-node --dev --tmp
```

## Step 2: Write a Simple ERC-20

```solidity
// src/MyToken.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MyToken is ERC20 {
    constructor(uint256 initialSupply) ERC20("MyToken", "MTK") {
        _mint(msg.sender, initialSupply * 10 ** decimals());
    }
}
```

## Step 3: Compile to RISC-V

```bash
# Using resolc (compiles to PolkaVM RISC-V bytecode)
resolc --target polkavm \
       --optimization 3 \
       --output-dir artifacts \
       src/MyToken.sol

# Artifacts generated:
# artifacts/MyToken.polkavm  <- RISC-V bytecode
# artifacts/MyToken.abi      <- ABI for interaction
```

## Step 4: Deploy

### Via Foundry

```bash
forge create src/MyToken.sol:MyToken \
  --rpc-url http://localhost:9944 \
  --private-key 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80 \
  --constructor-args 1000000

# Output:
# Deployer: 0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266
# Deployed to: 0x5FbDB2315678afecb367f032d93F642f64180aa3
# Transaction hash: 0x...
```

### Via Hardhat

```javascript
// scripts/deploy.js
const { ethers } = require("hardhat");

async function main() {
    const MyToken = await ethers.getContractFactory("MyToken");
    const token = await MyToken.deploy(1_000_000);
    await token.waitForDeployment();
    console.log("MyToken deployed to:", await token.getAddress());
}

main().catch(console.error);
```

```bash
npx hardhat run scripts/deploy.js --network dongchain_local
```

## Step 5: Interact

```bash
# Check total supply
cast call 0x5FbDB... "totalSupply()(uint256)" --rpc-url http://localhost:9944

# Transfer tokens
cast send 0x5FbDB... \
  "transfer(address,uint256)(bool)" \
  0x70997970C51812dc3A010C7d01b50e0d17dc79C8 \
  1000000000000000000 \
  --rpc-url http://localhost:9944 \
  --private-key 0xac0974...
```

## Step 6: Deploy an NFT (ERC-721) for Gaming

```solidity
// src/GameCharacter.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract GameCharacter is ERC721URIStorage, Ownable {
    uint256 private _nextTokenId;

    // No admin mint/burn after deployment (player sovereignty)
    bool public mintingOpen = true;

    constructor() ERC721("GameCharacter", "CHAR") Ownable(msg.sender) {}

    function mint(address player, string calldata characterURI)
        external
        returns (uint256)
    {
        require(mintingOpen, "Minting closed");
        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);
        _setTokenURI(tokenId, characterURI);
        return tokenId;
    }

    /// @notice Lock minting permanently — ensures player sovereignty
    function closeMinting() external onlyOwner {
        mintingOpen = false;
    }
}
```

```bash
# Deploy
forge create src/GameCharacter.sol:GameCharacter \
  --rpc-url http://localhost:9944 \
  --private-key $PRIVATE_KEY

# Mint a character NFT
cast send $GAME_CHARACTER_ADDRESS \
  "mint(address,string)(uint256)" \
  $PLAYER_ADDRESS \
  "ipfs://QmCharacterMetadata..." \
  --rpc-url http://localhost:9944 \
  --private-key $PRIVATE_KEY
```

## Step 7: Gasless Transaction (ERC-4337)

```javascript
// Using ERC-4337 for gasless mint
const { ethers } = require("ethers");
const { UserOperationBuilder } = require("@account-abstraction/sdk");

const provider = new ethers.JsonRpcProvider("http://localhost:9944");
const bundlerProvider = new ethers.JsonRpcProvider("http://localhost:3000");

// Build UserOperation
const userOp = await new UserOperationBuilder()
    .setSender(smartAccountAddress)
    .setCallData(
        gameCharacter.interface.encodeFunctionData("mint", [
            playerAddress,
            "ipfs://QmCharacterMetadata..."
        ])
    )
    .setPaymasterAndData(paymasterAddress + "00")  // sponsored
    .build(provider, entryPointAddress);

// Sign with user's key
userOp.signature = await wallet.signMessage(ethers.getBytes(userOpHash));

// Submit to Bundler (no gas needed from user)
const txHash = await bundlerProvider.send("eth_sendUserOperation", [
    userOp,
    entryPointAddress,
]);
console.log("UserOperation submitted:", txHash);
```

## Next Steps

- [ERC-4337 Account Abstraction](../components/erc4337-account-abstraction.md) — Full AA guide
- [Token Standards](../smart-contracts/token-standards.md) — ERC-20/721/1155 patterns
- [Solidity → RISC-V](../smart-contracts/solidity-to-riscv.md) — Compilation guide
- [Gaming Assets](../use-cases/gaming-assets.md) — Gaming integration patterns
