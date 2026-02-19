# GreenSetu

> **The first x402-powered autonomous verification agent on Algorand — proving trust in every supply chain, one micropayment at a time.**

GreenSetu is a full-stack supply-chain verification platform where an AI agent autonomously pays for, verifies, and certifies the integrity of real-world supply chain data on the Algorand blockchain using the **x402 protocol** — with tokenized carbon rewards for sustainable farmers.

---

## Problem

| Problem | Scale |
|---------|-------|
| Food fraud & mislabeling | **$40 B/year** globally (WHO) |
| Farmers receive only 8-10% of retail price | 60-90 day payment delays |
| Carbon / ESG greenwashing | No verifiable link between farming practices and carbon credits |
| No autonomous verification infrastructure | Human audits are slow, expensive, and easily gamed |

## Solution

1. **Every product batch** gets a unique digital identity (ASA token) on Algorand at harvest.
2. **Every handler** (farmer → transporter → warehouse → retailer) logs immutable checkpoints on-chain with GPS, temperature, humidity, and photos.
3. **An x402 AI verification agent** autonomously analyzes every checkpoint for anomalies — paying for each verification via x402 micropayments.
4. **Farmers get paid instantly** in stablecoins the moment their product reaches the retailer via atomic transfers.
5. **Consumers scan a QR code** and see the full verified journey, AI trust score, and carbon footprint.
6. **Sustainable farmers earn** tokenized carbon credit tokens and build an on-chain reputation.

---

## Key Innovation — Why x402?

x402 is Algorand's newest protocol (announced Feb 12, 2026) enabling AI agents to make autonomous micropayments over HTTP. GreenSetu uses it so the verification agent can **self-fund its own verification work** without any human wallet interaction.

| Traditional Supply Chain Apps | GreenSetu |
|------|------|
| Log data on-chain | Log data + **AI agent autonomously verifies it** |
| Manual / human auditors | **Autonomous AI verification via x402 micropayments** |
| Static trust | **Dynamic trust score from independent AI analysis** |
| Slow bank payments | **Instant atomic payments in USDCa** |
| No carbon integration | **Auto-generated tokenized carbon credits** |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Smart Contracts** | TypeScript (TealScript), AlgoKit 2.x, Algorand Box Storage |
| **Backend** | Node.js, Fastify, SQLite (better-sqlite3), algosdk v3 |
| **Frontend** | Next.js 14 (App Router), React 18, Tailwind CSS 4 |
| **Verification** | x402-avm SDK, Rule-based anomaly detection engine |
| **Wallet** | Defly Wallet Connect |
| **Maps & QR** | Leaflet.js, html5-qrcode, qrcode.react |
| **Network** | Algorand TestNet (Nodely node provider) |
| **Payment Token** | CVT (GreenSetu Token) — custom ASA for x402 micropayments |

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         USERS                                   │
│  Farmer (Defly)  │  Transporter  │  Retailer  │  Consumer (QR) │
└───────┬──────────┴───────┬───────┴─────┬──────┴───────┬────────┘
        │                  │             │              │
        ▼                  ▼             ▼              ▼
┌──────────────────────────────────────────────────────────────┐
│  Next.js 14 Frontend  (port 3000)                            │
│  Pages: / │ /farmer │ /scan │ /verify │ /product/[batchId]   │
└──────────────────────────┬───────────────────────────────────┘
                           │ REST
                           ▼
