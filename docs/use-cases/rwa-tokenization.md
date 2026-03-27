# RWA Tokenization — Real-World Assets on Dong Chain

## Overview

Dong Chain provides a two-layer RWA tokenization architecture:
1. **Layer 0 (Bitcoin/OmniCore):** Immutable issuance registry — highest censorship resistance
2. **Layer 1 (Dong Chain):** Programmable token with DeFi capabilities

## Supported Asset Classes

| Asset Class | Example | Issuance Layer | Smart Contract Features |
|---|---|---|---|
| Real estate | Apartment buildings, office towers | OmniCore L0 | Dividend distribution, fractional ownership |
| Treasury bonds | Government bonds | OmniCore L0 | Interest payments, maturity redemption |
| Commodities | Gold, oil certificates | OmniCore L0 | Price oracle integration |
| Private equity | Fund shares | OmniCore L0 | Whitelist compliance, transfer restrictions |
| Gaming land | Virtual territory | Dong Chain L1 | Play-to-earn mechanics, rental income |
| IP rights | Music royalties, patents | OmniCore L0 | Streaming revenue distribution |

## End-to-End Asset Lifecycle

### Phase 1: Issue on Bitcoin (Layer 0)

```bash
# Step 1: Verify OmniCore node is running
omnicore-cli getblockchaininfo

# Step 2: Issue RWA token
omnicore-cli omni_sendissuancefixed \
  "bc1qISSUER_ADDRESS" \    # Issuer's Bitcoin address
  1 \                        # Ecosystem: 1=mainnet
  2 \                        # Type: 2=divisible (like shares)
  0 \                        # PreviousID: 0 for new token
  "Real Estate" \            # Category
  "Commercial" \             # Subcategory
  "Hanoi Office Tower A" \   # Token name
  "https://issuer.io/hat-a" \# Information URL
  "Tokenized 30% ownership of 100 Nguyen Hue, Hanoi, Vietnam. Total value: $5M USD" \
  "15000000"                 # Supply: 15,000,000 shares (each = $0.33 face value)

# Response:
# {
#   "txid": "abc123...",  <- Permanently on Bitcoin blockchain
#   "propertyid": 42      <- Unique RWA identifier
# }

# Step 3: Verify issuance
omnicore-cli omni_getproperty 42
```

### Phase 2: Bridge to Dong Chain (BitVM2)

```bash
# Transfer OmniCore asset to BitVM2 bridge address
omnicore-cli omni_send \
  "bc1qISSUER_ADDRESS" \
  "bc1qBITVM2_BRIDGE_ADDRESS" \   # Computed from BitVM2 setup ceremony
  42 \                             # Property ID
  "15000000"                       # Amount to bridge

# Wait for 6 Bitcoin block confirmations (~60 minutes)
# Oracle automatically detects and mints wrapped token on Dong Chain
```

