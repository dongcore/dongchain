# Node Setup Guide

This guide covers production node configuration for Dong Chain.

## Node Types

| Node Type | Role | Requirements |
|---|---|---|
| **Collator** | Produces blocks, submits PoV | High CPU, 64GB RAM |
| **Full node** | Archives all state | 2TB+ storage |
| **RPC node** | Serves JSON-RPC requests | High bandwidth |
| **Bitcoin/OmniCore** | Layer-0 data source | 1TB+ storage |
| **ZK Prover** | Generates batch ZK proofs | GPU (A100 recommended) |

## Bitcoin/OmniCore Node

### Install OmniCore

```bash
# Download OmniCore binary
wget https://github.com/OmniLayer/omnicore/releases/download/v0.12.0/omnicore-0.12.0-x86_64-linux-gnu.tar.gz
tar -xzf omnicore-0.12.0-x86_64-linux-gnu.tar.gz
sudo mv omnicore-0.12.0/bin/* /usr/local/bin/

# Verify
omnicored --version
```

### Bitcoin Configuration

```bash
mkdir -p ~/.bitcoin
cat > ~/.bitcoin/bitcoin.conf << 'EOF'
# REQUIRED for OmniCore
txindex=1
addressindex=1
timestampindex=1
spentindex=1

# RPC access
rpcuser=dongchain
rpcpassword=CHANGE_THIS_STRONG_PASSWORD
rpcport=8332
rpcbind=127.0.0.1
server=1

# Performance
dbcache=4096
maxmempool=512
par=-1  # Use all CPU cores for validation

# Networking
listen=1
maxconnections=50
EOF
```

### Start OmniCore

```bash
# Start (initial sync: 12-48 hours)
omnicored -daemon

# Monitor sync progress
omnicore-cli getblockchaininfo | python3 -c "
import json, sys
info = json.load(sys.stdin)
print(f'Progress: {info[\"verificationprogress\"]:.2%}')
print(f'Blocks: {info[\"blocks\"]}')
"

# Check OmniCore is parsing
omnicore-cli omni_getactivations
```

### Systemd Service

```ini
# /etc/systemd/system/omnicore.service
[Unit]
Description=OmniCore Bitcoin Node
After=network.target

[Service]
User=bitcoin
Type=forking
ExecStart=/usr/local/bin/omnicored -daemon
ExecStop=/usr/local/bin/omnicore-cli stop
Restart=on-failure
RestartSec=30

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl enable omnicore
sudo systemctl start omnicore
sudo systemctl status omnicore
```

## Dong Chain Parachain Node

### Binary Installation

```bash
# Build from source (recommended for production)
git clone https://github.com/dongchain/dong-chain
cd dong-chain
cargo build --release -p dong-chain-node

# Or download binary release
wget https://github.com/dongchain/dong-chain/releases/latest/download/dong-chain-node-linux-x86_64
chmod +x dong-chain-node-linux-x86_64
sudo mv dong-chain-node-linux-x86_64 /usr/local/bin/dong-chain-node
```

### Key Generation

```bash
# Generate collator session key
subkey generate --scheme sr25519 > /secure/collator-key.txt
# Store the public key — insert into chain via author_insertKey RPC

# Generate node network key
dong-chain-node key generate-node-key --file /secure/node-key.txt
```

### Collator Configuration

```bash
dong-chain-node \
  --collator \
  --chain /etc/dong-chain/chain-spec.json \
  --base-path /data/dong-chain \
  --name "MyCollator" \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-cors all \
  --rpc-methods safe \
  --pruning archive \
  --node-key-file /secure/node-key.txt \
  --bootnodes /dns/boot1.dongchain.io/tcp/30333/p2p/12D3KooW... \
  -- \
  --chain /etc/dong-chain/relay-chain-spec.json \
  --port 30343 \
  --rpc-port 9945
```

### Insert Session Key

```bash
# Insert collator key into keystore
curl -sS http://localhost:9944 -H 'Content-Type: application/json' \
  -d '{
    "id": 1,
    "jsonrpc": "2.0",
    "method": "author_insertKey",
    "params": ["aura", "<mnemonic>", "<public-key>"]
  }'
```

### Systemd Service

```ini
# /etc/systemd/system/dong-chain.service
[Unit]
Description=Dong Chain Collator Node
After=network.target omnicore.service

[Service]
User=dongchain
ExecStart=/usr/local/bin/dong-chain-node \
  --collator \
  --chain /etc/dong-chain/chain-spec.json \
  --base-path /data/dong-chain \
  --port 30333 \
  --rpc-port 9944 \
  --rpc-cors all \
  -- \
  --chain /etc/dong-chain/relay-chain-spec.json \
  --port 30343

Restart=on-failure
RestartSec=10
LimitNOFILE=65536

[Install]
WantedBy=multi-user.target
```

## Monitoring

### Prometheus Metrics

```bash
# Enable metrics (add to startup flags)
--prometheus-port 9615 \
--prometheus-external

# Prometheus scrape config
scrape_configs:
  - job_name: dong_chain
    static_configs:
      - targets: ['localhost:9615']
```

### Key Metrics to Monitor

| Metric | Alert Threshold | Meaning |
|---|---|---|
| `substrate_block_height{status="finalized"}` | < expected | Block finality delayed |
| `substrate_peers_count` | < 5 | Network connectivity issue |
| `substrate_ready_transactions_number` | > 1000 | Mempool congestion |
| `process_cpu_seconds_total` | > 90% | CPU bottleneck |
| `process_resident_memory_bytes` | > 80% of RAM | Memory pressure |

### Health Check Script

```bash
#!/bin/bash
# health-check.sh

# Check Dong Chain node
BLOCK=$(curl -s http://localhost:9944 -H 'Content-Type: application/json' \
  -d '{"id":1,"jsonrpc":"2.0","method":"eth_blockNumber","params":[]}' | jq -r .result)
echo "Current block: $((16#${BLOCK:2}))"

# Check OmniCore
BTC_BLOCKS=$(omnicore-cli getblockcount)
echo "Bitcoin blocks: $BTC_BLOCKS"

# Check disk space
df -h /data/dong-chain
df -h ~/.bitcoin
```

## Security Hardening

```bash
# Firewall rules (ufw)
sudo ufw default deny incoming
sudo ufw allow 22/tcp          # SSH
sudo ufw allow 30333/tcp       # Dong Chain P2P
sudo ufw allow 30343/tcp       # Relay Chain P2P
sudo ufw allow 8332/tcp        # Bitcoin RPC (localhost only — handled by ufw)
sudo ufw allow 9944/tcp        # Dong Chain RPC (restrict to trusted IPs in prod)
sudo ufw enable

# Restrict Bitcoin RPC to localhost
# (Done via rpcbind=127.0.0.1 in bitcoin.conf)

# Never expose node private keys via RPC
# Use --rpc-methods safe for public-facing nodes
```

## Related Docs

- [Environment Setup](./02-environment-setup.md)
- [Prerequisites](./01-prerequisites.md)
- [Substrate Parachain Architecture](../architecture/03-substrate-parachain.md)
