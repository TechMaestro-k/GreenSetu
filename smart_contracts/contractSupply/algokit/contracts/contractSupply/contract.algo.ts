import { Contract } from "@algorandfoundation/tealscript";
import { VerificationResult } from "./types";

type BatchAsaId = uint64;

export class ContractSupply extends Contract {
    totalBatches = GlobalStateKey<uint64>({ key: "totalBatches" });
    totalVerifications = GlobalStateKey<uint64>({ key: "totalVerifications" });
    totalPayments = GlobalStateKey<uint64>({ key: "totalPayments" });
    admin = GlobalStateKey<Address>({ key: "admin" });

    batchCropTypeBox = BoxMap<uint64, string>({ prefix: "bct" });
    batchFarmGpsBox = BoxMap<uint64, string>({ prefix: "bfg" });
    batchOrganicCertIdBox = BoxMap<uint64, string>({ prefix: "boc" });
    batchFarmerAddrBox = BoxMap<uint64, string>({ prefix: "bfa" });
    batchWeightBox = BoxMap<uint64, uint64>({ prefix: "bw" });
    batchFarmingPracticesBox = BoxMap<uint64, string>({ prefix: "bfp" });
    batchCreatedAtBox = BoxMap<uint64, uint64>({ prefix: "bca" });
    batchAsaIdBox = BoxMap<uint64, uint64>({ prefix: "bas" });

    checkpointGpsBox = BoxMap<uint64, string>({ prefix: "cpg" });
    checkpointTemperatureBox = BoxMap<uint64, uint64>({ prefix: "cpt" });
    checkpointHumidityBox = BoxMap<uint64, uint64>({ prefix: "cph" });
    checkpointHandlerTypeBox = BoxMap<uint64, string>({ prefix: "cphn" });
    checkpointNotesBox = BoxMap<uint64, string>({ prefix: "cpno" });
    checkpointPhotoHashBox = BoxMap<uint64, string>({ prefix: "cpp" });
    checkpointTimestampBox = BoxMap<uint64, uint64>({ prefix: "cpts" });
    checkpointCountBox = BoxMap<uint64, uint64>({ prefix: "cpn" });
    handoffFromAddrBox = BoxMap<uint64, string>({ prefix: "hof" });
    handoffToAddrBox = BoxMap<uint64, string>({ prefix: "hot" });
    handoffTypeBox = BoxMap<uint64, string>({ prefix: "hoy" });
    handoffStatusBox = BoxMap<uint64, string>({ prefix: "hos" });
    handoffConfirmedAtBox = BoxMap<uint64, uint64>({ prefix: "hca" });
    handoffPhotoHashesBox = BoxMap<uint64, string>({ prefix: "hph" });
    handoffCountBox = BoxMap<uint64, uint64>({ prefix: "hon" });

    verificationResultBox = BoxMap<uint64, string>({ prefix: "vrs" });
    verificationConfidenceBox = BoxMap<uint64, uint64>({ prefix: "vrc" });
    verificationReasonBox = BoxMap<uint64, string>({ prefix: "vrr" });
    verificationVerifierAddrBox = BoxMap<uint64, string>({ prefix: "vrv" });
    verificationTimestampBox = BoxMap<uint64, uint64>({ prefix: "vrt" });

    carbonScoreBox = BoxMap<uint64, uint64>({ prefix: "ccs" });
    carbonCreditsBox = BoxMap<uint64, uint64>({ prefix: "ccc" });
    carbonDistanceBox = BoxMap<uint64, uint64>({ prefix: "ccd" });
    carbonTransportBox = BoxMap<uint64, string>({ prefix: "cct" });
    carbonCalculatedAtBox = BoxMap<uint64, uint64>({ prefix: "cca" });

    farmerTotalBatchesBox = BoxMap<string, uint64>({ prefix: "frb" });
    farmerVerifiedCountBox = BoxMap<string, uint64>({ prefix: "frv" });
    farmerFlaggedCountBox = BoxMap<string, uint64>({ prefix: "frf" });
    farmerTierBox = BoxMap<string, string>({ prefix: "frt" });
    farmerCarbonCreditsBox = BoxMap<string, uint64>({ prefix: "frc" });
    farmerPaymentsTotalBox = BoxMap<string, uint64>({ prefix: "frp" });
    farmerLastUpdatedBox = BoxMap<string, uint64>({ prefix: "fru" });

