import algosdk from 'algosdk';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');

    // Use client wallet to fund the app (has more ALGO)
    const clientSkB64 = process.env.CLIENT_AVM_PRIVATE_KEY || '';
    const clientSk = new Uint8Array(Buffer.from(clientSkB64, 'base64'));
    const clientAddr = algosdk.encodeAddress(clientSk.slice(32));
    const appAddr = algosdk.getApplicationAddress(755697325n);

    const clientInfo = await algodClient.accountInformation(clientAddr).do();
    console.log('Client:', clientAddr);
    console.log('Client balance:', Number(clientInfo.amount) / 1e6, 'ALGO');
    console.log('App Address:', appAddr.toString());

    const appInfo = await algodClient.accountInformation(appAddr.toString()).do();
    console.log('App balance before:', Number(appInfo.amount) / 1e6, 'ALGO');

    // Send 1.5 ALGO to the app address
    const params = await algodClient.getTransactionParams().do();
    const txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
        sender: clientAddr,
        receiver: appAddr.toString(),
        amount: 1_500_000, // 1.5 ALGO
        suggestedParams: params,
    });
    const signedTxn = txn.signTxn(clientSk);
    const response = await algodClient.sendRawTransaction(signedTxn).do();
    const txId = (response as Record<string, string>).txId || (response as Record<string, string>).txid || txn.txID();
    console.log('Funding tx:', txId);
    await algosdk.waitForConfirmation(algodClient, txId, 8);

    const appInfoAfter = await algodClient.accountInformation(appAddr.toString()).do();
    console.log('✅ App balance after:', Number(appInfoAfter.amount) / 1e6, 'ALGO');
}

main().catch(console.error);
