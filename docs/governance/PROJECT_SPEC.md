# GreenSetu — Complete Project Specification

## Tagline
> "The first x402-powered autonomous verification agent on Algorand — proving trust in every supply chain, one micropayment at a time."

## One-Liner Pitch
An AI agent that autonomously pays for, verifies, and certifies the integrity of real-world supply chain data on Algorand using the x402 protocol — with tokenized carbon rewards for sustainable farmers.

---

## Table of Contents
1. [Problem Statement](#1-problem-statement)
2. [Solution Overview](#2-solution-overview)
3. [Key Innovation](#3-key-innovation---what-makes-this-different)
4. [Features List](#4-features-list)
5. [Tech Stack](#5-tech-stack)
6. [Architecture Diagram](#6-architecture-diagram)
7. [Smart Contracts](#7-smart-contracts)
8. [App Flow (User Journeys)](#8-app-flow-user-journeys)
9. [Data Model](#9-data-model)
10. [Frontend Pages](#10-frontend-pages)
11. [x402 Verification Agent — How It Works](#11-x402-verification-agent--how-it-works)
12. [Demo Script for Judges](#12-demo-script-for-judges)
13. [Judging Criteria Mapping](#13-judging-criteria-mapping)
14. [Build Schedule (5 Days)](#14-build-schedule-5-days)
15. [Future Roadmap (Post-Hackathon)](#15-future-roadmap-post-hackathon)
16. [References & Resources](#16-references--resources)

---

## 1. Problem Statement

### The Problems (Real, Measurable, Global)

**Problem 1: Food Fraud is a $40B/year Global Crisis**
- 1 in 10 food products sold worldwide is adulterated or mislabeled (WHO)
- Fake "organic" labels, false origin claims, mislabeled ingredients
- Consumers have zero way to verify what's on the label
- Traditional audits are manual, periodic, and easily gamed

**Problem 2: Farmers Get Paid Late and Unfairly**
- Farmers earn only 8-10% of the retail price
- Payment delays of 60-90 days through middlemen
- Small-scale farmers in developing nations are hit hardest
- No transparency on where consumer money goes

**Problem 3: Carbon/ESG Greenwashing**
- Companies claim sustainability without proof
- Carbon offset markets are riddled with double-counting
- No automated, verifiable link between farming practices and carbon credits
- EU CSRD and SEC climate disclosure rules demand verifiable data

**Problem 4: No Autonomous Verification Infrastructure**
- Current supply chain solutions require human auditors
- Verification is expensive, slow, and not scalable
- No system exists where AI agents can autonomously pay for and perform verification on-chain

---

## 2. Solution Overview

GreenSetu is a platform where:

1. **Every product batch** gets a unique digital identity (ASA token) on Algorand at harvest
2. **Every handler** (farmer, transporter, warehouse, retailer) logs checkpoints on-chain with verifiable data
3. **An AI verification agent** autonomously analyzes all checkpoint data for fraud/anomalies — paying for each verification via x402 micropayments
4. **Farmers get paid instantly** in stablecoins the moment their product reaches the retailer — via atomic transfers
5. **Consumers scan a QR code** and see the full verified journey, AI trust score, and carbon footprint
6. **Sustainable farmers earn** tokenized carbon credits and build an on-chain reputation (dynamic NFT)

---

## 3. Key Innovation — What Makes This Different

### This is NOT just a supply chain tracker.

Existing supply chain projects (even past Algorand hackathon entries) simply log data on-chain. GreenSetu's innovation is the **x402-powered autonomous verification agent**.

| What Others Build | What GreenSetu Does |
|---|---|
| Log supply chain data on blockchain | Log data + **AI agent autonomously verifies it** |
| Manual verification / human auditors | **Autonomous AI verification via x402 micropayments** |
| Static trust (you trust the data logger) | **Dynamic trust (AI independently validates data integrity)** |
| Payments through traditional channels | **Instant atomic payments in USDCa on final delivery** |
| No carbon integration | **Auto-generated tokenized carbon credits for sustainable farmers** |
| Static NFTs or no identity | **Dynamic Reputation NFT that evolves with verification history** |

### Why x402 Is the Key Differentiator
- x402 is Algorand's newest protocol (announced February 12, 2026 — just days old)
- It enables AI agents to make autonomous micropayments over HTTP
- No other hackathon project will be using this
- It aligns with Algorand Foundation's current strategic push into agentic commerce

---

## 4. Features List

### CORE FEATURES (Must Have)

#### F1: Product Batch Minting
- Farmer creates an Algorand Standard Asset (ASA) for each product batch
- Metadata: crop type, weight, farm GPS coordinates, harvest date, organic certification ID
- Generates a unique QR code linked to the ASA ID
- Stored: ASA on-chain, metadata in note field

#### F2: Supply Chain Checkpoint Logging
- Each handler (transporter, warehouse, retailer) logs a checkpoint
- Data per checkpoint: GPS coordinates, timestamp, temperature, humidity, handler wallet address, notes
- Stored in smart contract box storage (one box per checkpoint)
- Immutable, timestamped, linked to the ASA ID

#### F3: x402 AI Verification Agent
- A verification HTTP API protected by an x402 paywall
- When called, the agent:
  1. Receives an x402 micropayment (0.001 ALGO)
  2. Fetches all checkpoints for the given ASA from on-chain
  3. Runs anomaly detection checks:
     - **Speed Check**: Did the product travel faster than physically possible between checkpoints?
     - **Temperature Check**: Did temperature exceed allowed range for this product type?
     - **Certification Check**: Is the organic certification ID valid and consistent?
     - **Route Check**: Does the route make geographical sense?
  4. Returns: `VERIFIED ✓` or `FLAGGED ✗` with specific reason
  5. Writes the verification result on-chain (transaction note or box)

#### F4: Instant Farmer Payment
- When retailer logs the final checkpoint, smart contract triggers an atomic transfer
- The buyer/retailer pre-funds the escrow when placing the purchase order
- Funds are locked in the smart contract until delivery is confirmed
- Payment in tUSDCa (test stablecoin) from escrow to farmer's wallet
- Atomic group transaction ensures: checkpoint log + payment happen together or not at all
- Farmer receives instant payment — no intermediaries, no delays

#### F5: Consumer QR Scan Page
- Mobile-responsive web page with QR code scanner
- Scans product QR → fetches ASA ID → queries Algorand indexer
- Displays:
  - Visual journey timeline (farm → transport → warehouse → retail)
  - Each checkpoint with location, time, temperature, and photo
  - Handoff confirmations (✓✓ both confirmed or ⚠️ one-sided)
  - AI verification badge (green ✓ or red ✗ with reason)
  - Carbon score (based on distance and transport method)
  - Farmer profile and what % of price went to farmer
  - Reputation badge (Bronze/Silver/Gold)

### DIFFERENTIATOR FEATURES (Should Have)

#### F6: Tokenized Carbon Credits
- After successful verification, system calculates carbon score based on:
  - Total distance traveled (shorter = better)
  - Transport method (truck vs ship vs air)
  - Farm's sustainable practices flag
- If score passes threshold → farmer earns carbon credit ASA tokens
- Carbon credits are fungible ASA tokens, tradeable on-chain
- Visual display on consumer scan page

#### F7: Farmer Reputation NFT
- Each farmer gets a unique NFT (ASA) when they first create a batch
- NFT metadata includes: total batches, verified count, flagged count, reputation tier
- Tiers update dynamically:
  - 🥉 Bronze: 0-10 verified batches
  - 🥈 Silver: 11-50 verified batches
  - 🥇 Gold: 51+ verified batches
- Visual badge displayed on consumer scan page
- On-chain proof of farmer's track record

### TRUST & ANTI-FRAUD FEATURES (Must Have)

#### F8: Photo Hash at Checkpoint
- At every checkpoint, the handler takes a photo of the product/crate
- The photo is hashed (SHA-256) client-side in the browser before upload
- The **hash** (not the image) is stored on-chain in the checkpoint box data
- The original photo is stored off-chain (e.g., IPFS or cloud storage) with reference
- Anyone can later verify photo integrity: re-hash the stored photo and compare with on-chain hash
- If photo is tampered with after submission, the hash won't match → **fraud detected**
- Adds visual proof at each stage — harder to fake than typed numbers
- AI verification agent can flag checkpoints with **missing photos** as suspicious

#### F9: Multi-Party Handoff Confirmation
- Every transfer between handlers requires **both parties** to confirm the handoff
- When goods move from Handler A → Handler B:
  1. Handler A logs a **"handed off to"** record with Handler B's wallet address
  2. Handler B logs a **"received from"** record with Handler A's wallet address
  3. Smart contract checks that **both records exist and match** (same batch, same time window, correct counterparties)
- If only one party confirms → handoff stays in **"pending"** status and is flagged
- If neither confirms within a configurable time window (e.g., 6 hours) → auto-flagged as suspicious
- Prevents a single actor from fabricating the entire chain of custody
- Displayed on consumer scan page: each handoff shows ✓✓ (both confirmed) or ⚠️ (single-sided)
- The AI verification agent includes **handoff consistency** as an additional check

---

## 5. Tech Stack

### Smart Contracts
| Component | Technology |
|---|---|
| Language | **TypeScript (TEALScript)** |
| Framework | **AlgoKit 2.x** |
| Testing | **AlgoKit Testing Utils + Jest** |
| Network | **Algorand TestNet** |
| Asset Standard | **ASA (Algorand Standard Assets)** |
| Storage | **Box Storage** for checkpoint data |
| Transactions | **Atomic Transfers** for payment + checkpoint bundling |

### x402 Verification Server
| Component | Technology |
|---|---|
| Runtime | **Node.js** |
| Framework | **Express.js** |
| x402 Protocol | **GoPlausible x402 SDK / Custom implementation** |
| AI/Verification | **Mock rule-based engine** (swappable with OpenAI/Claude API) |
| Algorand SDK | **algosdk (JavaScript)** |

### Frontend
| Component | Technology |
|---|---|
| Framework | **Next.js 14 (App Router)** |
| Styling | **Tailwind CSS** |
| Wallet | **Pera Wallet Connect (@perawallet/connect)** |
| QR Scanner | **html5-qrcode** |
| Maps/Visualization | **Leaflet.js** (journey map) |
| Charts | **Recharts** (carbon score visualization) |
| Algorand Queries | **algosdk + Algorand Indexer API (via Nodely)** |
| State Management | **React Context / Zustand** |

### Infrastructure
| Component | Technology |
|---|---|
| Node Provider | **Nodely** (free Algorand API access) |
| Indexer | **Nodely Indexer** or **Allo.info API** |
| Deployment | **Vercel** (frontend) |
| QR Code Generation | **qrcode.js** |

---

## 6. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        GREENSETU                          │
│                                                             │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌────────────┐  │
│  │  FARMER  │  │TRANSPORTER│ │ RETAILER │  │  CONSUMER  │  │
│  │  (Pera)  │  │  (Pera)  │  │  (Pera)  │  │ (QR Scan)  │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └─────┬──────┘  │
│       │              │             │              │          │
└───────┼──────────────┼─────────────┼──────────────┼──────────┘
        │              │             │              │
        ▼              ▼             ▼              │
┌─────────────────────────────────────────────┐     │
│         ALGORAND TESTNET                     │     │
│                                              │     │
│  ┌─────────────────────────────────────────┐ │     │
│  │     GreenSetuApp (Smart Contract)     │ │     │
│  │                                         │ │     │
│  │  Methods:                               │ │     │
│  │  ├─ createBatch() → mints ASA          │ │     │
│  │  ├─ logCheckpoint() → writes to boxes  │ │     │
│  │  ├─ storeVerification() → AI result    │ │     │
│  │  ├─ releaseFarmerPayment() → atomic tx │ │     │
│  │  ├─ mintCarbonCredit() → carbon ASA    │ │     │
│  │  └─ updateReputation() → NFT metadata  │ │     │
│  │                                         │ │     │
│  │  Storage (Boxes):                       │ │     │
│  │  ├─ batch_{id}_checkpoint_{n}           │ │     │
│  │  ├─ batch_{id}_verification             │ │     │
│  │  ├─ farmer_{addr}_reputation            │ │     │
│  │  └─ batch_{id}_carbon_score             │ │     │
│  └─────────────────────────────────────────┘ │     │
│                                              │     │
│  ASAs:                                       │     │
│  ├─ ProductBatch (per batch, unique)         │     │
│  ├─ tUSDCa (test stablecoin)                │     │
│  ├─ CarbonCredit (fungible)                  │     │
│  └─ ReputationNFT (per farmer, dynamic)      │     │
│                                              │     │
└──────────────────────┬───────────────────────┘     │
                       │                             │
                       ▼                             │
┌──────────────────────────────────────────────┐     │
│      x402 VERIFICATION SERVER (Node.js)       │     │
│                                               │     │
│  ┌─────────────────────────────────────────┐  │     │
│  │         x402 Payment Gateway            │  │     │
│  │  1. Receive HTTP request                │  │     │
│  │  2. Return 402 Payment Required         │  │     │
│  │  3. Client pays 0.001 ALGO              │  │     │
│  │  4. Verify payment on-chain             │  │     │
│  │  5. Execute verification                │  │     │
│  │  6. Return result                       │  │     │
│  └─────────────────┬───────────────────────┘  │     │
│                    │                          │     │
│  ┌─────────────────▼───────────────────────┐  │     │
│  │       AI VERIFICATION ENGINE            │  │     │
│  │                                         │  │     │
│  │  Rules:                                 │  │     │
│  │  ├─ Speed anomaly (>120 km/h ground)    │  │     │
│  │  ├─ Temp breach (>8°C for cold chain)   │  │     │
│  │  ├─ Route inconsistency (detour check)  │  │     │
│  │  ├─ Time gap (>48h between checkpoints) │  │     │
│  │  └─ Certification mismatch             │  │     │
│  │                                         │  │     │
│  │  Output: VERIFIED ✓ / FLAGGED ✗        │  │     │
│  │          + confidence score + reason     │  │     │
│  └─────────────────────────────────────────┘  │     │
└──────────────────────────────────────────────┘     │
                                                     │
                       ┌─────────────────────────────┘
                       ▼
┌──────────────────────────────────────────────┐
│       NEXT.JS FRONTEND (Vercel)              │
│                                              │
│  Pages:                                      │
│  ├─ /              → Landing page            │
│  ├─ /farmer        → Farmer dashboard        │
│  ├─ /checkpoint    → Log checkpoint form      │
│  ├─ /verify        → Trigger AI verification  │
│  ├─ /scan          → QR code scanner          │
│  └─ /product/[id]  → Product journey page     │
│                                              │
│  Components:                                 │
│  ├─ WalletConnect (Pera)                     │
│  ├─ JourneyTimeline                          │
│  ├─ JourneyMap (Leaflet)                     │
│  ├─ VerificationBadge                        │
│  ├─ CarbonScoreCard                          │
│  ├─ ReputationBadge                          │
│  └─ QRScanner                                │
└──────────────────────────────────────────────┘
```

---

## 7. Smart Contracts

### Contract: GreenSetuApp

```
Contract Name: GreenSetuApp
Language: TEALScript (TypeScript)
Type: Stateful Application

Global State:
  - admin: Address (contract deployer)
  - totalBatches: uint64
  - totalVerifications: uint64
  - carbonCreditAsaId: uint64
  - stablecoinAsaId: uint64

Methods:

  createBatch(
    cropType: string,
    weight: uint64,
    farmGps: string,
    organicCertId: string,
    farmerAddr: Address
  ) → uint64 (returns ASA ID)
    - Mints a new ASA representing the product batch
    - Stores batch metadata in box: batch_{asaId}_info
    - Increments totalBatches
    - Creates ReputationNFT for farmer if first batch

  logCheckpoint(
    batchAsaId: uint64,
    gpsLat: string,
    gpsLng: string,
    temperature: int64,
    humidity: uint64,
    handlerType: string,   // "farmer" | "transporter" | "warehouse" | "retailer"
    notes: string,
    photoHash: string      // SHA-256 hash of checkpoint photo (F8)
  ) → void
    - Validates caller holds the batch ASA or is authorized
    - Stores checkpoint in box: batch_{asaId}_cp_{index} (includes photoHash)
    - If photoHash is empty → marks checkpoint as "unverified_photo"
    - If handlerType == "retailer" → triggers releaseFarmerPayment()

  initiateHandoff(
    batchAsaId: uint64,
    fromAddr: Address,     // sender (current handler)
    toAddr: Address,       // receiver (next handler)
    handoffType: string    // "farmer_to_transporter" | "transporter_to_warehouse" | "warehouse_to_retailer"
  ) → void
    - Called by the sender to initiate a handoff
    - Stores pending handoff in box: batch_{asaId}_handoff_{index}
    - Status set to "pending_receiver"
    - Starts a time window (6 hours) for receiver to confirm

  confirmHandoff(
    batchAsaId: uint64,
    handoffIndex: uint64
  ) → void
    - Called by the receiver to confirm receipt
    - Validates caller matches the toAddr in the pending handoff
    - Updates handoff status to "confirmed"
    - If not confirmed within time window → status becomes "expired" (flagged)

  storeVerification(
    batchAsaId: uint64,
    result: string,        // "VERIFIED" | "FLAGGED"
    confidence: uint64,    // 0-100
    reason: string,
    verifierAddr: Address
  ) → void
    - Only callable by authorized verification agent
    - Stores result in box: batch_{asaId}_verification
    - Increments totalVerifications
    - If VERIFIED → calls mintCarbonCredit() and updateReputation()

  releaseFarmerPayment(
    batchAsaId: uint64,
    amount: uint64
  ) → void
    - Internal method triggered on final checkpoint
    - Atomic transfer: tUSDCa from escrow → farmer wallet
    - Logs payment in box: batch_{asaId}_payment

  mintCarbonCredit(
    farmerAddr: Address,
    amount: uint64
  ) → void
    - Transfers carbon credit ASA tokens to farmer
    - Amount based on carbon score calculation

  updateReputation(
    farmerAddr: Address,
    verified: boolean
  ) → void
    - Updates farmer reputation box: farmer_{addr}_reputation
    - Increments verified or flagged count
    - Updates tier: Bronze → Silver → Gold

  flagExpiredHandoffs(
    batchAsaId: uint64
  ) → void
    - Scans all handoffs for a batch
    - Any handoff still in "pending_receiver" past the time window → set to "expired"
    - Expired handoffs are auto-flagged for AI verification
```

### ASAs (Assets)

| ASA | Type | Purpose | Created By |
|---|---|---|---|
| ProductBatch_{id} | Unique (NFT-like) | Represents each harvested batch | createBatch() |
| tUSDCa | Fungible (decimals: 6) | Test stablecoin for payments | Deployed once at setup |
| CarbonCredit | Fungible (decimals: 2) | Carbon reward tokens | Deployed once at setup |
| ReputationNFT_{farmer} | NFT (unique per farmer) | Dynamic reputation badge | createBatch() on first batch |

---

## 8. App Flow (User Journeys)

### Journey 1: Farmer Creates a Batch

```
Step 1: Farmer opens GreenSetu web app
Step 2: Connects Pera Wallet
Step 3: Navigates to /farmer → "Create New Batch"
Step 4: Fills form:
        - Crop Type: "Organic Alphonso Mangoes"
        - Weight: 500 kg
        - Farm Location: [auto-detect GPS or manual entry]
        - Organic Certification ID: "NPOP-2026-MH-04521"
Step 5: Clicks "Mint Batch on Algorand"
Step 6: Pera Wallet popup → confirms transaction (fee: 0.001 ALGO)
Step 7: ASA created on-chain → Batch ID displayed
Step 8: QR Code auto-generated → Farmer prints it and attaches to crate
Step 9: First checkpoint auto-logged (handler: farmer, location: farm)
```

### Journey 2: Transporter Logs Checkpoint (with Handoff + Photo)

```
Step 1:  Transporter opens /checkpoint page
Step 2:  Connects Pera Wallet
Step 3:  Scans QR code on crate → ASA ID auto-filled
         (OR manually enters ASA ID)
Step 4:  System detects pending handoff from farmer → transporter
         Shows: "Farmer (0xABC...) initiated handoff. Confirm receipt?"
Step 5:  Transporter clicks "Confirm Handoff"
Step 6:  Pera confirms → handoff status updated to "confirmed" on-chain
         Handoff badge: ✓✓ Both parties confirmed
Step 7:  Fills checkpoint data:
         - Current GPS: [auto-detect]
         - Temperature: 4°C
         - Humidity: 65%
         - Handler Type: "Transporter"
         - Notes: "Loaded in refrigerated truck, departing farm"
Step 8:  📸 Takes photo of product crate (required)
         - Photo captured via camera or file upload
         - App computes SHA-256 hash client-side
         - Photo uploaded to off-chain storage (IPFS/cloud)
         - Hash displayed: "Photo hash: a3f8c2...e91b"
Step 9:  Clicks "Log Checkpoint"
Step 10: Pera confirms → checkpoint data + photo hash written to box storage on-chain
Step 11: Confirmation shown: "Checkpoint #2 logged ✓ | Photo verified ✓ | Handoff confirmed ✓✓"
```

### Journey 2b: Farmer Initiates Handoff (before transporter arrives)

```
Step 1: Farmer opens /checkpoint page
Step 2: Selects batch → clicks "Initiate Handoff"
Step 3: Enters transporter's wallet address (or scans their QR)
Step 4: Selects handoff type: "Farmer → Transporter"
Step 5: 📸 Takes photo of product being loaded onto truck
Step 6: Pera confirms → handoff record created on-chain (status: "pending_receiver")
Step 7: Timer starts: transporter has 6 hours to confirm
Step 8: If transporter doesn't confirm → handoff auto-flagged ⚠️
```

### Journey 3: AI Verification (x402)

```
Step 1: Any user (or automated trigger) navigates to /verify
Step 2: Enters Batch ASA ID
Step 3: Clicks "Request AI Verification"
Step 4: Frontend sends request to x402 verification server
Step 5: Server responds: HTTP 402 Payment Required
        Response includes: payment amount (0.001 ALGO), recipient address
Step 6: Frontend auto-constructs payment transaction
Step 7: User signs with Pera Wallet (or agent pays autonomously)
Step 8: Payment confirmed on-chain
Step 9: Server receives payment proof, executes verification:
        - Fetches all checkpoints from Algorand indexer
        - Runs anomaly checks:
          ✓ Speed between checkpoints: 85 km/h (OK, <120 km/h truck limit)
          ✓ Temperature: all readings 2-6°C (OK, cold chain maintained)
          ✓ Photos: all 4 checkpoints have photo hashes, integrity OK
          ✓ Handoffs: all 3 handoffs confirmed by both parties ✓✓
          ✗ FLAGGED: Organic cert ID "NPOP-2026-MH-04521" not found in
            certification database → "Certification Unverifiable"
        - Assigns confidence score: 65%
Step 10: Server writes verification result on-chain via smart contract
Step 11: Frontend displays result:
         "⚠️ FLAGGED — Organic certification could not be verified
          Confidence: 65% | Verified by: Agent-0x...a3f"
```

### Journey 4: Retailer + Farmer Payment

```
Step 1: Retailer opens /checkpoint
Step 2: Scans QR, fills checkpoint with handler type: "Retailer"
Step 3: Submits checkpoint
Step 4: Smart contract verifies escrow is pre-funded from purchase order
  (Buyer/retailer locked funds before shipment)
Step 5: Smart contract detects final checkpoint (retailer)
Step 6: Atomic transaction group executes:
        - Transaction 1: Log checkpoint data to box
        - Transaction 2: Transfer 500 tUSDCa from escrow → farmer wallet
Step 7: Both transactions succeed together (atomic)
Step 8: Farmer receives tUSDCa instantly
Step 9: Retailer sees: "✓ Product received. Farmer paid 500 tUSDCa."
Step 10: Farmer's dashboard updates: new payment received
```

### Journey 5: Consumer Scans Product

```
Step 1: Consumer picks up product in store, sees QR code on packaging
Step 2: Opens greensetu.app/scan on phone (no wallet needed)
Step 3: Scans QR code with camera
Step 4: Redirected to /product/[asaId]
Step 5: Page loads, fetching data from Algorand indexer:

        ┌──────────────────────────────────────────┐
        │  🥭 Organic Alphonso Mangoes — 500kg     │
        │  Batch #ASA-12345678                      │
        │                                           │
        │  JOURNEY                                  │
        │  ──────                                   │
        │  📍 Farm (Karnataka, India)               │
        │     Feb 10, 2026 08:00 — 4°C              │
        │           │                               │
        │           ▼                               │
        │  🚛 In Transit                            │
        │     Feb 10, 2026 14:00 — 5°C              │
        │           │                               │
        │           ▼                               │
        │  🏭 Warehouse (Mumbai)                    │
        │     Feb 11, 2026 09:00 — 3°C              │
        │           │                               │
        │           ▼                               │
        │  🛒 Retailer (Delhi)                      │
        │     Feb 12, 2026 11:00 — 4°C              │
        │                                           │
        │  AI VERIFICATION                          │
        │  ──────────────                           │
        │  ⚠️ FLAGGED — Organic cert unverifiable   │
        │  Confidence: 65% | Agent: 0x...a3f        │
        │                                           │
        │  CARBON SCORE                             │
        │  ────────────                             │
        │  🌱 Carbon Score: 72/100 (Good)           │
        │  Distance: 1,850 km | Transport: Truck    │
        │  Carbon Credits Earned: 3.2 CC            │
        │                                           │
        │  FARMER                                   │
        │  ──────                                   │
        │  👨‍🌾 Raj Kumar | 🥈 Silver Reputation     │
        │  42 batches verified | 1 flagged           │
        │  💰 Received: 500 tUSDCa for this batch   │
        └──────────────────────────────────────────┘
```

---

## 9. Data Model

### On-Chain Data (Algorand Boxes)

```
Box Key Format                    | Value (JSON-encoded bytes)
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_info                | {
                                  |   cropType: "Organic Alphonso Mangoes",
                                  |   weight: 500,
                                  |   farmGpsLat: "12.9716",
                                  |   farmGpsLng: "77.5946",
                                  |   organicCertId: "NPOP-2026-MH-04521",
                                  |   farmerAddr: "ALGO...",
                                  |   createdAt: 1739180400,
                                  |   totalCheckpoints: 4
                                  | }
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_cp_{0}              | {
                                  |   gpsLat: "12.9716",
                                  |   gpsLng: "77.5946",
                                  |   temperature: 4,
                                  |   humidity: 70,
                                  |   handlerType: "farmer",
                                  |   handlerAddr: "ALGO...",
                                  |   timestamp: 1739180400,
                                  |   notes: "Harvested and packed",
                                  |   photoHash: "a3f8c2...e91b",
                                  |   photoUrl: "ipfs://Qm..."
                                  | }
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_handoff_{0}         | {
                                  |   fromAddr: "ALGO_FARMER...",
                                  |   toAddr: "ALGO_TRANSPORTER...",
                                  |   handoffType: "farmer_to_transporter",
                                  |   initiatedAt: 1739180400,
                                  |   confirmedAt: 1739184000,
                                  |   status: "confirmed",
                                  |   timeWindowSecs: 21600,
                                  |   fromPhotoHash: "b4e9a1...f23c",
                                  |   toPhotoHash: "c5f0b2...d34e"
                                  | }
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_verification        | {
                                  |   result: "VERIFIED" | "FLAGGED",
                                  |   confidence: 85,
                                  |   reason: "All checks passed",
                                  |   checks: [
                                  |     { name: "speed", passed: true },
                                  |     { name: "temperature", passed: true },
                                  |     { name: "certification", passed: true },
                                  |     { name: "route", passed: true },
                                  |     { name: "photo_integrity", passed: true },
                                  |     { name: "handoff_consistency", passed: true }
                                  |   ],
                                  |   verifierAddr: "ALGO...",
                                  |   timestamp: 1739280000
                                  | }
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_payment             | {
                                  |   amount: 500000000,
                                  |   assetId: 12345 (tUSDCa),
                                  |   fromAddr: "ESCROW...",
                                  |   toAddr: "FARMER...",
                                  |   timestamp: 1739290000,
                                  |   txnId: "ABC123..."
                                  | }
──────────────────────────────────|──────────────────────────────────
batch_{asaId}_carbon              | {
                                  |   totalDistanceKm: 1850,
                                  |   transportMethod: "truck",
                                  |   carbonScore: 72,
                                  |   creditsEarned: 320,
                                  |   timestamp: 1739290000
                                  | }
──────────────────────────────────|──────────────────────────────────
farmer_{addr}_reputation          | {
                                  |   totalBatches: 42,
                                  |   verifiedCount: 41,
                                  |   flaggedCount: 1,
                                  |   tier: "silver",
                                  |   reputationNftAsaId: 67890,
                                  |   carbonCreditsTotal: 156.8
                                  | }
```

### Off-Chain Data (Frontend Only)

```
- Farm name, farmer display name (entered in form, displayed in UI)
- Product images (placeholder/static for hackathon)
- Checkpoint photos (stored in IPFS/cloud, hash on-chain for integrity verification)
- Map tiles for journey visualization (Leaflet/OpenStreetMap)
- AI verification detailed explanation text
```

---

## 10. Frontend Pages

### Page 1: Landing Page (`/`)

```
┌──────────────────────────────────────────────┐
│  GREENSETU                    [Connect Wallet]
│                                               │
│  ┌───────────────────────────────────────────┐│
│  │  "AI-Verified Trust for Every            ││
│  │   Supply Chain"                           ││
│  │                                           ││
│  │  The first x402-powered verification      ││
│  │  agent on Algorand                        ││
│  │                                           ││
│  │  [I'm a Farmer]  [I'm a Consumer]         ││
│  └───────────────────────────────────────────┘│
│                                               │
│  HOW IT WORKS                                 │
│  ─────────────                                │
│  1. 🌾 Farmer mints batch on-chain            │
│  2. 🚛 Handlers log checkpoints               │
│  3. 🤖 AI agent verifies (pays via x402)      │
│  4. 💰 Farmer gets paid instantly              │
│  5. 📱 Consumer scans & sees everything        │
│                                               │
│  POWERED BY                                   │
│  Algorand · x402 · ASAs · Atomic Transfers    │
└──────────────────────────────────────────────┘
```

### Page 2: Farmer Dashboard (`/farmer`)
- Connect Pera Wallet
- "Create New Batch" button → opens form
- List of all batches by this farmer
- Payment history
- Reputation score + tier badge
- Carbon credits balance

### Page 3: Log Checkpoint (`/checkpoint`)
- Connect Pera Wallet
- QR scanner or manual ASA ID entry
- **Handoff section** (top of page):
  - Shows any pending handoffs waiting for confirmation
  - "Confirm Handoff" button to accept incoming goods
  - "Initiate Handoff" button to hand off goods to next handler
  - Enter next handler's wallet address (or scan their QR)
  - Handoff status indicator: ⏳ Pending | ✓✓ Confirmed | ⚠️ Expired
- Checkpoint form (GPS, temp, humidity, handler type, notes)
- **Photo capture section**:
  - Camera button to take photo of product/crate (required)
  - Photo preview with computed SHA-256 hash displayed
  - Hash stored on-chain, photo uploaded to IPFS/cloud
- Submit button → Pera confirmation
- Success/error feedback with handoff + photo status

### Page 4: AI Verification (`/verify`)
- Enter Batch ASA ID
- "Request Verification" button
- Shows x402 payment flow (402 → payment → result)
- Displays result: VERIFIED ✓ / FLAGGED ✗
- Shows individual check results
- Links to on-chain transaction

### Page 5: QR Scanner (`/scan`)
- Camera-based QR code scanner
- Scans → redirects to /product/[asaId]
- No wallet needed (read-only)

### Page 6: Product Journey (`/product/[asaId]`)
- Visual timeline of all checkpoints
- Interactive map showing the journey route
- AI verification badge
- Carbon score card
- Farmer profile with reputation badge
- Payment status
- Link to Algorand explorer for on-chain proof

---

## 11. x402 Verification Agent — How It Works

### The x402 Protocol Flow

```
Client (Browser)                    x402 Server                    Algorand
      │                                  │                             │
      │  1. GET /verify?batch=12345      │                             │
      │ ─────────────────────────────►   │                             │
      │                                  │                             │
      │  2. HTTP 402 Payment Required    │                             │
      │     {                            │                             │
      │       amount: 1000,              │                             │
      │       asset: 0 (ALGO),           │                             │
      │       receiver: "SERVER_ADDR",   │                             │
      │       network: "testnet"         │                             │
      │     }                            │                             │
      │ ◄─────────────────────────────   │                             │
      │                                  │                             │
      │  3. Sign & send payment          │                             │
      │ ──────────────────────────────────────────────────────────►    │
      │                                  │                             │
      │  4. Payment confirmed (txnId)    │                             │
      │ ◄──────────────────────────────────────────────────────────    │
      │                                  │                             │
      │  5. POST /verify                 │                             │
      │     { batch: 12345,              │                             │
      │       paymentTxnId: "ABC..." }   │                             │
      │ ─────────────────────────────►   │                             │
      │                                  │  6. Verify payment on-chain │
      │                                  │ ────────────────────────►   │
      │                                  │ ◄────────────────────────   │
      │                                  │                             │
      │                                  │  7. Fetch checkpoints       │
      │                                  │ ────────────────────────►   │
      │                                  │ ◄────────────────────────   │
      │                                  │                             │
      │                                  │  8. Run AI verification     │
      │                                  │  ┌─────────────────────┐    │
      │                                  │  │ Speed: ✓ OK         │    │
      │                                  │  │ Temp: ✓ OK          │    │
      │                                  │  │ Cert: ✗ FAILED      │    │
      │                                  │  │ Route: ✓ OK         │    │
      │                                  │  │ Result: FLAGGED 65% │    │
      │                                  │  └─────────────────────┘    │
      │                                  │                             │
      │                                  │  9. Write result on-chain   │
      │                                  │ ────────────────────────►   │
      │                                  │ ◄────────────────────────   │
      │                                  │                             │
      │  10. Return verification result  │                             │
      │ ◄─────────────────────────────   │                             │
      │                                  │                             │
```

### AI Verification Checks (Mock Engine)

```typescript
interface VerificationResult {
  result: "VERIFIED" | "FLAGGED";
  confidence: number;  // 0-100
  reason: string;
  checks: {
    name: string;
    passed: boolean;
    detail: string;
  }[];
}

// Check 1: Speed Anomaly
// Calculate speed between consecutive checkpoints using GPS + timestamps
// FLAG if speed > 120 km/h (unrealistic for ground transport)
// FLAG if speed > 900 km/h (unrealistic for any transport)

// Check 2: Temperature Breach
// For cold-chain products (dairy, meat, produce):
// FLAG if any checkpoint shows temperature > 8°C
// FLAG if temperature difference between consecutive checkpoints > 15°C

// Check 3: Time Gaps
// FLAG if gap between consecutive checkpoints > 48 hours
// (suggests product was sitting somewhere untracked)

// Check 4: Route Consistency
// FLAG if product went backwards geographically
// FLAG if total distance > 3x straight-line distance (suspicious detour)

// Check 5: Certification Validation
// Check organic cert ID against known format patterns
// FLAG if format doesn't match expected pattern (e.g., NPOP-YYYY-XX-NNNNN)

// Check 6: Photo Integrity (F8)
// FLAG if any checkpoint is missing a photo hash (photoHash is empty)
// If off-chain photo is accessible, re-hash it and compare with on-chain hash
// FLAG if hashes don't match (photo was tampered with after submission)
// Multiple missing photos across checkpoints → higher severity flag

// Check 7: Handoff Consistency (F9)
// For each handoff, verify both parties confirmed (status == "confirmed")
// FLAG if any handoff is "pending_receiver" or "expired" (one-sided handoff)
// FLAG if handoff fromAddr doesn't match previous checkpoint's handlerAddr
// FLAG if handoff toAddr doesn't match next checkpoint's handlerAddr
// FLAG if time between initiation and confirmation is suspiciously instant (<1 min)
//   → suggests same person controlling both wallets
// Multiple failed handoffs → significantly lower confidence score
```

---

## 12. Demo Script for Judges

### Duration: 5 minutes

**[0:00 - 0:30] Hook**
> "Every year, $40 billion worth of food is sold with fake labels. The organic mangoes you bought? They might not be organic. The 'local' honey? It could be from another continent. And right now, there's no way for you to verify any of it. Until GreenSetu."

**[0:30 - 1:15] Farmer Creates a Batch (Live)**
- Open app, connect Pera Wallet as farmer
- Fill in: "Organic Alphonso Mangoes, 500kg, Karnataka, India"
- Mint batch → show ASA created on-chain
- Show QR code generated

**[1:15 - 2:00] Supply Chain Logging (Live)**
- Switch to transporter wallet → log checkpoint (different GPS, 5°C)
- Switch to warehouse wallet → log checkpoint (Mumbai, 3°C)
- Switch to retailer wallet → log final checkpoint (Delhi, 4°C)
- Show: farmer instantly received tUSDCa payment (atomic transfer)
- "The farmer gets paid the moment the product is delivered. No middlemen. No delays."

**[2:00 - 3:15] AI Verification via x402 (Live — THE WOW MOMENT)**
- Navigate to /verify
- Enter batch ID → click "Verify"
- Show the HTTP 402 response in real-time
- Sign the micropayment (0.001 ALGO)
- AI agent runs → results appear:
  - ✓ Speed OK
  - ✓ Temperature OK
  - ✗ FLAGGED: Organic cert format invalid
  - Overall: FLAGGED, 65% confidence
- "An AI agent just autonomously paid for verification, analyzed 4 checkpoints, caught a certification fraud, and wrote the result on-chain — all in 3 seconds."
- Show the verification transaction on Algorand explorer

**[3:15 - 4:15] Consumer Experience (Live)**
- Open /scan on phone (or browser)
- Scan the QR code
- Show the full product journey page:
  - Journey timeline with map
  - Red warning badge (FLAGGED)
  - Carbon score: 72/100
  - Farmer profile with Silver reputation badge
  - Payment info showing farmer received 500 tUSDCa
- "This is what transparency looks like. Every consumer can see this. No app download needed. Just scan."

**[4:15 - 5:00] Vision**
> "GreenSetu isn't just for food. The x402 verification agent works on ANY on-chain data pipeline — pharmaceuticals, luxury goods, carbon credits, construction materials. We built an autonomous trust layer for the real world, powered by Algorand."
>
> "We used: ASAs for product identity, box storage for checkpoint data, atomic transfers for instant payments, x402 for AI agent micropayments, and dynamic NFTs for farmer reputation. This is the future of verified commerce."

---

## 13. Judging Criteria Mapping

| Typical Criteria | How GreenSetu Scores |
|---|---|
| **Innovation / Creativity** | First project to use x402 (3 days old) for autonomous AI verification. Combines 3 trends no one else is merging: x402 + supply chain + carbon credits. |
| **Technical Complexity** | Smart contracts with box storage, atomic transfers, x402 protocol implementation, AI verification engine, Pera Wallet integration, QR scanning, map visualization — deep full-stack build. |
| **Use of Algorand** | ASAs (product batches, stablecoins, carbon credits, NFTs), box storage, atomic group transactions, x402 protocol, Algorand indexer, Pera Wallet — uses almost every Algorand primitive. |
| **Real-World Impact** | Solves $40B food fraud. Instant farmer payments. Verifiable carbon credits. Aligns with EU CSRD regulations. Applicable to pharma, luxury goods, any supply chain. |
| **Completeness / Polish** | Working end-to-end demo: mint → track → verify → pay → scan. Visual journey map. QR scanning. Professional UI. Backup demo video. |
| **Presentation** | Strong narrative hook ($40B fraud), live demo with real transactions, visual QR scan moment, clear architecture explanation. |
| **Scalability** | x402 agent is modular — can verify any on-chain data, not just food. Carbon credit system uses existing Algorand ASA infrastructure. |

---

## 14. Build Schedule (5 Days)

### Day 1: Setup + Smart Contracts
| Time | Task |
|---|---|
| 2 hours | Install AlgoKit, scaffold project, configure TestNet |
| 3 hours | Write GreenSetuApp smart contract (TEALScript): createBatch(), logCheckpoint() |
| 2 hours | Implement box storage for checkpoints |
| 1 hour | Deploy tUSDCa test stablecoin ASA |
| 1 hour | Test batch creation + checkpoint logging via CLI/scripts |
| **Deliverable** | Smart contract on TestNet, can create batches and log checkpoints |

### Day 2: x402 + Verification + Payments
| Time | Task |
|---|---|
| 3 hours | Build x402 verification server (Express.js): 402 response, payment verification |
| 2 hours | Build mock AI verification engine (rule-based checks) |
| 2 hours | Implement storeVerification() in smart contract + on-chain result writing |
| 2 hours | Implement releaseFarmerPayment() with atomic transfers |
| **Deliverable** | Full backend works: create → log → verify → pay, all on TestNet |

### Day 3: Carbon + Reputation + Frontend Start
| Time | Task |
|---|---|
| 1.5 hours | Implement mintCarbonCredit() logic in smart contract |
| 1.5 hours | Implement updateReputation() + ReputationNFT in smart contract |
| 1 hour | Test carbon + reputation flow end-to-end via scripts |
| 4 hours | Scaffold Next.js app, landing page, Pera Wallet connect, farmer dashboard |
| **Deliverable** | All smart contract features complete. Frontend skeleton with wallet connection |

### Day 4: Frontend Complete
| Time | Task |
|---|---|
| 2 hours | Checkpoint logging page (form + QR scanner + Algorand submit) |
| 2 hours | Verification page (x402 flow + result display) |
| 2 hours | Product journey page (timeline + Leaflet map + badges) |
| 2 hours | QR scanner page + farmer dashboard polish |
| 1 hour | Mobile responsiveness + Tailwind styling |
| **Deliverable** | Full working frontend connected to smart contracts on TestNet |

### Day 5: Polish + Demo
| Time | Task |
|---|---|
| 2 hours | End-to-end testing, fix bugs |
| 1 hour | Create demo seed data (pre-populated batches with journeys) |
| 1 hour | Record backup demo video |
| 1 hour | Write README with architecture diagram |
| 1 hour | Practice pitch (5 min demo script) |
| 1 hour | Final submission prep (screenshots, links, descriptions) |
| **Deliverable** | Submission-ready: live app, demo video, README, pitch prepared |

---

## 15. Future Roadmap (Post-Hackathon)

*Show this slide during your pitch to demonstrate long-term vision.*

**Phase 1 (Post-hackathon → 3 months)**
- Replace mock AI with real AI model (GPT-4/Claude API)
- Integrate real USDC (stablecoin) payments
- Partner with 10 organic farms for pilot
- Deploy to Algorand MainNet

**Phase 2 (3-6 months)**
- Real IoT sensor integration (temperature loggers with auto-checkpoint)
- Integration with ClimateTrade carbon market
- Expand to pharmaceutical supply chains
- Algorand Accelerator application ($50K funding)

**Phase 3 (6-12 months)**
- B2B API: any platform can use GreenSetu's x402 verification agent
- Integrate with EU CSRD compliance reporting
- Cross-chain verification via Algorand State Proofs
- Seed funding round ($500K-$1M)

---

## 16. References & Resources

### Algorand Documentation
- AlgoKit: https://algorand.co/algokit
- Developer Portal: https://dev.algorand.co/
- TEALScript: https://tealscript.netlify.app/
- ASAs: https://developer.algorand.org/docs/get-details/asa/
- Box Storage: https://developer.algorand.org/docs/get-details/dapps/smart-contracts/apps/state/#box-storage
- Atomic Transfers: https://developer.algorand.org/docs/get-details/atomic_transfers/

### x402 Protocol
- x402 Blog Post: https://algorand.co/blog/x402-unlocking-the-agentic-commerce-era
- x402 Ecosystem: https://algorand.co/agentic-commerce/x402
- GoPlausible x402: https://x402.goplausible.xyz/
- x402 Dev Resources: https://algorand.co/agentic-commerce/x402/developers

### Wallet Integration
- Pera Wallet Connect: https://github.com/perawallet/connect
- Pera Wallet SDK Docs: https://docs.perawallet.app/

### AI & Tools
- VibeKit (dev tooling): https://www.getvibekit.ai/
- Agent Skills: https://github.com/algorand-devrel/algorand-agent-skills
- Nodely (free node access): https://nodely.io/

### Algorand Programs
- Startup Challenges: https://algorand.co/startup-challenges
- Accelerator: https://algorand.co/2025-accelerator-application
- Hackathons: https://algorand.co/hackathon-upcoming

### Relevant Existing Projects (for research)
- Wholechain (supply chain): https://wholechain.com/
- ClimateTrade (carbon): https://climatetrade.com/
- Origino (traceability): https://origino.io/
- Labtrace (data auth): https://labtrace.io/