    paymentFarmerAddrBox = BoxMap<uint64, string>({ prefix: "pf" });
    paymentBatchIdBox = BoxMap<uint64, uint64>({ prefix: "pb" });
    paymentAmountBox = BoxMap<uint64, uint64>({ prefix: "pa" });
    paymentCurrencyBox = BoxMap<uint64, string>({ prefix: "pc" });
    paymentTxBox = BoxMap<uint64, string>({ prefix: "pt" });
    paymentTimestampBox = BoxMap<uint64, uint64>({ prefix: "pts" });

    private assertBatchExists(batchAsaId: BatchAsaId): void {
        const maxBatchId = this.totalBatches.exists ? this.totalBatches.value : 0;
        assert(batchAsaId > 0 && batchAsaId <= maxBatchId, "Batch not found");
    }

    /**
     * Access control: only the admin (contract creator) can call write methods.
     * Admin is set on createApplication and can be transferred via setAdmin.
     */
    private assertAdmin(): void {
        assert(
            this.admin.exists && this.txn.sender === this.admin.value,
            "Only admin can perform this action"
        );
    }

    /**
     * Called once when the application is created. Sets the deployer as admin.
     */
    createApplication(): void {
        this.admin.value = this.txn.sender;
    }

    /**
     * Transfer admin rights to a new address. Only current admin can call.
     */
    setAdmin(newAdmin: Address): void {
        this.assertAdmin();
        this.admin.value = newAdmin;
    }

    private assertVerificationExists(batchAsaId: BatchAsaId): void {
        if (!this.verificationResultBox(batchAsaId).exists) {
            assert(false, "Verification not found");
        }
    }

    private assertCheckpointIndex(batchAsaId: BatchAsaId, index: uint64): void {
        assert(index > 0, "Checkpoint index must be > 0");
        if (!this.checkpointCountBox(batchAsaId).exists) assert(false, "Checkpoint not found");
        const count = this.checkpointCountBox(batchAsaId).value;
        assert(index <= count, "Checkpoint not found");
    }

    private assertHandoffIndex(batchAsaId: BatchAsaId, index: uint64): void {
        assert(index > 0, "Handoff index must be > 0");
        if (!this.handoffCountBox(batchAsaId).exists) assert(false, "Handoff not found");
        const count = this.handoffCountBox(batchAsaId).value;
        assert(index <= count, "Handoff not found");
    }

    private nextPaymentId(): uint64 {
        const current = this.totalPayments.exists ? this.totalPayments.value : 0;
        const nextId = current + 1;
        this.totalPayments.value = nextId;
        return nextId;
    }

    // ─── Batch ─────────────────────────────────────
    createBatch(
        cropType: string,
        weight: uint64,
        farmGps: string,
        farmingPractices: string,
        organicCertId: string,
        farmerAddr: string,
        createdAt: uint64,
    ): BatchAsaId {
        this.assertAdmin();
        const current = this.totalBatches.exists ? this.totalBatches.value : 0;
        const nextId = current + 1;
        this.totalBatches.value = nextId;
        this.batchCropTypeBox(nextId).value = cropType;
        this.batchWeightBox(nextId).value = weight;
        this.batchFarmGpsBox(nextId).value = farmGps;
        this.batchFarmingPracticesBox(nextId).value = farmingPractices;
        this.batchOrganicCertIdBox(nextId).value = organicCertId;
        this.batchFarmerAddrBox(nextId).value = farmerAddr;
        this.batchCreatedAtBox(nextId).value = createdAt;
        return nextId;
    }

