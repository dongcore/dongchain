# Depository & Relay Protocol

## Overview

The Relay Depository protocol enables **instant cross-chain asset transfers** using a pre-funding model:
1. User deposits assets into the Depository on the source chain
2. A **Solver** immediately advances equivalent assets on the destination chain
3. An **MPC Allocator** cryptographically authorizes the Solver's reimbursement
4. The Depository releases funds to the Solver after verifying the EIP-712 signature

**Reference contract:** `0x4cD00E387622C35bDDB9b4c962C136462338BC31` (Base Mainnet)

## Actors

| Actor | Role | Risk |
|---|---|---|
| User | Initiates deposit on source chain | None after deposit confirmed |
| Solver | Pre-funds destination chain, fills order | Capital risk during fill window |
| MPC Allocator | Verifies fills, produces signed proofs | Reputation risk; collusion risk |
| Depository Contract | Custodies source-chain assets | Code risk (mitigated: non-upgradable) |

## Contract Interface

```solidity
// SPDX-License-Identifier: Apache-2.0
pragma solidity ^0.8.24;

import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";
import {EIP712} from "solady/utils/EIP712.sol";

/// @title DongChainDepository
/// @notice Non-upgradable cross-chain liquidity vault
/// @dev No proxy patterns, no delegatecall to mutable targets
contract DongChainDepository is EIP712 {
    using SafeTransferLib for address;

    // -------------------------------------------------------------------------
    // Immutable configuration
    // -------------------------------------------------------------------------

    /// @notice The MPC Allocator's address — only signatures from this address
    ///         are accepted for withdrawal authorization
    address public immutable MPC_ALLOCATOR;

    // -------------------------------------------------------------------------
    // State
    // -------------------------------------------------------------------------

    /// @notice Tracks used nonces to prevent replay attacks
    mapping(bytes32 => bool) public usedNonces;

    // -------------------------------------------------------------------------
    // Events
    // -------------------------------------------------------------------------

    event OrderCreated(
        bytes32 indexed orderId,
        address indexed depositor,
        address token,      // address(0) for native
        uint256 amount,
        uint256 destChainId
    );

    event OrderFilled(
        bytes32 indexed orderId,
        address indexed solver,
        uint256 amount
    );

    // -------------------------------------------------------------------------
    // EIP-712 Type Hashes
    // -------------------------------------------------------------------------

    bytes32 public constant CALL_REQUEST_TYPEHASH = keccak256(
        "CallRequest(address solver,address token,uint256 amount,bytes32 orderId,bytes32 nonce,uint256 deadline)"
    );

    // -------------------------------------------------------------------------
    // Structs
    // -------------------------------------------------------------------------

    struct CallRequest {
        address solver;
        address token;      // address(0) for native DONG
        uint256 amount;
        bytes32 orderId;
        bytes32 nonce;
        uint256 deadline;
        uint8 v;
        bytes32 r;
        bytes32 s;
    }

    // -------------------------------------------------------------------------
    // Constructor
    // -------------------------------------------------------------------------

    constructor(address _mpcAllocator) {
        require(_mpcAllocator != address(0), "Zero allocator");
        MPC_ALLOCATOR = _mpcAllocator;
    }

    // -------------------------------------------------------------------------
    // Deposit functions
    // -------------------------------------------------------------------------

    /// @notice Deposit native DONG token for cross-chain transfer
    /// @param depositor The ultimate beneficiary on the destination chain
    /// @param orderId Unique order identifier linking this deposit to an intent
    function depositNative(
        address depositor,
        bytes32 orderId
    ) external payable {
        require(msg.value > 0, "Zero value");
        emit OrderCreated(orderId, depositor, address(0), msg.value, 0);
    }

    /// @notice Deposit ERC-20 token for cross-chain transfer
    /// @param depositor The ultimate beneficiary on the destination chain
    /// @param token ERC-20 token address
    /// @param amount Amount to deposit
    /// @param orderId Unique order identifier
    function depositErc20(
        address depositor,
        address token,
        uint256 amount,
        bytes32 orderId
    ) external {
        require(amount > 0, "Zero amount");
        token.safeTransferFrom(msg.sender, address(this), amount);
        emit OrderCreated(orderId, depositor, token, amount, 0);
    }

    // -------------------------------------------------------------------------
    // Settlement function
    // -------------------------------------------------------------------------

    /// @notice Release funds to a Solver after verifying MPC Allocator signature
    /// @param request The CallRequest containing solver, token, amount, and sig
    function execute(CallRequest calldata request) external {
        // 1. Check deadline
        require(block.timestamp <= request.deadline, "Request expired");

        // 2. Check nonce (replay protection)
        require(!usedNonces[request.nonce], "Nonce already used");

        // 3. Reconstruct EIP-712 hash
        bytes32 structHash = keccak256(abi.encode(
            CALL_REQUEST_TYPEHASH,
            request.solver,
            request.token,
            request.amount,
            request.orderId,
            request.nonce,
            request.deadline
        ));
        bytes32 digest = _hashTypedData(structHash);

        // 4. Recover signer via ecrecover
        address signer = ecrecover(digest, request.v, request.r, request.s);
        require(signer == MPC_ALLOCATOR, "Invalid allocator signature");
        require(signer != address(0), "Invalid signature");

        // 5. Mark nonce as used
        usedNonces[request.nonce] = true;

        // 6. Release funds to Solver
        if (request.token == address(0)) {
            // Native DONG transfer
            SafeTransferLib.safeTransferETH(request.solver, request.amount);
        } else {
            // ERC-20 transfer
            request.token.safeTransfer(request.solver, request.amount);
        }

        emit OrderFilled(request.orderId, request.solver, request.amount);
    }

    // -------------------------------------------------------------------------
    // EIP-712 domain
    // -------------------------------------------------------------------------

    function _domainNameAndVersion()
        internal pure override
        returns (string memory name, string memory version)
    {
        name = "DongChainDepository";
        version = "1";
    }
}
```

