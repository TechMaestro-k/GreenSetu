import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const recipientAddress = process.argv[2];
const amountCVT = parseFloat(process.argv[3] || '100');

if (!recipientAddress) {
    console.error('Usage: npx tsx scripts/send-cvt-only.ts <ADDRESS> [CVT_AMOUNT]');
    process.exit(1);
}

const MERCHANT_MNEMONIC = process.env.DEFAULT_SENDER_MNEMONIC;
const ALGOD_URL = process.env.ALGORAND_NODE_URL || 'https://testnet-api.algonode.cloud';
const CVT_ASSET_ID = parseInt(process.env.X402_ASSET_ID || '755696837');

if (!MERCHANT_MNEMONIC) {
    console.error('DEFAULT_SENDER_MNEMONIC not found in .env');
    process.exit(1);
}

(async () => {
    const algodClient = new algosdk.Algodv2('', ALGOD_URL, '');
    const merchantAccount = algosdk.mnemonicToSecretKey(MERCHANT_MNEMONIC);
    const merchantAddress = merchantAccount.addr.toString();

    console.log(`\n💰 Sending CVT tokens`);
    console.log(`   From: ${merchantAddress}`);
    console.log(`   To: ${recipientAddress}`);
    console.log(`   Amount: ${amountCVT} CVT\n`);

    try {
        const params = await algodClient.getTransactionParams().do();

        const cvtTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: merchantAddress,
            receiver: recipientAddress,
            amount: Math.floor(amountCVT * 1_000_000),
            assetIndex: CVT_ASSET_ID,
            suggestedParams: params,
        });

        const txId = cvtTxn.txID();
        const signedCvtTxn = cvtTxn.signTxn(merchantAccount.sk);
        await algodClient.sendRawTransaction(signedCvtTxn).do();
        console.log(`✅ Transaction sent: ${txId}`);

        await algosdk.waitForConfirmation(algodClient, txId, 6);
        console.log(`✅ CVT transfer confirmed!`);
        console.log(`   ${amountCVT} CVT sent to ${recipientAddress}\n`);
    } catch (error: any) {
        console.error('\n❌ Error:', error.message || error);
        process.exit(1);
    }
})();
