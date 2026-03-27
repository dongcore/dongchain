# ERC-4337 Account Abstraction

## Overview

ERC-4337 enables Smart Account wallets on Dong Chain — users interact through Smart Contracts instead of EOA (Externally Owned Accounts). This unlocks:

- **Gasless transactions** — dApps sponsor gas via Paymaster
- **Social recovery** — recover wallet without seed phrase
- **Biometric auth** — FaceID/fingerprint via P-256 signatures
- **Session keys** — bounded authorization for gaming (no popup per action)
- **Multi-sig** — enterprise-grade multi-signature wallets
- **Batching** — execute multiple actions atomically in one transaction

## Architecture

```
User (off-chain)
    │ signs UserOperation
    │
    ▼
Bundler (node)
    │ aggregates multiple UserOps
    │ calls handleOps()
    ▼
EntryPoint Contract (non-upgradable)
    │ validates each UserOp
    ├──▶ Smart Account.validateUserOp()
    │       └── verifies signature (ECDSA, P-256, multi-sig)
    │
    ├──▶ Paymaster.validatePaymasterUserOp() (if sponsored)
    │       └── verifies gas sponsorship
    │
    └──▶ Smart Account.execute()
            └── performs actual transaction
```

## UserOperation Structure

```typescript
interface UserOperation {
  sender: string;               // Smart Account address
  nonce: bigint;                // Replay protection
  initCode: string;             // "0x" for existing accounts, else factory + calldata
  callData: string;             // Encoded function call to execute
  callGasLimit: bigint;         // Gas for execute()
  verificationGasLimit: bigint; // Gas for validateUserOp()
  preVerificationGas: bigint;   // Gas for Bundler overhead
  maxFeePerGas: bigint;         // Max gas price (EIP-1559)
  maxPriorityFeePerGas: bigint; // Priority fee
  paymasterAndData: string;     // "0x" = user pays, else paymaster addr + data
  signature: string;            // ECDSA/P256/multisig signature over hash
}
```

## Deployment

### 1. Deploy EntryPoint

```bash
# EntryPoint is the same canonical contract as Ethereum ERC-4337
# Deploy at deterministic address using CREATE2

forge script script/DeployEntryPoint.s.sol \
  --rpc-url $DONGCHAIN_RPC \
  --private-key $DEPLOYER_KEY \
  --broadcast

# EntryPoint address: 0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789
# (Same as Ethereum mainnet if using CREATE2 with same salt)
```

### 2. Deploy Smart Account Factory

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@openzeppelin/contracts/utils/Create2.sol";

contract DongChainAccountFactory {
    address public immutable entryPoint;

    constructor(address _entryPoint) {
        entryPoint = _entryPoint;
    }

    /// @notice Deploy a new Smart Account (counterfactual)
    function createAccount(address owner, uint256 salt)
        external returns (DongChainSmartAccount)
    {
        address addr = getAddress(owner, salt);
        if (addr.code.length > 0) return DongChainSmartAccount(payable(addr));

        return DongChainSmartAccount(payable(Create2.deploy(
            0,
            bytes32(salt),
            abi.encodePacked(
                type(DongChainSmartAccount).creationCode,
                abi.encode(owner, entryPoint)
            )
        )));
    }

    /// @notice Compute counterfactual address before deployment
    function getAddress(address owner, uint256 salt) public view returns (address) {
        return Create2.computeAddress(
            bytes32(salt),
            keccak256(abi.encodePacked(
                type(DongChainSmartAccount).creationCode,
                abi.encode(owner, entryPoint)
            ))
        );
    }
}
```

### 3. Smart Account Implementation

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/core/BaseAccount.sol";
import "@account-abstraction/contracts/core/Helpers.sol";

contract DongChainSmartAccount is BaseAccount {
    address public owner;
    address public immutable ENTRY_POINT;

    constructor(address _owner, address _entryPoint) {
        owner = _owner;
        ENTRY_POINT = _entryPoint;
    }

    // ─── ERC-4337 Required ────────────────────────────────────────────────────

    function entryPoint() public view override returns (IEntryPoint) {
        return IEntryPoint(ENTRY_POINT);
    }

    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external override returns (uint256 validationData) {
        _requireFromEntryPoint();

        // Validate signature
        bytes32 hash = MessageHashUtils.toEthSignedMessageHash(userOpHash);
        address recovered = ECDSA.recover(hash, userOp.signature);
        bool sigValid = (recovered == owner);

        if (missingAccountFunds > 0) {
            payable(ENTRY_POINT).call{value: missingAccountFunds}("");
        }

        return sigValid ? 0 : SIG_VALIDATION_FAILED;
    }

    // ─── Execution ────────────────────────────────────────────────────────────

    function execute(address target, uint256 value, bytes calldata data)
        external
    {
        _requireFromEntryPointOrOwner();
        (bool success, bytes memory result) = target.call{value: value}(data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    function executeBatch(
        address[] calldata targets,
        uint256[] calldata values,
        bytes[] calldata datas
    ) external {
        _requireFromEntryPointOrOwner();
        for (uint256 i = 0; i < targets.length; i++) {
            (bool success,) = targets[i].call{value: values[i]}(datas[i]);
            require(success, "Batch call failed");
        }
    }

    // ─── Receive ETH/DONG ─────────────────────────────────────────────────────
    receive() external payable {}
}
```

