# XCM — Cross-Consensus Messaging

## What is XCM?

XCM (Cross-Consensus Messaging) is a **message format** (not a transport protocol) that defines what a message receiver should DO when it receives a message. XCM works between:

- Parachains (via XCMP/HRMP)
- Parachains and Relay Chain (via UMP/DMP)
- Smart contracts and pallets (within same chain)
- Across bridges to external networks

## Message Passing Channels

| Protocol | Direction | Status |
|---|---|---|
| **UMP** (Upward Message Passing) | Parachain → Relay Chain | Active |
| **DMP** (Downward Message Passing) | Relay Chain → Parachain | Active |
| **HRMP** (Horizontal Relay-routed Message Passing) | Parachain ↔ Parachain (via Relay) | Active (interim) |
| **XCMP** (Cross-Chain Message Passing) | Parachain ↔ Parachain (direct) | Planned |

**Note:** XCMP is the intended final solution for parachain-to-parachain messaging. Until fully activated, HRMP (which routes through the Relay Chain) is used. HRMP is functional but has higher latency and resource cost.

## Common XCM Operations

### Transfer Assets to Another Parachain

```rust
// Send DONG tokens to address on Parachain B
use xcm::prelude::*;

let message = Xcm(vec![
    // Withdraw DONG from sender's account
    WithdrawAsset((Here, 100 * DONG).into()),

    // Pay for XCM execution on destination
    BuyExecution {
        fees: (Here, 1 * DONG).into(),
        weight_limit: Limited(Weight::from_parts(1_000_000_000, 0)),
    },

    // Deposit to recipient on destination chain
    DepositAsset {
        assets: All.into(),
        beneficiary: AccountId32 {
            network: None,
            id: recipient_account_id.into(),
        }.into(),
    },
]);

// Send via HRMP to Parachain B (paraId: 2001)
pallet_xcm::Pallet::<Runtime>::send_xcm(
    Here,
    (Parent, Parachain(2001)).into(),
    message,
)?;
```

### Execute Cross-Chain Contract Call

```rust
// Call a smart contract on another parachain
let call_data = encode_call("transfer(address,uint256)", (recipient, amount));

let message = Xcm(vec![
    WithdrawAsset((Here, fee_amount).into()),
    BuyExecution { fees: (Here, fee_amount).into(), weight_limit: Unlimited },

    Transact {
        origin_kind: OriginKind::SovereignAccount,
        require_weight_at_most: Weight::from_parts(5_000_000_000, 0),
        call: RuntimeCall::Contracts(pallet_revive::Call::call {
            dest: contract_address,
            value: 0,
            gas_limit: Weight::from_parts(1_000_000_000, 0),
            storage_deposit_limit: None,
            data: call_data,
        }).encode().into(),
    },
]);
```

## Asset Multi-Location

XCM uses `MultiLocation` to identify assets across chains:

```rust
// DONG native token on Dong Chain (when sending from Dong Chain)
let dong_here = MultiLocation { parents: 0, interior: Here };

// DONG from the perspective of another parachain
let dong_from_para = MultiLocation {
    parents: 1,
    interior: X1(Parachain(DONG_CHAIN_PARA_ID)),
};

// Relay Chain token (DOT) from Dong Chain
let dot = MultiLocation { parents: 1, interior: Here };

// Ethereum ERC-20 (via bridge)
let usdc_on_eth = MultiLocation {
    parents: 2,
    interior: X2(
        GlobalConsensus(Ethereum { chain_id: 1 }),
        AccountKey20 { network: None, key: USDC_ADDRESS },
    ),
};
```

## XCM Asset Registry

Dong Chain maintains a registry of recognized foreign assets:

```rust
// In runtime configuration
parameter_types! {
    pub const DotLocation: MultiLocation = MultiLocation::parent();
    pub DotPerSecond: (AssetId, u128, u128) = (
        AssetId(DotLocation::get()),
        1_000_000_000_000,  // DOT price in units per second
        1024,               // DOT price per byte
    );
}

pub type AssetTransactors = (
    // Handle native DONG
    CurrencyAdapter<Balances, IsConcrete<SelfReserve>, LocationToAccountId, AccountId, ()>,
    // Handle foreign assets (DOT, etc.)
    FungiblesAdapter<Assets, ConvertedConcreteId<...>, LocationToAccountId, AccountId, ...>,
);
```

