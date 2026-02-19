import { getContractClient, ContractClientInterface } from './contract.client.js';
import { IVerificationStore } from './verification.store.js';
import { SqliteVerificationStore, batchDb, checkpointDb, handoffDb, escrowDb, paymentDb, carbonDb, reputationDb } from './sqlite.store.js';
import type { VerificationResult, VerificationRecord, CheckpointRecord, HandoffRecord } from '../types/verification.types.js';
import algosdk from 'algosdk';
import { algorandConfig, x402Config } from '../config/algorand.config.js';

/**
 * Service to interact with the ContractSupply smart contract
 *
 * Orchestrates between on-chain storage (ContractClient) and SQLite persistence.
 * All write operations go to BOTH contract + SQLite.
 * Read operations try SQLite first, then fall back to contract.
 * Data survives server restarts (stored in server/data/greensetu.db).
 */
export class ContractSupplyService {
    private contractClient: ContractClientInterface | null = null;
    private verificationStore: IVerificationStore | null = null;

    async getClient(): Promise<ContractClientInterface> {
        if (!this.contractClient) {
            this.contractClient = await getContractClient();
        }
        return this.contractClient;
    }

    private getStore(): IVerificationStore {
        if (!this.verificationStore) {
            this.verificationStore = new SqliteVerificationStore();
            console.log('[ContractSupplyService] Using SQLite-backed verification store');
        }
        return this.verificationStore;
    }

    // ─── Batch Operations ──────────────────────────

    async createBatch(params: {
        cropType: string; weight: number; farmGps: string;
        farmingPractices: string; organicCertId: string; farmerAddr: string;
    }): Promise<{ id: string; onChain: boolean }> {
        const createdAt = Math.floor(Date.now() / 1000);
        const client = await this.getClient();

        const batchId = await client.createBatch({
            ...params,
            weight: BigInt(params.weight),
            createdAt: BigInt(createdAt),
        });

        const id = batchId.toString();
        if (id === '0') throw new Error('Contract returned batch ID 0 (likely stub)');
        batchDb.save(id, { ...params, createdAt, checkpointCount: 0, handoffCount: 0 });
        await this.ensureFarmerReputation(params.farmerAddr);
        console.log(`[ContractSupplyService] Created batch ${id} on-chain`);
        return { id, onChain: true };
    }

    async hasBatch(batchAsaId: string): Promise<boolean> {
        if (batchDb.has(batchAsaId)) return true;

        if (!this.isNumericId(batchAsaId)) return false;
        try {
            const client = await this.getClient();
            return await client.hasBatch(BigInt(batchAsaId));
        } catch { return false; }
    }

    async getBatchDetails(batchAsaId: string): Promise<{
        cropType: string | null; weight: number | null; farmGps: string | null;
        farmingPractices?: string | null; organicCertId?: string | null;
        farmerAddr: string | null; checkpointCount: number; handoffCount: number;
        createdAt?: number | null;
    } | null> {
        if (!this.isNumericId(batchAsaId)) return null;
        const local = batchDb.get(batchAsaId);
        try {
            const client = await this.getClient();
            const exists = await client.hasBatch(BigInt(batchAsaId));
            if (!exists && !local) return null;

            const [cropType, weight, farmGps, farmerAddr, cpCount, hoCount] = await Promise.all([
                client.getBatchCropType(BigInt(batchAsaId)),
                client.getBatchWeight(BigInt(batchAsaId)),
                client.getBatchFarmGps(BigInt(batchAsaId)),
                client.getBatchFarmerAddr(BigInt(batchAsaId)),
                client.getCheckpointCount(BigInt(batchAsaId)),
                client.getHandoffCount(BigInt(batchAsaId)),
            ]);

            return {
                cropType: cropType ?? local?.cropType ?? null,
                weight: weight ? Number(weight) : (local?.weight ?? null),
                farmGps: farmGps ?? local?.farmGps ?? null,
                farmingPractices: local?.farmingPractices ?? null,
                organicCertId: local?.organicCertId ?? null,
                farmerAddr: farmerAddr ?? local?.farmerAddr ?? null,
                createdAt: local?.createdAt ?? null,
                checkpointCount: Number(cpCount || 0) || local?.checkpointCount || 0,
                handoffCount: Number(hoCount || 0) || local?.handoffCount || 0,
            };
        } catch {
            if (!local) return null;
            return {
                cropType: local.cropType,
                weight: local.weight,
                farmGps: local.farmGps,
                farmingPractices: local.farmingPractices,
                organicCertId: local.organicCertId,
                farmerAddr: local.farmerAddr,
                createdAt: local.createdAt,
                checkpointCount: local.checkpointCount,
                handoffCount: local.handoffCount,
            };
        }
    }

