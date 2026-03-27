# Contributing to Dong Chain

Welcome! Dong Chain is open source under Apache 2.0. We welcome contributions from developers, researchers, and the broader Web3 community.

## Ways to Contribute

| Area | Skills Needed | Priority |
|---|---|---|
| Substrate runtime (Rust) | Rust, Substrate/FRAME | High |
| pallet-revive integration | Rust, RISC-V | High |
| Smart contracts (Solidity) | Solidity, Foundry | High |
| BitVM2 bridge implementation | Rust, Bitcoin Script, SNARK | High |
| ERC-4337 Bundler | TypeScript/Node.js | Medium |
| MPC Allocator | Rust, MPC protocols | Medium |
| ZK prover integration | Rust, RISC Zero | Medium |
| Developer documentation | Technical writing | Medium |
| OmniCore integration | C++, Bitcoin RPC | Medium |
| Frontend wallet SDK | TypeScript, React | Low |

## Development Process

### 1. Fork & Clone

```bash
git clone https://github.com/<your-handle>/dong-chain
cd dong-chain
git remote add upstream https://github.com/dongchain/dong-chain
```

### 2. Create a Branch

```bash
git checkout -b feat/your-feature-name
# or
git checkout -b fix/bug-description
```

Branch naming conventions:
- `feat/` — new feature
- `fix/` — bug fix
- `docs/` — documentation
- `test/` — tests only
- `refactor/` — code refactoring

### 3. Make Changes

- Follow Rust formatting: `cargo fmt`
- Lint: `cargo clippy -- -D warnings`
- For Solidity: `forge fmt`

### 4. Write Tests

```bash
# Substrate/Rust tests
cargo test -p dong-chain-runtime

# Smart contract tests
cd contracts && forge test -vvv

# Integration tests
cargo test -p dong-chain-integration
```

**Test coverage requirements:**
- Substrate pallets: >80% line coverage
- Smart contracts: 100% branch coverage (invariant fuzz tests required)
- Critical paths: differential testing between PVM and EVM

### 5. Submit Pull Request

```bash
git push origin feat/your-feature-name
# Open PR on GitHub
```

PR checklist:
- [ ] Code follows project style
- [ ] Tests pass (`cargo test`, `forge test`)
- [ ] New features have tests
- [ ] Documentation updated if needed
- [ ] No secrets or private keys in code
- [ ] `cargo clippy` passes without warnings

## Code Style

### Rust (Substrate)

```rust
// Good: explicit, documented
/// Validates a UserOperation's signature against the Smart Account.
/// Returns SIG_VALIDATION_FAILED (1) on invalid signature.
pub fn validate_user_op(
    user_op: &UserOperation,
    user_op_hash: H256,
) -> Result<ValidationData, DispatchError> {
    // Implementation
}

// Bad: undocumented, unclear return
pub fn validate(op: &UserOp, hash: H256) -> u256 {
    // ...
}
```

### Solidity

Follow OpenZeppelin style:
- NatSpec comments on all public functions
- Events for all state changes
- Custom errors instead of string reverts
- Checks-Effects-Interactions pattern

```solidity
// Good
/// @notice Deposits ERC-20 tokens for cross-chain transfer
/// @param depositor The beneficiary address on the destination chain
/// @param token The ERC-20 token contract address
/// @param amount The amount of tokens to deposit
/// @param orderId Unique identifier for this cross-chain order
function depositErc20(
    address depositor,
    address token,
    uint256 amount,
    bytes32 orderId
) external {
    if (amount == 0) revert ZeroAmount();
    token.safeTransferFrom(msg.sender, address(this), amount);
    emit OrderCreated(orderId, depositor, token, amount, 0);
}
```

## Repository Structure

```
dong-chain/
├── node/              # Substrate node binary
├── runtime/           # FRAME-based runtime
│   ├── src/lib.rs     # Runtime composition
│   └── pallets/       # Custom pallets
├── contracts/         # Solidity smart contracts
│   ├── src/
│   │   ├── Depository.sol
│   │   ├── EntryPoint.sol
│   │   └── tokens/
│   ├── test/
│   └── script/        # Deployment scripts
├── bridge/            # BitVM2 bridge implementation
├── bundler/           # ERC-4337 Bundler (TypeScript)
├── prover/            # ZK proof generation (Rust + RISC Zero)
├── sdk/               # Developer SDK (TypeScript)
└── docs/              # This documentation
```

## Issue Guidelines

### Bug Reports

Use the bug report template. Include:
- Dong Chain node version
- OS and hardware
- Steps to reproduce
- Expected vs. actual behavior
- Logs/error messages

### Feature Requests

Use the feature request template. Include:
- Problem you're solving
- Proposed solution
- Alternatives considered
- Impact on existing functionality

### Security Vulnerabilities

**Do NOT open public issues for security vulnerabilities.**

Email: security@dongchain.io

We follow responsible disclosure with a 90-day window.

## Community

- GitHub Discussions: Feature proposals, Q&A
- Discord: Real-time development discussion
- Twitter/X: Announcements

## License

By contributing, you agree your contributions are licensed under Apache 2.0.
