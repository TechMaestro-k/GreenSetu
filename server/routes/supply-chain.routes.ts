import { HttpRequest, HttpResponse } from "../types/http.types.js";
import {
    CreateBatchRequest,
    CreateBatchResponse,
    LogCheckpointRequest,
    LogCheckpointResponse,
    InitiateHandoffRequest,
    ConfirmHandoffRequest,
    HandoffResponse,
    BatchDetailsResponse,
    FundEscrowRequest,
    EscrowResponse,
    ReleasePaymentResponse,
    CarbonScoreResponse,
    FarmerReputationResponse,
} from "../types/verification.types.js";
import { ContractSupplyService } from "../services/contract-supply.service.js";
import { IndexerClientAdapter } from "../blockchain/indexer.client.js";
import QRCode from "qrcode";

export interface SupplyChainRouteDeps {
    contractService: ContractSupplyService;
    indexer: IndexerClientAdapter;
}

function getTierEmoji(tier: string): string {
    if (tier === 'gold') return 'gold-medal';
    if (tier === 'silver') return 'silver-medal';
    return 'bronze-medal';
}

// ─── POST /batch ───────────────────────────────────

export async function postCreateBatch(
    req: HttpRequest<CreateBatchRequest>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<CreateBatchResponse | { error: string }>> {
    const { cropType, weight, farmGps, farmingPractices, organicCertId, farmerAddr } = req.body;

    if (!cropType || !farmGps || !farmerAddr) {
        return { status: 400, body: { error: "cropType, farmGps, and farmerAddr are required" } };
    }
    if (typeof weight !== 'number' || weight <= 0) {
        return { status: 400, body: { error: "weight must be a positive number" } };
    }

    try {
        const result = await deps.contractService.createBatch({
            cropType, weight, farmGps,
            farmingPractices: farmingPractices || '',
            organicCertId: organicCertId || '',
            farmerAddr,
        });

        // Generate QR code for the product journey page
        const origin = process.env.FRONTEND_URL || 'http://localhost:3000';
        const productUrl = `${origin}/product/${result.id}`;
        let qrCodeDataUrl: string | undefined;

        try {
            qrCodeDataUrl = await QRCode.toDataURL(productUrl, {
                width: 256,
                margin: 2,
                color: {
                    dark: '#10b981',  // Green color matching theme
                    light: '#ffffff'
                }
            });
        } catch (qrErr) {
            console.error('Failed to generate QR code:', qrErr);
        }

        return {
            status: 201,
            body: {
                batchId: result.id,
                message: `Batch ${result.id} created successfully${result.onChain ? '' : ' (stored locally — on-chain write failed)'}`,
                qrCode: qrCodeDataUrl,
            },
        };
    } catch (error) {
        console.error("Error creating batch:", error);
        return { status: 500, body: { error: `Failed to create batch: ${error}` } };
    }
}

// ─── POST /checkpoint ──────────────────────────────

export async function postLogCheckpoint(
    req: HttpRequest<LogCheckpointRequest>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<LogCheckpointResponse | { error: string }>> {
    const { batchAsaId, gpsLat, gpsLng, temperature, humidity, handlerType, notes, photoHash } = req.body;

    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    // Validate batch exists
    const exists = await deps.contractService.hasBatch(batchAsaId);
    if (!exists) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    try {
        const checkpointIndex = await deps.contractService.logCheckpoint({
            batchAsaId,
            gpsLat: gpsLat || '0',
            gpsLng: gpsLng || '0',
            temperature: temperature ?? 0,
            humidity: humidity ?? 0,
            handlerType: handlerType || 'unknown',
            notes: notes || '',
            photoHash: photoHash || '',
        });

        return {
            status: 201,
            body: {
                batchAsaId,
                checkpointIndex,
                message: `Checkpoint ${checkpointIndex} logged for batch ${batchAsaId}`,
            },
        };
    } catch (error) {
        console.error("Error logging checkpoint:", error);
        return { status: 500, body: { error: `Failed to log checkpoint: ${error}` } };
    }
}

// ─── POST /handoff/initiate ────────────────────────

export async function postInitiateHandoff(
    req: HttpRequest<InitiateHandoffRequest>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<HandoffResponse | { error: string }>> {
    const { batchAsaId, fromAddr, toAddr, handoffType, handoffPhotoHashes } = req.body;

    if (!batchAsaId || !fromAddr || !toAddr) {
        return { status: 400, body: { error: "batchAsaId, fromAddr, and toAddr are required" } };
    }

    const exists = await deps.contractService.hasBatch(batchAsaId);
    if (!exists) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    try {
        const index = await deps.contractService.initiateHandoff({
            batchAsaId, fromAddr, toAddr,
            handoffType: handoffType || 'transfer',
            handoffPhotoHashes: handoffPhotoHashes || '',
        });

        return {
            status: 201,
            body: {
                batchAsaId,
                message: `Handoff ${index} initiated from ${fromAddr} to ${toAddr}`,
            },
        };
    } catch (error) {
        console.error("Error initiating handoff:", error);
        return { status: 500, body: { error: `Failed to initiate handoff: ${error}` } };
    }
}

// ─── POST /handoff/confirm ─────────────────────────

export async function postConfirmHandoff(
    req: HttpRequest<ConfirmHandoffRequest>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<HandoffResponse | { error: string }>> {
    const { batchAsaId, handoffIndex } = req.body;

    if (!batchAsaId || typeof handoffIndex !== 'number' || handoffIndex < 1) {
        return { status: 400, body: { error: "batchAsaId and valid handoffIndex (>= 1) are required" } };
    }

    const exists = await deps.contractService.hasBatch(batchAsaId);
    if (!exists) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    try {
        await deps.contractService.confirmHandoff({ batchAsaId, handoffIndex });

        return {
            status: 200,
            body: {
                batchAsaId,
                message: `Handoff ${handoffIndex} confirmed for batch ${batchAsaId}`,
            },
        };
    } catch (error) {
        console.error("Error confirming handoff:", error);
        return { status: 500, body: { error: `Failed to confirm handoff: ${error}` } };
    }
}

// ─── GET /handoff/confirm/transaction/:batchAsaId/:handoffIndex ───

export async function getConfirmHandoffTransaction(
    req: HttpRequest<unknown, { batchAsaId: string; handoffIndex: string }>,
): Promise<HttpResponse<{ batchAsaId: string; handoffIndex: number; message: string } | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    const handoffIndexStr = req.params?.handoffIndex?.trim();

    if (!batchAsaId || !handoffIndexStr) {
        return { status: 400, body: { error: "batchAsaId and handoffIndex are required" } };
    }

    const handoffIndex = parseInt(handoffIndexStr, 10);
    if (isNaN(handoffIndex) || handoffIndex < 1) {
        return { status: 400, body: { error: "handoffIndex must be a positive integer" } };
    }

    return {
        status: 200,
        body: {
            batchAsaId,
            handoffIndex,
            message: `Transaction info for confirming handoff ${handoffIndex} on batch ${batchAsaId}. Use POST /handoff/confirm to execute.`,
        },
    };
}

// ─── GET /batch/:batchAsaId ────────────────────────

export async function getBatchDetails(
    req: HttpRequest<unknown, { batchAsaId: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<BatchDetailsResponse | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    const details = await deps.indexer.getBatchDetails(batchAsaId);
    if (!details) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    return { status: 200, body: details };
}

// ─── POST /batch/:batchAsaId/escrow/fund ──────────

export async function postFundEscrow(
    req: HttpRequest<FundEscrowRequest, { batchAsaId: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<EscrowResponse | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    const { buyerAddr, amount, batchId } = req.body || {};
    if (batchId && batchId !== batchAsaId) {
        return { status: 400, body: { error: "batchId must match URL param" } };
    }
    if (!buyerAddr || typeof buyerAddr !== 'string') {
        return { status: 400, body: { error: "buyerAddr is required" } };
    }
    if (typeof amount !== 'number' || amount <= 0) {
        return { status: 400, body: { error: "amount must be a positive number" } };
    }

    const exists = await deps.contractService.hasBatch(batchAsaId);
    if (!exists) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    try {
        await deps.contractService.fundEscrow(batchAsaId, buyerAddr, amount);
        const escrow = await deps.contractService.getEscrow(batchAsaId);
        if (!escrow) {
            return { status: 500, body: { error: "Escrow created but not found" } };
        }
        return {
            status: 201,
            body: {
                batchId: batchAsaId,
                status: escrow.status,
                amount: escrow.amount,
                farmerAddr: escrow.farmerAddr,
            },
        };
    } catch (error) {
        console.error("Error funding escrow:", error);
        return { status: 500, body: { error: `Failed to fund escrow: ${error}` } };
    }
}

// ─── POST /batch/:batchAsaId/escrow/release ───────

export async function postReleaseEscrow(
    req: HttpRequest<unknown, { batchAsaId: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<ReleasePaymentResponse | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    try {
        const result = await deps.contractService.releaseFarmerPayment(batchAsaId);
        return {
            status: 200,
            body: {
                batchId: batchAsaId,
                amount: result.amount,
                farmerAddr: result.farmerAddr,
                txId: result.txId,
                message: `Payment released to farmer for batch ${batchAsaId}`,
            },
        };
    } catch (error) {
        console.error("Error releasing escrow:", error);
        const message = String(error);
        if (message.includes('not found')) {
            return { status: 404, body: { error: message } };
        }
        return { status: 500, body: { error: `Failed to release payment: ${error}` } };
    }
}

// ─── GET /batch/:batchAsaId/carbon ────────────────

export async function getCarbonScore(
    req: HttpRequest<unknown, { batchAsaId: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<CarbonScoreResponse | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    try {
        const existing = await deps.contractService.getCarbonCredit(batchAsaId);
        const result = existing || await deps.contractService.calculateCarbonScore(batchAsaId);
        return {
            status: 200,
            body: {
                batchId: batchAsaId,
                score: result.score,
                creditsEarned: result.creditsEarned,
                distance: result.distance,
                transportMethod: result.transportMethod,
            },
        };
    } catch (error) {
        console.error("Error getting carbon score:", error);
        const message = String(error);
        if (message.includes('not found')) {
            return { status: 404, body: { error: message } };
        }
        return { status: 500, body: { error: `Failed to fetch carbon score: ${error}` } };
    }
}

// ─── GET /farmer/:farmerAddr/reputation ───────────

export async function getFarmerReputation(
    req: HttpRequest<unknown, { farmerAddr: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<FarmerReputationResponse | { error: string }>> {
    const farmerAddr = req.params?.farmerAddr?.trim();
    if (!farmerAddr) {
        return { status: 400, body: { error: "farmerAddr is required" } };
    }

    try {
        const reputation = await deps.contractService.getFarmerReputation(farmerAddr);
        if (!reputation) {
            return { status: 404, body: { error: `No reputation found for ${farmerAddr}` } };
        }

        const batches = await deps.contractService.getFarmerBatches(farmerAddr);
        const payments = await deps.contractService.getPaymentsByFarmer(farmerAddr);

        return {
            status: 200,
            body: {
                farmerAddr,
                totalBatches: reputation.totalBatches,
                verifiedCount: reputation.verifiedCount,
                flaggedCount: reputation.flaggedCount,
                tier: reputation.tier,
                tierEmoji: getTierEmoji(reputation.tier),
                carbonCreditsTotal: reputation.carbonCreditsTotal,
                totalPaymentsReceived: reputation.totalPaymentsReceived,
                batches: (batches || []).map((b) => ({
                    batchId: b.batchId,
                    cropType: b.cropType,
                    weight: b.weight,
                    createdAt: b.createdAt,
                })),
                payments: (payments || []).map((p) => ({
                    batchId: p.batchId,
                    amount: p.amount,
                    currency: p.currency,
                    timestamp: p.timestamp,
                })),
            },
        };
    } catch (error) {
        console.error("Error getting farmer reputation:", error);
        return { status: 500, body: { error: `Failed to fetch reputation: ${error}` } };
    }
}

// ─── GET /farmer/:farmerAddr/payments ─────────────

export async function getFarmerPayments(
    req: HttpRequest<unknown, { farmerAddr: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<{ farmerAddr: string; payments: Array<{ batchId: string; amount: number; currency: string; timestamp: number }> } | { error: string }>> {
    const farmerAddr = req.params?.farmerAddr?.trim();
    if (!farmerAddr) {
        return { status: 400, body: { error: "farmerAddr is required" } };
    }

    try {
        const payments = await deps.contractService.getPaymentsByFarmer(farmerAddr);
        return {
            status: 200,
            body: {
                farmerAddr,
                payments: (payments || []).map((p) => ({
                    batchId: p.batchId,
                    amount: p.amount,
                    currency: p.currency,
                    timestamp: p.timestamp,
                })),
            },
        };
    } catch (error) {
        console.error("Error getting farmer payments:", error);
        return { status: 500, body: { error: `Failed to fetch payments: ${error}` } };
    }
}

// ─── GET /farmer/:farmerAddr/batches ──────────────

export async function getFarmerBatches(
    req: HttpRequest<unknown, { farmerAddr: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<{ farmerAddr: string; batches: Array<{ batchId: string; cropType: string; weight: number; createdAt: number }> } | { error: string }>> {
    const farmerAddr = req.params?.farmerAddr?.trim();
    if (!farmerAddr) {
        return { status: 400, body: { error: "farmerAddr is required" } };
    }

    try {
        const batches = await deps.contractService.getFarmerBatches(farmerAddr);
        return {
            status: 200,
            body: {
                farmerAddr,
                batches: (batches || []).map((b) => ({
                    batchId: b.batchId,
                    cropType: b.cropType,
                    weight: b.weight,
                    createdAt: b.createdAt,
                })),
            },
        };
    } catch (error) {
        console.error("Error getting farmer batches:", error);
        return { status: 500, body: { error: `Failed to fetch batches: ${error}` } };
    }
}

// ─── POST /batch/:batchAsaId/mint ──────────────────

export interface MintBatchRequest {
    metadataHash: string;
}

export async function postMintBatchAsa(
    req: HttpRequest<MintBatchRequest, { batchAsaId: string }>,
    deps: SupplyChainRouteDeps,
): Promise<HttpResponse<{ batchAsaId: string; assetId: string; message: string } | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    const metadataHash = req.body?.metadataHash?.trim();
    if (!metadataHash) {
        return { status: 400, body: { error: "metadataHash is required" } };
    }

    const exists = await deps.contractService.hasBatch(batchAsaId);
    if (!exists) {
        return { status: 404, body: { error: `Batch ${batchAsaId} not found` } };
    }

    try {
        const result = await deps.contractService.mintBatchAsa(batchAsaId, metadataHash);
        return {
            status: 201,
            body: {
                batchAsaId,
                assetId: result.assetId,
                message: `NFT minted for batch ${batchAsaId}. ASA ID: ${result.assetId}`,
            },
        };
    } catch (error) {
        console.error("Error minting batch ASA:", error);
        return { status: 500, body: { error: `Failed to mint batch NFT: ${error}` } };
    }
}
