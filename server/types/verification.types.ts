export type VerificationResult = "VERIFIED" | "FLAGGED";

export interface VerificationRequest {
    batchAsaId: string;
    evidence?: Record<string, unknown>;
    verifierAddr?: string;
    timestamp?: number;
}

export interface VerificationRecord {
    batchAsaId: string;
    result: VerificationResult;
    confidence: number;
    reason: string;
    verifierAddr: string;
    timestamp: number;
}

export interface PaymentReceipt {
    amount: number;
    assetId?: number;
    txId?: string;
    timestamp: number;
}

export interface VerificationResponse {
    verification: VerificationRecord;
    payment?: PaymentReceipt;
}

export interface VerificationStatusResponse {
    verification?: VerificationRecord;
}

// ─── Supply Chain Types ────────────────────────────

export interface CreateBatchRequest {
    cropType: string;
    weight: number;
    farmGps: string;
    farmingPractices: string;
    organicCertId: string;
    farmerAddr: string;
}

export interface CreateBatchResponse {
    batchId: string;
    message: string;
    qrCode?: string;
}

export interface LogCheckpointRequest {
    batchAsaId: string;
    gpsLat: string;
    gpsLng: string;
    temperature: number;
    humidity: number;
    handlerType: string;
    notes: string;
    photoHash: string;
}

export interface LogCheckpointResponse {
    batchAsaId: string;
    checkpointIndex: number;
    message: string;
}

export interface InitiateHandoffRequest {
    batchAsaId: string;
    fromAddr: string;
    toAddr: string;
    handoffType: string;
    handoffPhotoHashes: string;
}

export interface ConfirmHandoffRequest {
    batchAsaId: string;
    handoffIndex: number;
}

export interface HandoffResponse {
    batchAsaId: string;
    message: string;
}

export interface BatchDetailsResponse {
    batchId: string;
    cropType: string | null;
    weight: number | null;
    farmGps: string | null;
    farmingPractices?: string | null;
    organicCertId?: string | null;
    farmerAddr: string | null;
    createdAt?: number | null;
    checkpointCount: number;
    handoffCount: number;
    verification: VerificationRecord | null;
    checkpoints: CheckpointRecord[];
    handoffs: HandoffRecord[];
}

export interface CheckpointRecord {
    index: number;
    gps: string | null;
    temperature: number | null;
    humidity?: number | null;
    handlerType: string | null;
    notes?: string | null;
    photoHash?: string | null;
    timestamp: number | null;
}

export interface HandoffRecord {
    index: number;
    status: string | null;
    fromAddr?: string | null;
    toAddr?: string | null;
    handoffType?: string | null;
    confirmedAt?: number | null;
}

// ─── Escrow / Payment Types ────────────────────────

export interface FundEscrowRequest {
    batchId: string;
    buyerAddr: string;
    amount: number;
}

export interface EscrowResponse {
    batchId: string;
    status: string;
    amount: number;
    farmerAddr: string;
}

export interface ReleasePaymentResponse {
    batchId: string;
    amount: number;
    farmerAddr: string;
    txId: string;
    message: string;
}

// ─── Carbon Credit Types ───────────────────────────

export interface CarbonScoreResponse {
    batchId: string;
    score: number;
    creditsEarned: number;
    distance: number;
    transportMethod: string;
}

// ─── Farmer Reputation Types ───────────────────────

export interface FarmerReputationResponse {
    farmerAddr: string;
    totalBatches: number;
    verifiedCount: number;
    flaggedCount: number;
    tier: string;
    tierEmoji: string;
    carbonCreditsTotal: number;
    totalPaymentsReceived: number;
    batches: Array<{ batchId: string; cropType: string; weight: number; createdAt: number }>;
    payments: Array<{ batchId: string; amount: number; currency: string; timestamp: number }>;
}