### 4. Paymaster Deployment

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@account-abstraction/contracts/core/BasePaymaster.sol";

/// @title DongChainSponsorPaymaster
/// @notice Sponsors gas for whitelisted dApps
contract DongChainSponsorPaymaster is BasePaymaster {
    mapping(address => bool) public sponsoredDApps;

    constructor(IEntryPoint _entryPoint) BasePaymaster(_entryPoint) {}

    function addSponsoredDApp(address dapp) external onlyOwner {
        sponsoredDApps[dapp] = true;
    }

    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32,
        uint256 maxCost
    ) external override returns (bytes memory context, uint256 validationData) {
        // Decode target dApp from callData
        address target = address(bytes20(userOp.callData[16:36]));
        require(sponsoredDApps[target], "dApp not sponsored");

        // Ensure paymaster has enough ETH
        require(address(this).balance >= maxCost, "Insufficient paymaster balance");

        return ("", 0); // 0 = valid
    }

    function postOp(PostOpMode, bytes calldata, uint256) external override {}

    // Fund the paymaster
    receive() external payable {}
}
```

## Bundler Setup

```bash
# Clone and configure official Bundler
git clone https://github.com/eth-infinitism/bundler
cd bundler
npm install

# Configure for Dong Chain
cat > config.json << EOF
{
  "rpcUrl": "http://localhost:9944",
  "port": 3000,
  "entryPoint": "0x5FF137D4b0FDCD49DcA30c7CF57E578a026d2789",
  "mnemonic": "test test test test test test test test test test test junk",
  "minBalance": "0.1",
  "maxBundleGas": 5000000
}
EOF

npm start
```

## Client SDK Usage

```typescript
import { ethers } from "ethers";
import { Presets, Client } from "userop";

// Initialize client
const client = await Client.init("http://localhost:9944", {
  entryPoint: ENTRY_POINT_ADDRESS,
  overrideBundlerRpc: "http://localhost:3000",
});

// Build Smart Account (gasless mint for gaming)
const builder = await Presets.Builder.SimpleAccount.init(
  new ethers.Wallet(PRIVATE_KEY),
  "http://localhost:9944",
  { entryPoint: ENTRY_POINT_ADDRESS }
);

// Execute gasless transaction
const res = await client.sendUserOperation(
  builder
    .execute(
      gameCharacterContract,
      0,
      gameCharacterContract.interface.encodeFunctionData("mintCharacter", [
        playerAddress,
        "Warrior",
        "ipfs://QmCharacterMeta..."
      ])
    )
    .setPaymasterAndData(PAYMASTER_ADDRESS + "00"),
  { onBuild: (op) => console.log("UserOp:", op) }
);

console.log("Transaction:", await res.wait());
```

## P-256 (WebAuthn/Biometric) Signatures

For mobile apps with biometric authentication:

```solidity
// validateUserOp with P-256 signature
function validateUserOp(...) external override returns (uint256) {
    // Decode signature type
    uint8 sigType = uint8(userOp.signature[0]);

    if (sigType == SIG_TYPE_ECDSA) {
        // Standard ECDSA (secp256k1)
        return _validateECDSA(userOpHash, userOp.signature[1:]);
    } else if (sigType == SIG_TYPE_P256) {
        // P-256 for WebAuthn/biometric
        return _validateP256(userOpHash, userOp.signature[1:]);
    }

    return SIG_VALIDATION_FAILED;
}

function _validateP256(bytes32 hash, bytes calldata sig)
    internal view returns (uint256)
{
    // P-256 verification — runs natively on RISC-V without precompile
    (uint256 r, uint256 s, uint256 pubKeyX, uint256 pubKeyY) =
        abi.decode(sig, (uint256, uint256, uint256, uint256));

    bool valid = P256.verify(hash, r, s, pubKeyX, pubKeyY);
    return valid ? 0 : SIG_VALIDATION_FAILED;
}
```

## Related Docs

- [Gaming Assets](../use-cases/gaming-assets.md) — Session keys in gaming context
- [RISC-V VM](../architecture/04-risc-v-vm.md) — Why P-256 works without precompile
- [Quickstart](../getting-started/04-quickstart.md) — Deploy your first gasless transaction