### Phase 3: Program on Dong Chain (RISC-V)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title HanoiOfficeTowerA
/// @notice Wrapped RWA token for real estate ownership
///         Backed 1:1 by OmniCore property #42 on Bitcoin L0
contract HanoiOfficeTowerA is ERC20, Ownable {
    // ─── Compliance ───────────────────────────────────────────────────────────
    mapping(address => bool) public kycApproved;
    address public immutable BRIDGE_ORACLE;

    uint256 public dividendPerShare;
    mapping(address => uint256) public claimedDividend;

    event DividendDistributed(uint256 amount, uint256 perShare);
    event KYCApproved(address investor);
    event KYCRevoked(address investor);

    // ─── Constructor ──────────────────────────────────────────────────────────
    constructor(address oracle) ERC20("Hanoi Office Tower A", "HOTA") Ownable(msg.sender) {
        BRIDGE_ORACLE = oracle;
    }

    // ─── Minting (bridge oracle only) ─────────────────────────────────────────
    /// @notice Called by BitVM2 oracle when peg-in confirmed
    function mintBridged(address recipient, uint256 amount) external {
        require(msg.sender == BRIDGE_ORACLE, "Not oracle");
        require(kycApproved[recipient], "KYC required");
        _mint(recipient, amount);
    }

    // ─── KYC Compliance ───────────────────────────────────────────────────────
    function approveKYC(address investor) external onlyOwner {
        kycApproved[investor] = true;
        emit KYCApproved(investor);
    }

    function revokeKYC(address investor) external onlyOwner {
        kycApproved[investor] = false;
        emit KYCRevoked(investor);
    }

    // ─── Transfer with compliance check ───────────────────────────────────────
    function _update(address from, address to, uint256 value) internal override {
        if (to != address(0) && from != address(0)) {
            require(kycApproved[to], "Recipient not KYC approved");
        }
        super._update(from, to, value);
    }

    // ─── Dividend Distribution ────────────────────────────────────────────────
    /// @notice Distribute rental income to token holders (quarterly)
    function distributeDividend() external payable onlyOwner {
        require(totalSupply() > 0, "No supply");
        uint256 perShare = msg.value * 1e18 / totalSupply();
        dividendPerShare += perShare;
        emit DividendDistributed(msg.value, perShare);
    }

    /// @notice Claim accumulated dividend
    function claimDividend() external {
        uint256 owed = (dividendPerShare - claimedDividend[msg.sender])
                       * balanceOf(msg.sender) / 1e18;
        require(owed > 0, "Nothing to claim");
        claimedDividend[msg.sender] = dividendPerShare;
        payable(msg.sender).transfer(owed);
    }
}
```

### Phase 4: DeFi Integration

Once on Dong Chain, RWA tokens can participate in DeFi:

```solidity
// Example: Use tokenized real estate as loan collateral
// (Aave-like lending protocol on Dong Chain)

interface ILendingPool {
    function deposit(address asset, uint256 amount) external;
    function borrow(address asset, uint256 amount) external;
}

// User deposits HOTA (real estate token) as collateral
lendingPool.deposit(HOTA_ADDRESS, 1000 * 1e18);

// User borrows USDC against real estate collateral
lendingPool.borrow(USDC_ADDRESS, 500 * 1e18);
```

## Compliance Framework

### Transfer Restrictions

RWA tokens often require compliance rules:

```solidity
// Transfer restriction types
enum RestrictionType {
    NONE,           // No restrictions (gaming assets, commodities)
    KYC_ONLY,       // Requires KYC verification
    ACCREDITED,     // Accredited investors only
    JURISDICTION,   // Geographic restrictions
    LOCKUP          // Time-based lockup period
}
```

### On-Chain Audit Trail

Every transfer is permanently recorded:
```
Bitcoin L0: Original issuance → immutable forever
Dong Chain: All transfer events → queryable via JSON-RPC
ZK Proof: Batch summary → Bitcoin finality every 24h
```

## Cross-Chain Yield Distribution

RWA income can flow across chains via Relay Depository:

```
[Real Estate Rental Income (USDC on Ethereum)]
        │
        ▼ Relay Depository cross-chain transfer
[USDC received on Dong Chain]
        │
        ▼ Smart contract dividend distribution
[Token holders receive pro-rata income]
```

## Legal & Regulatory Considerations

> **Disclaimer:** This documentation is for technical reference only. Consult legal counsel in your jurisdiction before tokenizing real-world assets.

Key areas to address:
- Securities regulations (SEC in US, SFC in HK, etc.)
- KYC/AML requirements
- Investor accreditation standards
- Cross-border transfer rules
- Token custody and recovery procedures

The smart contract layer provides technical enforcement; legal compliance is the issuer's responsibility.

## Related Docs

- [Layer 0 — Bitcoin & OmniCore](../architecture/01-layer0-bitcoin.md)
- [BitVM2 Bridge](../architecture/02-bitvm2-bridge.md)
- [Security Model](../security/security-model.md)