## HRMP Channel Setup

Before two parachains can exchange XCM messages, HRMP channels must be established:

```bash
# Parachain A requests channel to Parachain B
polkadot-js-api tx.hrmp.hrmpInitOpenChannel \
  --recipient <para_b_id> \
  --proposedMaxCapacity 1000 \
  --proposedMaxMessageSize 102400

# Parachain B accepts
polkadot-js-api tx.hrmp.hrmpAcceptOpenChannel \
  --sender <para_a_id>
```

Both operations require bond deposits on the Relay Chain.

## XCM Fee Calculation

XCM messages require fees on the destination chain. Fee estimation:

```typescript
// JavaScript: estimate XCM fee
const xcmWeight = await api.call.xcmPaymentApi.queryXcmWeight({
  v3: [
    { withdrawAsset: [[(Here, transferAmount)]] },
    { buyExecution: { fees: [(Here, 1)], weightLimit: 'Unlimited' } },
    { depositAsset: { assets: { wild: 'All' }, beneficiary: recipientLocation } }
  ]
});

const xcmFee = await api.call.xcmPaymentApi.queryWeightToAssetFee(
  xcmWeight,
  { v3: DotLocation }
);
```

## Dong Chain XCM Config

```rust
// XCM execution configuration
pub struct XcmConfig;

impl xcm_executor::Config for XcmConfig {
    type RuntimeCall = RuntimeCall;
    type XcmSender = XcmRouter;
    type AssetTransactor = AssetTransactors;
    type OriginConverter = XcmOriginToTransactDispatchOrigin;

    // Who can reserve-transfer assets
    type IsReserve = MultiNativeAsset<AbsoluteAndRelativeReserveProvider<SelfLocation>>;

    // Who can teleport assets
    type IsTeleporter = NativeAsset;  // Only DONG can be teleported

    // Weight calculation
    type Weigher = FixedWeightBounds<UnitWeightCost, RuntimeCall, MaxInstructions>;

    // Fee handling
    type Trader = UsingComponents<
        WeightToFee,
        SelfReserve,
        AccountId,
        Balances,
        ToAuthor<Runtime>,
    >;

    type ResponseHandler = PolkadotXcm;
    type AssetTrap = PolkadotXcm;
    type AssetLocker = PolkadotXcm;
    type AssetExchanger = ();
    type AssetClaims = PolkadotXcm;
    type SubscriptionService = PolkadotXcm;
    type PalletInstancesInfo = AllPalletsWithSystem;
    type MaxAssetsIntoHolding = MaxAssetsIntoHolding;
    type FeeManager = ();
    type MessageExporter = ();
    type UniversalAliases = Nothing;
    type CallDispatcher = RuntimeCall;
    type SafeCallFilter = Everything;
    type Aliasers = Nothing;
}
```

## Gaming Asset Cross-Chain Transfer

Moving an ERC-721 character NFT from Dong Chain to a Gaming Parachain via XCM:

```rust
// Transfer ERC-721 character NFT via XCM
// (requires XCM NFT standard — work in progress in Polkadot ecosystem)
let nft_asset = MultiAsset {
    id: AssetId(MultiLocation {
        parents: 0,
        interior: X2(
            PalletInstance(20),  // pallet-revive index
            AccountKey20 { network: None, key: CHARACTER_CONTRACT },
        ),
    }),
    fun: Fungibility::NonFungible(AssetInstance::Index(character_token_id)),
};

let message = Xcm(vec![
    WithdrawAsset(nft_asset.clone().into()),
    BuyExecution { fees: (Here, fee).into(), weight_limit: Unlimited },
    DepositAsset {
        assets: nft_asset.into(),
        beneficiary: player_location_on_gaming_para,
    },
]);
```

## Related Docs

- [Substrate Parachain](./03-substrate-parachain.md)
- [Depository & Relay Protocol](./06-depository-relay.md) — For non-Polkadot cross-chain (Ethereum, Solana)
