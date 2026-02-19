/**
 * Testnet setup script for GreenSetu x402 integration.
 *
 * Generates:
 *  1. Merchant account (receives x402 payments)
 *  2. Deployer account (deploys smart contract, creates ASA)
 *  3. Custom test ASA ("CVT" - GreenSetu Token)
 *
 * Usage:
 *   npx tsx scripts/setup-testnet.ts
 */

import algosdk from "algosdk";
import dotenv from "dotenv";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const ALGOD_URL = "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = "";

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");

// ── Helpers ─────────────────────────────────────────────────────────────

function accountFromSk(sk: Uint8Array) {
    const pub = sk.slice(32);
    return { sk, address: algosdk.encodeAddress(pub) };
}

async function checkBalance(addr: string): Promise<bigint> {
    try {
        const info = await algod.accountInformation(addr).do();
        return BigInt(info.amount);
    } catch {
        return 0n;
    }
}

async function waitForFunding(addr: string, label: string): Promise<void> {
    console.log(`\n⏳ Waiting for ${label} to be funded...`);
    console.log(`   Address: ${addr}`);
    console.log(`   Fund at: https://bank.testnet.algorand.network/`);

    for (let i = 0; i < 120; i++) {
        const balance = await checkBalance(addr);
        if (balance > 0n) {
            console.log(`   ✅ ${label} funded! Balance: ${Number(balance) / 1_000_000} ALGO`);
            return;
        }
        process.stdout.write(".");
        await new Promise((r) => setTimeout(r, 5000));
    }
    throw new Error(`Timeout waiting for ${label} funding`);
}

// ── Main ────────────────────────────────────────────────────────────────

