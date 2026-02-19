import { VerificationRecord, VerificationRequest, VerificationResult, CheckpointRecord, HandoffRecord } from "../types/verification.types.js";
import { ContractSupplyService } from "./contract-supply.service.js";

export interface VerificationEngine {
    verify(input: VerificationRequest): Promise<VerificationRecord>;
}

// ─── Anomaly detection thresholds ──────────────────
const MAX_SPEED_KMH = 120;           // max ground transport speed
const MAX_COLD_CHAIN_TEMP = 8;       // °C – cold chain threshold
const MAX_TIME_GAP_HOURS = 48;       // max hours between checkpoints
const MIN_CONFIDENCE_FLOOR = 10;     // minimum confidence score

/**
 * Haversine distance between two "lat|lng" GPS strings (in km)
 */
function haversineKm(gps1: string, gps2: string): number | null {
    const parse = (s: string): [number, number] | null => {
        const parts = s.split('|');
        if (parts.length !== 2) return null;
        const lat = parseFloat(parts[0]);
        const lng = parseFloat(parts[1]);
        if (isNaN(lat) || isNaN(lng)) return null;
        return [lat, lng];
    };
    const a = parse(gps1);
    const b = parse(gps2);
    if (!a || !b) return null;

    const toRad = (d: number) => (d * Math.PI) / 180;
    const R = 6371; // Earth radius in km
    const dLat = toRad(b[0] - a[0]);
    const dLng = toRad(b[1] - a[1]);
    const sinLat = Math.sin(dLat / 2);
    const sinLng = Math.sin(dLng / 2);
    const h = sinLat * sinLat + Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * sinLng * sinLng;
    return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

interface AnomalyFlag {
    check: string;
    message: string;
    severity: 'critical' | 'warning';
    deduction: number; // confidence deduction
}

/**
 * ContractVerificationEngine – real anomaly detection
 *
 * Checks performed:
 * 1. Speed check – travel speed between checkpoints > MAX_SPEED_KMH
 * 2. Temperature check – temperature > MAX_COLD_CHAIN_TEMP
 * 3. Time gap check – gap between checkpoints > MAX_TIME_GAP_HOURS
 * 4. Handoff consistency – any unconfirmed (pending) handoffs
 * 5. Photo integrity – missing photo hashes at checkpoints
 * 6. Batch existence – batch must exist before verification
 */
export class ContractVerificationEngine implements VerificationEngine {
    constructor(private contractService: ContractSupplyService) { }

    async verify(input: VerificationRequest): Promise<VerificationRecord> {
        const verifierAddr = input.verifierAddr ?? "SYSTEM";
        const timestamp = input.timestamp ?? Math.floor(Date.now() / 1000);
        const flags: AnomalyFlag[] = [];

        // 1. Check batch exists
        const batchExists = await this.contractService.hasBatch(input.batchAsaId);
        if (!batchExists) {
            flags.push({
                check: 'batch_existence',
                message: `Batch ${input.batchAsaId} not found on-chain`,
                severity: 'critical',
                deduction: 50,
            });
        }

        // 2. Fetch checkpoints and handoffs
        const checkpoints = await this.contractService.getCheckpoints(input.batchAsaId);
        const handoffs = await this.contractService.getHandoffs(input.batchAsaId);

        // 3. Run anomaly checks on checkpoints
        if (checkpoints.length > 0) {
            this.checkSpeedAnomalies(checkpoints, flags);
            this.checkTemperatureAnomalies(checkpoints, flags);
            this.checkTimeGaps(checkpoints, flags);
            this.checkRouteConsistency(checkpoints, flags);
        } else if (batchExists) {
            flags.push({
                check: 'no_checkpoints',
                message: 'No checkpoints found for this batch',
                severity: 'warning',
                deduction: 15,
            });
        }

        // 4. Handoff consistency check
        this.checkHandoffConsistency(handoffs, flags);

        // 5. Evidence-based checks
        if (input.evidence) {
            this.checkEvidence(input.evidence, flags);
        }

        // Calculate result
        let confidence = 100;
        for (const flag of flags) {
            confidence -= flag.deduction;
        }
        confidence = Math.max(confidence, MIN_CONFIDENCE_FLOOR);

        const hasCritical = flags.some(f => f.severity === 'critical');
        const result: VerificationResult = hasCritical || confidence < 50 ? 'FLAGGED' : 'VERIFIED';

        const reason = flags.length === 0
            ? 'All checks passed — no anomalies detected'
            : flags.map(f => `[${f.severity.toUpperCase()}] ${f.check}: ${f.message}`).join('; ');

        // Store on-chain + in-memory
        await this.contractService.storeVerification(
            input.batchAsaId, result, confidence, reason, verifierAddr,
        );

        return {
            batchAsaId: input.batchAsaId,
            result, confidence, reason,
            verifierAddr, timestamp,
        };
    }

    // ─── Check implementations ─────────────────────

    private checkSpeedAnomalies(checkpoints: CheckpointRecord[], flags: AnomalyFlag[]): void {
        for (let i = 1; i < checkpoints.length; i++) {
            const prev = checkpoints[i - 1];
            const curr = checkpoints[i];
            if (!prev.gps || !curr.gps || !prev.timestamp || !curr.timestamp) continue;

            const distKm = haversineKm(prev.gps, curr.gps);
            if (distKm === null) continue;

            const timeDiffHours = Math.abs(curr.timestamp - prev.timestamp) / 3600;
            if (timeDiffHours < 0.001) continue; // avoid division by zero

            const speedKmh = distKm / timeDiffHours;
            if (speedKmh > MAX_SPEED_KMH) {
                flags.push({
                    check: 'speed_anomaly',
                    message: `Checkpoint ${prev.index}→${curr.index}: ${speedKmh.toFixed(1)} km/h exceeds ${MAX_SPEED_KMH} km/h limit`,
                    severity: 'critical',
                    deduction: 30,
                });
            }
        }
    }

    private checkTemperatureAnomalies(checkpoints: CheckpointRecord[], flags: AnomalyFlag[]): void {
        for (const cp of checkpoints) {
            if (cp.temperature === null) continue;
            if (cp.temperature > MAX_COLD_CHAIN_TEMP) {
                flags.push({
                    check: 'temperature_breach',
                    message: `Checkpoint ${cp.index}: ${cp.temperature}°C exceeds cold chain limit of ${MAX_COLD_CHAIN_TEMP}°C`,
                    severity: 'warning',
                    deduction: 20,
                });
            }
        }
    }

    private checkTimeGaps(checkpoints: CheckpointRecord[], flags: AnomalyFlag[]): void {
        for (let i = 1; i < checkpoints.length; i++) {
            const prev = checkpoints[i - 1];
            const curr = checkpoints[i];
            if (!prev.timestamp || !curr.timestamp) continue;

            const gapHours = Math.abs(curr.timestamp - prev.timestamp) / 3600;
            if (gapHours > MAX_TIME_GAP_HOURS) {
                flags.push({
                    check: 'time_gap',
                    message: `Checkpoint ${prev.index}→${curr.index}: ${gapHours.toFixed(1)} hour gap exceeds ${MAX_TIME_GAP_HOURS}h limit`,
                    severity: 'warning',
                    deduction: 15,
                });
            }
        }
    }

    private checkRouteConsistency(checkpoints: CheckpointRecord[], flags: AnomalyFlag[]): void {
        // Route consistency: check for impossible distances and unrealistic paths
        let totalDistance = 0;
        let maxGap = 0;
        const MAX_SINGLE_SEGMENT_KM = 2000; // unrealistic single segment
        const MAX_TOTAL_DISTANCE_KM = 5000; // unrealistic total distance for farm supply chain

        for (let i = 1; i < checkpoints.length; i++) {
            const prev = checkpoints[i - 1];
            const curr = checkpoints[i];
            if (!prev.gps || !curr.gps) continue;

            const distKm = haversineKm(prev.gps, curr.gps);
            if (distKm === null) continue;

            // Check for impossibly large single segment
            if (distKm > MAX_SINGLE_SEGMENT_KM) {
                flags.push({
                    check: 'route_consistency',
                    message: `Checkpoint ${prev.index}→${curr.index}: segment distance ${distKm.toFixed(0)}km exceeds realistic limit`,
                    severity: 'warning',
                    deduction: 12,
                });
            }

            totalDistance += distKm;
            maxGap = Math.max(maxGap, distKm);
        }

        // Check for impossibly large total distance
        if (totalDistance > MAX_TOTAL_DISTANCE_KM) {
            flags.push({
                check: 'route_consistency',
                message: `Total route distance ${totalDistance.toFixed(0)}km is unrealistic for farm supply chain (max ${MAX_TOTAL_DISTANCE_KM}km)`,
                severity: 'warning',
                deduction: 10,
            });
        }
    }

    private checkHandoffConsistency(handoffs: HandoffRecord[], flags: AnomalyFlag[]): void {
        const pending = handoffs.filter(h => h.status === 'pending');
        if (pending.length > 0) {
            flags.push({
                check: 'handoff_unconfirmed',
                message: `${pending.length} handoff(s) still pending confirmation`,
                severity: 'warning',
                deduction: 10,
            });
        }
    }

    private checkEvidence(evidence: Record<string, unknown>, flags: AnomalyFlag[]): void {
        // Check for missing photo hashes at checkpoints
        if (evidence.missingPhotos && Array.isArray(evidence.missingPhotos)) {
            flags.push({
                check: 'photo_integrity',
                message: `${evidence.missingPhotos.length} checkpoint(s) missing photo hashes`,
                severity: 'warning',
                deduction: 10,
            });
        }

        // Check for suspicious certification
        if (evidence.certificationMismatch) {
            flags.push({
                check: 'certification_mismatch',
                message: `Organic certification mismatch: ${evidence.certificationMismatch}`,
                severity: 'critical',
                deduction: 40,
            });
        }
    }
}

/**
 * Stub engine for testing without contract
 */
export class StubVerificationEngine implements VerificationEngine {
    async verify(input: VerificationRequest): Promise<VerificationRecord> {
        return {
            batchAsaId: input.batchAsaId,
            result: "VERIFIED",
            confidence: 100,
            reason: "stubbed verification",
            verifierAddr: input.verifierAddr ?? "SYSTEM",
            timestamp: input.timestamp ?? 0,
        };
    }
}
