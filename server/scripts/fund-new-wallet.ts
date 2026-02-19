import algosdk from 'algosdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

const newWalletAddress = process.argv[2];
const amountAlgo = parseFloat(process.argv[3] || '1');
const amountCVT = parseFloat(process.argv[4] || '100');

if (!newWalletAddress) {
    console.error('Usage: npx tsx scripts/fund-new-wallet.ts <ADDRESS> [ALGO_AMOUNT] [CVT_AMOUNT]');
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

    // Ensure address is a string
    const merchantAddress = typeof merchantAccount.addr === 'string'
        ? merchantAccount.addr
        : algosdk.encodeAddress(merchantAccount.addr.publicKey);

    console.log(`\n💰 Funding wallet: ${newWalletAddress}`);
    console.log(`   From merchant: ${merchantAddress}`);
    console.log(`   ALGO: ${amountAlgo} | CVT: ${amountCVT}\n`);

    try {
        // Validate address
        const decodedAddr = algosdk.decodeAddress(newWalletAddress);
        console.log('✓ Address valid');

        const params = await algodClient.getTransactionParams().do();
        console.log('✓ Params:', params);

        // 1. Send ALGO for transaction fees
        console.log('\n1️⃣  Sending ALGO...');
        const algoTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
            sender: merchantAddress,
            receiver: newWalletAddress,
            amount: Math.floor(amountAlgo * 1_000_000),
            suggestedParams: params,
        });

        const signedAlgoTxn = algosdk.signTransaction(algoTxn, merchantAccount.sk);
        console.log('   Signed transaction, sending...');
        const algoResult = await algodClient.sendRawTransaction(signedAlgoTxn.blob).do();
        console.log('   Raw result:', algoResult);
        const algoTxId = algoResult.txid || algoTxn.txID();
        console.log(`   ✅ ALGO sent: ${algoTxId}`);
        await algosdk.waitForConfirmation(algodClient, algoTxId, 4);

        // 2. Opt-in to CVT asset from new wallet
        console.log('\n2️⃣  Opting in to CVT asset...');
        console.log('   ⚠️  This requires the new wallet to sign the opt-in transaction.');
        console.log('   ❌ Cannot auto opt-in from here - wallet must do it manually.\n');

        // 3. Send CVT tokens (will fail if not opted in)
        console.log('\n3️⃣  Attempting to send CVT tokens...');
        const params2 = await algodClient.getTransactionParams().do();
        const cvtTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
            sender: merchantAddress,
            receiver: newWalletAddress,
            amount: Math.floor(amountCVT * 1_000_000), // CVT has 6 decimals
            assetIndex: CVT_ASSET_ID,
            suggestedParams: params2,
        });

        const signedCvtTxn = algosdk.signTransaction(cvtTxn, merchantAccount.sk);

        try {
            const cvtResult = await algodClient.sendRawTransaction(signedCvtTxn.blob).do();
            console.log(`   ✅ CVT sent: ${cvtResult.txid}`);
            await algosdk.waitForConfirmation(algodClient, cvtResult.txid, 4);
        } catch (err: any) {
            if (err.message?.includes('must optin')) {
                console.log(`   ⚠️  Wallet not opted in to CVT yet.`);
                console.log(`\n📝 MANUAL STEPS NEEDED:`);
                console.log(`   1. Open Defly Wallet`);
                console.log(`   2. Go to Assets tab`);
                console.log(`   3. Search for asset ID: ${CVT_ASSET_ID}`);
                console.log(`   4. Click "Add Asset" or "Opt In"`);
                console.log(`   5. Re-run this script to send CVT\n`);
            } else {
                throw err;
            }
        }

        console.log('\n✅ Funding complete!');
        console.log(`   Address: ${newWalletAddress}`);
        console.log(`   ALGO: ${amountAlgo} ✓`);
        console.log(`   CVT: Check if opt-in needed\n`);

    } catch (error) {
        console.error('\n❌ Error:', error);
        process.exit(1);
    }
})();
