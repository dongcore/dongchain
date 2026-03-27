# Token Standards on Dong Chain

All major Ethereum token standards are supported on Dong Chain via Solidity → RISC-V compilation (resolc) or EVM compatibility (REVM backend).

## ERC-20 — Fungible Tokens

**Use cases:** DONG governance token, stablecoins, RWA shares, in-game currency

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DongStablecoin
/// @notice Example stablecoin backed by OmniCore-issued assets
contract DongStablecoin is ERC20, ERC20Permit, Ownable {
    address public immutable BRIDGE_ORACLE;

    constructor(address oracle)
        ERC20("Dong USD", "DUSD")
        ERC20Permit("Dong USD")
        Ownable(msg.sender)
    {
        BRIDGE_ORACLE = oracle;
    }

    function mint(address to, uint256 amount) external {
        require(msg.sender == BRIDGE_ORACLE, "Not oracle");
        _mint(to, amount);
    }

    function burn(address from, uint256 amount) external {
        require(msg.sender == BRIDGE_ORACLE, "Not oracle");
        _burn(from, amount);
    }
}
```

```bash
# Compile to RISC-V
resolc --target polkavm --optimization 3 --output-dir artifacts src/DongStablecoin.sol

# Deploy
forge create src/DongStablecoin.sol:DongStablecoin \
  --rpc-url $DONGCHAIN_RPC \
  --private-key $PRIVATE_KEY \
  --constructor-args $ORACLE_ADDRESS
```

## ERC-721 — Non-Fungible Tokens

**Use cases:** Game characters, land/territory, unique RWA certificates, collectibles

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";
import "@openzeppelin/contracts/token/ERC721/extensions/ERC721Enumerable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title DongChainNFT
/// @notice Generic NFT with metadata storage
contract DongChainNFT is ERC721URIStorage, ERC721Enumerable, Ownable {
    uint256 private _nextTokenId;
    uint256 public constant MAX_SUPPLY = 10_000;

    error MaxSupplyReached();
    error NotTokenOwner();

    constructor(string memory name, string memory symbol)
        ERC721(name, symbol)
        Ownable(msg.sender)
    {}

    function mint(address to, string calldata uri)
        external onlyOwner
        returns (uint256 tokenId)
    {
        if (_nextTokenId >= MAX_SUPPLY) revert MaxSupplyReached();
        tokenId = _nextTokenId++;
        _safeMint(to, tokenId);
        _setTokenURI(tokenId, uri);
    }

    // Required overrides for multiple inheritance
    function _update(address to, uint256 tokenId, address auth)
        internal override(ERC721, ERC721Enumerable)
        returns (address)
    {
        return super._update(to, tokenId, auth);
    }

    function _increaseBalance(address account, uint128 value)
        internal override(ERC721, ERC721Enumerable)
    {
        super._increaseBalance(account, value);
    }

    function tokenURI(uint256 tokenId)
        public view override(ERC721, ERC721URIStorage)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function supportsInterface(bytes4 interfaceId)
        public view override(ERC721URIStorage, ERC721Enumerable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
```

## ERC-1155 — Multi-Token Standard

