# GreenSetu Server API Documentation

## Base URL

```
http://localhost:4000
```

## Overview

GreenSetu provides a RESTful API for supply chain verification. Verifications are stored on the Algorand blockchain (when contract is deployed) or in-memory for development.

---

## Endpoints

### 1. Create Verification

**Request**

```http
POST /verify
Content-Type: application/json

{
  "batchAsaId": "string (required)",
  "evidence": { ... } (optional),
  "verifierAddr": "string (optional)",
  "timestamp": number (optional)
}
```

**Parameters**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `batchAsaId` | string | Yes | Unique identifier for the batch/shipment |
| `evidence` | object | No | Verification evidence/metadata (JSON object) |
| `verifierAddr` | string | No | Algorand address of the verifier (default: `SYSTEM`) |
| `timestamp` | number | No | Unix timestamp (default: current time) |

**Response (200 OK)**

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
    "assetId": null,
    "txId": null,
    "timestamp": 1771357865
  }
}
```

**Response Fields**

| Field | Type | Description |
|-------|------|-------------|
| `verification` | object | The verification record stored on-chain |
| `verification.batchAsaId` | string | The batch ID |
| `verification.result` | string | `"VERIFIED"` or `"FLAGGED"` |
| `verification.confidence` | number | Confidence score (0-100) |
| `verification.reason` | string | Verification notes/reason |
| `verification.verifierAddr` | string | Algorand address of verifier |
| `verification.timestamp` | number | Unix timestamp of verification |
| `payment` | object | Payment details for the verification |
| `payment.amount` | number | Fee in microAlgos (µAlgo) |
| `payment.assetId` | number \| null | Asset ID if charged in specific ASA |
| `payment.txId` | string \| null | Blockchain transaction ID (if on-chain) |
| `payment.timestamp` | number | Payment timestamp |

**Error Responses**

```json
// 400 Bad Request
{
  "error": "invalid request",
  "details": "batchAsaId is required"
}

// 500 Internal Server Error
{
  "error": "Verification failed: ..."
}
```

**Fee Structure**

| Verification Result | Base Fee |
|-------------------|----------|
| VERIFIED | 2,000 µAlgo (0.002 ALGO) |
| FLAGGED | 5,000 µAlgo (0.005 ALGO) |
| Evidence (per 100 bytes) | +1 µAlgo |

---

### 2. Get Verification Status

**Request**

```http
GET /status/:batchAsaId
```

**Parameters**

| Parameter | Type | Description |
|-----------|------|-------------|
| `batchAsaId` | string (URL path) | Batch identifier |

**Response (200 OK)**

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

**Response (404 Not Found)**

```json
{
  "error": "verification not found"
}
```

---

## Examples

### Example 1: Create Verification with Evidence

```bash
curl -X POST http://localhost:4000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "batchAsaId": "batch-20260218-001",
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY",
    "evidence": {
      "quality_grade": "A",
      "temperature": 4.5,
      "humidity": 65,
      "scan_location": "NYC_WAREHOUSE_01",
      "inspector_id": "INV-2025-0042"
    }
  }'
```

### Example 2: Retrieve Verification

```bash
curl http://localhost:4000/status/batch-20260218-001
```

### Example 3: Verification with Custom Timestamp

```bash
curl -X POST http://localhost:4000/verify \
  -H "Content-Type: application/json" \
  -d '{
    "batchAsaId": "batch-legacy",
    "timestamp": 1700000000,
    "verifierAddr": "AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HVY"
  }'
```

---

## Data Types

### VerificationResult

```typescript
type VerificationResult = "VERIFIED" | "FLAGGED";
```

### VerificationRecord

```typescript
interface VerificationRecord {
  batchAsaId: string;
  result: VerificationResult;
  confidence: number;        // 0-100
  reason: string;
  verifierAddr: string;
  timestamp: number;         // Unix timestamp
}
```

### PaymentReceipt

```typescript
interface PaymentReceipt {
  amount: number;            // microAlgos
  assetId?: number;
  txId?: string;
  timestamp: number;         // Unix timestamp
}
```

---

## HTTP Status Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request (validation error) |
| 404 | Not Found (no verification for batch) |
| 500 | Internal Server Error |

---

## Error Handling

The API uses consistent error response format:

```json
{
  "error": "error description",
  "details": "additional context (optional)"
}
```

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| `batchAsaId is required` | Missing required field | Include `batchAsaId` in request |
| `verification not found` | Batch not verified yet | POST to /verify first |
| `Verification failed: ...` | Server error | Check logs, verify CONTRACT_APP_ID is set correctly |

---

## Rate Limiting

Currently, there is **no rate limiting** implemented. This should be added for production use.

---

## Authentication

Currently, there is **no authentication** required. This should be added for production use.

To add auth in future:
- API key validation
- JWT token verification
- OAuth2 integration

---

## Pagination

Not applicable for this API version. Single-record queries only.

---

## Response Headers

```
Content-Type: application/json; charset=utf-8
Connection: keep-alive
Keep-Alive: timeout=72
```

---

## Storage Behavior

### Development Mode (CONTRACT_APP_ID=0)

- Verifications stored in-memory only
- Lost on server restart
- Perfect for local testing

### Production Mode (CONTRACT_APP_ID>0)

- Verifications stored on-chain (primary)
- Fallback to in-memory if contract unavailable
- Persists indefinitely on blockchain

---

## API Versioning

Current version: **v1** (implicit)

Future versions will be prefixed: `/v2/`, `/v3/`, etc.

---

## Changelog

### v1.0.0 (2026-02-18)

- Initial release
- POST /verify - Create verification
- GET /status/:batchAsaId - Get verification status
- In-memory storage with contract fallback
- Fee calculation for verifications

---

## See Also

- [Deployment Guide](./DEPLOYMENT.md)
- [Onboarding Guide](./ONBOARDING.md)
- [Smart Contract](../smart_contracts/contractSupply/)
