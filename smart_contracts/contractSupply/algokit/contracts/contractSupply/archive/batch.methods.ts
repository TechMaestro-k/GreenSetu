import type { BatchAsaId, BatchCreateInput, BatchInfo } from "./types";
import { saveBatchInfo } from "./storage";

const totalBatches = GlobalStateKey<uint64>({ key: "totalBatches" });

export function handleCreateBatch(input: BatchCreateInput): BatchAsaId {
    const current = totalBatches.exists ? totalBatches.value : 0;
    const nextId = current + 1;

    const batch: BatchInfo = {
        batchAsaId: nextId,
        cropType: input.cropType,
        weight: input.weight,
        farmGps: input.farmGps,
        organicCertId: input.organicCertId,
        farmerAddr: input.farmerAddr,
    };

    totalBatches.value = nextId;
    saveBatchInfo(batch);

    return nextId;
}
