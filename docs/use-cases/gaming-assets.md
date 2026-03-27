# Gaming Assets — In-Game Sovereignty on Dong Chain

## Overview

Dong Chain provides game developers a high-performance, player-sovereign asset infrastructure. Unlike traditional game economies where publishers control all assets, Dong Chain enforces true player ownership at the smart contract level.

## Core Principles

| Principle | Implementation |
|---|---|
| Player Sovereignty | Non-upgradable ERC-721/1155 with no admin burn/transfer |
| Throughput | RISC-V execution — 2-4x faster than EVM for batch NFT operations |
| UX-first | ERC-4337 session keys — no wallet popup for every action |
| Cross-game | XCM-based asset transfer across Polkadot parachains |
| Interoperability | Relay Depository bridges assets to Ethereum/OpenSea |

## Asset Standards

### Character NFTs (ERC-721)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/extensions/ERC721URIStorage.sol";

/// @title GameCharacter
/// @notice Player-sovereign character NFT — no admin can transfer or burn
contract GameCharacter is ERC721URIStorage {
    uint256 private _nextTokenId;
    address public immutable GAME_STUDIO;
    bool public mintingOpen = true;

    event CharacterMinted(uint256 indexed tokenId, address indexed owner, string characterClass);

    constructor(address studio) ERC721("DongChainCharacter", "DCHAR") {
        GAME_STUDIO = studio;
    }

    /// @notice Mint a new character — only studio can mint (during game launch)
    function mintCharacter(
        address player,
        string calldata characterClass,
        string calldata metadataURI
    ) external returns (uint256) {
        require(msg.sender == GAME_STUDIO, "Not studio");
        require(mintingOpen, "Minting closed");

        uint256 tokenId = _nextTokenId++;
        _safeMint(player, tokenId);
        _setTokenURI(tokenId, metadataURI);

        emit CharacterMinted(tokenId, player, characterClass);
        return tokenId;
    }

    /// @notice Permanently close minting — called after game launch, ensures scarcity
    function closeMinting() external {
        require(msg.sender == GAME_STUDIO, "Not studio");
        mintingOpen = false;
    }

    // NO admin burn function — player sovereignty enforced
    // NO admin transfer function — only player can transfer their characters
}
```

### Item Contracts (ERC-1155 Multi-Token)

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/// @title GameItems
/// @notice Multi-token contract for in-game items
///         Optimized for batch operations on RISC-V
contract GameItems is ERC1155, Ownable {
    // Item type IDs
    uint256 public constant SWORD      = 1;
    uint256 public constant SHIELD     = 2;
    uint256 public constant POTION     = 3;
    uint256 public constant RARE_ARMOR = 4;

    // Item metadata
    mapping(uint256 => string) public itemNames;
    mapping(uint256 => uint256) public maxSupply;
    mapping(uint256 => uint256) public currentSupply;

    constructor() ERC1155("https://api.game.io/items/{id}.json") Ownable(msg.sender) {
        itemNames[SWORD] = "Dragon Sword";
        itemNames[SHIELD] = "Crystal Shield";
        itemNames[POTION] = "Health Potion";
        itemNames[RARE_ARMOR] = "Legendary Armor";

        maxSupply[SWORD] = 10000;
        maxSupply[SHIELD] = 10000;
        maxSupply[POTION] = type(uint256).max;  // Unlimited consumables
        maxSupply[RARE_ARMOR] = 100;             // Rare — hard cap
    }

    /// @notice Mint items to a player (called when player earns items in-game)
    function mintItems(
        address player,
        uint256[] calldata itemIds,
        uint256[] calldata amounts
    ) external onlyOwner {
        for (uint256 i = 0; i < itemIds.length; i++) {
            currentSupply[itemIds[i]] += amounts[i];
            require(
                currentSupply[itemIds[i]] <= maxSupply[itemIds[i]],
                "Exceeds max supply"
            );
        }
        _mintBatch(player, itemIds, amounts, "");
    }

    /// @notice Batch transfer entire inventory — optimized for RISC-V
    ///         Player can move all items to another wallet atomically
    function transferInventory(
        address to,
        uint256[] calldata itemIds,
        uint256[] calldata amounts
    ) external {
        safeBatchTransferFrom(msg.sender, to, itemIds, amounts, "");
    }
}
```

### Character-Owned Inventory (ERC-6551 Token Bound Accounts)

