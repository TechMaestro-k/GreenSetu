import algosdk from 'algosdk';
import { x402Client, x402HTTPClient } from '@x402-avm/core/client';
import { registerExactAvmScheme } from '@x402-avm/avm/exact/client';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const CLIENT_PRIVATE_KEY = process.env.CLIENT_AVM_PRIVATE_KEY;
const API_BASE = 'http://127.0.0.1:4000';
const ALGOD_URL = 'https://testnet-api.algonode.cloud';

if (!CLIENT_PRIVATE_KEY) {
    console.error('❌ CLIENT_AVM_PRIVATE_KEY not found in .env');
    process.exit(1);
}

const batchIdArg = process.argv[2];

(async () => {

    // Setup signer
    const secretKey = new Uint8Array(Buffer.from(CLIENT_PRIVATE_KEY, 'base64'));
    const publicKey = secretKey.slice(32);
    const clientAddress = algosdk.encodeAddress(publicKey);

    const client = new x402Client();
    const signer = {
        address: clientAddress,
        signTransactions: async (txns: Uint8Array[], indexes?: number[]) => {
            return txns.map((txn, i) => {
                if (indexes && !indexes.includes(i)) return null;
                const decoded = algosdk.decodeUnsignedTransaction(txn);
                return decoded.signTxn(secretKey);
            });
        },
    };

    registerExactAvmScheme(client, {
        signer,
        algodConfig: {
            algodClient: new algosdk.Algodv2('', ALGOD_URL, ''),
        },
    });

    const httpClient = new x402HTTPClient(client);

    const createBatch = async () => {
        const res = await fetch(`${API_BASE}/batch`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                cropType: 'Coffee',
                weight: 1200,
                farmGps: '-1.2921|36.8219',
                farmingPractices: 'shade-grown',
                organicCertId: 'ORG-TEST-001',
                farmerAddr: 'FARMER-TEST-ADDR',
            }),
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.error || 'Create batch failed');
        return body.batchId as string;
    };

    const batchId = batchIdArg || (await createBatch());
    console.log(`\n🧪 Testing Pay & Verify for batch ${batchId}...\n`);

    // 1. Fetch paywall
    console.log('1️⃣  Fetching paywall...');
    const paywallRes = await fetch(`${API_BASE}/verify`);
    const paywallBody = await paywallRes.json();
    console.log('Paywall response:', paywallRes.status);

    const headerLookup = (name: string) => {
        return paywallRes.headers.get(name) || paywallRes.headers.get(name.toLowerCase());
    };

    const paymentRequired = httpClient.getPaymentRequiredResponse(headerLookup, paywallBody);
    console.log('Payment required:', JSON.stringify(paymentRequired, null, 2));

    // 2. Create payment
    console.log('\n2️⃣  Creating payment...');
    const payload = await httpClient.createPaymentPayload(paymentRequired as any);
    const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);
    console.log('Payment headers:', Object.keys(paymentHeaders));

    // 3. Send verify request
    console.log('\n3️⃣  Sending verify request...');
    const verifyRes = await fetch(`${API_BASE}/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...paymentHeaders },
        body: JSON.stringify({ batchAsaId: batchId }),
    });

    const verifyBody = await verifyRes.json();
    console.log('Verify response status:', verifyRes.status);
    console.log('Verify response body:', JSON.stringify(verifyBody, null, 2));

    // 4. Check status
    console.log('\n4️⃣  Checking status...');
    const statusRes = await fetch(`${API_BASE}/status/${batchId}`);
    const statusBody = await statusRes.json();
    console.log('Status response:', statusRes.status);
    console.log('Status body:', JSON.stringify(statusBody, null, 2));

    console.log('\n✅ Test complete');
})();