    // ─── Checkpoint Operations ─────────────────────

    async logCheckpoint(params: {
        batchAsaId: string; gpsLat: string; gpsLng: string;
        temperature: number; humidity: number; handlerType: string;
        notes: string; photoHash: string;
    }): Promise<number> {
        const timestamp = Math.floor(Date.now() / 1000);
        const client = await this.getClient();

        // Determine next checkpoint index
        const local = batchDb.get(params.batchAsaId);
        const nextIndex = local ? local.checkpointCount + 1 : 1;

        try {
            await client.logCheckpoint({
                batchAsaId: BigInt(params.batchAsaId),
                gpsLat: params.gpsLat, gpsLng: params.gpsLng,
                temperature: BigInt(params.temperature),
                humidity: BigInt(params.humidity),
                handlerType: params.handlerType,
                notes: params.notes, photoHash: params.photoHash,
                checkpointTimestamp: BigInt(timestamp),
            });
            console.log(`[ContractSupplyService] Logged checkpoint ${nextIndex} for batch ${params.batchAsaId} on-chain`);
        } catch (error) {
            console.warn(`[ContractSupplyService] Contract logCheckpoint failed (stored in-memory only):`, error);
        }

        // Always persist to SQLite
        checkpointDb.save(params.batchAsaId, nextIndex, {
            gps: `${params.gpsLat}|${params.gpsLng}`,
            temperature: params.temperature,
            humidity: params.humidity,
            handlerType: params.handlerType,
            notes: params.notes,
            photoHash: params.photoHash,
            timestamp,
        });
        batchDb.updateCheckpointCount(params.batchAsaId, nextIndex);

        return nextIndex;
    }

    async getCheckpoints(batchAsaId: string): Promise<CheckpointRecord[]> {
        const local = checkpointDb.getAll(batchAsaId);
        const localByIndex = new Map(local.map((checkpoint) => [checkpoint.index, checkpoint]));
        const results: CheckpointRecord[] = [];
        if (!this.isNumericId(batchAsaId)) return local;
        try {
            const client = await this.getClient();
            const count = Number(await client.getCheckpointCount(BigInt(batchAsaId)));
            for (let i = 1; i <= count; i++) {
                const [gps, temp, handler, ts] = await Promise.all([
                    client.getCheckpointGps(BigInt(batchAsaId), BigInt(i)),
                    client.getCheckpointTemperature(BigInt(batchAsaId), BigInt(i)),
                    client.getCheckpointHandlerType(BigInt(batchAsaId), BigInt(i)),
                    client.getCheckpointTimestamp(BigInt(batchAsaId), BigInt(i)),
                ]);
                const localEntry = localByIndex.get(i);
                results.push({
                    index: i,
                    gps: gps ?? localEntry?.gps ?? null,
                    temperature: temp ? Number(temp) : (localEntry?.temperature ?? null),
                    humidity: localEntry?.humidity ?? null,
                    handlerType: handler ?? localEntry?.handlerType ?? null,
                    notes: localEntry?.notes ?? null,
                    photoHash: localEntry?.photoHash ?? null,
                    timestamp: ts ? Number(ts) : (localEntry?.timestamp ?? null),
                });
            }
            if (results.length >= local.length) return results;
            const merged = new Map(results.map((checkpoint) => [checkpoint.index, checkpoint]));
            local.forEach((checkpoint) => {
                if (!merged.has(checkpoint.index)) merged.set(checkpoint.index, checkpoint);
            });
            return Array.from(merged.values()).sort((a, b) => a.index - b.index);
        } catch {
            return local;
        }
    }

    // ─── Handoff Operations ────────────────────────

