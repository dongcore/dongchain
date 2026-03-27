# Security Model

## Trust Assumptions

Dong Chain's security is layered, with each layer having different trust assumptions:

### Layer 0 (Bitcoin PoW)
- **Trust required:** None beyond cryptographic assumptions (SHA256, ECDSA)
- **Security:** ~$300M+ cost to reorg 6 blocks (2026 estimate)
- **Assumption:** Bitcoin miners are majority honest (Nakamoto assumption)

### BitVM2 Bridge
- **Trust required:** 1-of-n honest operator (liveness honesty)
- **Security:** Any single honest operator prevents fund loss
- **Assumption:** At least 1 operator in setup ceremony remains honest and online

### Relay Chain (Substrate)
- **Trust required:** Majority of Relay Chain validators honest
- **Security:** Shared Polkadot security model
- **Assumption:** Validator set is sufficiently decentralized

### Relay Depository (MPC Allocator)
- **Trust required:** MPC threshold (e.g., 5-of-9 must be honest)
- **Security:** Semi-trusted federation; cannot steal deposits, only delay settlement
- **Assumption:** MPC committee does not fully collude to forge EIP-712 signatures

### Smart Contracts (pallet-revive)
- **Trust required:** Code correctness (verified by audit)
- **Security:** Immutable after deployment (no upgrade proxy)
- **Assumption:** resolc compiler produces semantically correct RISC-V output

## Threat Model

### Critical Threats (Can Cause Fund Loss)

| Threat | Attack Vector | Mitigation |
|---|---|---|
| Bitcoin 51% attack | Control > 50% of Bitcoin hashrate | Economically infeasible ($300M+/block) |
| Full BitVM2 operator collusion | All n operators collude | 1-of-n model; geographic/entity diversity |
| Full MPC collusion | All MPC members sign forged proofs | 5-of-9 threshold; independent audits |
| Smart contract bug in Depository | Malicious `execute()` call | Non-upgradable; formal verification |
| resolc compiler semantic drift | LLVM produces incorrect RISC-V | Source + PVM bytecode audit required |

### High Severity (Can Cause Disruption)

| Threat | Attack Vector | Mitigation |
|---|---|---|
| Relay Chain validator attack | Majority validators malicious | Polkadot shared security |
| Bundler DoS | Flood Bundler with invalid UserOps | Rate limiting, reputation system |
| OmniCore node failure | Node goes offline | Redundant node setup |
| Solver liquidity crisis | Solvers can't front capital | Multiple competing Solvers |

### Medium Severity (Can Cause UX Degradation)

| Threat | Attack Vector | Mitigation |
|---|---|---|
| Bitcoin reorg (< 6 blocks) | Natural stale blocks | 6-confirmation wait |
| Session key theft | Game client compromise | Bounded selectors + spend limits |
| Bridge challenge period delay | Operator goes offline | 1-of-n ensures other operators continue |

## Non-Upgradeability Policy

### Contracts That Must Be Non-Upgradable

1. **DongChainDepository** — Custodies user funds; any upgrade is an attack surface
2. **EntryPoint (ERC-4337)** — Core transaction hub; standardized across ecosystem
3. **RWA Token Contracts** — Immutable supply and ownership rules

### What "Non-Upgradable" Means in Practice

```solidity
// PROHIBITED patterns in core contracts:
contract BadDepository {
    // ❌ Proxy pattern
    fallback() external { /* delegatecall */ }

    // ❌ Upgradeable proxy
    function upgradeTo(address newImpl) external onlyOwner { ... }

    // ❌ UUPS
    function _authorizeUpgrade(address) internal override onlyOwner {}

    // ❌ Self-destruct
    function destroy() external onlyOwner { selfdestruct(payable(owner)); }
}

// CORRECT pattern:
contract GoodDepository {
    // ✅ Immutable configuration
    address public immutable MPC_ALLOCATOR;

    // ✅ No upgrade functions
    // ✅ No delegatecall to external addresses
    // ✅ No selfdestruct
}
```

## Smart Contract Audit Checklist

Before any contract handles user funds on mainnet:

### Pre-Audit
- [ ] 100% branch coverage in Foundry tests
- [ ] Invariant fuzz tests with Echidna (10M+ runs)
- [ ] Differential testing: EVM vs PVM output comparison
- [ ] Static analysis: Slither, Semgrep on Solidity source

### Audit Requirements
- [ ] Source-level Solidity audit by reputable firm
- [ ] PVM bytecode audit (verify resolc output matches intent)
- [ ] Focus areas: reentrancy, integer overflow, access control, signature malleability

### Post-Audit
- [ ] All High/Critical findings resolved
- [ ] Medium findings resolved or formally accepted with rationale
- [ ] Public audit report published
- [ ] Bug bounty program launched before mainnet

## Session Key Security (Gaming)

Session keys are a key UX feature but require careful security design:

```solidity
// Security invariants for session keys:

// 1. Selector whitelist — session key can ONLY call approved functions
require(sessionKey.allowedSelectors.contains(callSelector), "Selector not allowed");

// 2. Spend limit — prevents draining wallet during session
require(sessionKey.amountSpent + value <= sessionKey.spendLimit, "Spend limit exceeded");

// 3. Expiry — session keys auto-expire
require(block.timestamp <= sessionKey.validUntil, "Session expired");

// 4. Target whitelist — only approved contracts
require(sessionKey.allowedTargets.contains(target), "Target not allowed");
```

**Security review for gaming integrations:**
- Game client must generate fresh session keys per session (not persist)
- Session key should have minimum required permissions (principle of least authority)
- Emergency session key revocation must work even if game server is down

## Cryptographic Assumptions

| Assumption | System Component | Post-Quantum Safe? |
|---|---|---|
| SHA-256 collision resistance | Bitcoin PoW | Yes (Grover's: 2^128 security) |
| ECDSA (secp256k1) hardness | Bitcoin addresses, EIP-712 | No — vulnerable to Shor's algorithm |
| Schnorr (secp256k1) | Taproot/BitVM2 | No — same curve |
| Keccak-256 pre-image resistance | Contract storage keys | Yes |

**Post-quantum migration path:** RISC-V's cryptographic agnosticism allows deploying post-quantum signature schemes (e.g., CRYSTALS-Dilithium, FALCON) as smart contracts without hard forks. This is a planned post-mainnet upgrade.

## Incident Response

### Severity Classification

| Severity | Example | Response Time | Action |
|---|---|---|---|
| Critical | Funds at risk | < 1 hour | Pause deposits via guardian multisig |
| High | Bridge delay | < 4 hours | Alert MPC operators, monitor |
| Medium | RPC degradation | < 24 hours | Scale infrastructure |
| Low | UI bug | < 72 hours | Standard patch release |

### Emergency Contacts

Defined in `SECURITY.md` at repository root:
- Security team Signal/Telegram (private)
- Guardian multisig address for emergency pauses
- Bug bounty submission: security@dongchain.io

## Related Docs

- [Audit Checklist](./audit-checklist.md)
- [BitVM2 Bridge Security](../architecture/02-bitvm2-bridge.md)
- [Depository Contract](../components/depository-contract.md)
