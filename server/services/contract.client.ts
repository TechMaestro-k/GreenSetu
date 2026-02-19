/**
 * ContractClient - Real wrapper around Algorand AppClient
 *
 * Uses the ARC56 spec to make real on-chain calls to the deployed
 * ContractSupply smart contract via AlgoKit's AppClient.
 *
 * Behavior:
 * - If CONTRACT_APP_ID is set and LocalNet is reachable, uses real contract calls
 * - If CONTRACT_APP_ID is not set, falls back to StubContractClient (dev mode)
 */

import { AlgorandClient } from '@algorandfoundation/algokit-utils';
import { AppClient } from '@algorandfoundation/algokit-utils/types/app-client';
import algosdk, { type ABIValue } from 'algosdk';
import { algorandConfig } from '../config/algorand.config.js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function urlToClientConfig(urlString: string) {
    const url = new URL(urlString);
    return {
        server: `${url.protocol}//${url.hostname}`,
        port: url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80,
        token: '',
    };
}

function buildAlgorandClient() {
    const network = (process.env.ALGORAND_NETWORK || 'localnet').toLowerCase();
    if (network === 'localnet') {
        return AlgorandClient.defaultLocalNet();
    }

    const algodConfig = urlToClientConfig(algorandConfig.nodeUrl);
    const indexerConfig = urlToClientConfig(algorandConfig.indexerUrl);
    return AlgorandClient.fromConfig({ algodConfig, indexerConfig });
}

export interface ContractClientInterface {
    storeVerification(params: {
        batchAsaId: bigint | number;
        result: string;
        confidence: bigint | number;
        reason: string;
        verifierAddr: string;
    }): Promise<void>;

    createBatch(params: {
        cropType: string;
        weight: bigint | number;
        farmGps: string;
        farmingPractices: string;
        organicCertId: string;
        farmerAddr: string;
        createdAt: bigint | number;
    }): Promise<bigint>;

    logCheckpoint(params: {
        batchAsaId: bigint | number;
        gpsLat: string;
        gpsLng: string;
        temperature: bigint | number;
        humidity: bigint | number;
        handlerType: string;
        notes: string;
        photoHash: string;
        checkpointTimestamp: bigint | number;
    }): Promise<void>;

    initiateHandoff(params: {
        batchAsaId: bigint | number;
        fromAddr: string;
        toAddr: string;
        handoffType: string;
        handoffPhotoHashes: string;
    }): Promise<void>;

    confirmHandoff(params: {
        batchAsaId: bigint | number;
        handoffIndex: bigint | number;
        confirmedAt: bigint | number;
    }): Promise<void>;

    getVerification(batchAsaId: bigint | number): Promise<string | null>;
    getVerificationConfidence(batchAsaId: bigint | number): Promise<bigint | null>;
    getVerificationReason(batchAsaId: bigint | number): Promise<string | null>;
    getVerificationVerifierAddr(batchAsaId: bigint | number): Promise<string | null>;
    getVerificationTimestamp(batchAsaId: bigint | number): Promise<bigint | null>;
    getTotalVerifications(): Promise<bigint>;
    getTotalBatches(): Promise<bigint>;
    getTotalPayments(): Promise<bigint>;

    hasBatch(batchAsaId: bigint | number): Promise<boolean>;
    getBatch(batchAsaId: bigint | number): Promise<string | null>;
    getBatchCropType(batchAsaId: bigint | number): Promise<string | null>;
    getBatchWeight(batchAsaId: bigint | number): Promise<bigint | null>;
    getBatchFarmGps(batchAsaId: bigint | number): Promise<string | null>;
    getBatchFarmerAddr(batchAsaId: bigint | number): Promise<string | null>;
    getBatchCreatedAt(batchAsaId: bigint | number): Promise<bigint | null>;

    getCheckpointCount(batchAsaId: bigint | number): Promise<bigint>;
    getCheckpointTemperature(batchAsaId: bigint | number, index: bigint | number): Promise<bigint | null>;
    getCheckpointGps(batchAsaId: bigint | number, index: bigint | number): Promise<string | null>;
    getCheckpointTimestamp(batchAsaId: bigint | number, index: bigint | number): Promise<bigint | null>;
    getCheckpointHandlerType(batchAsaId: bigint | number, index: bigint | number): Promise<string | null>;

    getHandoffCount(batchAsaId: bigint | number): Promise<bigint>;
    getHandoffStatus(batchAsaId: bigint | number, index: bigint | number): Promise<string | null>;

