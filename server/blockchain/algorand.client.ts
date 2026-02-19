import { VerificationRecord } from "../types/verification.types.js";

export interface AlgorandClientAdapter {
    submitVerification(record: VerificationRecord): Promise<void>;
}

export class NoopAlgorandClientAdapter implements AlgorandClientAdapter {
    async submitVerification(_record: VerificationRecord): Promise<void> {
        return;
    }
}