    async initiateHandoff(params: {
        batchAsaId: string; fromAddr: string; toAddr: string;
        handoffType: string; handoffPhotoHashes: string;
    }): Promise<number> {
        const client = await this.getClient();
        const local = batchDb.get(params.batchAsaId);
        const nextIndex = local ? local.handoffCount + 1 : 1;

        try {
            await client.initiateHandoff({
                batchAsaId: BigInt(params.batchAsaId),
                fromAddr: params.fromAddr, toAddr: params.toAddr,
                handoffType: params.handoffType,
                handoffPhotoHashes: params.handoffPhotoHashes,
            });
            console.log(`[ContractSupplyService] Initiated handoff ${nextIndex} for batch ${params.batchAsaId} on-chain`);
        } catch (error) {
            console.warn(`[ContractSupplyService] Contract initiateHandoff failed (stored in-memory only):`, error);
        }

        // Persist to SQLite
        handoffDb.save(params.batchAsaId, nextIndex, {
            status: 'pending',
            fromAddr: params.fromAddr,
            toAddr: params.toAddr,
            handoffType: params.handoffType,
            confirmedAt: null,
        });
        batchDb.updateHandoffCount(params.batchAsaId, nextIndex);

        return nextIndex;
    }

    async confirmHandoff(params: {
        batchAsaId: string; handoffIndex: number;
    }): Promise<void> {
        const confirmedAt = Math.floor(Date.now() / 1000);
        const client = await this.getClient();

        try {
            await client.confirmHandoff({
                batchAsaId: BigInt(params.batchAsaId),
                handoffIndex: BigInt(params.handoffIndex),
                confirmedAt: BigInt(confirmedAt),
            });
            console.log(`[ContractSupplyService] Confirmed handoff ${params.handoffIndex} for batch ${params.batchAsaId} on-chain`);
        } catch (error) {
            console.warn(`[ContractSupplyService] Contract confirmHandoff failed (stored in-memory only):`, error);
        }

        // Update SQLite
        handoffDb.updateStatus(params.batchAsaId, params.handoffIndex, 'confirmed');
    }

    async getHandoffs(batchAsaId: string): Promise<HandoffRecord[]> {
        const local = handoffDb.getAll(batchAsaId);
        const localByIndex = new Map(local.map((handoff) => [handoff.index, handoff]));
        const results: HandoffRecord[] = [];
        if (!this.isNumericId(batchAsaId)) return local;
        try {
            const client = await this.getClient();
            const count = Number(await client.getHandoffCount(BigInt(batchAsaId)));
            for (let i = 1; i <= count; i++) {
                const status = await client.getHandoffStatus(BigInt(batchAsaId), BigInt(i));
                const localEntry = localByIndex.get(i);
                results.push({
                    index: i,
                    status: status ?? localEntry?.status ?? null,
                    fromAddr: localEntry?.fromAddr ?? null,
                    toAddr: localEntry?.toAddr ?? null,
                    handoffType: localEntry?.handoffType ?? null,
                    confirmedAt: localEntry?.confirmedAt ?? null,
                });
            }
            if (results.length >= local.length) return results;
            const merged = new Map(results.map((handoff) => [handoff.index, handoff]));
            local.forEach((handoff) => {
                if (!merged.has(handoff.index)) merged.set(handoff.index, handoff);
            });
            return Array.from(merged.values()).sort((a, b) => a.index - b.index);
        } catch {
            return local;
        }
    }

    // ─── Verification Operations ───────────────────

    async storeVerification(
        batchAsaId: string,
        result: string,
        confidence: number,
        reason: string,
        verifierAddr: string
    ): Promise<void> {
        const timestamp = Math.floor(Date.now() / 1000);
        if (!this.isNumericId(batchAsaId)) {
            throw new Error('Verification requires an on-chain batch ID');
        }

        const client = await this.getClient();
        await client.storeVerification({
            batchAsaId: BigInt(batchAsaId),
            result, confidence: BigInt(confidence),
            reason, verifierAddr,
        });
        console.log(`[ContractSupplyService] Stored verification for batch ${batchAsaId} on-chain`);

        await this.updateReputationOnVerification(batchAsaId, result);

        try {
            await this.calculateCarbonScore(batchAsaId);
        } catch (carbonErr) {
            console.warn('[ContractSupplyService] Carbon score calculation failed:', carbonErr);
        }
    }