async function main() {
    console.log("═══════════════════════════════════════════════════");
    console.log("  GreenSetu — Testnet Setup");
    console.log("═══════════════════════════════════════════════════\n");

    // Check if we already have a merchant key; if not, generate one
    let merchantSk: Uint8Array;
    let merchantAddress: string;
    let merchantMnemonic: string;

    const existingMerchantSk = process.env.MERCHANT_PRIVATE_KEY;
    if (existingMerchantSk) {
        merchantSk = new Uint8Array(Buffer.from(existingMerchantSk, "base64"));
        merchantAddress = accountFromSk(merchantSk).address;
        merchantMnemonic = algosdk.secretKeyToMnemonic(merchantSk);
        console.log("Using existing merchant account from MERCHANT_PRIVATE_KEY");
    } else {
        const acct = algosdk.generateAccount();
        merchantSk = acct.sk;
        merchantAddress = algosdk.encodeAddress(acct.addr.publicKey);
        merchantMnemonic = algosdk.secretKeyToMnemonic(merchantSk);
        console.log("Generated NEW merchant account");
    }
    console.log(`  Merchant Address: ${merchantAddress}`);

    // Client account — reuse existing
    let clientSk: Uint8Array;
    let clientAddress: string;
    const existingClientSk = process.env.CLIENT_AVM_PRIVATE_KEY;
    if (existingClientSk) {
        clientSk = new Uint8Array(Buffer.from(existingClientSk, "base64"));
        clientAddress = accountFromSk(clientSk).address;
        console.log(`  Client Address:   ${clientAddress} (existing)`);
    } else {
        const acct = algosdk.generateAccount();
        clientSk = acct.sk;
        clientAddress = algosdk.encodeAddress(acct.addr.publicKey);
        console.log(`  Client Address:   ${clientAddress} (new)`);
    }

    // ── Check funding ───────────────────────────────────────────────────
    console.log("\n── Checking Account Balances ──");

    const merchantBal = await checkBalance(merchantAddress);
    const clientBal = await checkBalance(clientAddress);

    console.log(`  Merchant: ${Number(merchantBal) / 1_000_000} ALGO`);
    console.log(`  Client:   ${Number(clientBal) / 1_000_000} ALGO`);

    if (merchantBal < 1_000_000n) {
        await waitForFunding(merchantAddress, "Merchant");
    }
    if (clientBal < 1_000_000n) {
        await waitForFunding(clientAddress, "Client");
    }

    // ── Create Custom Test ASA ──────────────────────────────────────────
    console.log("\n── Creating Custom Test ASA (CVT - GreenSetu Token) ──");

    const params = await algod.getTransactionParams().do();

    const asaCreateTxn = algosdk.makeAssetCreateTxnWithSuggestedParamsFromObject({
        sender: algosdk.Address.fromString(merchantAddress),
        total: 1_000_000_000_000n, // 1M tokens with 6 decimals
        decimals: 6,
        defaultFrozen: false,
        unitName: "CVT",
        assetName: "GreenSetu Token",
        assetURL: "https://greensetu.dev",
        manager: algosdk.Address.fromString(merchantAddress),
        reserve: algosdk.Address.fromString(merchantAddress),
        freeze: algosdk.Address.fromString(merchantAddress),
        clawback: algosdk.Address.fromString(merchantAddress),
        suggestedParams: params,
    });

    const signedAsaCreate = asaCreateTxn.signTxn(merchantSk);
    const asaResult = await algod.sendRawTransaction(signedAsaCreate).do();
    console.log(`  ASA create TX: ${asaResult.txid}`);

    const confirmed = await algosdk.waitForConfirmation(algod, asaCreateTxn.txID(), 4);
    const asaId = confirmed.assetIndex;
    console.log(`  ✅ CVT ASA created! ID: ${asaId}`);

    // ── Opt-in client to ASA ────────────────────────────────────────────
    console.log("\n── Opting client into CVT ASA ──");

    const optInParams = await algod.getTransactionParams().do();
    const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: algosdk.Address.fromString(clientAddress),
        receiver: algosdk.Address.fromString(clientAddress),
        amount: 0n,
        assetIndex: Number(asaId),
        suggestedParams: optInParams,
    });

    const signedOptIn = optInTxn.signTxn(clientSk);
    const optInResult = await algod.sendRawTransaction(signedOptIn).do();
    await algosdk.waitForConfirmation(algod, optInTxn.txID(), 4);
    console.log(`  ✅ Client opted in (TX: ${optInResult.txid})`);

    // ── Send CVT tokens to client ───────────────────────────────────────
    console.log("\n── Sending CVT tokens to client ──");

    const sendParams = await algod.getTransactionParams().do();
    const sendTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: algosdk.Address.fromString(merchantAddress),
        receiver: algosdk.Address.fromString(clientAddress),
        amount: 100_000_000_000n, // 100,000 CVT tokens
        assetIndex: Number(asaId),
        suggestedParams: sendParams,
    });

    const signedSend = sendTxn.signTxn(merchantSk);
    const sendResult = await algod.sendRawTransaction(signedSend).do();
    await algosdk.waitForConfirmation(algod, sendTxn.txID(), 4);
    console.log(`  ✅ Sent 100,000 CVT to client (TX: ${sendResult.txid})`);

    // ── Write .env.testnet ──────────────────────────────────────────────
    const envContent = `# Algorand Testnet Configuration
ALGORAND_NETWORK=testnet
ALGORAND_NODE_URL=https://testnet-api.algonode.cloud
ALGORAND_INDEXER_URL=https://testnet-idx.algonode.cloud

# Smart Contract Configuration
CONTRACT_APP_ID=0
CONTRACT_CREATOR_MNEMONIC=${merchantMnemonic}
DEFAULT_SENDER_MNEMONIC=${merchantMnemonic}

# Server Configuration
PORT=4000
HOST=0.0.0.0
NODE_ENV=development

# x402 Configuration
AVM_ADDRESS=${merchantAddress}
MERCHANT_PRIVATE_KEY=${Buffer.from(merchantSk).toString("base64")}
FACILITATOR_URL=https://facilitator.goplausible.xyz
X402_NETWORK=algorand:SGO1GKSzyE7IEPItTxCByw9x8FmnrCDexi9/cOUJOiI=
X402_AMOUNT=1000
X402_ASSET_ID=${asaId}
X402_ASSET_DECIMALS=6
X402_ASSET_NAME=CVT
X402_TIMEOUT_SECONDS=60

# Client key for x402 payments (base64 secret key)
CLIENT_AVM_PRIVATE_KEY=${Buffer.from(clientSk).toString("base64")}
CLIENT_AVM_ADDRESS=${clientAddress}
`;

    const envPath = path.resolve(__dirname, "../.env.testnet");
    fs.writeFileSync(envPath, envContent);
    console.log(`\n✅ Wrote ${envPath}`);

    // ── Summary ─────────────────────────────────────────────────────────
    console.log("\n═══════════════════════════════════════════════════");
    console.log("  Setup Complete!");
    console.log("═══════════════════════════════════════════════════");
    console.log(`  Merchant:  ${merchantAddress}`);
    console.log(`  Client:    ${clientAddress}`);
    console.log(`  CVT ASA:   ${asaId}`);
    console.log(`  Network:   Algorand Testnet`);
    console.log("");
    console.log("  To switch to testnet, run:");
    console.log("    cp .env.testnet .env");
    console.log("═══════════════════════════════════════════════════\n");
}

main().catch((err) => {
    console.error("Fatal:", err);
    process.exit(1);
});
