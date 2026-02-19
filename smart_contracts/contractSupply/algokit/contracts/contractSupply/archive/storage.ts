import type {
    BatchAsaId,
    BatchInfo,
    BatchInfoStored,
    CheckpointInput,
    CheckpointStored,
    HandoffConfirmInput,
    HandoffInitiateInput,
    HandoffStored,
} from "./types";
import { EMPTY_BATCH_INFO, EMPTY_HANDOFF } from "./types";

// Storage-only helpers. Implementations must avoid business logic.
// All BoxMaps use uint64 keys to avoid TEALScript ValueType resolution issues.
// Checkpoint/handoff use packed key: batchAsaId * 10000 + index.

const MAX_INDEX = 10000;

// Batch storage: one delimited-string box per batch
const batchBox = BoxMap<BatchAsaId, string>({ prefix: "b" });
const checkpointCountBox = BoxMap<BatchAsaId, uint64>({ prefix: "cpn" });
const handoffCountBox = BoxMap<BatchAsaId, uint64>({ prefix: "hon" });

// Checkpoint storage: one delimited-string box per checkpoint
const checkpointBox = BoxMap<uint64, string>({ prefix: "cp" });

// Handoff storage: one delimited-string box per handoff
const handoffBox = BoxMap<uint64, string>({ prefix: "ho" });

function packedKey(batchAsaId: BatchAsaId, index: uint64): uint64 {
    return batchAsaId * MAX_INDEX + index;
}

// ---------- Batch ----------

export function saveBatchInfo(batch: BatchInfo): void {
    batchBox(batch.batchAsaId).value = `${batch.cropType}|${batch.weight}|${batch.farmGps}|${batch.organicCertId}|${batch.farmerAddr}`;
}

export function fetchBatch(batchAsaId: BatchAsaId): BatchInfoStored {
    const entry = batchBox(batchAsaId);
    if (!entry.exists) return EMPTY_BATCH_INFO;
    return {
        batchAsaId,
        cropType: entry.value,
        weight: 0,
        farmGps: "",
        organicCertId: "",
        farmerAddr: "",
    };
}

// ---------- Checkpoint ----------

export function saveCheckpoint(checkpoint: CheckpointInput, index: uint64): void {
    const pk = packedKey(checkpoint.batchAsaId, index);
    checkpointBox(pk).value = `${checkpoint.gpsLat}|${checkpoint.gpsLng}|${checkpoint.temperature}|${checkpoint.humidity}|${checkpoint.handlerType}|${checkpoint.notes}|${checkpoint.photoHash}`;
}

export function getCheckpointCount(batchAsaId: BatchAsaId): uint64 {
    const entry = checkpointCountBox(batchAsaId);
    return entry.exists ? entry.value : 0;
}

export function setCheckpointCount(batchAsaId: BatchAsaId, count: uint64): void {
    checkpointCountBox(batchAsaId).value = count;
}

export function fetchCheckpoints(batchAsaId: BatchAsaId): CheckpointStored[] {
    const count = getCheckpointCount(batchAsaId);
    const results: CheckpointStored[] = [];

    let i: uint64 = 1;
    while (i <= count) {
        const pk = packedKey(batchAsaId, i);
        const entry = checkpointBox(pk);
        if (entry.exists) {
            results.push({
                batchAsaId,
                gpsLat: entry.value,
                gpsLng: "",
                temperature: 0,
                humidity: 0,
                handlerType: "farmer",
                notes: "",
                photoHash: "",
            });
        }
        i = i + 1;
    }

    return results;
}

// ---------- Handoff ----------

export function saveHandoff(handoff: HandoffInitiateInput): void {
    const index = getHandoffCount(handoff.batchAsaId) + 1;
    setHandoffCount(handoff.batchAsaId, index);
    const pk = packedKey(handoff.batchAsaId, index);
    handoffBox(pk).value = `${handoff.fromAddr}|${handoff.toAddr}|${handoff.handoffType}|pending`;
}

export function applyHandoffConfirmation(handoff: HandoffConfirmInput): void {
    const pk = packedKey(handoff.batchAsaId, handoff.handoffIndex);
    // Use setter pattern directly to avoid ValueType resolution issues
    handoffBox(pk).value = "confirmed";
}

export function getHandoffCount(batchAsaId: BatchAsaId): uint64 {
    const entry = handoffCountBox(batchAsaId);
    return entry.exists ? entry.value : 0;
}

export function setHandoffCount(batchAsaId: BatchAsaId, count: uint64): void {
    handoffCountBox(batchAsaId).value = count;
}

export function fetchHandoff(batchAsaId: BatchAsaId, handoffIndex: uint64): HandoffStored {
    const count = getHandoffCount(batchAsaId);
    if (handoffIndex > count) return EMPTY_HANDOFF;
    if (handoffIndex === 0) return EMPTY_HANDOFF;
    const pk = packedKey(batchAsaId, handoffIndex);

    return {
        batchAsaId,
        fromAddr: handoffBox(pk).value,
        toAddr: "",
        handoffType: "farmer_to_transporter",
        status: "pending",
    };
}