    async getVerificationRecord(batchAsaId: string): Promise<VerificationRecord | null> {
        // Contract fallback
        if (!this.isNumericId(batchAsaId)) return null;
        try {
            const client = await this.getClient();
            const [result, confidence, reason, verifierAddr, timestamp] = await Promise.all([
                client.getVerification(BigInt(batchAsaId)),
                client.getVerificationConfidence(BigInt(batchAsaId)),
                client.getVerificationReason(BigInt(batchAsaId)),
                client.getVerificationVerifierAddr(BigInt(batchAsaId)),
                client.getVerificationTimestamp(BigInt(batchAsaId)),
            ]);

            if (!result || confidence === null || !reason || !verifierAddr || timestamp === null) {
                return null;
            }

            return {
                batchAsaId,
                result: (result === 'VERIFIED' || result === 'FLAGGED' ? result : 'VERIFIED') as VerificationResult,
                confidence: Number(confidence),
                reason,
                verifierAddr,
                timestamp: Number(timestamp),
            };
        } catch { return null; }
    }

    // Legacy getters (kept for backward compatibility with indexer)
    async getVerification(batchAsaId: string): Promise<string | null> {
        const record = await this.getVerificationRecord(batchAsaId);
        return record?.result ?? null;
    }

    async getVerificationConfidence(batchAsaId: string): Promise<number | null> {
        const record = await this.getVerificationRecord(batchAsaId);
        return record?.confidence ?? null;
    }

    async getVerificationReason(batchAsaId: string): Promise<string | null> {
        const record = await this.getVerificationRecord(batchAsaId);
        return record?.reason ?? null;
    }

    async getVerificationVerifierAddr(batchAsaId: string): Promise<string | null> {
        const record = await this.getVerificationRecord(batchAsaId);
        return record?.verifierAddr ?? null;
    }

    async getVerificationTimestamp(batchAsaId: string): Promise<number | null> {
        const record = await this.getVerificationRecord(batchAsaId);
        return record?.timestamp ?? null;
    }

    async getTotalVerifications(): Promise<number> {
        const client = await this.getClient();
        const total = await client.getTotalVerifications();
        return Number(total);
    }

    // ─── Utility ───────────────────────────────────

    private isNumericId(id: string): boolean {
        return /^\d+$/.test(id);
    }

    // ─── Mint Batch NFT ────────────────────────────

    async mintBatchAsa(batchAsaId: string, metadataHash: string): Promise<{ assetId: string }> {
        if (!this.isNumericId(batchAsaId)) {
            throw new Error('Cannot mint NFT for local-only batch (not on-chain)');
        }

        const client = await this.getClient();
        const hashBytes = new Uint8Array(32);
        const encoded = new TextEncoder().encode(metadataHash);
        hashBytes.set(encoded.slice(0, 32));

        const assetId = await client.mintBatchAsa({
            batchAsaId: BigInt(batchAsaId),
            metadataHash: hashBytes,
        });

        console.log(`[ContractSupplyService] Minted batch NFT for batch ${batchAsaId}, ASA ID: ${assetId}`);
        return { assetId: assetId.toString() };
    }

    // ─── Escrow / Farmer Payment Operations ────────

    async fundEscrow(batchId: string, buyerAddr: string, amount: number): Promise<void> {
        const batch = batchDb.get(batchId);
        if (!batch) throw new Error(`Batch ${batchId} not found`);

        escrowDb.fund(batchId, buyerAddr, batch.farmerAddr, amount);
        console.log(`[ContractSupplyService] Escrow funded for batch ${batchId}: ${amount} tUSDCa from ${buyerAddr}`);
    }