┌──────────────────────────────────────────────────────────────┐
│  Fastify Backend  (port 4000)                                │
│  ┌──────────────┐  ┌──────────────────┐  ┌───────────────┐  │
│  │ Supply Chain  │  │ Verification     │  │ x402 Payment  │  │
│  │ Routes       │  │ Engine (AI)      │  │ Gateway       │  │
│  └──────┬───────┘  └────────┬─────────┘  └───────┬───────┘  │
│         │                   │                     │          │
│  ┌──────┴───────────────────┴─────────────────────┴───────┐  │
│  │  Contract Supply Service (orchestrator)                │  │
│  │  On-chain (Algorand) + SQLite dual persistence         │  │
│  └────────────────────────┬───────────────────────────────┘  │
└───────────────────────────┼──────────────────────────────────┘
                            │
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  Algorand TestNet                                            │
│  Smart Contract (TealScript) — App ID: configured at deploy  │
│  ┌───────────────────────────────────────────────────┐       │
│  │  createBatch()        → mints ASA per batch       │       │
│  │  logCheckpoint()      → writes to box storage     │       │
│  │  initiateHandoff()    → two-party handoff         │       │
│  │  confirmHandoff()     → confirms receipt          │       │
│  │  storeVerification()  → AI result on-chain        │       │
│  │  releaseFarmerPayment() → atomic transfer         │       │
│  │  calculateCarbonScore() → carbon credit ASA       │       │
│  └───────────────────────────────────────────────────┘       │
└──────────────────────────────────────────────────────────────┘
```

---

## Features

### Core
- **Batch Minting** — Each product batch becomes a unique ASA with full metadata (crop type, weight, GPS, organic cert)
- **Checkpoint Logging** — Immutable on-chain records at every supply chain stage (GPS, temp, humidity, photos)
- **x402 AI Verification** — Autonomous anomaly detection: speed checks, temperature validation, certification verification, route analysis
- **Instant Farmer Payment** — Atomic transfers in USDCa on delivery confirmation
- **Consumer QR Scan** — Mobile-friendly journey page with timeline, map, verification badge, and carbon score

### Trust & Anti-Fraud
- **Photo Hash Verification** — SHA-256 hashes stored on-chain; any photo tampering is detectable
- **Multi-Party Handoff** — Both sender and receiver must confirm every transfer; single-sided handoffs are flagged
- **Handoff Confirmation** — Visual ✓✓ (confirmed) or ⚠️ (pending) status on consumer page

### Sustainability
- **Tokenized Carbon Credits** — Auto-calculated from distance, transport method, and farming practices
- **Farmer Reputation NFT** — Dynamic on-chain reputation tiers (Bronze → Silver → Gold)

---

## Project Structure

```
GreenSetu/
├── frontend/                  # Next.js 14 frontend
│   ├── app/
│   │   ├── page.tsx           # Landing page
│   │   ├── farmer/            # Farmer dashboard
│   │   ├── scan/              # QR code scanner
│   │   ├── verify/            # Verification with x402 payment
│   │   └── product/[batchId]/ # Consumer product journey page
│   └── public/                # Static assets & ABI
├── server/                    # Fastify backend
│   ├── index.ts               # App entry point
│   ├── routes/                # REST API endpoints
│   ├── services/              # Business logic & contract orchestration
│   ├── blockchain/            # Algorand client & indexer adapters
│   ├── config/                # Algorand config & ABI
│   └── types/                 # TypeScript type definitions
├── smart_contracts/           # TealScript smart contracts
│   └── contractSupply/algokit/
│       ├── contracts/         # TealScript source & compiled TEAL
│       ├── __test__/          # Jest contract tests
│       └── scripts/           # Deploy scripts (localnet & testnet)
├── docs/                      # API & deployment documentation
│   ├── API.md                 # Full API reference
│   └── DEPLOYMENT.md          # Deployment guide
└── diagrams/                  # Architecture diagrams (PNG)
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ and npm
- **Docker** (running, for AlgoKit LocalNet)
- **AlgoKit CLI** — [Install guide](https://dev.algorand.co/getting-started/algokit-quick-start)

### 1. Clone & Install

```bash
git clone <repo-url>
cd GreenSetu

# Install backend dependencies
cd server && npm install && cd ..

# Install frontend dependencies
cd frontend && npm install && cd ..

# Install contract dependencies
cd smart_contracts/contractSupply/algokit && npm install && cd ../../..
```

### 2. Start Algorand LocalNet

```bash
algokit localnet start
```

### 3. Deploy Smart Contract

```bash
cd smart_contracts/contractSupply/algokit
npm run build
npx ts-node scripts/deploy-localnet.ts
# Note the App ID from the output
```

### 4. Configure Environment Variables

**Backend** — copy and edit `server/.env.example` → `server/.env`:
```env
ALGORAND_NETWORK=localnet
ALGORAND_NODE_URL=http://localhost:4001
ALGORAND_INDEXER_URL=http://localhost:8980
CONTRACT_APP_ID=<app-id-from-step-3>
CONTRACT_CREATOR_MNEMONIC=<localnet-account-mnemonic>
DEFAULT_SENDER_MNEMONIC=<localnet-account-mnemonic>
PORT=4000
HOST=0.0.0.0
```

**Frontend** — copy and edit `frontend/.env.example` → `frontend/.env.local`:
```env
VITE_ALGOD_SERVER=http://localhost:4001
VITE_ALGOD_NETWORK=localnet
```

### 5. Run the Application

```bash
# Terminal 1 — Backend
cd server && npm run dev
# → http://localhost:4000

# Terminal 2 — Frontend
cd frontend && npm run dev
# → http://localhost:3000
```

---

## API Reference

See [docs/API.md](docs/API.md) for the complete API documentation. Key endpoints:

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/batch` | Create a new product batch (mints ASA) |
| `POST` | `/checkpoint` | Log a supply chain checkpoint |
| `POST` | `/handoff/initiate` | Initiate a product handoff |
| `POST` | `/handoff/confirm` | Confirm receipt of a handoff |
| `POST` | `/verify` | Run x402-paid AI verification |
| `GET`  | `/verify` | Get x402 payment requirements (HTTP 402) |
| `GET`  | `/status/:batchAsaId` | Get verification status for a batch |
| `GET`  | `/journey/:batchAsaId` | Full product journey (batch + checkpoints + handoffs + verification) |
| `GET`  | `/carbon/:batchAsaId` | Carbon score for a batch |

---

## x402 Verification Flow

```
Consumer / Agent                    GreenSetu Server               Algorand
       │                                   │                            │
       │──── GET /verify ─────────────────▶│                            │
       │◀─── 402 Payment Required ─────────│                            │
       │     (price, facilitator, token)   │                            │
       │                                   │                            │
       │──── POST /verify ────────────────▶│                            │
       │     X-PAYMENT: <x402 payload>     │                            │
       │     { batchAsaId: "42" }          │                            │
       │                                   │── verify x402 payment ───▶│
       │                                   │◀─ payment confirmed ──────│
       │                                   │                            │
       │                                   │── fetch checkpoints ─────▶│
       │                                   │◀─ checkpoint data ────────│
       │                                   │                            │
       │                                   │── AI anomaly detection     │
       │                                   │   (speed, temp, cert,      │
       │                                   │    route, photo, handoff)  │
       │                                   │                            │
       │                                   │── store result on-chain ─▶│
       │◀─── { result: "VERIFIED",  ───────│                            │
       │       confidence: 95,             │                            │
       │       checks: [...] }             │                            │
```

---

## Smart Contract

The `ContractSupply` smart contract is written in **TealScript** and compiled to TEAL via AlgoKit.

**Key methods:**
- `createBatch(crop, weight, lat, lng, certId)` — Mints a batch ASA and stores metadata in box storage
- `logCheckpoint(batchId, checkpointIdx, handler, lat, lng, temp, humidity)` — Immutable checkpoint record
- `initiateHandoff(batchId, fromAddr, toAddr)` — Start a two-party handoff
- `confirmHandoff(batchId, confirmerAddr)` — Second party confirms receipt
- `storeVerification(batchId, result, confidence, reason)` — Write AI verification result on-chain
- `fundEscrow(batchId, amount)` — Lock funds for farmer payment
- `releaseFarmerPayment(batchId, farmerAddr)` — Atomic payment on delivery
- `calculateCarbonScore(batchId)` — Compute and store carbon footprint

**Storage:** Algorand Box Storage (one box per checkpoint/verification/handoff per batch)

### Running Contract Tests

```bash
cd smart_contracts/contractSupply/algokit
npm test
```

---

## Screenshots & Diagrams

Architecture diagrams are available in the `diagrams/` directory:
- `system_architecture.png` — High-level system architecture
- `sequence_diagram.png` — Verification sequence flow
- `service_diagram.png` — Service layer interactions
- `smartcontract_state_Data_flow_diags.png` — Smart contract data flow

---

## Environment Variables

### Backend (`server/.env`)

| Variable | Description | Example |
|----------|-------------|---------|
| `ALGORAND_NETWORK` | Network target | `localnet` / `testnet` |
| `ALGORAND_NODE_URL` | Algod node URL | `http://localhost:4001` |
| `ALGORAND_INDEXER_URL` | Indexer URL | `http://localhost:8980` |
| `CONTRACT_APP_ID` | Deployed contract app ID | `755778476` |
| `CONTRACT_CREATOR_MNEMONIC` | Creator wallet mnemonic | *(secret)* |
| `DEFAULT_SENDER_MNEMONIC` | Default transaction signer | *(secret)* |
| `PORT` | Server port | `4000` |

### Frontend (`frontend/.env.local`)

| Variable | Description | Example |
|----------|-------------|---------|
| `VITE_ALGOD_SERVER` | Algod URL | `http://localhost:4001` |
| `VITE_ALGOD_NETWORK` | Network | `localnet` |
| `VITE_INDEXER_SERVER` | Indexer URL | `http://localhost:8980` |

---

## Deployment

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md) for detailed deployment instructions covering:
- LocalNet deployment (development)
- TestNet deployment (production/demo)
- Environment configuration

---

## Built For

**Algorand Hackathon 2026** — x402 Agentic Commerce Track

### Judging Criteria Alignment

| Criteria | How GreenSetu Addresses It |
|----------|------------------------------|
| **x402 Protocol Usage** | Core feature — AI agent pays for verification via x402 micropayments |
| **Algorand Integration** | ASA minting, box storage, atomic transfers, indexer queries |
| **Innovation** | First autonomous supply chain verification agent using x402 |
| **Real-World Impact** | Tackles $40B food fraud, instant farmer payments, verifiable carbon credits |
| **Technical Completeness** | Full-stack: smart contract + backend + frontend + x402 payment flow |

---

## License

MIT
