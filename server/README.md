# ChainVerify Server

Backend API server for supply chain verification built with Fastify and Algorand.

## Quick Start

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Start server
npm run dev
```

Server runs on `http://127.0.0.1:4000`

## Features

✅ RESTful API for batch verification  
✅ Smart contract integration (Algorand)  
✅ In-memory storage with contract fallback  
✅ x402 payment-gated verification  
✅ TypeScript support  
✅ Fastify framework (fast & lightweight)  

## API Endpoints

### Create Verification (x402)
```bash
GET /verify
```

Returns HTTP 402 with x402 payment requirements.

```bash
POST /verify
Content-Type: application/json
X-PAYMENT: <x402 payment payload>

{
  "batchAsaId": "batch-001",
  "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY"
}
```

### Get Status
```bash
GET /status/:batchAsaId
```

Full API docs: [docs/API.md](../docs/API.md)

## Configuration

### Environment Variables

Create a `.env` file (see `.env.example`):

```env
# Server
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# Algorand Configuration
ALGORAND_NODE_URL=http://localhost:4001
ALGORAND_INDEXER_URL=http://localhost:8980

# Smart Contract (optional - set when contract is deployed)
CONTRACT_APP_ID=0
DEFAULT_SENDER_MNEMONIC=

# x402 (Algorand AVM)
AVM_ADDRESS=
FACILITATOR_URL=https://facilitator.goplausible.xyz
X402_NETWORK=algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
X402_AMOUNT=1000
X402_ASSET_ID=0
X402_ASSET_DECIMALS=6
X402_ASSET_NAME=ALGO
X402_TIMEOUT_SECONDS=60

# AlgoKit LocalNet
# Set when using LocalNet
```

## Development Mode

By default, the server uses **in-memory storage** with no blockchain required:

```bash
npm run dev
```

This is perfect for:
- Local testing
- API development
- Integration testing

Verifications are stored in-memory and lost on restart.

## Production Mode

To connect to a deployed smart contract:

1. Deploy the contract to TestNet or MainNet
2. Set `CONTRACT_APP_ID` in `.env`
3. Set `DEFAULT_SENDER_MNEMONIC` for transaction signing
4. Restart server

See [Deployment Guide](../docs/DEPLOYMENT.md) for detailed steps.

## Project Structure

```
server/
├── index.ts                    # Fastify server entry point
├── config/
│   ├── algorand-client.factory.ts
│   └── algorand.config.ts
├── routes/
│   └── verification.routes.ts   # Route handlers
├── services/
│   ├── verification.engine.ts   # Business logic
│   ├── payment.gateway.ts       # Fee calculation
│   ├── contract-supply.service.ts
│   ├── contract.client.ts       # Contract wrapper
│   └── verification.store.ts    # In-memory storage
├── blockchain/
│   ├── algorand.client.ts
│   └── indexer.client.ts
├── types/
│   ├── http.types.ts
│   └── verification.types.ts
└── package.json
```

## Scripts

```bash
# Install dependencies
npm install

# Type check & compile
npm run build

# Start development server
npm run dev

# Start production server
npm start
```

## API Examples

### Create a Verification

```bash
# 1) Fetch payment requirements (HTTP 402)
curl -i http://127.0.0.1:4000/verify

# 2) Pay using an x402 client (recommended) and retry with X-PAYMENT header
curl -X POST http://127.0.0.1:4000/verify \
  -H "Content-Type: application/json" \
  -H "X-PAYMENT: <x402-payment-payload>" \
  -d '{
    "batchAsaId": "batch-001",
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY",
    "evidence": {
      "quality": "A+",
      "temperature": 4.5
    }
  }'
```

Response:
```json
{
  "verification": {
    "batchAsaId": "batch-001",
    "result": "VERIFIED",
    "confidence": 100,
    "reason": "Verification performed by smart contract",
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY",
    "timestamp": 1771357865
  },
  "payment": {
    "amount": 2000,
    "timestamp": 1771357865
  }
}
```

### Get Verification Status

```bash
curl http://127.0.0.1:4000/status/batch-001
```