**Use cases:** Game items (batch transfers), mixed fungible/non-fungible collections

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/token/ERC1155/extensions/ERC1155Supply.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title GameItems
/// @notice Multi-token for in-game items with supply tracking
contract GameItems is ERC1155, ERC1155Supply, Ownable {
    // Item type constants
    uint256 public constant SWORD = 1;
    uint256 public constant SHIELD = 2;
    uint256 public constant POTION = 3;

    // Max supply per item type
    mapping(uint256 => uint256) public maxSupply;

    constructor() ERC1155("https://game.io/api/items/{id}.json") Ownable(msg.sender) {
        maxSupply[SWORD] = 10_000;
        maxSupply[SHIELD] = 10_000;
        maxSupply[POTION] = type(uint256).max;  // Unlimited consumables
    }

    /// @notice Mint items to player — called by game backend
    function mintBatch(
        address player,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        for (uint256 i = 0; i < ids.length; i++) {
            require(
                totalSupply(ids[i]) + amounts[i] <= maxSupply[ids[i]],
                "Max supply exceeded"
            );
        }
        _mintBatch(player, ids, amounts, "");
    }

    // Override for ERC1155Supply compatibility
    function _update(
        address from, address to,
        uint256[] memory ids, uint256[] memory values
    ) internal override(ERC1155, ERC1155Supply) {
        super._update(from, to, ids, values);
    }
}
```

## ERC-4337 — Account Abstraction

See [ERC-4337 Account Abstraction](../components/erc4337-account-abstraction.md) for full implementation.

Key interfaces:
```solidity
interface IAccount {
    function validateUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 missingAccountFunds
    ) external returns (uint256 validationData);
}

interface IPaymaster {
    function validatePaymasterUserOp(
        UserOperation calldata userOp,
        bytes32 userOpHash,
        uint256 maxCost
    ) external returns (bytes memory context, uint256 validationData);
}
```

## ERC-6551 — Token Bound Accounts (Gaming)

Allows NFT characters to own their own wallets:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/introspection/IERC165.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC1271.sol";
import "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";

/// @title ERC6551Account
/// @notice Smart account owned by an NFT (character bound account)
contract ERC6551Account is IERC165, IERC1271 {
    uint256 private _nonce;

    receive() external payable {}

    /// @notice Execute call on behalf of the NFT owner
    function execute(address to, uint256 value, bytes calldata data, uint8 operation)
        external payable returns (bytes memory result)
    {
        require(msg.sender == owner(), "Not NFT owner");
        require(operation == 0, "Only CALL supported");

        bool success;
        (success, result) = to.call{value: value}(data);
        if (!success) {
            assembly { revert(add(result, 32), mload(result)) }
        }
    }

    /// @notice Returns the NFT owner as the account owner
    function owner() public view returns (address) {
        (uint256 chainId, address tokenContract, uint256 tokenId) = token();
        if (chainId != block.chainid) return address(0);
        return IERC721(tokenContract).ownerOf(tokenId);
    }

    /// @notice Returns the bound NFT's chain, contract, and tokenId
    function token() public view returns (uint256, address, uint256) {
        // ERC-6551 standard storage layout
        bytes memory footer = new bytes(0x60);
        assembly {
            extcodecopy(address(), add(footer, 0x20), 0x4d, 0x60)
        }
        return abi.decode(footer, (uint256, address, uint256));
    }

    function isValidSignature(bytes32 hash, bytes calldata signature)
        external view returns (bytes4)
    {
        bool valid = SignatureChecker.isValidSignatureNow(owner(), hash, signature);
        return valid ? IERC1271.isValidSignature.selector : bytes4(0);
    }

    function supportsInterface(bytes4 interfaceId) public pure returns (bool) {
        return interfaceId == type(IERC165).interfaceId
            || interfaceId == type(IERC1271).interfaceId;
    }
}
```

## Gas Comparison (EVM vs PVM)

| Operation | EVM Gas | PVM Gas | Saving |
|---|---|---|---|
| ERC-20 transfer | 21,000 | ~9,000 | ~57% |
| ERC-721 mint | 85,000 | ~35,000 | ~59% |
| ERC-1155 batch transfer (10 items) | 100,000 | ~40,000 | ~60% |
| ERC-4337 UserOp validation | 50,000 | ~20,000 | ~60% |

*Estimates based on preliminary pallet-revive benchmarks. Official numbers published pre-mainnet.*

## Related Docs

- [Solidity → RISC-V](./solidity-to-riscv.md) — Compilation guide
- [Deployment Guide](./deployment-guide.md) — Deploy to Dong Chain
- [Gaming Assets](../use-cases/gaming-assets.md) — Token patterns for gaming