## Full Execution Flow

```
┌──────────────────────────────────────────────────────────────────────┐
│                     CROSS-CHAIN TRANSFER FLOW                        │
│                                                                      │
│  USER                DEPOSITORY          SOLVER         MPC          │
│  (Dong Chain)        (Dong Chain)        (off-chain)    ALLOCATOR    │
│                                                                      │
│  1. depositErc20 ──▶ OrderCreated event                              │
│     (orderId, amt)         │                                         │
│                            │             Observes event              │
│                            │                   │                     │
│                            │             2. Fill on dest chain       │
│                            │                   │ sends tokens to     │
│                            │                   │ user on Ethereum    │
│                            │                   │                     │
│                            │             3. Request reimbursement    │
│                            │                   │──────────────────▶  │
│                            │                   │             Verifies│
│                            │                   │             fill    │
│                            │                   │             on dest │
│                            │                   │◀────────────────────│
│                            │             4. Signed CallRequest       │
│                            │             (EIP-712 signature)         │
│                            │                   │                     │
│  5. Solver calls execute(request, sig)         │                     │
│            ──────────────▶ │                                         │
│                            │ ecrecover → verify MPC_ALLOCATOR        │
│                            │ check nonce not used                    │
│                            │ check deadline not expired              │
│                            │                                         │
│                            │──▶ transfer tokens to Solver            │
│                            │    emit OrderFilled                     │
│                                                                      │
└──────────────────────────────────────────────────────────────────────┘
```

## MPC Allocator Verification Logic (Off-chain)

The MPC Allocator performs off-chain verification before signing:

```typescript
// Pseudocode: MPC Allocator verification
async function verifyAndSign(
  orderId: string,
  solverAddress: string,
  destChainId: number,
  fillTxHash: string
): Promise<SignedCallRequest> {
  // 1. Fetch fill transaction from destination chain
  const fillTx = await destChainProvider.getTransaction(fillTxHash);

  // 2. Verify the fill is valid
  assert(fillTx.to === userAddress, "Wrong recipient");
  assert(fillTx.value >= requiredAmount, "Insufficient fill");
  assert(await destChainProvider.getTransactionConfirmations(fillTxHash) >= 1);

  // 3. Construct CallRequest
  const request = {
    solver: solverAddress,
    token: sourceTokenAddress,
    amount: fillAmount,
    orderId: orderId,
    nonce: generateNonce(),
    deadline: Math.floor(Date.now() / 1000) + 3600, // 1 hour
  };

  // 4. MPC committee signs (5-of-9 threshold)
  const signature = await mpcSign(request, MPC_PRIVATE_KEY);

  return { ...request, ...signature };
}
```

## Security Properties

### Replay Protection
- Each `CallRequest` has a unique `nonce` stored in `usedNonces` mapping
- After `execute()` succeeds, `usedNonces[nonce] = true` — cannot reuse

### Domain Isolation
- EIP-712 domain separator includes `chainId` + `verifyingContract`
- A signature valid on Dong Chain testnet ≠ valid on mainnet

### Deadline Protection
- All requests have `deadline` timestamp
- Expired requests rejected even with valid signature

### Non-upgradeability
The contract contains:
- No `delegatecall` to mutable addresses
- No `selfdestruct`
- No `upgradeTo()` or proxy pattern
- Immutable `MPC_ALLOCATOR` address

## Supported Cross-Chain Directions (Testnet)

| Source | Destination | Status |
|---|---|---|
| Dong Chain → Ethereum | EIP-712 | Planned |
| Dong Chain → Base | EIP-712 | Planned |
| Dong Chain → Solana | Ed25519 | Planned |
| Ethereum → Dong Chain | EIP-712 (reverse) | Planned |
| Parachain A → Parachain B | XCM (no Depository) | Q2 2026 |

## Deployment

```bash
# Deploy via Foundry
forge create src/DongChainDepository.sol:DongChainDepository \
  --rpc-url $DONGCHAIN_RPC \
  --private-key $DEPLOYER_KEY \
  --constructor-args $MPC_ALLOCATOR_ADDRESS

# Verify deployment
cast call $DEPOSITORY_ADDRESS "MPC_ALLOCATOR()(address)" \
  --rpc-url $DONGCHAIN_RPC
```

## Related Docs

- [Cross-Chain Architecture](./05-xcm-messaging.md)
- [Security Model](../security/security-model.md)
- [Depository Contract Deep-Dive](../components/depository-contract.md)
