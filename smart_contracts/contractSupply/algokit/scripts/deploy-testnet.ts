#!/usr/bin/env node

/**
 * TestNet Deployment Script
 *
 * Deploys the ContractSupply smart contract to Algorand TestNet
 * and saves the app ID to the server .env file.
 */

import * as fs from "fs";
import * as path from "path";
import algosdk from "algosdk";
import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { ContractSupplyFactory } from "../contracts/clients/ContractSupplyClient.js";

const PROJECT_DIR = process.cwd();
const SERVER_ENV_PATH = path.resolve(PROJECT_DIR, "../../../server/.env");
const SERVER_TESTNET_ENV_PATH = path.resolve(PROJECT_DIR, "../../../server/.env.testnet");

const ALGOD_URL = "https://testnet-api.algonode.cloud";
const ALGOD_TOKEN = "";

const algod = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_URL, "");

function readEnvFile(filePath: string): Record<string, string> {
    if (!fs.existsSync(filePath)) return {};
    const content = fs.readFileSync(filePath, "utf8");
    const env: Record<string, string> = {};
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

function updateEnvValue(filePath: string, key: string, value: string) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, "utf8");
    const line = `${key}=${value}`;
    if (content.includes(`${key}=`)) {
        content = content.replace(new RegExp(`${key}=.*`), line);
    } else {
        content += `\n${line}`;
    }
    fs.writeFileSync(filePath, content);
}

async function getBalance(addr: string): Promise<bigint> {
    const info = await algod.accountInformation(addr).do();
    return BigInt(info.amount);
}

async function sendAlgo(fromSk: Uint8Array, toAddr: string, amount: bigint) {
    const sender = algosdk.encodeAddress(fromSk.slice(32));
    const params = await algod.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        from: sender,
        to: toAddr,
        amount,
        suggestedParams: params,
    });
    const signed = txn.signTxn(fromSk);
    const result = await algod.sendRawTransaction(signed).do();
    await algosdk.waitForConfirmation(algod, txn.txID(), 4);
    return result.txid;
}

async function deployToTestNet() {
    console.log("🚀 Deploying ContractSupply to TestNet...\n");

    const env = readEnvFile(SERVER_ENV_PATH);
    const deployerMnemonic = env.CONTRACT_CREATOR_MNEMONIC;
    if (!deployerMnemonic) {
        throw new Error("CONTRACT_CREATOR_MNEMONIC not found in server/.env");
    }

    const deployer = algosdk.mnemonicToSecretKey(deployerMnemonic);
    const deployerAddr = deployer.addr.toString();

    console.log(`✅ Deployer address: ${deployerAddr}`);

    let deployerBalance = await getBalance(deployerAddr);
    console.log(`   Balance: ${Number(deployerBalance) / 1e6} ALGO`);

    // Ensure deployer has enough funds (2 ALGO minimum)
    const minimum = 2_000_000n;
    if (deployerBalance < minimum) {
        const clientSkB64 = env.CLIENT_AVM_PRIVATE_KEY;
        if (!clientSkB64) {
            throw new Error(
                "Deployer balance is low and CLIENT_AVM_PRIVATE_KEY is missing. Fund the deployer account manually."
            );
        }
        const clientSk = new Uint8Array(Buffer.from(clientSkB64, "base64"));
        console.log("⚠️  Deployer balance low; topping up from client account...");
        await sendAlgo(clientSk, deployerAddr, 2_000_000n);
        deployerBalance = await getBalance(deployerAddr);
        console.log(`   New balance: ${Number(deployerBalance) / 1e6} ALGO`);
    }

    const algorand = AlgorandClient.testNet();
    algorand.setSignerFromAccount(deployer);

    const factory = new ContractSupplyFactory({
        algorand,
        defaultSender: deployer.addr,
    });

    console.log("📝 Creating contract...");
    const { appClient } = await factory.send.create.createApplication({
        sender: deployer.addr,
        args: [],
    });

    const appId = appClient.appId;
    console.log(`\n🎉 Contract deployed successfully!`);
    console.log(`📱 App ID: ${appId}`);
    console.log(`💰 Contract address: ${appClient.appAddress}\n`);

    // Fund app account for box storage
    console.log("💸 Funding contract account for storage...");
    await algorand.send.payment({
        sender: deployer.addr,
        receiver: appClient.appAddress,
        amount: (500_000).microAlgo(),
    });
    console.log("✅ Contract account funded\n");

    // Update server .env files
    updateEnvValue(SERVER_ENV_PATH, "CONTRACT_APP_ID", String(appId));
    updateEnvValue(SERVER_TESTNET_ENV_PATH, "CONTRACT_APP_ID", String(appId));
    updateEnvValue(SERVER_ENV_PATH, "DEFAULT_SENDER_MNEMONIC", deployerMnemonic);
    updateEnvValue(SERVER_TESTNET_ENV_PATH, "DEFAULT_SENDER_MNEMONIC", deployerMnemonic);

    console.log(`✅ Updated server/.env with CONTRACT_APP_ID=${appId}`);

    // Save deployment info
    const deploymentInfo = {
        timestamp: new Date().toISOString(),
        network: "testnet",
        appId: Number(appId),
        appAddress: appClient.appAddress,
        deployerAccount: deployerAddr,
        message: "Contract deployment to TestNet successful",
    };

    const deploymentFile = path.join(__dirname, "../deployment-testnet.json");
    fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
    console.log(`✅ Saved deployment info to deployment-testnet.json`);

    console.log("\n📚 Next steps:");
    console.log("1. Restart the server: cd /home/karan/GreenSetu/server && npx tsx index.ts");
    console.log("2. Run paid verification: npx tsx scripts/test-x402-e2e.ts");
}

deployToTestNet().catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
});