    async releaseFarmerPayment(batchId: string): Promise<{
        amount: number; farmerAddr: string; txId: string;
    }> {
        const escrow = escrowDb.get(batchId);
        if (!escrow) throw new Error(`No escrow found for batch ${batchId}`);
        if (escrow.status === 'released') throw new Error(`Escrow already released for batch ${batchId}`);

        const txId = await this.sendFarmerPayment(escrow.amount, escrow.farmerAddr);

        const timestamp = Math.floor(Date.now() / 1000);
        const client = await this.getClient();
        await client.recordFarmerPayment({
            farmerAddr: escrow.farmerAddr,
            batchAsaId: BigInt(batchId),
            amount: BigInt(this.toBaseUnits(escrow.amount)),
            currency: x402Config.assetName || 'ALGO',
            txId,
            timestamp: BigInt(timestamp),
        });

        escrowDb.release(batchId);
        paymentDb.record({
            batchId,
            fromAddr: escrow.buyerAddr,
            toAddr: escrow.farmerAddr,
            amount: escrow.amount,
            currency: x402Config.assetName || 'ALGO',
            txId,
        });

        await this.updateReputationPayment(escrow.farmerAddr, escrow.amount);

        console.log(`[ContractSupplyService] Released ${escrow.amount} ${x402Config.assetName || 'ALGO'} to farmer ${escrow.farmerAddr} (tx: ${txId})`);
        return { amount: escrow.amount, farmerAddr: escrow.farmerAddr, txId };
    }

    async getEscrow(batchId: string) {
        return escrowDb.get(batchId);
    }

    async getPaymentsByFarmer(farmerAddr: string) {
        const client = await this.getClient();
        const total = Number(await client.getTotalPayments());
        if (total === 0) return [];

        const payments = [] as Array<{ batchId: string; amount: number; currency: string; timestamp: number }>;
        for (let i = 1; i <= total; i += 1) {
            const [owner, batchId, amountRaw, currency, timestampRaw] = await Promise.all([
                client.getPaymentFarmerAddr(BigInt(i)),
                client.getPaymentBatchId(BigInt(i)),
                client.getPaymentAmount(BigInt(i)),
                client.getPaymentCurrency(BigInt(i)),
                client.getPaymentTimestamp(BigInt(i)),
            ]);
            if (!owner || owner !== farmerAddr) continue;
            payments.push({
                batchId: String(batchId || 0n),
                amount: this.fromBaseUnits(Number(amountRaw || 0n)),
                currency: currency || (x402Config.assetName || 'ALGO'),
                timestamp: Number(timestampRaw || 0n),
            });
        }

        return payments.reverse();
    }

    async getPaymentsByBatch(batchId: string) {
        return paymentDb.getByBatch(batchId);
    }

    // ─── Carbon Credit Operations ──────────────────

    async calculateCarbonScore(batchId: string): Promise<{
        score: number; creditsEarned: number; distance: number; transportMethod: string;
    }> {
        const batch = batchDb.get(batchId);
        if (!batch) throw new Error(`Batch ${batchId} not found`);

        const checkpoints = checkpointDb.getAll(batchId);

        // Calculate distance from GPS coordinates
        let totalDistance = 0;
        for (let i = 1; i < checkpoints.length; i++) {
            const prev = checkpoints[i - 1];
            const curr = checkpoints[i];
            if (prev.gps && curr.gps) {
                totalDistance += this.calculateGpsDistance(prev.gps, curr.gps);
            }
        }

        // If no real GPS data, estimate from weight and checkpoint count
        if (totalDistance === 0) {
            totalDistance = 50 + Math.random() * 200; // 50-250 km estimate
        }

        // Determine transport method heuristic
        let transportMethod = 'truck';
        if (totalDistance > 1000) transportMethod = 'ship';
        if (totalDistance > 5000) transportMethod = 'air';

        // Carbon score: 100 = best (short distance, sustainable), 0 = worst
        const distancePenalty = Math.min(totalDistance / 50, 60); // max 60 points lost
        const sustainableBonus = batch.farmingPractices?.toLowerCase().includes('organic') ? 20 : 0;
        const transportPenalty = transportMethod === 'truck' ? 0 : transportMethod === 'ship' ? 10 : 30;
        const score = Math.max(0, Math.min(100, Math.round(100 - distancePenalty - transportPenalty + sustainableBonus)));

        // Credits earned: based on score
        const creditsEarned = parseFloat((score * 0.05).toFixed(2)); // 0-5 credits

        if (!this.isNumericId(batchId)) {
            throw new Error('Carbon score requires an on-chain batch ID');
        }

        const client = await this.getClient();
        const calculatedAt = Math.floor(Date.now() / 1000);
        const creditsScaled = this.toCreditsUnits(creditsEarned);
        await client.updateCarbonScore({
            batchAsaId: BigInt(batchId),
            score: BigInt(score),
            creditsEarned: BigInt(creditsScaled),
            distance: BigInt(Math.round(totalDistance)),
            transportMethod,
            calculatedAt: BigInt(calculatedAt),
        });

        await this.updateReputationCarbon(batch.farmerAddr, creditsEarned);

        console.log(`[ContractSupplyService] Carbon score for batch ${batchId}: ${score}/100, ${creditsEarned} credits`);
        return { score, creditsEarned, distance: Math.round(totalDistance), transportMethod };
    }

