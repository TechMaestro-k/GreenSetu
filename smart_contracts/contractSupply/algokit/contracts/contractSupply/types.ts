export type VerificationResult = "VERIFIED" | "FLAGGED";

export interface VerificationRecord {
    batchAsaId: uint64;
    result: VerificationResult;
    confidence: uint64;
    reason: string;
    verifierAddr: string;
    timestamp: uint64;
}
