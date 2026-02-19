#!/usr/bin/env node

/**
 * LocalNet Deployment Script
 * 
 * Deploys the ContractSupply smart contract to AlgoKit LocalNet
 * and saves the app ID to the server .env file
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { ContractSupplyFactory } from '../contracts/clients/ContractSupplyClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function deployToLocalNet() {
    console.log('🚀 Deploying ContractSupply to LocalNet...\n');

    try {
        // Initialize LocalNet client
        const algorand = AlgorandClient.defaultLocalNet();
        console.log('✅ Connected to LocalNet');

        // Get dispenser account
        const dispenser = await algorand.account.kmd.getLocalNetDispenserAccount();
        algorand.setSignerFromAccount(dispenser);
        console.log(`✅ Got dispenser account: ${dispenser.addr}`);

        // Create factory
        const factory = new ContractSupplyFactory({
            algorand,
            defaultSender: dispenser.addr,
        });

        console.log('📝 Creating contract...');
        const { appClient } = await factory.send.create.createApplication({
            sender: dispenser.addr,
            args: [],
        });

        const appId = appClient.appId;
        console.log(`\n🎉 Contract deployed successfully!`);
        console.log(`📱 App ID: ${appId}`);
        console.log(`💰 Contract address: ${appClient.appAddress}\n`);

        // Fund the app account for box storage MBR
        console.log('💸 Funding contract account for storage...');
        await algorand.send.payment({
            sender: dispenser.addr,
            receiver: appClient.appAddress,
            amount: (2_000_000).microAlgo(),
        });
        console.log('✅ Contract account funded\n');

        // Update server .env file
        const serverEnvPath = path.join(
            __dirname,
            '../../../../server/.env'
        );

        if (fs.existsSync(serverEnvPath)) {
            let envContent = fs.readFileSync(serverEnvPath, 'utf-8');

            // Update CONTRACT_APP_ID if it exists, otherwise add it
            if (envContent.includes('CONTRACT_APP_ID=')) {
                envContent = envContent.replace(/CONTRACT_APP_ID=\d+/, `CONTRACT_APP_ID=${appId}`);
            } else {
                envContent += `\nCONTRACT_APP_ID=${appId}`;
            }

            // Also update DEFAULT_SENDER_MNEMONIC if needed (for testing)
            if (!envContent.includes('DEFAULT_SENDER_MNEMONIC=') || envContent.includes('DEFAULT_SENDER_MNEMONIC=\n')) {
                // Note: In real deployment, this would be set properly
                // For LocalNet testing, we can use the dispenser
            }

            fs.writeFileSync(serverEnvPath, envContent);
            console.log(`✅ Updated server/.env with CONTRACT_APP_ID=${appId}`);
        } else {
            console.warn(`⚠️  server/.env not found at ${serverEnvPath}`);
        }

        // Save deployment info
        const deploymentInfo = {
            timestamp: new Date().toISOString(),
            network: 'localnet',
            appId: Number(appId), // Convert to number for JSON serialization
            appAddress: appClient.appAddress,
            dispenserAccount: dispenser.addr,
            message: 'Contract deployment to LocalNet successful'
        };

        const deploymentFile = path.join(__dirname, '../deployment-localnet.json');
        fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
        console.log(`✅ Saved deployment info to deployment-localnet.json`);

        console.log('\n📚 Next steps:');
        console.log(`1. Start the server: cd /home/karan/ChainVerify/server && npm run dev`);
        console.log(`2. Test the API: curl -X POST http://127.0.0.1:4000/verify -H "Content-Type: application/json" -d '{"batchAsaId": "batch-001"}'`);
        console.log(`3. Get status: curl http://127.0.0.1:4000/status/batch-001`);

    } catch (error) {
        console.error('❌ Deployment failed:', error);
        process.exit(1);
    }
}

// Run deployment
deployToLocalNet();

