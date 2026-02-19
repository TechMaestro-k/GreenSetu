// Frontend connectivity smoke test (runs in Node, no browser required).
// Checks: GET /verify header, create batch, pay & verify, status fetch.
// Usage: node scripts/test-frontend-flow.mjs

import fs from "node:fs";
import path from "node:path";
import algosdk from "algosdk";
import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";

const root = path.resolve(process.cwd());

function readEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const env = {};
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const idx = trimmed.indexOf("=");
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        env[key] = value;
    }
    return env;
}

const frontendEnv = readEnv(path.join(root, ".env.local"));
const serverEnv = readEnv(path.resolve(root, "../server/.env"));

const API_BASE = frontendEnv.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";
const ALGOD_URL = frontendEnv.NEXT_PUBLIC_ALGOD_URL || serverEnv.ALGORAND_NODE_URL || "https://testnet-api.algonode.cloud";
const CLIENT_SK_B64 = serverEnv.CLIENT_AVM_PRIVATE_KEY;

if (!CLIENT_SK_B64) {
    console.error("CLIENT_AVM_PRIVATE_KEY missing in server/.env");
    process.exit(1);
}

const clientSk = new Uint8Array(Buffer.from(CLIENT_SK_B64, "base64"));
const clientAddress = algosdk.encodeAddress(clientSk.slice(32));

const signer = {
    address: clientAddress,
    signTransactions: async (txns, indexes) =>
        txns.map((txn, i) => {
            if (indexes && !indexes.includes(i)) return null;
            const decoded = algosdk.decodeUnsignedTransaction(txn);
            return decoded.signTxn(clientSk);
        }),
};

const x402 = new x402Client();
registerExactAvmScheme(x402, {
    signer,
    algodConfig: { algodClient: new algosdk.Algodv2("", ALGOD_URL, "") },
});
const httpClient = new x402HTTPClient(x402);

async function getPaywall() {
    const res = await fetch(`${API_BASE}/verify`);
    const body = await res.json().catch(() => ({}));
    const header = res.headers.get("payment-required");
    if (!header) {
        throw new Error("Missing payment-required header (CORS or backend issue)");
    }
    const paywall = httpClient.getPaymentRequiredResponse(
        (name) => res.headers.get(name),
        body,
    );
    return paywall;
}

async function createBatch() {
    const res = await fetch(`${API_BASE}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            cropType: "Coffee",
            weight: 1200,
            farmGps: "-1.2921|36.8219",
            farmingPractices: "shade-grown",
            organicCertId: "ORG-TEST-001",
            farmerAddr: "FARMER-TEST-ADDR",
        }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Create batch failed");
    return body.batchId;
}

async function payAndVerify(batchId, paywall) {
    const payload = await httpClient.createPaymentPayload(paywall);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);
    const res = await fetch(`${API_BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...paymentHeaders },
        body: JSON.stringify({ batchAsaId: batchId }),
    });
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Verify failed");
    return body;
}

async function getStatus(batchId) {
    const res = await fetch(`${API_BASE}/status/${batchId}`);
    const body = await res.json();
    if (!res.ok) throw new Error(body.error || "Status failed");
    return body;
}

async function main() {
    console.log("API:", API_BASE);
    console.log("ALGOD:", ALGOD_URL);
    console.log("Client:", clientAddress);

    const paywall = await getPaywall();
    console.log("Paywall OK:", paywall.accepts?.[0]?.amount, paywall.accepts?.[0]?.asset);

    const batchId = await createBatch();
    console.log("Batch created:", batchId);

    const verify = await payAndVerify(batchId, paywall);
    console.log("Verify OK:", verify.verification?.result);

    const status = await getStatus(batchId);
    console.log("Status OK:", status.verification?.result);

    console.log("All frontend-linked checks passed.");
}

main().catch((err) => {
    console.error("Test failed:", err.message || err);
    process.exit(1);
});