    // ─── Checkpoint ────────────────────────────────
    logCheckpoint(
        batchAsaId: BatchAsaId,
        gpsLat: string,
        gpsLng: string,
        temperature: uint64,
        humidity: uint64,
        handlerType: string,
        notes: string,
        photoHash: string,
        checkpointTimestamp: uint64,
    ): void {
        this.assertAdmin();
        this.assertBatchExists(batchAsaId);

        const current = this.checkpointCountBox(batchAsaId).exists
            ? this.checkpointCountBox(batchAsaId).value
            : 0;
        const nextIndex = current + 1;
        this.checkpointCountBox(batchAsaId).value = nextIndex;

        const pk = batchAsaId * 10000 + nextIndex;
        this.checkpointGpsBox(pk).value = gpsLat + "|" + gpsLng;
        this.checkpointTemperatureBox(pk).value = temperature;
        this.checkpointHumidityBox(pk).value = humidity;
        this.checkpointHandlerTypeBox(pk).value = handlerType;
        this.checkpointNotesBox(pk).value = notes;
        this.checkpointPhotoHashBox(pk).value = photoHash;
        this.checkpointTimestampBox(pk).value = checkpointTimestamp;
    }

    // ─── Handoff ───────────────────────────────────
    initiateHandoff(
        batchAsaId: BatchAsaId,
        fromAddr: string,
        toAddr: string,
        handoffType: string,
        handoffPhotoHashes: string,
    ): void {
        this.assertAdmin();
        this.assertBatchExists(batchAsaId);

        const current = this.handoffCountBox(batchAsaId).exists
            ? this.handoffCountBox(batchAsaId).value
            : 0;
        const nextIndex = current + 1;
        this.handoffCountBox(batchAsaId).value = nextIndex;

        const pk = batchAsaId * 10000 + nextIndex;
        this.handoffFromAddrBox(pk).value = fromAddr;
        this.handoffToAddrBox(pk).value = toAddr;
        this.handoffTypeBox(pk).value = handoffType;
        this.handoffStatusBox(pk).value = "pending";
        this.handoffConfirmedAtBox(pk).value = 0;
        this.handoffPhotoHashesBox(pk).value = handoffPhotoHashes;
    }

    confirmHandoff(batchAsaId: BatchAsaId, handoffIndex: uint64, confirmedAt: uint64): void {
        // Allow receiver OR admin to confirm handoff
        // Note: Frontend must ensure correct receiver signs the transaction
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        this.handoffStatusBox(pk).value = "confirmed";
        this.handoffConfirmedAtBox(pk).value = confirmedAt;
    }

    mintBatchAsa(batchAsaId: BatchAsaId, metadataHash: bytes): uint64 {
        this.assertAdmin();
        this.assertBatchExists(batchAsaId);
        assert(!this.batchAsaIdBox(batchAsaId).exists, "ASA already minted");
        const assetId = sendAssetCreation({
            fee: globals.minTxnFee,
            configAssetTotal: 1,
            configAssetDecimals: 0,
            configAssetName: "CHAINVERIFY-BATCH",
            configAssetUnitName: "CVBATCH",
            configAssetManager: globals.currentApplicationAddress,
            configAssetReserve: globals.currentApplicationAddress,
            configAssetFreeze: globals.currentApplicationAddress,
            configAssetClawback: globals.currentApplicationAddress,
            configAssetMetadataHash: metadataHash,
        });
        const assetIndex = assetId.id;
        this.batchAsaIdBox(batchAsaId).value = assetIndex;
        return assetIndex;
    }

    // ─── Verification ───────────────────────────
    storeVerification(
        batchAsaId: BatchAsaId,
        result: VerificationResult,
        confidence: uint64,
        reason: string,
        verifierAddr: string,
    ): void {
        this.assertAdmin();
        this.assertBatchExists(batchAsaId);

        const existed = this.verificationResultBox(batchAsaId).exists;
        this.verificationResultBox(batchAsaId).value = result;
        this.verificationConfidenceBox(batchAsaId).value = confidence;
        this.verificationReasonBox(batchAsaId).value = reason;
        this.verificationVerifierAddrBox(batchAsaId).value = verifierAddr;
        this.verificationTimestampBox(batchAsaId).value = globals.latestTimestamp;

        if (!existed) {
            const current = this.totalVerifications.exists ? this.totalVerifications.value : 0;
            this.totalVerifications.value = current + 1;
        }
    }

