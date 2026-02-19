import type { HandoffConfirmInput, HandoffInitiateInput } from "./types";
import { applyHandoffConfirmation, fetchBatch, saveHandoff } from "./storage";

export function handleInitiateHandoff(input: HandoffInitiateInput): void {
    if (fetchBatch(input.batchAsaId).batchAsaId === 0) throw new Error("Batch not found");
    saveHandoff(input);
}

export function handleConfirmHandoff(input: HandoffConfirmInput): void {
    if (fetchBatch(input.batchAsaId).batchAsaId === 0) throw new Error("Batch not found");
    applyHandoffConfirmation(input);
}
