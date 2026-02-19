import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const recipientAddress = process.argv[2] || 'LKJQYQZCZRDTWCRH53VLFCOC2ZE3CXCMLLYQJVH5DN2IMQMLEWVNHRF65U';
const amountAlgo = 0.2;
const amountCVT = 100;

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
    const merchantAddress = algosdk.encodeAddress(merchantAccount.addr.publicKey);

    console.log(`\n💰 Funding wallet`);
    console.log(`   From: ${merchantAddress}`);
    console.log(`   To: ${recipientAddress}`);
    console.log(`   ALGO: ${amountAlgo} | CVT: ${amountCVT}\n`);

    try {
        // 1. Send ALGO
        console.log('1️⃣  Sending ALGO for fees...');
        const params1 = await algodClient.getTransactionParams().do();
        const algoTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: merchantAddress,
            receiver: recipientAddress,
            amount: Math.floor(amountAlgo * 1_000_000),
            suggestedParams: params1,
        });
        const signedAlgo = algosdk.signTransaction(algoTxn, merchantAccount.sk);
        const algoRes = await algodClient.sendRawTransaction(signedAlgo.blob).do();
        console.log(`   Txn ID: ${algoRes.txid}`);
        await algosdk.waitForConfirmation(algodClient, algoRes.txid, 4);
        console.log(`   ✅ ${amountAlgo} ALGO sent\n`);

        // 2. Send CVT
        console.log('2️⃣  Sending CVT tokens...');
        const params2 = await algodClient.getTransactionParams().do();
        const cvtTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: merchantAddress,
            receiver: recipientAddress,
            amount: Math.floor(amountCVT * 1_000_000),
            assetIndex: CVT_ASSET_ID,
            suggestedParams: params2,
        });
        const signedCvt = algosdk.signTransaction(cvtTxn, merchantAccount.sk);
        const cvtRes = await algodClient.sendRawTransaction(signedCvt.blob).do();
        console.log(`   Txn ID: ${cvtRes.txid}`);
        await algosdk.waitForConfirmation(algodClient, cvtRes.txid, 4);
        console.log(`   ✅ ${amountCVT} CVT sent\n`);

        console.log('✅ Wallet funded successfully!');
        console.log(`   ${recipientAddress}`);
        console.log(`   ${amountAlgo} ALGO + ${amountCVT} CVT\n`);
    } catch (error: any) {
        console.error('\n❌ Error:', error.message || error);
        process.exit(1);
    }
})();