    mintBatchAsa(params: {
        batchAsaId: bigint | number;
        metadataHash: Uint8Array;
    }): Promise<bigint>;

    updateCarbonScore(params: {
        batchAsaId: bigint | number;
        score: bigint | number;
        creditsEarned: bigint | number;
        distance: bigint | number;
        transportMethod: string;
        calculatedAt: bigint | number;
    }): Promise<void>;

    getCarbonScore(batchAsaId: bigint | number): Promise<bigint | null>;
    getCarbonCredits(batchAsaId: bigint | number): Promise<bigint | null>;
    getCarbonDistance(batchAsaId: bigint | number): Promise<bigint | null>;
    getCarbonTransportMethod(batchAsaId: bigint | number): Promise<string | null>;
    getCarbonCalculatedAt(batchAsaId: bigint | number): Promise<bigint | null>;

    updateFarmerReputation(params: {
        farmerAddr: string;
        totalBatches: bigint | number;
        verifiedCount: bigint | number;
        flaggedCount: bigint | number;
        tier: string;
        carbonCreditsTotal: bigint | number;
        totalPaymentsReceived: bigint | number;
        lastUpdated: bigint | number;
    }): Promise<void>;

    getFarmerTotalBatches(farmerAddr: string): Promise<bigint | null>;
    getFarmerVerifiedCount(farmerAddr: string): Promise<bigint | null>;
    getFarmerFlaggedCount(farmerAddr: string): Promise<bigint | null>;
    getFarmerTier(farmerAddr: string): Promise<string | null>;
    getFarmerCarbonCreditsTotal(farmerAddr: string): Promise<bigint | null>;
    getFarmerPaymentsTotal(farmerAddr: string): Promise<bigint | null>;
    getFarmerLastUpdated(farmerAddr: string): Promise<bigint | null>;

    recordFarmerPayment(params: {
        farmerAddr: string;
        batchAsaId: bigint | number;
        amount: bigint | number;
        currency: string;
        txId: string;
        timestamp: bigint | number;
    }): Promise<void>;

    getPaymentFarmerAddr(paymentId: bigint | number): Promise<string | null>;
    getPaymentBatchId(paymentId: bigint | number): Promise<bigint | null>;
    getPaymentAmount(paymentId: bigint | number): Promise<bigint | null>;
    getPaymentCurrency(paymentId: bigint | number): Promise<string | null>;
    getPaymentTxId(paymentId: bigint | number): Promise<string | null>;
    getPaymentTimestamp(paymentId: bigint | number): Promise<bigint | null>;
}

/**
 * Real contract client using AlgoKit AppClient + ARC56 spec
 */
export class RealContractClient implements ContractClientInterface {
    private appClient: AppClient;

    constructor(appClient: AppClient) {
        this.appClient = appClient;
        console.log('[ContractClient] Using REAL contract implementation');
    }

    private async call(method: string, args: ABIValue[]): Promise<unknown> {
        const result = await this.appClient.send.call({
            method,
            args,
            populateAppCallResources: true,
        });
        return result.return;
    }

    async createBatch(params: {
        cropType: string; weight: bigint | number; farmGps: string;
        farmingPractices: string; organicCertId: string; farmerAddr: string;
        createdAt: bigint | number;
    }): Promise<bigint> {
        const result = await this.call('createBatch', [
            params.cropType, BigInt(params.weight), params.farmGps,
            params.farmingPractices, params.organicCertId, params.farmerAddr,
            BigInt(params.createdAt),
        ]);
        return result as bigint;
    }

    async logCheckpoint(params: {
        batchAsaId: bigint | number; gpsLat: string; gpsLng: string;
        temperature: bigint | number; humidity: bigint | number;
        handlerType: string; notes: string; photoHash: string;
        checkpointTimestamp: bigint | number;
    }): Promise<void> {
        await this.call('logCheckpoint', [
            BigInt(params.batchAsaId), params.gpsLat, params.gpsLng,
            BigInt(params.temperature), BigInt(params.humidity),
            params.handlerType, params.notes, params.photoHash,
            BigInt(params.checkpointTimestamp),
        ]);
    }

    async initiateHandoff(params: {
        batchAsaId: bigint | number; fromAddr: string; toAddr: string;
        handoffType: string; handoffPhotoHashes: string;
    }): Promise<void> {
        await this.call('initiateHandoff', [
            BigInt(params.batchAsaId), params.fromAddr, params.toAddr,
            params.handoffType, params.handoffPhotoHashes,
        ]);
    }

