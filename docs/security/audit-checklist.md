# Contract Audit Checklist

Use this checklist before any contract handles real funds on mainnet.

## Phase 1: Pre-Audit Preparation

### Code Quality
- [ ] All functions have NatSpec documentation
- [ ] Custom errors used instead of string reverts
- [ ] Events emitted for all state changes
- [ ] No `console.log` or debug code
- [ ] No TODOs or FIXMEs in production code
- [ ] `cargo fmt` / `forge fmt` applied

### Test Coverage
- [ ] `forge coverage` shows 100% branch coverage for critical contracts
- [ ] Invariant tests written for core state invariants
- [ ] Fuzz tests run: `forge test --fuzz-runs 1000000`
- [ ] Edge cases tested: zero amounts, max uint256, empty arrays

### Static Analysis
```bash
# Run Slither
pip install slither-analyzer
slither src/ --exclude-dependencies --config-file slither.config.json

# Run Semgrep
semgrep --config p/solidity-security src/

# Run Aderyn
cargo install aderyn
aderyn src/
```

### Compilation Integrity (RISC-V specific)
- [ ] Differential test: same inputs produce same outputs on EVM (REVM) and PVM (resolc)
- [ ] resolc version documented and pinned
- [ ] No semantic warnings from resolc compiler

## Phase 2: Security Review Areas

### Access Control
- [ ] All admin functions protected with proper role checks
- [ ] `onlyOwner` / `onlyRole` cannot be bypassed via inheritance
- [ ] Constructor correctly sets initial owners
- [ ] No `address(0)` as owner

### Reentrancy
- [ ] Check-Effects-Interactions pattern followed
- [ ] External calls happen AFTER state updates
- [ ] `ReentrancyGuard` used where appropriate
- [ ] ERC-1155 / ERC-721 `safeTransfer` reentrancy considered

### Integer Arithmetic
- [ ] No unchecked math except where explicitly safe
- [ ] Division by zero impossible
- [ ] No phantom overflow via intermediate calculations
- [ ] Fixed-point math (if any) correctly scaled

### Signature Security (Depository-specific)
- [ ] EIP-712 domain separator includes: `name`, `version`, `chainId`, `verifyingContract`
- [ ] Nonce mapping prevents replay attacks
- [ ] Deadline check prevents stale signatures
- [ ] `ecrecover` return value checked for `address(0)`
- [ ] No signature malleability (use OpenZeppelin ECDSA, not raw ecrecover)

### Non-Upgradeability Verification
```bash
# Check for proxy patterns
grep -r "delegatecall\|upgradeTo\|upgradeToAndCall\|UUPS\|TransparentProxy" src/

# Should return empty for Depository and EntryPoint
```
- [ ] No `delegatecall` to mutable addresses
- [ ] No `selfdestruct`
- [ ] No upgrade functions
- [ ] Immutable configuration variables use `immutable` keyword

### Economic Security
- [ ] Flash loan attacks considered
- [ ] Price oracle manipulation impossible (if using oracles)
- [ ] No sandwich attack vectors
- [ ] Solver capital risk bounded (Depository: solver only risks their own capital)

### ERC-4337 Specific
- [ ] `validateUserOp` returns `SIG_VALIDATION_FAILED` (not revert) on bad signatures
- [ ] Nonce management follows ERC-4337 spec
- [ ] Paymaster `validatePaymasterUserOp` doesn't use storage that could be manipulated by Bundler
- [ ] `simulateValidation` works correctly for Bundler

## Phase 3: Formal Verification (Critical Contracts)

### Depository Contract
```
Properties to verify formally (using Certora or K Framework):
1. execute() can only release <= deposited amount
2. usedNonces[n] is monotonically true (never goes false)
3. ecrecover(sig) == MPC_ALLOCATOR is required before any fund release
4. Domain separator is constant (no dynamic computation)
```

### EntryPoint (ERC-4337)
- Defer to upstream audit of official ERC-4337 EntryPoint implementation

## Phase 4: PVM Bytecode Audit (RISC-V Specific)

This is unique to Dong Chain and critical:

```bash
# 1. Compile to PVM
resolc --target polkavm --optimization 3 src/DongChainDepository.sol

# 2. Disassemble PVM bytecode
polkavm-disassembler artifacts/DongChainDepository.polkavm > disassembly.txt

# 3. Audit team reviews:
#    - Function dispatch correctness
#    - Storage slot mapping matches Solidity layout
#    - No spurious writes to unintended storage slots
#    - ecrecover host function called correctly
#    - Gas metering doesn't allow denial-of-service

# 4. Differential test vs EVM output
forge test --match-contract DifferentialTest -vvv
```

**Key risk:** LLVM optimization passes during Yul → LLVM IR → RISC-V may introduce:
- Dead code elimination that incorrectly removes validation steps
- Loop unrolling that changes gas consumption patterns
- Constant folding that evaluates expressions differently

## Phase 5: Pre-Mainnet Launch

### Infrastructure
- [ ] Mainnet MPC Allocator deployed with 5-of-9 threshold
- [ ] BitVM2 operator setup ceremony complete with 9 independent operators
- [ ] Bug bounty program live (minimum $50,000 pool)
- [ ] Guardian multisig deployed (for emergency deposit pause)
- [ ] Monitoring and alerting operational

### Staged Launch
```
Week 1: Deploy with whitelist only (10 trusted addresses)
Week 2: Open to 100 users, $10,000 TVL cap
Week 4: Remove TVL cap, open to all users
Month 2: Full mainnet launch
```

### Documentation
- [ ] Audit report published publicly
- [ ] Deployment addresses published and verified
- [ ] Security contact information visible (`SECURITY.md`)

## Common Vulnerabilities Checklist

| Vulnerability | Check |
|---|---|
| Reentrancy | CEI pattern, ReentrancyGuard |
| Integer overflow | Solidity 0.8+ default, unchecked blocks reviewed |
| Access control | All admin functions checked |
| Signature replay | Nonce + domain separator |
| Front-running | Commit-reveal or slippage protection where needed |
| Price manipulation | TWAP oracles, sanity checks |
| Denial of service | Bounded loops, no unbounded storage iteration |
| Logic errors | Formal spec comparison |
| PVM semantic drift | Differential testing against EVM |
| Flash loans | State snapshots, locked funds logic |

## Related Docs

- [Security Model](./security-model.md)
- [Depository Contract](../components/depository-contract.md)
- [Solidity → RISC-V](../smart-contracts/solidity-to-riscv.md) — PVM-specific risks
