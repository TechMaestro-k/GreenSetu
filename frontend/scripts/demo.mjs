#!/usr/bin/env node

/**
 * ChainVerify Demo Script
 * 
 * This demonstrates the full payment flow using two separate wallets:
 * - Client Wallet (DYWL5...) pays for verification
 * - Merchant Wallet (FBOEQ...) receives payment
 */

import { x402Client, x402HTTPClient } from '@x402-avm/core/client';
import { registerExactAvmScheme } from '@x402-avm/avm/exact/client';
import algosdk from 'algosdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readEnv(filePath) {
    if (!fs.existsSync(filePath)) return {};
    const env = {};
    const content = fs.readFileSync(filePath, 'utf8');
    for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const idx = trimmed.indexOf('=');
        if (idx === -1) continue;
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        env[key] = value;
    }
    return env;
}

// Resolve .env relative to this script file, not CWD
const serverEnv = readEnv(path.resolve(__dirname, '../../server/.env'));

const API_BASE = process.env.API_BASE_URL || 'http://127.0.0.1:4000';
const ALGOD_URL = serverEnv.ALGORAND_NODE_URL || 'https://testnet-api.algonode.cloud';
const CLIENT_SK_B64 = serverEnv.CLIENT_AVM_PRIVATE_KEY;

if (!CLIENT_SK_B64) {
    console.error('❌ CLIENT_AVM_PRIVATE_KEY not found in server/.env');
    process.exit(1);
}

const clientSk = new Uint8Array(Buffer.from(CLIENT_SK_B64, 'base64'));
const clientAddress = algosdk.encodeAddress(clientSk.slice(32));

console.log('\n🎬 ChainVerify Payment Demo\n');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log(`API:      ${API_BASE}`);
console.log(`Network:  Algorand Testnet`);
console.log(`Client:   ${clientAddress}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Setup x402 client
const x402 = new x402Client();
const signer = {
    address: clientAddress,
    signTransactions: async (txns, indexes) => {
        console.log(`  📝 Signing ${indexes?.length || txns.length} transaction(s)...`);
        return txns.map((txn, i) => {
            if (!indexes || indexes.includes(i)) {
                const decodedTxn = algosdk.decodeUnsignedTransaction(txn);
                return decodedTxn.signTxn(clientSk);
            }
            return null;
        });
    },
};

registerExactAvmScheme(x402, {
    signer,
    algodConfig: { algodClient: new algosdk.Algodv2('', ALGOD_URL, '') },
});

const httpClient = new x402HTTPClient(x402);

(async () => {
    try {
        // Step 1: Get Payment Requirements
        console.log('📋 Step 1: Fetching payment requirements...');
        const paywallRes = await fetch(`${API_BASE}/verify`);
        const paywallHeaders = (name) => paywallRes.headers.get(name) || paywallRes.headers.get(name.toLowerCase());
        const paymentRequired = httpClient.getPaymentRequiredResponse(paywallHeaders);

        const scheme = paymentRequired.accepts[0];
        console.log(`  ✓ Payment: ${scheme.amount} ${scheme.extra?.name || scheme.asset}`);
        console.log(`  ✓ Pay to:  ${scheme.payTo}\n`);

        // Step 2: Create Batch
        console.log('📦 Step 2: Creating coffee batch...');
        const batchRes = await fetch(`${API_BASE}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cropType: 'Coffee',
                weight: 1200,
                farmGps: '-1.2921|36.8219',
                farmingPractices: 'shade-grown',
                organicCertId: 'ORG-DEMO-2026',
                farmerAddr: 'DEMO-FARMER-KENYA',
            }),
        });
        const batch = await batchRes.json();
        console.log(`  ✓ Batch created: ${batch.batchId}\n`);

        // Step 3: Create Payment & Verify
        console.log('💳 Step 3: Processing payment & verification...');
        console.log(`  📤 Client (${clientAddress.slice(0, 8)}...) paying...`);

        const payload = await httpClient.createPaymentPayload(paymentRequired);
        const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);

        const verifyRes = await fetch(`${API_BASE}/verify`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', ...paymentHeaders },
            body: JSON.stringify({ batchAsaId: batch.batchId }),
        });

        const verification = await verifyRes.json();

        if (!verifyRes.ok) {
            throw new Error(verification.error || 'Verification failed');
        }

        console.log(`  ✓ Payment settled: ${verification.payment.amount / 1_000_000} ${scheme.extra?.name}`);
        console.log(`  ✓ Verification: ${verification.verification.result}`);
        console.log(`  ✓ Confidence: ${verification.verification.confidence}%\n`);

        // Step 4: Check On-Chain Status
        console.log('🔗 Step 4: Reading on-chain status...');
        const statusRes = await fetch(`${API_BASE}/status/${batch.batchId}`);
        const status = await statusRes.json();

        console.log(`  ✓ On-chain result: ${status.verification.result}`);
        console.log(`  ✓ Timestamp: ${new Date(status.verification.timestamp * 1000).toLocaleString()}`);
        console.log(`  ✓ Verifier: ${status.verification.verifierAddr}\n`);

        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('✅ Demo Complete!');
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
        console.log('📊 Summary:');
        console.log(`   - Batch ID:     ${batch.batchId}`);
        console.log(`   - Payment:      0.001 CVT`);
        console.log(`   - Result:       ${verification.verification.result}`);
        console.log(`   - On-chain:     ✓ Stored\n`);

    } catch (error) {
        console.error('\n❌ Error:', error.message);
        process.exit(1);
    }
})();
