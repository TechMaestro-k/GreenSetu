/**
 * Create an on-chain batch, then run a paid verification and read back status.
 *
 * Usage:
 *   npx tsx scripts/test-onchain-batch-verify.ts
 */

import algosdk from "algosdk";
import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SERVER_URL = process.env.SERVER_URL ?? "http://127.0.0.1:4000";

async function jsonFetch(url: string, init?: RequestInit) {
    const res = await fetch(url, init);
    let body: unknown = null;
    const ct = res.headers.get("content-type") ?? "";
    if (ct.includes("json")) {
        body = await res.json();
    } else {
        body = await res.text();
    }
    return { status: res.status, body };
}

function getSigner() {
    const skB64 = process.env.CLIENT_AVM_PRIVATE_KEY;
    if (!skB64) throw new Error("CLIENT_AVM_PRIVATE_KEY missing");
    const sk = new Uint8Array(Buffer.from(skB64, "base64"));
    const address = algosdk.encodeAddress(sk.slice(32));
    return {
        address,
        signTransactions: async (txns: Uint8Array[], indexes?: number[]) =>
            txns.map((txn, i) => {
                if (indexes && !indexes.includes(i)) return null;
                const decoded = algosdk.decodeUnsignedTransaction(txn);
                return decoded.signTxn(sk);
            }),
    };
}

async function main() {
    console.log("\n=== On-chain batch + paid verification ===\n");

    // 1) Create batch on-chain (no payment required)
    const createRes = await jsonFetch(`${SERVER_URL}/batch`, {
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

    if (createRes.status !== 201) {
        console.error("❌ Failed to create batch:", createRes.body);
        process.exit(1);
    }

    const batchId = (createRes.body as { batchId?: string }).batchId;
    if (!batchId) {
        console.error("❌ Missing batchId in response:", createRes.body);
        process.exit(1);
    }

    console.log(`✅ Created batch on-chain: ${batchId}`);

    // 2) Log checkpoints to trigger anomalies (speed + temperature)
    const checkpointRes = await jsonFetch(`${SERVER_URL}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            batchAsaId: batchId,
            gpsLat: "-1.2921",
            gpsLng: "36.8219",
            temperature: 12,
            humidity: 55,
            handlerType: "storage",
            notes: "Initial storage checkpoint",
            photoHash: "QmCheckpointPhotoHash",
        }),
    });

    if (checkpointRes.status !== 201) {
        console.error("❌ Failed to log checkpoint:", checkpointRes.body);
        process.exit(1);
    }

    const checkpointRes2 = await jsonFetch(`${SERVER_URL}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            batchAsaId: batchId,
            gpsLat: "37.7749",
            gpsLng: "-122.4194",
            temperature: 7,
            humidity: 40,
            handlerType: "transit",
            notes: "Fast transit checkpoint",
            photoHash: "QmCheckpointPhotoHash2",
        }),
    });

    if (checkpointRes2.status !== 201) {
        console.error("❌ Failed to log checkpoint 2:", checkpointRes2.body);
        process.exit(1);
    }

    console.log("✅ Logged 2 checkpoints for batch (expect speed + temperature anomalies)");

    // 3) Initiate a handoff but do not confirm (pending handoff anomaly)
    const handoffRes = await jsonFetch(`${SERVER_URL}/handoff/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            batchAsaId: batchId,
            fromAddr: "FROM-ADDR-TEST",
            toAddr: "TO-ADDR-TEST",
            handoffType: "transfer",
            handoffPhotoHashes: "QmHandoffPhotoHash",
        }),
    });

    if (handoffRes.status !== 201) {
        console.error("❌ Failed to initiate handoff:", handoffRes.body);
        process.exit(1);
    }

    console.log("✅ Initiated handoff (left pending for anomaly check)");

    // 4) Build payment headers via x402
    const signer = getSigner();
    const algodUrl = process.env.ALGORAND_NODE_URL ?? "https://testnet-api.algonode.cloud";
    const client = new x402Client();
    registerExactAvmScheme(client, {
        signer,
        algodConfig: { algodClient: new algosdk.Algodv2("", algodUrl, "") },
    });
    const httpClient = new x402HTTPClient(client);

    const getRes = await fetch(`${SERVER_URL}/verify`);
    const getBody = await getRes.json().catch(() => ({}));
    const paymentRequired = httpClient.getPaymentRequiredResponse(
        (name) => getRes.headers.get(name),
        getBody,
    );
    const payload = await httpClient.createPaymentPayload(paymentRequired);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

    // 5) Paid verification with evidence flags
    const verifyRes = await jsonFetch(`${SERVER_URL}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...paymentHeaders },
        body: JSON.stringify({
            batchAsaId: batchId,
            evidence: {
                missingPhotos: [1],
                certificationMismatch: "ORG-TEST-001 vs ORG-TEST-999",
            },
        }),
    });

    if (verifyRes.status !== 200) {
        console.error("❌ Verification failed:", verifyRes.body);
        process.exit(1);
    }

    console.log("✅ Verification response:", verifyRes.body);

    // 6) Read status (contract-backed)
    const statusRes = await jsonFetch(`${SERVER_URL}/status/${batchId}`);
    if (statusRes.status !== 200) {
        console.error("❌ Status lookup failed:", statusRes.body);
        process.exit(1);
    }

    console.log("✅ Status response:", statusRes.body);
    console.log("\nDone.\n");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
