export type BatchAsaId = uint64;
export type Address = string;

export type HandlerType = "farmer" | "transporter" | "warehouse" | "retailer";
export type HandoffType =
    | "farmer_to_transporter"
    | "transporter_to_warehouse"
    | "warehouse_to_retailer";

export interface BatchCreateInput {
    cropType: string;
    weight: uint64;
    farmGps: string;
    organicCertId: string;
    farmerAddr: Address;
}

export interface BatchInfo extends BatchCreateInput {
    batchAsaId: BatchAsaId;
}

// Stored view types for Phase 1 (stringified numbers).
export interface BatchInfoStored {
    batchAsaId: BatchAsaId;
    cropType: string;
    weight: uint64;
    farmGps: string;
    organicCertId: string;
    farmerAddr: Address;
}

export const EMPTY_BATCH_INFO: BatchInfoStored = {
    batchAsaId: 0,
    cropType: "",
    weight: 0,
    farmGps: "",
    organicCertId: "",
    farmerAddr: "",
};


export interface CheckpointInput {
    batchAsaId: BatchAsaId;
    gpsLat: string;
    gpsLng: string;
    temperature: uint64;
    humidity: uint64;
    handlerType: HandlerType;
    notes: string;
    photoHash: string;
}

export interface CheckpointStored {
    batchAsaId: BatchAsaId;
    gpsLat: string;
    gpsLng: string;
    temperature: uint64;
    humidity: uint64;
    handlerType: HandlerType;
    notes: string;
    photoHash: string;
}

export interface HandoffInitiateInput {
    batchAsaId: BatchAsaId;
    fromAddr: Address;
    toAddr: Address;
    handoffType: HandoffType;
}

export interface HandoffStored {
    batchAsaId: BatchAsaId;
    fromAddr: Address;
    toAddr: Address;
    handoffType: HandoffType;
    status: string;
}

export const EMPTY_HANDOFF: HandoffStored = {
    batchAsaId: 0,
    fromAddr: "",
    toAddr: "",
    handoffType: "farmer_to_transporter",
    status: "",
};


export interface HandoffConfirmInput {
    batchAsaId: BatchAsaId;
    handoffIndex: uint64;
}