    async getCarbonCredit(batchId: string) {
        if (!this.isNumericId(batchId)) return null;
        const client = await this.getClient();
        const [score, credits, distance, transport, calculatedAt] = await Promise.all([
            client.getCarbonScore(BigInt(batchId)),
            client.getCarbonCredits(BigInt(batchId)),
            client.getCarbonDistance(BigInt(batchId)),
            client.getCarbonTransportMethod(BigInt(batchId)),
            client.getCarbonCalculatedAt(BigInt(batchId)),
        ]);

        if (!calculatedAt || calculatedAt === BigInt(0)) return null;

        return {
            batchId,
            farmerAddr: null,
            score: score ? Number(score) : 0,
            creditsEarned: this.fromCreditsUnits(Number(credits || 0n)),
            distance: distance ? Number(distance) : 0,
            transportMethod: transport || 'truck',
        };
    }

    async getCarbonCreditsByFarmer(farmerAddr: string) {
        const batches = await this.getFarmerBatches(farmerAddr);
        const credits = [] as Array<{ batchId: string; score: number; creditsEarned: number; distance: number; transportMethod: string }>;
        for (const batch of batches) {
            const entry = await this.getCarbonCredit(batch.batchId);
            if (entry) {
                credits.push({
                    batchId: batch.batchId,
                    score: entry.score,
                    creditsEarned: entry.creditsEarned,
                    distance: entry.distance,
                    transportMethod: entry.transportMethod,
                });
            }
        }
        return credits;
    }

    // ─── Farmer Reputation Operations ──────────────

    private async ensureFarmerReputation(farmerAddr: string): Promise<void> {
        const existing = await this.getFarmerReputationFromChain(farmerAddr);
        const now = Math.floor(Date.now() / 1000);
        if (!existing) {
            await this.setFarmerReputationOnChain({
                farmerAddr,
                totalBatches: 1,
                verifiedCount: 0,
                flaggedCount: 0,
                tier: 'bronze',
                carbonCreditsTotal: 0,
                totalPaymentsReceived: 0,
                lastUpdated: now,
            });
            return;
        }

        await this.setFarmerReputationOnChain({
            farmerAddr,
            totalBatches: existing.totalBatches + 1,
            verifiedCount: existing.verifiedCount,
            flaggedCount: existing.flaggedCount,
            tier: this.calculateTier(existing.verifiedCount),
            carbonCreditsTotal: existing.carbonCreditsTotal,
            totalPaymentsReceived: existing.totalPaymentsReceived,
            lastUpdated: now,
        });
    }

    async updateReputationOnVerification(batchId: string, result: string): Promise<void> {
        const batch = batchDb.get(batchId);
        if (!batch) return;

        const existing = await this.getFarmerReputationFromChain(batch.farmerAddr);
        const base = existing || {
            totalBatches: 1, verifiedCount: 0, flaggedCount: 0,
            tier: 'bronze', carbonCreditsTotal: 0, totalPaymentsReceived: 0,
        };

        const verifiedCount = base.verifiedCount + (result === 'VERIFIED' ? 1 : 0);
        const flaggedCount = base.flaggedCount + (result === 'FLAGGED' ? 1 : 0);
        const now = Math.floor(Date.now() / 1000);

        await this.setFarmerReputationOnChain({
            farmerAddr: batch.farmerAddr,
            totalBatches: base.totalBatches,
            verifiedCount,
            flaggedCount,
            tier: this.calculateTier(verifiedCount),
            carbonCreditsTotal: base.carbonCreditsTotal,
            totalPaymentsReceived: base.totalPaymentsReceived,
            lastUpdated: now,
        });

        console.log(`[ContractSupplyService] Updated reputation for ${batch.farmerAddr}: ${verifiedCount} verified, ${flaggedCount} flagged`);
    }