    async confirmHandoff(params: {
        batchAsaId: bigint | number; handoffIndex: bigint | number;
        confirmedAt: bigint | number;
    }): Promise<void> {
        await this.call('confirmHandoff', [
            BigInt(params.batchAsaId), BigInt(params.handoffIndex),
            BigInt(params.confirmedAt),
        ]);
    }

    async storeVerification(params: {
        batchAsaId: bigint | number; result: string; confidence: bigint | number;
        reason: string; verifierAddr: string;
    }): Promise<void> {
        await this.call('storeVerification', [
            BigInt(params.batchAsaId), params.result, BigInt(params.confidence),
            params.reason, params.verifierAddr,
        ]);
    }

    async getVerification(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getVerification', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getVerificationConfidence(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getVerificationConfidence', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getVerificationReason(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getVerificationReason', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getVerificationVerifierAddr(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getVerificationVerifierAddr', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getVerificationTimestamp(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getVerificationTimestamp', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getTotalVerifications(): Promise<bigint> {
        try { return (await this.call('getTotalVerifications', [])) as bigint; }
        catch { return BigInt(0); }
    }

    async getTotalBatches(): Promise<bigint> {
        try { return (await this.call('getTotalBatches', [])) as bigint; }
        catch { return BigInt(0); }
    }

    async getTotalPayments(): Promise<bigint> {
        try { return (await this.call('getTotalPayments', [])) as bigint; }
        catch { return BigInt(0); }
    }

    async hasBatch(batchAsaId: bigint | number): Promise<boolean> {
        try { return (await this.call('hasBatch', [BigInt(batchAsaId)])) as boolean; }
        catch { return false; }
    }

    async getBatch(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getBatch', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getBatchCropType(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getBatchCropType', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getBatchWeight(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getBatchWeight', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getBatchFarmGps(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getBatchFarmGps', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getBatchFarmerAddr(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getBatchFarmerAddr', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getBatchCreatedAt(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getBatchCreatedAt', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getCheckpointCount(batchAsaId: bigint | number): Promise<bigint> {
        try { return (await this.call('getCheckpointCount', [BigInt(batchAsaId)])) as bigint; }
        catch { return BigInt(0); }
    }

    async getCheckpointTemperature(batchAsaId: bigint | number, index: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCheckpointTemperature', [BigInt(batchAsaId), BigInt(index)])) as bigint; }
        catch { return null; }
    }

    async getCheckpointGps(batchAsaId: bigint | number, index: bigint | number): Promise<string | null> {
        try { return (await this.call('getCheckpointGps', [BigInt(batchAsaId), BigInt(index)])) as string; }
        catch { return null; }
    }

    async getCheckpointTimestamp(batchAsaId: bigint | number, index: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCheckpointTimestamp', [BigInt(batchAsaId), BigInt(index)])) as bigint; }
        catch { return null; }
    }

    async getCheckpointHandlerType(batchAsaId: bigint | number, index: bigint | number): Promise<string | null> {
        try { return (await this.call('getCheckpointHandlerType', [BigInt(batchAsaId), BigInt(index)])) as string; }
        catch { return null; }
    }

    async getHandoffCount(batchAsaId: bigint | number): Promise<bigint> {
        try { return (await this.call('getHandoffCount', [BigInt(batchAsaId)])) as bigint; }
        catch { return BigInt(0); }
    }

    async getHandoffStatus(batchAsaId: bigint | number, index: bigint | number): Promise<string | null> {
        try { return (await this.call('getHandoffStatus', [BigInt(batchAsaId), BigInt(index)])) as string; }
        catch { return null; }
    }

    async mintBatchAsa(params: { batchAsaId: bigint | number; metadataHash: Uint8Array }): Promise<bigint> {
        const result = await this.call('mintBatchAsa', [BigInt(params.batchAsaId), params.metadataHash]);
        return result as bigint;
    }

    async updateCarbonScore(params: {
        batchAsaId: bigint | number;
        score: bigint | number;
        creditsEarned: bigint | number;
        distance: bigint | number;
        transportMethod: string;
        calculatedAt: bigint | number;
    }): Promise<void> {
        await this.call('updateCarbonScore', [
            BigInt(params.batchAsaId),
            BigInt(params.score),
            BigInt(params.creditsEarned),
            BigInt(params.distance),
            params.transportMethod,
            BigInt(params.calculatedAt),
        ]);
    }

    async getCarbonScore(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCarbonScore', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getCarbonCredits(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCarbonCredits', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getCarbonDistance(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCarbonDistance', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async getCarbonTransportMethod(batchAsaId: bigint | number): Promise<string | null> {
        try { return (await this.call('getCarbonTransportMethod', [BigInt(batchAsaId)])) as string; }
        catch { return null; }
    }

    async getCarbonCalculatedAt(batchAsaId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getCarbonCalculatedAt', [BigInt(batchAsaId)])) as bigint; }
        catch { return null; }
    }

    async updateFarmerReputation(params: {
        farmerAddr: string;
        totalBatches: bigint | number;
        verifiedCount: bigint | number;
        flaggedCount: bigint | number;
        tier: string;
        carbonCreditsTotal: bigint | number;
        totalPaymentsReceived: bigint | number;
        lastUpdated: bigint | number;
    }): Promise<void> {
        await this.call('updateFarmerReputation', [
            params.farmerAddr,
            BigInt(params.totalBatches),
            BigInt(params.verifiedCount),
            BigInt(params.flaggedCount),
            params.tier,
            BigInt(params.carbonCreditsTotal),
            BigInt(params.totalPaymentsReceived),
            BigInt(params.lastUpdated),
        ]);
    }

    async getFarmerTotalBatches(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerTotalBatches', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async getFarmerVerifiedCount(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerVerifiedCount', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async getFarmerFlaggedCount(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerFlaggedCount', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async getFarmerTier(farmerAddr: string): Promise<string | null> {
        try { return (await this.call('getFarmerTier', [farmerAddr])) as string; }
        catch { return null; }
    }

    async getFarmerCarbonCreditsTotal(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerCarbonCreditsTotal', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async getFarmerPaymentsTotal(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerPaymentsTotal', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async getFarmerLastUpdated(farmerAddr: string): Promise<bigint | null> {
        try { return (await this.call('getFarmerLastUpdated', [farmerAddr])) as bigint; }
        catch { return null; }
    }

    async recordFarmerPayment(params: {
        farmerAddr: string;
        batchAsaId: bigint | number;
        amount: bigint | number;
        currency: string;
        txId: string;
        timestamp: bigint | number;
    }): Promise<void> {
        await this.call('recordFarmerPayment', [
            params.farmerAddr,
            BigInt(params.batchAsaId),
            BigInt(params.amount),
            params.currency,
            params.txId,
            BigInt(params.timestamp),
        ]);
    }

    async getPaymentFarmerAddr(paymentId: bigint | number): Promise<string | null> {
        try { return (await this.call('getPaymentFarmerAddr', [BigInt(paymentId)])) as string; }
        catch { return null; }
    }

    async getPaymentBatchId(paymentId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getPaymentBatchId', [BigInt(paymentId)])) as bigint; }
        catch { return null; }
    }

    async getPaymentAmount(paymentId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getPaymentAmount', [BigInt(paymentId)])) as bigint; }
        catch { return null; }
    }

    async getPaymentCurrency(paymentId: bigint | number): Promise<string | null> {
        try { return (await this.call('getPaymentCurrency', [BigInt(paymentId)])) as string; }
        catch { return null; }
    }

    async getPaymentTxId(paymentId: bigint | number): Promise<string | null> {
        try { return (await this.call('getPaymentTxId', [BigInt(paymentId)])) as string; }
        catch { return null; }
    }

    async getPaymentTimestamp(paymentId: bigint | number): Promise<bigint | null> {
        try { return (await this.call('getPaymentTimestamp', [BigInt(paymentId)])) as bigint; }
        catch { return null; }
    }
}

/**
 * Stub implementation for development without deployed contract
 */
export class StubContractClient implements ContractClientInterface {
    constructor() {
        console.log('[ContractClient] Using STUB implementation (no CONTRACT_APP_ID)');
    }

    async createBatch(): Promise<bigint> { return BigInt(0); }
    async logCheckpoint(): Promise<void> { return; }
    async initiateHandoff(): Promise<void> { return; }
    async confirmHandoff(): Promise<void> { return; }
    async storeVerification(): Promise<void> { return; }
    async getVerification(): Promise<string | null> { return null; }
    async getVerificationConfidence(): Promise<bigint | null> { return null; }
    async getVerificationReason(): Promise<string | null> { return null; }
    async getVerificationVerifierAddr(): Promise<string | null> { return null; }
    async getVerificationTimestamp(): Promise<bigint | null> { return null; }
    async getTotalVerifications(): Promise<bigint> { return BigInt(0); }
    async getTotalBatches(): Promise<bigint> { return BigInt(0); }
    async getTotalPayments(): Promise<bigint> { return BigInt(0); }
    async hasBatch(): Promise<boolean> { return false; }
    async getBatch(): Promise<string | null> { return null; }
    async getBatchCropType(): Promise<string | null> { return null; }
    async getBatchWeight(): Promise<bigint | null> { return null; }
    async getBatchFarmGps(): Promise<string | null> { return null; }
    async getBatchFarmerAddr(): Promise<string | null> { return null; }
    async getBatchCreatedAt(): Promise<bigint | null> { return null; }
    async getCheckpointCount(): Promise<bigint> { return BigInt(0); }
    async getCheckpointTemperature(): Promise<bigint | null> { return null; }
    async getCheckpointGps(): Promise<string | null> { return null; }
    async getCheckpointTimestamp(): Promise<bigint | null> { return null; }
    async getCheckpointHandlerType(): Promise<string | null> { return null; }
    async getHandoffCount(): Promise<bigint> { return BigInt(0); }
    async getHandoffStatus(): Promise<string | null> { return null; }
    async mintBatchAsa(): Promise<bigint> { return BigInt(0); }
    async updateCarbonScore(): Promise<void> { return; }
    async getCarbonScore(): Promise<bigint | null> { return null; }
    async getCarbonCredits(): Promise<bigint | null> { return null; }
    async getCarbonDistance(): Promise<bigint | null> { return null; }
    async getCarbonTransportMethod(): Promise<string | null> { return null; }
    async getCarbonCalculatedAt(): Promise<bigint | null> { return null; }
    async updateFarmerReputation(): Promise<void> { return; }
    async getFarmerTotalBatches(): Promise<bigint | null> { return null; }
    async getFarmerVerifiedCount(): Promise<bigint | null> { return null; }
    async getFarmerFlaggedCount(): Promise<bigint | null> { return null; }
    async getFarmerTier(): Promise<string | null> { return null; }
    async getFarmerCarbonCreditsTotal(): Promise<bigint | null> { return null; }
    async getFarmerPaymentsTotal(): Promise<bigint | null> { return null; }
    async getFarmerLastUpdated(): Promise<bigint | null> { return null; }
    async recordFarmerPayment(): Promise<void> { return; }
    async getPaymentFarmerAddr(): Promise<string | null> { return null; }
    async getPaymentBatchId(): Promise<bigint | null> { return null; }
    async getPaymentAmount(): Promise<bigint | null> { return null; }
    async getPaymentCurrency(): Promise<string | null> { return null; }
    async getPaymentTxId(): Promise<string | null> { return null; }
    async getPaymentTimestamp(): Promise<bigint | null> { return null; }
}

/**
 * Factory function to get or create the contract client
 * Returns RealContractClient if CONTRACT_APP_ID is set and LocalNet is reachable
 * Returns StubContractClient otherwise
 */
let cachedClient: ContractClientInterface | null = null;

export async function getContractClient(): Promise<ContractClientInterface> {
    if (cachedClient) return cachedClient;

    if (!algorandConfig.contractAppId || algorandConfig.contractAppId === 0) {
        cachedClient = new StubContractClient();
        return cachedClient;
    }

    try {
        // Load ARC56 spec
        const specPath = join(__dirname, '..', 'config', 'ContractSupply.arc56.json');
        const spec = JSON.parse(readFileSync(specPath, 'utf8'));

        const network = (process.env.ALGORAND_NETWORK || 'localnet').toLowerCase();
        const algorand = buildAlgorandClient();

        let account: algosdk.Account;
        if (network === 'localnet') {
            const signerAccount = await algorand.account.kmd.getLocalNetDispenserAccount();
            account = signerAccount.account;
            algorand.setSignerFromAccount(account);
        } else {
            const mnemonic =
                algorandConfig.defaultSenderMnemonic || algorandConfig.contractCreatorMnemonic;
            if (!mnemonic) {
                throw new Error(
                    'DEFAULT_SENDER_MNEMONIC or CONTRACT_CREATOR_MNEMONIC is required for non-localnet'
                );
            }
            account = algosdk.mnemonicToSecretKey(mnemonic);
            algorand.setSignerFromAccount(account);
        }

        // Create AppClient with the ARC56 spec
        const appClient = new AppClient({
            appSpec: spec,
            appId: BigInt(algorandConfig.contractAppId),
            algorand,
            defaultSender: account.addr,
        });

        console.log(
            `[ContractClient] Connected to contract App ID=${algorandConfig.contractAppId}`
        );

        cachedClient = new RealContractClient(appClient);
        return cachedClient;
    } catch (error) {
        console.warn(
            `[ContractClient] Failed to initialize real client, falling back to stub:`,
            error
        );
        cachedClient = new StubContractClient();
        return cachedClient;
    }
}
