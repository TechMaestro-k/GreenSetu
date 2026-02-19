import { VerificationRecord, VerificationResult, BatchDetailsResponse } from "../types/verification.types.js";
import { ContractSupplyService } from "../services/contract-supply.service.js";

export interface IndexerClientAdapter {
    getVerification(batchAsaId: string): Promise<VerificationRecord | null>;
    getBatchDetails(batchAsaId: string): Promise<BatchDetailsResponse | null>;
}

export class NoopIndexerClientAdapter implements IndexerClientAdapter {
    async getVerification(_batchAsaId: string): Promise<VerificationRecord | null> {
        return null;
    }
    async getBatchDetails(_batchAsaId: string): Promise<BatchDetailsResponse | null> {
        return null;
    }
}

export class ContractIndexerClientAdapter implements IndexerClientAdapter {
    constructor(private contractService: ContractSupplyService) { }

    /**
     * Single efficient lookup — uses getVerificationRecord() which checks
     * in-memory first, then contract as one call (not 5 separate calls)
     */
    async getVerification(batchAsaId: string): Promise<VerificationRecord | null> {
        try {
            return await this.contractService.getVerificationRecord(batchAsaId);
        } catch (error) {
            console.error(`Error fetching verification for batch ${batchAsaId}:`, error);
            return null;
        }
    }

    /**
     * Full batch details including checkpoints, handoffs, and verification
     */
    async getBatchDetails(batchAsaId: string): Promise<BatchDetailsResponse | null> {
        try {
            const batch = await this.contractService.getBatchDetails(batchAsaId);
            if (!batch) return null;

            const [verification, checkpoints, handoffs] = await Promise.all([
                this.contractService.getVerificationRecord(batchAsaId),
                this.contractService.getCheckpoints(batchAsaId),
                this.contractService.getHandoffs(batchAsaId),
            ]);

            return {
                batchId: batchAsaId,
                cropType: batch.cropType,
                weight: batch.weight,
                farmGps: batch.farmGps,
                farmingPractices: batch.farmingPractices ?? null,
                organicCertId: batch.organicCertId ?? null,
                farmerAddr: batch.farmerAddr,
                createdAt: batch.createdAt ?? null,
                checkpointCount: batch.checkpointCount,
                handoffCount: batch.handoffCount,
                verification,
                checkpoints,
                handoffs,
            };
        } catch (error) {
            console.error(`Error fetching batch details for ${batchAsaId}:`, error);
            return null;
        }
    }
}
