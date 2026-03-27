# Layer 0 — Bitcoin & OmniCore

## Role: The Immutable Motherboard

Bitcoin serves as the Layer-0 "Motherboard" for Dong Chain. It provides:
- **Censorship-resistant finality:** Assets recorded on Bitcoin inherit the world's largest PoW security
- **Immutable RWA registry:** All asset issuances are permanently recorded via OmniCore OP_RETURN
- **Trust anchor for bridges:** BitVM2 uses Bitcoin as the final dispute resolution layer

## Bitcoin Node Setup

### Required Configuration (`bitcoin.conf`)

```toml
# MANDATORY: Full transaction index — OmniCore will refuse to start without this
txindex=1

# RPC access
rpcuser=dongchain
rpcpassword=<strong-random-password>
rpcport=8332
server=1

# Performance tuning
dbcache=4096          # 4GB DB cache for faster sync
maxmempool=512        # 512MB mempool

# Indexing
addressindex=1        # Required for address balance queries
timestampindex=1      # Required for timestamp queries
spentindex=1          # Required for spent output queries
```

**Warning:** If `txindex=1` is added after the node is already synced, a full re-index is required. This can take 12-24 hours. Plan accordingly.

### Initial Sync Timeline (Reference Hardware)

| Hardware | Initial Bitcoin Sync | OmniCore Parse |
|---|---|---|
| 8-core, 32GB RAM, HDD | 48-72 hours | 3-5 hours |
| 16-core, 64GB RAM, NVMe | 12-24 hours | 60-90 minutes |
| 32-core, 128GB RAM, NVMe RAID | 4-8 hours | 30-45 minutes |

### Health Check Commands

```bash
# Verify node is synced
bitcoin-cli getblockchaininfo | jq .verificationprogress

# Verify txindex is active
bitcoin-cli getindexinfo

# Expected output:
# {
#   "txindex": {
#     "synced": true,
#     "best_block_height": <current_height>
#   }
# }
```

## OmniCore Integration

### What is OmniCore?

OmniCore is a Bitcoin Core fork that adds the Omni Layer meta-protocol. It parses special Bitcoin transactions to maintain a parallel asset registry without changing Bitcoin's consensus rules.

Think of it as: **HTTP running on TCP/IP** — OmniCore adds asset semantics on top of Bitcoin's transport layer.

### Encoding Mechanisms

#### Layer B (Multisig Encoding)
Embeds up to 66 bytes per public key slot into multisig outputs:
```
OP_1 <data_pubkey_1> <data_pubkey_2> <signing_pubkey> OP_3 OP_CHECKMULTISIG
```

#### Layer C (OP_RETURN Encoding — Preferred)
Embeds up to 80 bytes into an unspendable output:
```
OP_RETURN <0x6f6d6e69> <asset_type: 2 bytes> <property_id: 4 bytes> <amount: 8 bytes> ...
```

Where `0x6f6d6e69` is the Omni protocol magic bytes ("omni" in ASCII).

### Asset Issuance

#### Create a Fixed-Supply RWA Token

```bash
omnicore-cli omni_sendissuancefixed \
  "bc1q..." \           # From address (issuer)
  1 \                   # Ecosystem: 1=mainnet
  2 \                   # Type: 2=divisible (like ERC-20), 1=indivisible (like NFT)
  0 \                   # Previous ID: 0 for new token
  "Real Estate" \       # Category
  "Commercial" \        # Subcategory
  "Hanoi Office Tower" \# Name
  "https://issuer.com/token-info" \  # URL
  "Tokenized ownership of 100 Nguyen Hue, Hanoi" \  # Data
  "1000000"             # Total supply (1,000,000 tokens)
```

**Response:**
```json
{
  "txid": "abc123...",
  "propertyid": 42
}
```

#### Query Asset State

```bash
# Get all assets issued by an address
omnicore-cli omni_listproperties

# Get specific property info
omnicore-cli omni_getproperty 42

# Get balance
omnicore-cli omni_getbalance "bc1q..." 42
```

### State Synchronization to Dong Chain

The OmniCore state must be mirrored to the Dong Chain runtime. The bridge module:

1. Subscribes to `omni_listtransactions` for new Omni Layer events
2. On each Bitcoin block, queries changed balances
3. Produces proofs of OmniCore state for the BitVM2 oracle

```rust
// Pseudocode: OmniCore state listener
async fn omnicore_listener(rpc: &OmniRpcClient) {
    let mut last_height = get_last_processed_height();

    loop {
        let current_height = rpc.get_block_count().await?;

        for height in last_height..current_height {
            let block = rpc.get_block_hash(height).await?;
            let txs = rpc.omni_list_transactions_for_block(block).await?;

            for tx in txs {
                if tx.is_peg_in_lock() {
                    emit_peg_in_event(tx);
                }
            }
        }

        last_height = current_height;
        sleep(Duration::from_secs(30)).await;
    }
}
```

## Storage Requirements

| Data | Size (2026) | Growth |
|---|---|---|
| Bitcoin blockchain | ~700 GB | ~50 GB/year |
| Bitcoin indexes (txindex, etc.) | ~100 GB | ~7 GB/year |
| OmniCore state DB | ~10 GB | ~1 GB/year |
| **Total** | **~810 GB** | **~58 GB/year** |

**Recommendation:** Use a dedicated 2TB NVMe SSD for Layer-0 data with automated backup.

## Limitations of Layer 0

OmniCore is intentionally limited — it is a "Depository of Truth" only:

| Can Do | Cannot Do |
|---|---|
| Issue fungible tokens | Execute conditional logic |
| Transfer token ownership | Run AMMs or lending protocols |
| Record immutable metadata | Process cross-chain messages |
| Maintain audit trail | Interact with other chains |

All programmable logic must happen on Dong Chain's RISC-V layer after bridging.

## Related Docs

- [BitVM2 Bridge](./02-bitvm2-bridge.md) — How assets cross from Layer 0 to Dong Chain
- [Depository Contract](../components/depository-contract.md) — Cross-chain liquidity protocol