    private async updateReputationPayment(farmerAddr: string, amount: number): Promise<void> {
        const existing = await this.getFarmerReputationFromChain(farmerAddr);
        if (!existing) return;
        const now = Math.floor(Date.now() / 1000);
        await this.setFarmerReputationOnChain({
            farmerAddr,
            totalBatches: existing.totalBatches,
            verifiedCount: existing.verifiedCount,
            flaggedCount: existing.flaggedCount,
            tier: existing.tier,
            carbonCreditsTotal: existing.carbonCreditsTotal,
            totalPaymentsReceived: existing.totalPaymentsReceived + amount,
            lastUpdated: now,
        });
    }

    private async updateReputationCarbon(farmerAddr: string, credits: number): Promise<void> {
        const existing = await this.getFarmerReputationFromChain(farmerAddr);
        if (!existing) return;
        const now = Math.floor(Date.now() / 1000);
        await this.setFarmerReputationOnChain({
            farmerAddr,
            totalBatches: existing.totalBatches,
            verifiedCount: existing.verifiedCount,
            flaggedCount: existing.flaggedCount,
            tier: existing.tier,
            carbonCreditsTotal: existing.carbonCreditsTotal + credits,
            totalPaymentsReceived: existing.totalPaymentsReceived,
            lastUpdated: now,
        });
    }

    async getFarmerReputation(farmerAddr: string) {
        return await this.getFarmerReputationFromChain(farmerAddr);
    }

    async getFarmerBatches(farmerAddr: string) {
        const client = await this.getClient();
        const total = await client.getTotalBatches();
        const batches = [] as Array<{ batchId: string; cropType: string; weight: number; createdAt: number }>;
        const totalCount = Number(total);
        for (let i = 1; i <= totalCount; i += 1) {
            const [owner, cropType, weight, createdAt] = await Promise.all([
                client.getBatchFarmerAddr(BigInt(i)),
                client.getBatchCropType(BigInt(i)),
                client.getBatchWeight(BigInt(i)),
                client.getBatchCreatedAt(BigInt(i)),
            ]);
            if (!owner || owner !== farmerAddr) continue;
            batches.push({
                batchId: String(i),
                cropType: cropType || 'Unknown',
                weight: weight ? Number(weight) : 0,
                createdAt: createdAt ? Number(createdAt) : 0,
            });
        }
        return batches;
    }

    private calculateTier(verifiedCount: number): string {
        if (verifiedCount >= 51) return 'gold';
        if (verifiedCount >= 11) return 'silver';
        return 'bronze';
    }

    private toCreditsUnits(value: number): number {
        return Math.round(value * 100);
    }

    private fromCreditsUnits(value: number): number {
        return Math.round(value) / 100;
    }

    private toBaseUnits(value: number): number {
        const decimals = Number.isFinite(x402Config.assetDecimals) ? x402Config.assetDecimals : 6;
        return Math.round(value * Math.pow(10, decimals));
    }

    private fromBaseUnits(value: number): number {
        const decimals = Number.isFinite(x402Config.assetDecimals) ? x402Config.assetDecimals : 6;
        return value / Math.pow(10, decimals);
    }