ERC-6551 allows each Character NFT to have its own wallet — characters own their items:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ERC6551Registry
/// @notice Creates token-bound accounts for character NFTs
interface IERC6551Registry {
    function createAccount(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external returns (address);

    function account(
        address implementation,
        bytes32 salt,
        uint256 chainId,
        address tokenContract,
        uint256 tokenId
    ) external view returns (address);
}

// Usage:
// character #42's wallet address:
// registry.account(accountImpl, salt, block.chainid, characterNFT, 42)
//
// Items held by character #42:
// gameItems.balanceOf(registry.account(..., 42), SWORD)
```

## Session Keys for Gaming UX

Session keys allow smooth gameplay without constant wallet approvals:

```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title GameSessionKeyModule
/// @notice Smart Account module for bounded game session authorization
contract GameSessionKeyModule {
    struct SessionKey {
        address key;                  // Temporary key address
        uint256 validUntil;           // Expiry timestamp
        bytes4[] allowedSelectors;    // Permitted function calls
        uint256 spendLimit;           // Max DONG spend per session
        uint256 amountSpent;          // Tracking current spend
        address[] allowedTargets;     // Permitted contract addresses
    }

    mapping(address => mapping(address => SessionKey)) public sessionKeys;
    // smartAccount => sessionKeyAddress => SessionKey

    /// @notice Register a session key for in-game actions
    /// @param sessionKeyAddress Temporary key generated by game client
    /// @param validHours Session duration (max 24 hours recommended for gaming)
    function registerSessionKey(
        address sessionKeyAddress,
        uint256 validHours,
        bytes4[] calldata selectors,
        uint256 spendLimit,
        address[] calldata targets
    ) external {
        require(validHours <= 24, "Max 24h session");

        sessionKeys[msg.sender][sessionKeyAddress] = SessionKey({
            key: sessionKeyAddress,
            validUntil: block.timestamp + (validHours * 3600),
            allowedSelectors: selectors,
            spendLimit: spendLimit,
            amountSpent: 0,
            allowedTargets: targets
        });
    }

    /// @notice Validate if a session key can execute a specific call
    function validateSessionCall(
        address smartAccount,
        address sessionKey,
        address target,
        bytes4 selector,
        uint256 value
    ) external view returns (bool) {
        SessionKey storage sk = sessionKeys[smartAccount][sessionKey];

        if (block.timestamp > sk.validUntil) return false;
        if (sk.amountSpent + value > sk.spendLimit) return false;

        bool targetAllowed = false;
        for (uint256 i = 0; i < sk.allowedTargets.length; i++) {
            if (sk.allowedTargets[i] == target) { targetAllowed = true; break; }
        }
        if (!targetAllowed) return false;

        bool selectorAllowed = false;
        for (uint256 i = 0; i < sk.allowedSelectors.length; i++) {
            if (sk.allowedSelectors[i] == selector) { selectorAllowed = true; break; }
        }

        return selectorAllowed;
    }
}
```

## Game Integration Example

```javascript
// Game client SDK example
import { DongChainGameSDK } from "@dongchain/game-sdk";

const sdk = new DongChainGameSDK({
  rpcUrl: "https://rpc.dongchain.io",
  bundlerUrl: "https://bundler.dongchain.io",
  entryPoint: ENTRY_POINT_ADDRESS,
  gameContracts: {
    character: CHARACTER_CONTRACT,
    items: ITEMS_CONTRACT,
    depository: DEPOSITORY_CONTRACT,
  }
});

// Create session key on game login (replaces wallet popup for every action)
const sessionKey = await sdk.createSessionKey({
  wallet: playerSmartAccount,
  validHours: 8,
  allowedActions: [
    "mintItems",           // Can earn items
    "safeBatchTransferFrom", // Can trade items
    "equipItem",           // Can equip items
  ],
  spendLimit: ethers.parseEther("0.1"),  // Max 0.1 DONG per session
});

// During gameplay — no wallet popup needed!
await sdk.earnItem(playerAddress, SWORD, 1);    // Gasless via session key
await sdk.equipItem(playerAddress, characterId, SWORD); // Gasless
```

## Cross-Chain Asset Transfer

Players can move assets to Ethereum (e.g., to sell on OpenSea):

```typescript
// Transfer character NFT to Ethereum via Relay Depository
const transfer = await sdk.crossChainTransfer({
  fromChain: "dongchain",
  toChain: "ethereum",
  asset: {
    type: "ERC721",
    contract: CHARACTER_CONTRACT,
    tokenId: 42,
  },
  recipient: playerEthereumAddress,
});

// Transfer completes in ~30-60 seconds via Solver network
console.log("Transfer ID:", transfer.orderId);
```

## Sovereignty Guarantees

| Scenario | Dong Chain Behavior |
|---|---|
| Game studio shuts down | Player NFTs remain on-chain, transferable forever |
| Game servers go offline | Assets still exist; can be traded on any EVM DEX |
| Studio tries to burn player NFT | Transaction reverts — no admin burn function |
| Studio tries to transfer player NFT | Transaction reverts — only player can transfer |
| Studio upgrades game logic | New contract deployed; old assets remain valid |

## Gaming Parachain Architecture

For high-volume games (millions of transactions/day), deploy a dedicated Gaming Parachain:

```
Relay Chain (shared security)
        │
        ├── Dong Chain (main token, governance, RWA)
        │
        └── Gaming Parachain (high-throughput NFT operations)
                │
                ├── ERC-721 Character Registry
                ├── ERC-1155 Item Marketplace
                ├── Matchmaking Logic (RISC-V smart contracts)
                └── Leaderboard State (on-chain rankings)
```

Gaming Parachain benefits:
- Dedicated block space (no competition with DeFi)
- Custom gas pricing for game microtransactions
- XCM bridges to main Dong Chain for token transfers
- RISC-V SIMD for game physics/randomness computation

## Related Docs

- [ERC-4337 Account Abstraction](../components/erc4337-account-abstraction.md)
- [Token Standards](../smart-contracts/token-standards.md)
- [Depository & Relay Protocol](../architecture/06-depository-relay.md)
- [RWA Tokenization](./rwa-tokenization.md)