    // ─── Carbon ─────────────────────────────────
    updateCarbonScore(
        batchAsaId: BatchAsaId,
        score: uint64,
        creditsEarned: uint64,
        distance: uint64,
        transportMethod: string,
        calculatedAt: uint64,
    ): void {
        this.assertAdmin();
        this.assertBatchExists(batchAsaId);
        this.carbonScoreBox(batchAsaId).value = score;
        this.carbonCreditsBox(batchAsaId).value = creditsEarned;
        this.carbonDistanceBox(batchAsaId).value = distance;
        this.carbonTransportBox(batchAsaId).value = transportMethod;
        this.carbonCalculatedAtBox(batchAsaId).value = calculatedAt;
    }

    // ─── Farmer Reputation ──────────────────────
    updateFarmerReputation(
        farmerAddr: string,
        totalBatches: uint64,
        verifiedCount: uint64,
        flaggedCount: uint64,
        tier: string,
        carbonCreditsTotal: uint64,
        totalPaymentsReceived: uint64,
        lastUpdated: uint64,
    ): void {
        this.assertAdmin();
        this.farmerTotalBatchesBox(farmerAddr).value = totalBatches;
        this.farmerVerifiedCountBox(farmerAddr).value = verifiedCount;
        this.farmerFlaggedCountBox(farmerAddr).value = flaggedCount;
        this.farmerTierBox(farmerAddr).value = tier;
        this.farmerCarbonCreditsBox(farmerAddr).value = carbonCreditsTotal;
        this.farmerPaymentsTotalBox(farmerAddr).value = totalPaymentsReceived;
        this.farmerLastUpdatedBox(farmerAddr).value = lastUpdated;
    }

    recordFarmerPayment(
        farmerAddr: string,
        batchAsaId: uint64,
        amount: uint64,
        currency: string,
        txId: string,
        timestamp: uint64,
    ): void {
        this.assertAdmin();
        const paymentId = this.nextPaymentId();
        this.paymentFarmerAddrBox(paymentId).value = farmerAddr;
        this.paymentBatchIdBox(paymentId).value = batchAsaId;
        this.paymentAmountBox(paymentId).value = amount;
        this.paymentCurrencyBox(paymentId).value = currency;
        this.paymentTxBox(paymentId).value = txId;
        this.paymentTimestampBox(paymentId).value = timestamp;
    }

    // ─── Read APIs ─────────────────────────────────
    @abi.readonly
    getVerification(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        this.assertVerificationExists(batchAsaId);
        return this.verificationResultBox(batchAsaId).value;
    }

    @abi.readonly
    getTotalVerifications(): uint64 {
        if (!this.totalVerifications.exists) return 0;
        return this.totalVerifications.value;
    }

    @abi.readonly
    getTotalBatches(): uint64 {
        if (!this.totalBatches.exists) return 0;
        return this.totalBatches.value;
    }

    @abi.readonly
    getTotalPayments(): uint64 {
        if (!this.totalPayments.exists) return 0;
        return this.totalPayments.value;
    }