    private async getFarmerReputationFromChain(farmerAddr: string): Promise<{
        farmerAddr: string;
        totalBatches: number;
        verifiedCount: number;
        flaggedCount: number;
        tier: string;
        carbonCreditsTotal: number;
        totalPaymentsReceived: number;
        lastUpdated: number;
    } | null> {
        const client = await this.getClient();
        const [totalBatches, verifiedCount, flaggedCount, tier, creditsTotal, paymentsTotal, lastUpdated] = await Promise.all([
            client.getFarmerTotalBatches(farmerAddr),
            client.getFarmerVerifiedCount(farmerAddr),
            client.getFarmerFlaggedCount(farmerAddr),
            client.getFarmerTier(farmerAddr),
            client.getFarmerCarbonCreditsTotal(farmerAddr),
            client.getFarmerPaymentsTotal(farmerAddr),
            client.getFarmerLastUpdated(farmerAddr),
        ]);

        const hasAny = (totalBatches || verifiedCount || flaggedCount || creditsTotal || paymentsTotal || lastUpdated || tier) ? true : false;
        if (!hasAny) return null;

        return {
            farmerAddr,
            totalBatches: Number(totalBatches || 0n),
            verifiedCount: Number(verifiedCount || 0n),
            flaggedCount: Number(flaggedCount || 0n),
            tier: tier || 'bronze',
            carbonCreditsTotal: this.fromCreditsUnits(Number(creditsTotal || 0n)),
            totalPaymentsReceived: this.fromBaseUnits(Number(paymentsTotal || 0n)),
            lastUpdated: Number(lastUpdated || 0n),
        };
    }

    private async setFarmerReputationOnChain(params: {
        farmerAddr: string;
        totalBatches: number;
        verifiedCount: number;
        flaggedCount: number;
        tier: string;
        carbonCreditsTotal: number;
        totalPaymentsReceived: number;
        lastUpdated: number;
    }): Promise<void> {
        const client = await this.getClient();
        await client.updateFarmerReputation({
            farmerAddr: params.farmerAddr,
            totalBatches: BigInt(params.totalBatches),
            verifiedCount: BigInt(params.verifiedCount),
            flaggedCount: BigInt(params.flaggedCount),
            tier: params.tier,
            carbonCreditsTotal: BigInt(this.toCreditsUnits(params.carbonCreditsTotal)),
            totalPaymentsReceived: BigInt(this.toBaseUnits(params.totalPaymentsReceived)),
            lastUpdated: BigInt(params.lastUpdated),
        });
    }

    private calculateGpsDistance(gps1: string, gps2: string): number {
        const [lat1, lon1] = gps1.split('|').map(Number);
        const [lat2, lon2] = gps2.split('|').map(Number);
        if (isNaN(lat1) || isNaN(lon1) || isNaN(lat2) || isNaN(lon2)) return 0;
        if (lat1 === 0 && lon1 === 0) return 0;
        if (lat2 === 0 && lon2 === 0) return 0;

        const R = 6371; // Earth's radius in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) ** 2 +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) ** 2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    private buildAlgodClient(): algosdk.Algodv2 {
        const url = new URL(algorandConfig.nodeUrl);
        const server = `${url.protocol}//${url.hostname}`;
        const port = url.port ? Number(url.port) : url.protocol === 'https:' ? 443 : 80;
        return new algosdk.Algodv2('', server, port);
    }

    private getSenderAccount(): algosdk.Account {
        if (!algorandConfig.defaultSenderMnemonic) {
            throw new Error('DEFAULT_SENDER_MNEMONIC is required for escrow release payments');
        }
        return algosdk.mnemonicToSecretKey(algorandConfig.defaultSenderMnemonic);
    }

    private async sendFarmerPayment(amount: number, farmerAddr: string): Promise<string> {
        const algod = this.buildAlgodClient();
        const sender = this.getSenderAccount();
        const params = await algod.getTransactionParams().do();

        const assetId = Number(x402Config.assetId || '0');
        let txn: algosdk.Transaction;

        if (assetId && assetId !== 0) {
            const decimals = Number.isFinite(x402Config.assetDecimals) ? x402Config.assetDecimals : 6;
            const baseUnits = BigInt(Math.round(amount * Math.pow(10, decimals)));
            txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: sender.addr,
                receiver: farmerAddr,
                assetIndex: assetId,
                amount: baseUnits,
                suggestedParams: params,
            });
        } else {
            const microAlgos = BigInt(Math.round(amount * 1_000_000));
            txn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
                sender: sender.addr,
                receiver: farmerAddr,
                amount: microAlgos,
                suggestedParams: params,
            });
        }

        const signed = txn.signTxn(sender.sk);
        const response = await algod.sendRawTransaction(signed).do();
        const txId = (response as unknown as { txId: string }).txId;
        await algosdk.waitForConfirmation(algod, txId, 4);
        return txId;
    }
}
