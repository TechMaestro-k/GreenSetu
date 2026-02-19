/**
 * Verification Store - In-memory storage for verification records
 * 
 * This module provides a simple in-memory store for verification records.
 * Benefits:
 * - Allows testing without deployed smart contract
 * - Provides fallback if blockchain is unavailable
 * - Useful for development and testing
 * 
 * In production, this can be extended to:
 * - Use a database backend (PostgreSQL, MongoDB, etc.)
 * - Sync with blockchain state
 * - Provide query capabilities and history tracking
 */

import { VerificationRecord } from '../types/verification.types.js';

export interface IVerificationStore {
    saveVerification(record: VerificationRecord): Promise<void>;
    getVerification(batchAsaId: string): Promise<VerificationRecord | null>;
    getAllVerifications(): Promise<VerificationRecord[]>;
    getTotalCount(): Promise<number>;
    clear(): Promise<void>;
}

/**
 * In-memory verification store
 * Stores verifications in a Map for fast access
 * Data is lost on server restart (use database for persistence)
 */
export class InMemoryVerificationStore implements IVerificationStore {
    private store = new Map<string, VerificationRecord>();

    async saveVerification(record: VerificationRecord): Promise<void> {
        this.store.set(record.batchAsaId, record);
        console.log(`[VerificationStore] Saved verification for batch ${record.batchAsaId}`);
    }

    async getVerification(batchAsaId: string): Promise<VerificationRecord | null> {
        return this.store.get(batchAsaId) || null;
    }

    async getAllVerifications(): Promise<VerificationRecord[]> {
        return Array.from(this.store.values());
    }

    async getTotalCount(): Promise<number> {
        return this.store.size;
    }

    async clear(): Promise<void> {
        this.store.clear();
        console.log('[VerificationStore] Cleared all verifications');
    }
}

// Global store instance
let verificationStore: IVerificationStore | null = null;

/**
 * Get or create the global verification store instance
 */
export function getVerificationStore(): IVerificationStore {
    if (!verificationStore) {
        verificationStore = new InMemoryVerificationStore();
        console.log('[VerificationStore] Initialized in-memory store');
    }
    return verificationStore;
}

/**
 * Replace the verification store (useful for testing)
 */
export function setVerificationStore(store: IVerificationStore): void {
    verificationStore = store;
}