Response:
```json
{
  "verification": {
    "batchAsaId": "batch-001",
    "result": "VERIFIED",
    "confidence": 100,
    "reason": "Verification performed by smart contract",
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY",
    "timestamp": 1771357865
  }
}
```

## Architecture

```
POST /verify
  ↓
ContractVerificationEngine
  ↓
ContractSupplyService (stores to both)
  ├─→ ContractClient (blockchain)
  └─→ VerificationStore (in-memory)
  ↓
Response with verification + payment


GET /status/:batchAsaId
  ↓
IndexerClientAdapter (retrieves from)
  ├─→ VerificationStore (in-memory - fast)
  └─→ ContractClient (blockchain - fallback)
  ↓
Response with verification
```

## Fee Structure

| Type | Amount |
|------|--------|
| Verification (VERIFIED) | 2,000 µAlgo |
| Verification (FLAGGED) | 5,000 µAlgo |
| Evidence (per 100 bytes) | +1 µAlgo |

## Blockchain Integration

### Storage

- **Primary**: Algorand smart contract (when CONTRACT_APP_ID is set)
- **Fallback**: In-memory storage (for development/testing)
- **Both**: Stored simultaneously for redundancy

### Contract Methods Used

- `storeVerification()` - Save verification on-chain
- `getVerification()` - Retrieve verification result
- `getVerificationConfidence()` - Get confidence score
- `getVerificationReason()` - Get verification notes
- `getVerificationVerifierAddr()` - Get verifier address
- `getVerificationTimestamp()` - Get verification time
- `getTotalVerifications()` - Get count of all verifications

See [Smart Contract Docs](../smart_contracts/contractSupply/README.md) for more info.

## Troubleshooting

### Port Already in Use

```bash
# Kill process on port 4000
lsof -i :4000 | grep -v COMMAND | awk '{print $2}' | xargs kill -9
```

### Module Not Found Errors

```bash
# Rebuild TypeScript
npm run build

# Reinstall dependencies
rm -rf node_modules
npm install
```

### Contract Errors

Check `.env` file:
- `CONTRACT_APP_ID` must be numeric or 0
- `DEFAULT_SENDER_MNEMONIC` must be valid
- Network URLs must be accessible

### Type Errors

```bash
# Rebuild
npm run build

# Or start fresh
npm install
npm run build
npm run dev
```

## Testing

### Manual Testing with curl

See examples above and in [docs/API.md](../docs/API.md)

### Automated Testing

Development: Jest tests for services (to be added)

```bash
npm test
```

## Logging

Server logs all requests using Fastify's built-in logger:

```json
{
  "level": 30,
  "time": 1771357865772,
  "pid": 35537,
  "req": { "method": "POST", "url": "/verify" },
  "msg": "incoming request"
}
```

Control log level with `LOG_LEVEL` environment variable (default: info)

## Security Notes

⚠️ **Development Only** - This server currently has:
- No authentication
- No rate limiting
- No HTTPS
- No input sanitization beyond basic validation

Add before production use:
- API key validation
- JWT authentication
- Rate limiting middleware
- HTTPS/TLS
- Input sanitization
- SQL/NoSQL injection prevention

## Dependencies

- **fastify** (^4.28.1) - Web framework
- **@algorandfoundation/algokit-utils** (^9.2.0) - Algorand toolkit
- **algosdk** (^3.5.2) - Algorand SDK
- **dotenv** (^17.3.1) - Environment config
- **typescript** (^5.5.4) - Language
- **tsx** (^4.19.1) - TypeScript executor
- **@types/node** (^25.2.3) - Node types

## Contributing

1. Follow TypeScript best practices
2. Add types for all functions
3. Test with `npm run build`
4. Document public APIs
5. Keep services decoupled

## Related Documentation

- [API Documentation](../docs/API.md)
- [Deployment Guide](../docs/DEPLOYMENT.md)
- [Onboarding Guide](../docs/ONBOARDING.md)
- [Smart Contract](../smart_contracts/contractSupply/)

## Next Steps

1. ✅ Basic server setup
2. ✅ Smart contract integration
3. ⏳ Connect to real smart contract (see deployment guide)
4. ⏳ Add database backend
5. ⏳ Add authentication
6. ⏳ Deploy frontend

## License

MIT
