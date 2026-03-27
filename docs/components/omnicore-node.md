# OmniCore Node

## Overview

OmniCore is a full Bitcoin node with the Omni Layer meta-protocol built in. It serves as Dong Chain's Layer-0 asset registry — all RWA tokens are issued and tracked here before being bridged to Dong Chain.

## Installation

```bash
# Download latest OmniCore release
VERSION=0.12.0
wget https://github.com/OmniLayer/omnicore/releases/download/v${VERSION}/omnicore-${VERSION}-x86_64-linux-gnu.tar.gz
tar -xzf omnicore-${VERSION}-x86_64-linux-gnu.tar.gz
sudo mv omnicore-${VERSION}/bin/* /usr/local/bin/

# Verify
omnicored --version
omnicore-cli --version
```

## Configuration

```bash
# Create data directory
mkdir -p ~/.bitcoin

# Write config
cat > ~/.bitcoin/bitcoin.conf << 'EOF'
# MANDATORY — OmniCore will not start without this
txindex=1

# Additional indexes for asset tracking
addressindex=1
timestampindex=1
spentindex=1

# RPC access (restrict to localhost in production)
rpcuser=dongchain
rpcpassword=CHANGE_THIS_TO_STRONG_RANDOM_PASSWORD
rpcport=8332
rpcbind=127.0.0.1
rpcallowip=127.0.0.1
server=1

# Performance
dbcache=4096        # 4GB RAM cache
maxmempool=512      # 512MB mempool
par=-1              # Use all CPU cores

# P2P
listen=1
maxconnections=50
EOF
```

## Starting the Node

```bash
# Start in background
omnicored -daemon

# Monitor startup
tail -f ~/.bitcoin/debug.log | grep -E "OmniCore|txindex|synced"

# Check sync status
omnicore-cli getblockchaininfo | python3 -m json.tool
```

**Sync times (reference hardware: 16-core, 64GB RAM, NVMe):**
- Bitcoin blockchain: 12-24 hours
- OmniCore Omni Layer parsing: additional 60-90 minutes

## JSON-RPC Interface

OmniCore extends the standard Bitcoin JSON-RPC with `omni_*` methods:

### Asset Management

```bash
# List all properties on Omni Layer
omnicore-cli omni_listproperties

# Get specific property info
omnicore-cli omni_getproperty <propertyid>

# Get balance
omnicore-cli omni_getbalance <address> <propertyid>

# Get all balances for address
omnicore-cli omni_getallbalancesforaddress <address>

# List transactions
omnicore-cli omni_listtransactions

# Get transaction details
omnicore-cli omni_gettransaction <txid>
```

### Asset Issuance

```bash
# Issue a fixed-supply token (for RWA with fixed share count)
omnicore-cli omni_sendissuancefixed \
  <fromaddress> \
  <ecosystem: 1=mainnet, 2=testnet> \
  <type: 1=indivisible, 2=divisible> \
  <previousid: 0 for new> \
  "<category>" \
  "<subcategory>" \
  "<name>" \
  "<url>" \
  "<data>" \
  "<amount>"

# Issue a managed-supply token (for RWAs with variable supply)
omnicore-cli omni_sendissuancemanaged \
  <fromaddress> \
  <ecosystem> \
  <type> \
  <previousid> \
  "<category>" "<subcategory>" "<name>" "<url>" "<data>"

# Grant additional supply (managed tokens only)
omnicore-cli omni_sendgrant <fromaddress> <toaddress> <propertyid> <amount>

# Revoke supply (managed tokens only)
omnicore-cli omni_sendrevoke <fromaddress> <propertyid> <amount>
```

### Asset Transfer

```bash
# Transfer token to another address
omnicore-cli omni_send <fromaddress> <toaddress> <propertyid> <amount>

# Transfer to BitVM2 bridge (for peg-in)
omnicore-cli omni_send \
  "bc1qISSUER_ADDRESS" \
  "bc1qBITVM2_BRIDGE_ADDRESS" \
  42 \          # Property ID
  "1000000"     # Amount to bridge
```

## Asset Lifecycle Monitoring

The bridge module monitors OmniCore for peg-in events:

```python
#!/usr/bin/env python3
"""Monitor OmniCore for bridge peg-in transactions."""

import json
import time
import subprocess

BRIDGE_ADDRESS = "bc1qBITVM2_BRIDGE_ADDRESS"
PROPERTY_ID = 42
CONFIRMATIONS_REQUIRED = 6

def get_block_count():
    result = subprocess.run(
        ["omnicore-cli", "getblockcount"],
        capture_output=True, text=True
    )
    return int(result.stdout.strip())

def get_omni_transactions(address, count=100):
    result = subprocess.run(
        ["omnicore-cli", "omni_listtransactions", address, str(count), "0"],
        capture_output=True, text=True
    )
    return json.loads(result.stdout)

def monitor_peg_ins():
    current_block = get_block_count()

    while True:
        txs = get_omni_transactions(BRIDGE_ADDRESS)

        for tx in txs:
            if (tx.get("propertyid") == PROPERTY_ID
                    and tx.get("valid")
                    and tx.get("confirmations", 0) >= CONFIRMATIONS_REQUIRED):

                print(f"[PEG-IN CONFIRMED] txid={tx['txid']} "
                      f"amount={tx['amount']} "
                      f"sender={tx['sendingaddress']}")

                # Trigger mint on Dong Chain
                trigger_dong_chain_mint(
                    property_id=tx['propertyid'],
                    amount=tx['amount'],
                    bitcoin_txid=tx['txid'],
                    sender=tx['sendingaddress'],
                )

        time.sleep(30)  # Check every 30 seconds

if __name__ == "__main__":
    monitor_peg_ins()
```

## Property Types

| Type | Value | Description | Use Case |
|---|---|---|---|
| Divisible | 2 | Like ERC-20 (18 decimal-like precision) | Shares, currencies |
| Indivisible | 1 | Integer units only | Certificates, unique items |

## Ecosystem

| Ecosystem | Value | Purpose |
|---|---|---|
| Main | 1 | Mainnet assets (real value) |
| Test | 2 | Testnet assets (no real value) |

## Limitations

| Cannot Do | Workaround |
|---|---|
| Conditional logic | Move to Dong Chain RISC-V smart contracts |
| Cross-chain messages | Use BitVM2 bridge → Dong Chain |
| AMM/DeFi operations | Deploy on Dong Chain pallet-revive |
| Real-time queries | Poll via JSON-RPC |

## Troubleshooting

### "txindex not enabled" error
```bash
# Stop node
omnicore-cli stop

# Add txindex=1 to bitcoin.conf
echo "txindex=1" >> ~/.bitcoin/bitcoin.conf

# Restart with reindex (takes 12-24 hours)
omnicored -reindex
```

### OmniCore parse takes too long
```bash
# Check parsing progress
omnicore-cli omni_getinfo | python3 -m json.tool | grep -E "block|parse"
```

### RPC connection refused
```bash
# Verify node is running
pgrep -x omnicored

# Check RPC port
ss -tlnp | grep 8332

# Test connection
curl --user dongchain:password \
  --data '{"jsonrpc":"1.0","id":"test","method":"getblockcount","params":[]}' \
  -H 'content-type: text/plain;' \
  http://127.0.0.1:8332/
```

## Related Docs

- [Layer 0 — Bitcoin & OmniCore Architecture](../architecture/01-layer0-bitcoin.md)
- [BitVM2 Bridge](../architecture/02-bitvm2-bridge.md)
- [RWA Tokenization Use Case](../use-cases/rwa-tokenization.md)
