# Phase 4.1: Deployment Guide

This guide explains how to deploy the ChainVerify smart contract and connect it to the server.

## Overview

The server is designed to work in two modes:

1. **Development Mode** (Default): Uses in-memory storage
   - No blockchain required
   - Perfect for testing the API
   - Verifications are stored in-memory (lost on restart)

2. **Production Mode**: Uses on-chain storage via smart contract
   - Requires deployed smart contract
   - Verifications stored permanently on blockchain
   - Requires blockchain configuration

## Step 1: Deploy Smart Contract to LocalNet

### Prerequisites
- AlgoKit CLI installed
- Docker running for LocalNet
- contract app in `/smart_contracts/contractSupply/algokit`

### Deploy Steps

```bash
# Start LocalNet
algokit localnet start

# Navigate to contract directory
cd smart_contracts/contractSupply/algokit

# Deploy the contract
algokit project deploy localnet

# Save the app ID from the output (you'll need it in Step 2)
# Look for: "App ID: <app-id>"
```

## Step 2: Configure Server Environment

Edit `/server/.env`:

```env
# Set the deployed app ID
CONTRACT_APP_ID=<app-id-from-step-1>

# Set default sender (the account that will sign transactions)
# Use an account from LocalNet
DEFAULT_SENDER_MNEMONIC="<mnemonic-of-localnet-account>"

# Algorand network URLs (for LocalNet)
ALGORAND_NODE_URL=http://localhost:4001
ALGORAND_INDEXER_URL=http://localhost:8980
```

### Getting a LocalNet Account

```bash
# List available accounts
algokit localnet accounts list

# Get the mnemonic of an account
algokit localnet accounts detail -a <account-address> -m
```

## Step 3: Restart Server

```bash
cd server

# Kill previous server
pkill -f "npx tsx"

# Start with new configuration
npm run dev
```

## Step 4: Verify Contract Integration

### Test Store and Retrieve

```bash
# Create a verification
curl -X POST http://127.0.0.1:4000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "batchAsaId": "batch-001",
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY",
    "evidence": {"quality": "A+"}
  }'

# Retrieve the verification (should now query the contract)
curl http://127.0.0.1:4000/status/batch-001
```

### Check Server Logs

Look for messages like:
```
[ContractSupplyService] Stored verification for batch batch-001 to contract
```

If you see contract errors, check:
1. `CONTRACT_APP_ID` is correct
2. `DEFAULT_SENDER_MNEMONIC` is valid
3. Contract was deployed successfully
4. LocalNet is running

## Step 5: Deploy to TestNet (Advanced)

### Prerequisites
- TestNet Algo account with funds
- TestNet dispenser https://testnet.algoexplorer.io/dispenser

### Deploy Steps

```bash
# In contract directory
cd smart_contracts/contractSupply/algokit

# Deploy to TestNet
algokit project deploy testnet

# Note the app ID
```

### Configure Server for TestNet

Edit `/server/.env`:

```env
ALGORAND_NETWORK=testnet
CONTRACT_APP_ID=<testnet-app-id>
DEFAULT_SENDER_MNEMONIC=<your-testnet-account-mnemonic>

# TestNet URLs
ALGORAND_NODE_URL=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_URL=https://testnet-idx.algonode.cloud
```

### Current TestNet Deployment Snapshot (2026-02-18)

Non-sensitive values for quick reference:

- App ID: 755697325
- App Address: K6GXF73VTSBCSAB75FOFNBFJWK37USSW4BZD7C3QIDIJKXE23MGZ6GST3E
- Payment ASA (CVT): 755696837
- Facilitator: https://facilitator.goplausible.xyz
- Algod: https://testnet-api.algonode.cloud
- Indexer: https://testnet-idx.algonode.cloud

Explorer / indexer quick checks:

- AlgoExplorer (testnet): https://testnet.algoexplorer.io/application/755697325
- AlgoScan (testnet): https://testnet.algoscan.app/app/755697325
- Indexer app info: https://testnet-idx.algonode.cloud/v2/applications/755697325
- Indexer boxes list: https://testnet-idx.algonode.cloud/v2/applications/755697325/boxes

Raw box decode script:

```bash
cd server
npx tsx scripts/inspect-contract-boxes.ts
```

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                  Fastify Server                     │
├─────────────────────────────────────────────────────┤
│  POST /verify  │  GET /status/:batchAsaId │  Routes  │
├─────────────────────────────────────────────────────┤
│           ContractSupplyService (Adapter)          │
├────────────────────┬────────────────────────────────┤
│  ContractClient    │   VerificationStore            │
│  (Blockchain)      │   (In-Memory/DB)               │
├────────────────────┴────────────────────────────────┤
│  When CONTRACT_APP_ID is set:                       │
│  - Try to store/query contract first                │
│  - Fall back to in-memory if contract unavailable   │
│                                                     │
│  When CONTRACT_APP_ID is 0 (default):              │
│  - Use in-memory storage only                       │
│  - Perfect for development/testing                  │
└─────────────────────────────────────────────────────┘
```

## Troubleshooting

### Error: "Cannot convert X to a BigInt"
**Cause**: `batchAsaId` must be numeric for blockchain calls
**Solution**: Use numeric batch IDs or contract will use in-memory fallback

### Error: "Contract app not found"
**Cause**: Wrong `CONTRACT_APP_ID` or contract not deployed
**Solution**: Verify app ID and redeploy contract

### Error: "Invalid sender"
**Cause**: `DEFAULT_SENDER_MNEMONIC` is invalid or account has no funds
**Solution**: Use `algokit localnet accounts list` to get valid account

### GET /status returns empty verification
**Cause**: Contract not deployed or verification not stored
**Solution**: Check server logs for "Stored verification for batch X to contract"

## Development vs Production

| Feature | Development | Production |
|---------|-------------|-----------|
| Storage | In-memory | Contract + DB |
| Persistence | Session only | Permanent |
| Configuration | Optional | Required |
| Cost | Free | Gas fees |
| Scalability | Limited | Depends on network |

## Next Steps

1. Generate ContractSupplyClient from artifacts (if not auto-generated)
2. Implement complete transaction signing in ContractClient
3. Add database backend for audit trail
4. Set up monitoring and alerting
5. Configure mainnet deployment
