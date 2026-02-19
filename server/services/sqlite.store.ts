/**
 * SQLite-backed persistence for verification records, batches, checkpoints, and handoffs.
 *
 * Uses better-sqlite3 for synchronous, fast, zero-config storage.
 * Data survives server restarts. File stored at server/data/chainverify.db
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { mkdirSync } from 'fs';
import type { VerificationRecord, CheckpointRecord, HandoffRecord } from '../types/verification.types.js';
import type { IVerificationStore } from './verification.store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = process.env.SQLITE_DB_PATH || join(__dirname, '..', 'data', 'chainverify.db');

// Ensure data directory exists
mkdirSync(dirname(DB_PATH), { recursive: true });

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

// ─── Schema ─────────────────────────────────────────

db.exec(`
    CREATE TABLE IF NOT EXISTS verifications (
        batchAsaId TEXT PRIMARY KEY,
        result TEXT NOT NULL,
        confidence INTEGER NOT NULL,
        reason TEXT NOT NULL,
        verifierAddr TEXT NOT NULL,
        timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS batches (
        batchId TEXT PRIMARY KEY,
        cropType TEXT NOT NULL,
        weight REAL NOT NULL,
        farmGps TEXT NOT NULL,
        farmingPractices TEXT NOT NULL DEFAULT '',
        organicCertId TEXT NOT NULL DEFAULT '',
        farmerAddr TEXT NOT NULL,
        createdAt INTEGER NOT NULL,
        checkpointCount INTEGER NOT NULL DEFAULT 0,
        handoffCount INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS checkpoints (
        batchAsaId TEXT NOT NULL,
        idx INTEGER NOT NULL,
        gps TEXT,
        temperature REAL,
        humidity REAL,
        handlerType TEXT,
        notes TEXT,
        photoHash TEXT,
        timestamp INTEGER,
        PRIMARY KEY (batchAsaId, idx)
    );

    CREATE TABLE IF NOT EXISTS handoffs (
        batchAsaId TEXT NOT NULL,
        idx INTEGER NOT NULL,
        status TEXT,
        fromAddr TEXT,
        toAddr TEXT,
        handoffType TEXT,
        confirmedAt INTEGER,
        PRIMARY KEY (batchAsaId, idx)
    );

    CREATE TABLE IF NOT EXISTS escrows (
        batchId TEXT PRIMARY KEY,
        buyerAddr TEXT NOT NULL,
        farmerAddr TEXT NOT NULL,
        amount REAL NOT NULL,
        status TEXT NOT NULL DEFAULT 'funded',
        createdAt INTEGER NOT NULL,
        releasedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        batchId TEXT NOT NULL,
        fromAddr TEXT NOT NULL,
        toAddr TEXT NOT NULL,
        amount REAL NOT NULL,
        currency TEXT NOT NULL DEFAULT 'tUSDCa',
        txId TEXT,
        timestamp INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS carbon_credits (
        batchId TEXT PRIMARY KEY,
        farmerAddr TEXT NOT NULL,
        score INTEGER NOT NULL,
        creditsEarned REAL NOT NULL,
        distance REAL NOT NULL,
        transportMethod TEXT NOT NULL DEFAULT 'truck',
        calculatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS farmer_reputation (
        farmerAddr TEXT PRIMARY KEY,
        totalBatches INTEGER NOT NULL DEFAULT 0,
        verifiedCount INTEGER NOT NULL DEFAULT 0,
        flaggedCount INTEGER NOT NULL DEFAULT 0,
        tier TEXT NOT NULL DEFAULT 'bronze',
        carbonCreditsTotal REAL NOT NULL DEFAULT 0,
        totalPaymentsReceived REAL NOT NULL DEFAULT 0,
        lastUpdated INTEGER NOT NULL
    );
`);

const ensureColumn = (table: string, columnDef: string) => {
    try {
        db.exec(`ALTER TABLE ${table} ADD COLUMN ${columnDef}`);
    } catch {
        // ignore if column already exists
    }
};

ensureColumn('checkpoints', 'humidity REAL');
ensureColumn('checkpoints', 'notes TEXT');
ensureColumn('checkpoints', 'photoHash TEXT');
ensureColumn('handoffs', 'fromAddr TEXT');
ensureColumn('handoffs', 'toAddr TEXT');
ensureColumn('handoffs', 'handoffType TEXT');
ensureColumn('handoffs', 'confirmedAt INTEGER');

// ─── Prepared Statements ────────────────────────────

const stmts = {
    // Verifications
    upsertVerification: db.prepare(`
        INSERT OR REPLACE INTO verifications (batchAsaId, result, confidence, reason, verifierAddr, timestamp)
        VALUES (@batchAsaId, @result, @confidence, @reason, @verifierAddr, @timestamp)
    `),
    getVerification: db.prepare(`SELECT * FROM verifications WHERE batchAsaId = ?`),
    getAllVerifications: db.prepare(`SELECT * FROM verifications ORDER BY timestamp DESC`),
    countVerifications: db.prepare(`SELECT COUNT(*) as count FROM verifications`),

    // Batches
    upsertBatch: db.prepare(`
        INSERT OR REPLACE INTO batches (batchId, cropType, weight, farmGps, farmingPractices, organicCertId, farmerAddr, createdAt, checkpointCount, handoffCount)
        VALUES (@batchId, @cropType, @weight, @farmGps, @farmingPractices, @organicCertId, @farmerAddr, @createdAt, @checkpointCount, @handoffCount)
    `),
    getBatch: db.prepare(`SELECT * FROM batches WHERE batchId = ?`),
    updateBatchCheckpointCount: db.prepare(`UPDATE batches SET checkpointCount = ? WHERE batchId = ?`),
    updateBatchHandoffCount: db.prepare(`UPDATE batches SET handoffCount = ? WHERE batchId = ?`),

    // Checkpoints
    upsertCheckpoint: db.prepare(`
        INSERT OR REPLACE INTO checkpoints (batchAsaId, idx, gps, temperature, humidity, handlerType, notes, photoHash, timestamp)
        VALUES (@batchAsaId, @idx, @gps, @temperature, @humidity, @handlerType, @notes, @photoHash, @timestamp)
    `),
    getCheckpoints: db.prepare(`SELECT * FROM checkpoints WHERE batchAsaId = ? ORDER BY idx ASC`),

    // Handoffs
    upsertHandoff: db.prepare(`
        INSERT OR REPLACE INTO handoffs (batchAsaId, idx, status, fromAddr, toAddr, handoffType, confirmedAt)
        VALUES (@batchAsaId, @idx, @status, @fromAddr, @toAddr, @handoffType, @confirmedAt)
    `),
    getHandoffByIndex: db.prepare(`SELECT * FROM handoffs WHERE batchAsaId = ? AND idx = ?`),
    getHandoffs: db.prepare(`SELECT * FROM handoffs WHERE batchAsaId = ? ORDER BY idx ASC`),

    // Escrows
    upsertEscrow: db.prepare(`
        INSERT OR REPLACE INTO escrows (batchId, buyerAddr, farmerAddr, amount, status, createdAt, releasedAt)
        VALUES (@batchId, @buyerAddr, @farmerAddr, @amount, @status, @createdAt, @releasedAt)
    `),
    getEscrow: db.prepare(`SELECT * FROM escrows WHERE batchId = ?`),
    releaseEscrow: db.prepare(`UPDATE escrows SET status = 'released', releasedAt = ? WHERE batchId = ?`),

    // Payments
    insertPayment: db.prepare(`
        INSERT INTO payments (batchId, fromAddr, toAddr, amount, currency, txId, timestamp)
        VALUES (@batchId, @fromAddr, @toAddr, @amount, @currency, @txId, @timestamp)
    `),
    getPaymentsByFarmer: db.prepare(`SELECT * FROM payments WHERE toAddr = ? ORDER BY timestamp DESC`),
    getPaymentsByBatch: db.prepare(`SELECT * FROM payments WHERE batchId = ? ORDER BY timestamp DESC`),

    // Carbon Credits
    upsertCarbonCredit: db.prepare(`
        INSERT OR REPLACE INTO carbon_credits (batchId, farmerAddr, score, creditsEarned, distance, transportMethod, calculatedAt)
        VALUES (@batchId, @farmerAddr, @score, @creditsEarned, @distance, @transportMethod, @calculatedAt)
    `),
    getCarbonCredit: db.prepare(`SELECT * FROM carbon_credits WHERE batchId = ?`),
    getCarbonCreditsByFarmer: db.prepare(`SELECT * FROM carbon_credits WHERE farmerAddr = ?`),

    // Farmer Reputation
    upsertReputation: db.prepare(`
        INSERT OR REPLACE INTO farmer_reputation (farmerAddr, totalBatches, verifiedCount, flaggedCount, tier, carbonCreditsTotal, totalPaymentsReceived, lastUpdated)
        VALUES (@farmerAddr, @totalBatches, @verifiedCount, @flaggedCount, @tier, @carbonCreditsTotal, @totalPaymentsReceived, @lastUpdated)
    `),
    getReputation: db.prepare(`SELECT * FROM farmer_reputation WHERE farmerAddr = ?`),
    getAllBatchesByFarmer: db.prepare(`SELECT * FROM batches WHERE farmerAddr = ? ORDER BY createdAt DESC`),
};

// ─── Verification Store (implements IVerificationStore) ──

export class SqliteVerificationStore implements IVerificationStore {
    async saveVerification(record: VerificationRecord): Promise<void> {
        stmts.upsertVerification.run({
            batchAsaId: record.batchAsaId,
            result: record.result,
            confidence: record.confidence,
            reason: record.reason,
            verifierAddr: record.verifierAddr,
            timestamp: record.timestamp,
        });
        console.log(`[SqliteStore] Saved verification for batch ${record.batchAsaId}`);
    }

    async getVerification(batchAsaId: string): Promise<VerificationRecord | null> {
        const row = stmts.getVerification.get(batchAsaId) as VerificationRecord | undefined;
        return row || null;
    }

    async getAllVerifications(): Promise<VerificationRecord[]> {
        return stmts.getAllVerifications.all() as VerificationRecord[];
    }

    async getTotalCount(): Promise<number> {
        const row = stmts.countVerifications.get() as { count: number };
        return row.count;
    }

    async clear(): Promise<void> {
        db.exec('DELETE FROM verifications');
        console.log('[SqliteStore] Cleared all verifications');
    }
}

// ─── Batch Persistence ──────────────────────────────

export const batchDb = {
    save(batchId: string, data: {
        cropType: string; weight: number; farmGps: string;
        farmingPractices: string; organicCertId: string; farmerAddr: string;
        createdAt: number; checkpointCount: number; handoffCount: number;
    }): void {
        stmts.upsertBatch.run({ batchId, ...data });
    },

    get(batchId: string): {
        cropType: string; weight: number; farmGps: string;
        farmingPractices: string; organicCertId: string; farmerAddr: string;
        createdAt: number; checkpointCount: number; handoffCount: number;
    } | null {
        const row = stmts.getBatch.get(batchId) as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
            cropType: row.cropType as string,
            weight: row.weight as number,
            farmGps: row.farmGps as string,
            farmingPractices: row.farmingPractices as string,
            organicCertId: row.organicCertId as string,
            farmerAddr: row.farmerAddr as string,
            createdAt: row.createdAt as number,
            checkpointCount: row.checkpointCount as number,
            handoffCount: row.handoffCount as number,
        };
    },

    has(batchId: string): boolean {
        return !!stmts.getBatch.get(batchId);
    },

    updateCheckpointCount(batchId: string, count: number): void {
        stmts.updateBatchCheckpointCount.run(count, batchId);
    },

    updateHandoffCount(batchId: string, count: number): void {
        stmts.updateBatchHandoffCount.run(count, batchId);
    },
};

export const checkpointDb = {
    save(batchAsaId: string, idx: number, data: Omit<CheckpointRecord, 'index'>): void {
        stmts.upsertCheckpoint.run({
            batchAsaId,
            idx,
            gps: data.gps,
            temperature: data.temperature,
            humidity: data.humidity ?? null,
            handlerType: data.handlerType,
            notes: data.notes ?? null,
            photoHash: data.photoHash ?? null,
            timestamp: data.timestamp,
        });
    },

    getAll(batchAsaId: string): CheckpointRecord[] {
        const rows = stmts.getCheckpoints.all(batchAsaId) as Array<{
            idx: number; gps: string | null; temperature: number | null;
            humidity: number | null;
            handlerType: string | null;
            notes: string | null;
            photoHash: string | null;
            timestamp: number | null;
        }>;
        return rows.map((r) => ({
            index: r.idx,
            gps: r.gps,
            temperature: r.temperature,
            humidity: r.humidity,
            handlerType: r.handlerType,
            notes: r.notes,
            photoHash: r.photoHash,
            timestamp: r.timestamp,
        }));
    },
};

export const handoffDb = {
    save(batchAsaId: string, idx: number, data: Omit<HandoffRecord, 'index'>): void {
        stmts.upsertHandoff.run({
            batchAsaId,
            idx,
            status: data.status,
            fromAddr: data.fromAddr ?? null,
            toAddr: data.toAddr ?? null,
            handoffType: data.handoffType ?? null,
            confirmedAt: data.confirmedAt ?? null,
        });
    },

    getAll(batchAsaId: string): HandoffRecord[] {
        const rows = stmts.getHandoffs.all(batchAsaId) as Array<{
            idx: number;
            status: string | null;
            fromAddr: string | null;
            toAddr: string | null;
            handoffType: string | null;
            confirmedAt: number | null;
        }>;
        return rows.map((r) => ({
            index: r.idx,
            status: r.status,
            fromAddr: r.fromAddr,
            toAddr: r.toAddr,
            handoffType: r.handoffType,
            confirmedAt: r.confirmedAt,
        }));
    },

    updateStatus(batchAsaId: string, idx: number, status: string): void {
        const current = (stmts.getHandoffByIndex.get(batchAsaId, idx) as {
            fromAddr?: string | null;
            toAddr?: string | null;
            handoffType?: string | null;
        } | undefined) ?? {};
        stmts.upsertHandoff.run({
            batchAsaId,
            idx,
            status,
            fromAddr: current.fromAddr ?? null,
            toAddr: current.toAddr ?? null,
            handoffType: current.handoffType ?? null,
            confirmedAt: Math.floor(Date.now() / 1000),
        });
    },
};

// ─── Escrow Persistence ─────────────────────────────

export const escrowDb = {
    fund(batchId: string, buyerAddr: string, farmerAddr: string, amount: number): void {
        stmts.upsertEscrow.run({
            batchId, buyerAddr, farmerAddr, amount,
            status: 'funded', createdAt: Math.floor(Date.now() / 1000), releasedAt: null,
        });
    },

    get(batchId: string): {
        buyerAddr: string; farmerAddr: string; amount: number;
        status: string; createdAt: number; releasedAt: number | null;
    } | null {
        const row = stmts.getEscrow.get(batchId) as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
            buyerAddr: row.buyerAddr as string,
            farmerAddr: row.farmerAddr as string,
            amount: row.amount as number,
            status: row.status as string,
            createdAt: row.createdAt as number,
            releasedAt: row.releasedAt as number | null,
        };
    },

    release(batchId: string): void {
        stmts.releaseEscrow.run(Math.floor(Date.now() / 1000), batchId);
    },
};

// ─── Payment Persistence ────────────────────────────

export const paymentDb = {
    record(data: {
        batchId: string; fromAddr: string; toAddr: string;
        amount: number; currency: string; txId: string | null;
    }): void {
        stmts.insertPayment.run({
            ...data, timestamp: Math.floor(Date.now() / 1000),
        });
    },

    getByFarmer(farmerAddr: string): Array<{
        batchId: string; fromAddr: string; amount: number;
        currency: string; txId: string | null; timestamp: number;
    }> {
        return stmts.getPaymentsByFarmer.all(farmerAddr) as any[];
    },

    getByBatch(batchId: string): Array<{
        fromAddr: string; toAddr: string; amount: number;
        currency: string; txId: string | null; timestamp: number;
    }> {
        return stmts.getPaymentsByBatch.all(batchId) as any[];
    },
};

// ─── Carbon Credit Persistence ──────────────────────

export const carbonDb = {
    save(data: {
        batchId: string; farmerAddr: string; score: number;
        creditsEarned: number; distance: number; transportMethod: string;
    }): void {
        stmts.upsertCarbonCredit.run({
            ...data, calculatedAt: Math.floor(Date.now() / 1000),
        });
    },

    get(batchId: string): {
        farmerAddr: string; score: number; creditsEarned: number;
        distance: number; transportMethod: string; calculatedAt: number;
    } | null {
        const row = stmts.getCarbonCredit.get(batchId) as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
            farmerAddr: row.farmerAddr as string,
            score: row.score as number,
            creditsEarned: row.creditsEarned as number,
            distance: row.distance as number,
            transportMethod: row.transportMethod as string,
            calculatedAt: row.calculatedAt as number,
        };
    },

    getByFarmer(farmerAddr: string): Array<{
        batchId: string; score: number; creditsEarned: number;
        distance: number; calculatedAt: number;
    }> {
        return stmts.getCarbonCreditsByFarmer.all(farmerAddr) as any[];
    },
};

// ─── Farmer Reputation Persistence ──────────────────

export const reputationDb = {
    get(farmerAddr: string): {
        totalBatches: number; verifiedCount: number; flaggedCount: number;
        tier: string; carbonCreditsTotal: number; totalPaymentsReceived: number;
        lastUpdated: number;
    } | null {
        const row = stmts.getReputation.get(farmerAddr) as Record<string, unknown> | undefined;
        if (!row) return null;
        return {
            totalBatches: row.totalBatches as number,
            verifiedCount: row.verifiedCount as number,
            flaggedCount: row.flaggedCount as number,
            tier: row.tier as string,
            carbonCreditsTotal: row.carbonCreditsTotal as number,
            totalPaymentsReceived: row.totalPaymentsReceived as number,
            lastUpdated: row.lastUpdated as number,
        };
    },

    upsert(farmerAddr: string, data: {
        totalBatches: number; verifiedCount: number; flaggedCount: number;
        tier: string; carbonCreditsTotal: number; totalPaymentsReceived: number;
    }): void {
        stmts.upsertReputation.run({
            farmerAddr, ...data, lastUpdated: Math.floor(Date.now() / 1000),
        });
    },

    getBatchesByFarmer(farmerAddr: string): Array<{ batchId: string; cropType: string; weight: number; createdAt: number }> {
        return stmts.getAllBatchesByFarmer.all(farmerAddr) as any[];
    },
};

// ─── Export DB instance for advanced use ─────────────

export { db };