    @abi.readonly
    getVerificationConfidence(batchAsaId: BatchAsaId): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertVerificationExists(batchAsaId);
        return this.verificationConfidenceBox(batchAsaId).value;
    }

    @abi.readonly
    getVerificationReason(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        this.assertVerificationExists(batchAsaId);
        return this.verificationReasonBox(batchAsaId).value;
    }

    @abi.readonly
    getVerificationVerifierAddr(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        this.assertVerificationExists(batchAsaId);
        return this.verificationVerifierAddrBox(batchAsaId).value;
    }

    @abi.readonly
    getVerificationTimestamp(batchAsaId: BatchAsaId): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertVerificationExists(batchAsaId);
        return this.verificationTimestampBox(batchAsaId).value;
    }

    @abi.readonly
    getCarbonScore(batchAsaId: BatchAsaId): uint64 {
        if (!this.carbonScoreBox(batchAsaId).exists) return 0;
        return this.carbonScoreBox(batchAsaId).value;
    }

    @abi.readonly
    getCarbonCredits(batchAsaId: BatchAsaId): uint64 {
        if (!this.carbonCreditsBox(batchAsaId).exists) return 0;
        return this.carbonCreditsBox(batchAsaId).value;
    }

    @abi.readonly
    getCarbonDistance(batchAsaId: BatchAsaId): uint64 {
        if (!this.carbonDistanceBox(batchAsaId).exists) return 0;
        return this.carbonDistanceBox(batchAsaId).value;
    }

    @abi.readonly
    getCarbonTransportMethod(batchAsaId: BatchAsaId): string {
        if (!this.carbonTransportBox(batchAsaId).exists) return "";
        return this.carbonTransportBox(batchAsaId).value;
    }

    @abi.readonly
    getCarbonCalculatedAt(batchAsaId: BatchAsaId): uint64 {
        if (!this.carbonCalculatedAtBox(batchAsaId).exists) return 0;
        return this.carbonCalculatedAtBox(batchAsaId).value;
    }

    @abi.readonly
    getFarmerTotalBatches(farmerAddr: string): uint64 {
        if (!this.farmerTotalBatchesBox(farmerAddr).exists) return 0;
        return this.farmerTotalBatchesBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerVerifiedCount(farmerAddr: string): uint64 {
        if (!this.farmerVerifiedCountBox(farmerAddr).exists) return 0;
        return this.farmerVerifiedCountBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerFlaggedCount(farmerAddr: string): uint64 {
        if (!this.farmerFlaggedCountBox(farmerAddr).exists) return 0;
        return this.farmerFlaggedCountBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerTier(farmerAddr: string): string {
        if (!this.farmerTierBox(farmerAddr).exists) return "";
        return this.farmerTierBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerCarbonCreditsTotal(farmerAddr: string): uint64 {
        if (!this.farmerCarbonCreditsBox(farmerAddr).exists) return 0;
        return this.farmerCarbonCreditsBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerPaymentsTotal(farmerAddr: string): uint64 {
        if (!this.farmerPaymentsTotalBox(farmerAddr).exists) return 0;
        return this.farmerPaymentsTotalBox(farmerAddr).value;
    }

    @abi.readonly
    getFarmerLastUpdated(farmerAddr: string): uint64 {
        if (!this.farmerLastUpdatedBox(farmerAddr).exists) return 0;
        return this.farmerLastUpdatedBox(farmerAddr).value;
    }

    @abi.readonly
    getPaymentFarmerAddr(paymentId: uint64): string {
        if (!this.paymentFarmerAddrBox(paymentId).exists) return "";
        return this.paymentFarmerAddrBox(paymentId).value;
    }

    @abi.readonly
    getPaymentBatchId(paymentId: uint64): uint64 {
        if (!this.paymentBatchIdBox(paymentId).exists) return 0;
        return this.paymentBatchIdBox(paymentId).value;
    }

    @abi.readonly
    getPaymentAmount(paymentId: uint64): uint64 {
        if (!this.paymentAmountBox(paymentId).exists) return 0;
        return this.paymentAmountBox(paymentId).value;
    }

    @abi.readonly
    getPaymentCurrency(paymentId: uint64): string {
        if (!this.paymentCurrencyBox(paymentId).exists) return "";
        return this.paymentCurrencyBox(paymentId).value;
    }

    @abi.readonly
    getPaymentTxId(paymentId: uint64): string {
        if (!this.paymentTxBox(paymentId).exists) return "";
        return this.paymentTxBox(paymentId).value;
    }

    @abi.readonly
    getPaymentTimestamp(paymentId: uint64): uint64 {
        if (!this.paymentTimestampBox(paymentId).exists) return 0;
        return this.paymentTimestampBox(paymentId).value;
    }

    @abi.readonly
    getBatch(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchCropTypeBox(batchAsaId).value
            + "|" + this.batchFarmGpsBox(batchAsaId).value
            + "|" + this.batchOrganicCertIdBox(batchAsaId).value
            + "|" + this.batchFarmerAddrBox(batchAsaId).value;
    }

    @abi.readonly
    hasBatch(batchAsaId: BatchAsaId): boolean {
        return this.batchCropTypeBox(batchAsaId).exists;
    }

    @abi.readonly
    getCheckpoint(batchAsaId: BatchAsaId, index: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointGpsBox(pk).value
            + "|" + this.checkpointHandlerTypeBox(pk).value
            + "|" + this.checkpointNotesBox(pk).value
            + "|" + this.checkpointPhotoHashBox(pk).value;
    }

    @abi.readonly
    getCheckpointCount(batchAsaId: BatchAsaId): uint64 {
        if (!this.checkpointCountBox(batchAsaId).exists) return 0;
        return this.checkpointCountBox(batchAsaId).value;
    }

    @abi.readonly
    getHandoff(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffFromAddrBox(pk).value
            + "|" + this.handoffToAddrBox(pk).value
            + "|" + this.handoffTypeBox(pk).value
            + "|" + this.handoffStatusBox(pk).value;
    }

    @abi.readonly
    hasHandoff(batchAsaId: BatchAsaId, handoffIndex: uint64): boolean {
        if (!this.handoffCountBox(batchAsaId).exists) return false;
        const count = this.handoffCountBox(batchAsaId).value;
        if (handoffIndex > count) return false;
        if (handoffIndex === 0) return false;
        return true;
    }

    @abi.readonly
    getHandoffCount(batchAsaId: BatchAsaId): uint64 {
        if (!this.handoffCountBox(batchAsaId).exists) return 0;
        return this.handoffCountBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchWeight(batchAsaId: BatchAsaId): uint64 {
        this.assertBatchExists(batchAsaId);
        return this.batchWeightBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchCropType(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchCropTypeBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchFarmGps(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchFarmGpsBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchFarmingPractices(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchFarmingPracticesBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchOrganicCertId(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchOrganicCertIdBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchFarmerAddr(batchAsaId: BatchAsaId): string {
        this.assertBatchExists(batchAsaId);
        return this.batchFarmerAddrBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchCreatedAt(batchAsaId: BatchAsaId): uint64 {
        this.assertBatchExists(batchAsaId);
        return this.batchCreatedAtBox(batchAsaId).value;
    }

    @abi.readonly
    getBatchAsaId(batchAsaId: BatchAsaId): uint64 {
        this.assertBatchExists(batchAsaId);
        if (!this.batchAsaIdBox(batchAsaId).exists) return 0;
        return this.batchAsaIdBox(batchAsaId).value;
    }

    @abi.readonly
    getCheckpointTemperature(batchAsaId: BatchAsaId, index: uint64): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointTemperatureBox(pk).value;
    }

    @abi.readonly
    getCheckpointHumidity(batchAsaId: BatchAsaId, index: uint64): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointHumidityBox(pk).value;
    }

    @abi.readonly
    getCheckpointGps(batchAsaId: BatchAsaId, index: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointGpsBox(pk).value;
    }

    @abi.readonly
    getCheckpointHandlerType(batchAsaId: BatchAsaId, index: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointHandlerTypeBox(pk).value;
    }

    @abi.readonly
    getCheckpointNotes(batchAsaId: BatchAsaId, index: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointNotesBox(pk).value;
    }

    @abi.readonly
    getCheckpointPhotoHash(batchAsaId: BatchAsaId, index: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointPhotoHashBox(pk).value;
    }

    @abi.readonly
    getCheckpointTimestamp(batchAsaId: BatchAsaId, index: uint64): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertCheckpointIndex(batchAsaId, index);
        const pk = batchAsaId * 10000 + index;
        return this.checkpointTimestampBox(pk).value;
    }

    @abi.readonly
    getHandoffFromAddr(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffFromAddrBox(pk).value;
    }

    @abi.readonly
    getHandoffToAddr(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffToAddrBox(pk).value;
    }

    @abi.readonly
    getHandoffType(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffTypeBox(pk).value;
    }

    @abi.readonly
    getHandoffStatus(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffStatusBox(pk).value;
    }

    @abi.readonly
    getHandoffConfirmedAt(batchAsaId: BatchAsaId, handoffIndex: uint64): uint64 {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffConfirmedAtBox(pk).value;
    }

    @abi.readonly
    getHandoffPhotoHashes(batchAsaId: BatchAsaId, handoffIndex: uint64): string {
        this.assertBatchExists(batchAsaId);
        this.assertHandoffIndex(batchAsaId, handoffIndex);
        const pk = batchAsaId * 10000 + handoffIndex;
        return this.handoffPhotoHashesBox(pk).value;
    }
}
