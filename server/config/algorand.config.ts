import dotenv from 'dotenv';
import { ALGORAND_TESTNET_CAIP2 } from '@x402-avm/avm';

dotenv.config();

export const algorandConfig = {
    // Network configuration
    nodeUrl: process.env.ALGORAND_NODE_URL || 'http://localhost:4001',
    indexerUrl: process.env.ALGORAND_INDEXER_URL || 'http://localhost:8980',

    // AlgoKit AlgorandClient will auto-detect from env
    // It looks for: KMD_ACCOUNT_NAME, KMD_ACCOUNT_PASSWORD, ALGORAND_KMD_TOKEN, ALGORAND_KMD_PORT

    // Smart contract configuration
    contractCreatorMnemonic: process.env.CONTRACT_CREATOR_MNEMONIC || '',
    contractAppId: parseInt(process.env.CONTRACT_APP_ID || '0', 10),

    // Default sender (can be overridden per transaction)
    defaultSenderMnemonic: process.env.DEFAULT_SENDER_MNEMONIC || '',
};

export const x402Config = {
    payTo: process.env.AVM_ADDRESS || process.env.RESOURCE_PAY_TO || '',
    facilitatorUrl: process.env.FACILITATOR_URL || 'https://facilitator.goplausible.xyz',
    network: process.env.X402_NETWORK || ALGORAND_TESTNET_CAIP2,
    amount: process.env.X402_AMOUNT || '1000',
    assetId: process.env.X402_ASSET_ID || '0',
    assetDecimals: Number(process.env.X402_ASSET_DECIMALS || '6'),
    assetName: process.env.X402_ASSET_NAME || 'ALGO',
    maxTimeoutSeconds: Number(process.env.X402_TIMEOUT_SECONDS || '60'),
};

export function validateAlgorandConfig(): void {
    if (!algorandConfig.contractAppId) {
        console.warn(
            'Warning: CONTRACT_APP_ID not set. Smart contract calls will fail. Set it in .env file'
        );
    }

    if (!x402Config.payTo) {
        console.warn(
            'Warning: AVM_ADDRESS not set. x402 payments will be rejected. Set it in .env file'
        );
    }
}
