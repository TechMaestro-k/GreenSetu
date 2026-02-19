import type { CheckpointInput } from "./types";
import { fetchBatch, getCheckpointCount, saveCheckpoint, setCheckpointCount } from "./storage";

export function handleLogCheckpoint(input: CheckpointInput): void {
    if (fetchBatch(input.batchAsaId).batchAsaId === 0) throw new Error("Batch not found");
    const current = getCheckpointCount(input.batchAsaId);
    const nextIndex = current + 1;

    setCheckpointCount(input.batchAsaId, nextIndex);
    saveCheckpoint(input, nextIndex);
}
