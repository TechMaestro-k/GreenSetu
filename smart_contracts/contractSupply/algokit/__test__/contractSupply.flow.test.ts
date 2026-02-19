import { AlgorandClient } from "@algorandfoundation/algokit-utils";
import { ContractSupplyFactory } from "../contracts/clients/ContractSupplyClient";

describe("ContractSupply flow", () => {
  jest.setTimeout(120000);

  it("creates batch, logs checkpoint, and completes handoff", async () => {
    const flowTrace: string[] = [];
    const record = (message: string) => {
      flowTrace.push(message);
    };

    record("Bootstrapping LocalNet client and dispenser account");
    const algorand = AlgorandClient.defaultLocalNet();
    const account = await algorand.account.kmd.getLocalNetDispenserAccount();
    algorand.setSignerFromAccount(account);

    const factory = new ContractSupplyFactory({
      algorand,
      defaultSender: account.addr,
    });

    record("Creating application");
    const { appClient } = await factory.send.create.createApplication({
      sender: account.addr,
      args: [],
    });

    // Fund the app account for box storage MBR
    record("Funding app account for box storage");
    await algorand.send.payment({
      sender: account.addr,
      receiver: appClient.appAddress,
      amount: (2_000_000).microAlgo(),
    });

    record("Calling createBatch");
    const created = await appClient.send.createBatch({
      sender: account.addr,
      args: {
        cropType: "rice",
        weight: BigInt(100),
        farmGps: "12.34,56.78",
        farmingPractices: "organic",
        organicCertId: "ORG-1",
        farmerAddr: account.addr.toString(),
        createdAt: BigInt(1700000000),
      },
      populateAppCallResources: true,
    });

    const batchAsaId = created.return ?? BigInt(0);
    record(`Batch created with id ${batchAsaId.toString()}`);
    expect(batchAsaId).toBeGreaterThan(BigInt(0));

    const metadataHash = new Uint8Array(32);
    metadataHash[0] = 1;

    record("Calling mintBatchAsa");
    const mintedAsa = await appClient.send.mintBatchAsa({
      sender: account.addr,
      args: {
        batchAsaId,
        metadataHash,
      },
      populateAppCallResources: true,
    });

    record(`Batch ASA minted with id ${mintedAsa.return}`);

    record("Calling logCheckpoint");
    await appClient.send.logCheckpoint({
      sender: account.addr,
      args: {
        batchAsaId,
        gpsLat: "12.34",
        gpsLng: "56.78",
        temperature: BigInt(5),
        humidity: BigInt(80),
        handlerType: "farmer",
        notes: "initial",
        photoHash: "hash-1",
        checkpointTimestamp: BigInt(1700000100),
      },
      populateAppCallResources: true,
    });

    record("Calling initiateHandoff");
    await appClient.send.initiateHandoff({
      sender: account.addr,
      args: {
        batchAsaId,
        fromAddr: account.addr.toString(),
        toAddr: account.addr.toString(),
        handoffType: "farmer_to_transporter",
        handoffPhotoHashes: "handoff-hash-1",
      },
      populateAppCallResources: true,
    });

    record("Calling confirmHandoff");
    await appClient.send.confirmHandoff({
      sender: account.addr,
      args: {
        batchAsaId,
        handoffIndex: BigInt(1),
        confirmedAt: BigInt(1700000200),
      },
      populateAppCallResources: true,
    });

    record("Calling storeVerification");
    await appClient.send.storeVerification({
      sender: account.addr,
      args: {
        batchAsaId,
        result: "VERIFIED",
        confidence: BigInt(85),
        reason: "All checks passed",
        verifierAddr: account.addr.toString(),
      },
      populateAppCallResources: true,
    });

    record("Calling getVerification");
    const verification = await appClient.send.getVerification({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getVerificationConfidence");
    const verificationConfidence = await appClient.send.getVerificationConfidence({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getVerificationReason");
    const verificationReason = await appClient.send.getVerificationReason({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getVerificationVerifierAddr");
    const verificationVerifierAddr = await appClient.send.getVerificationVerifierAddr({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getVerificationTimestamp");
    const verificationTimestamp = await appClient.send.getVerificationTimestamp({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getTotalVerifications");
    const totalVerifications = await appClient.send.getTotalVerifications({
      sender: account.addr,
      args: {},
      populateAppCallResources: true,
    });

    record("Calling hasBatch");
    const hasBatch = await appClient.send.hasBatch({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling hasHandoff");
    const hasHandoff = await appClient.send.hasHandoff({
      sender: account.addr,
      args: {
        batchAsaId,
        handoffIndex: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getBatchWeight");
    const batchWeight = await appClient.send.getBatchWeight({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getCheckpointTemperature");
    const checkpointTemperature = await appClient.send.getCheckpointTemperature({
      sender: account.addr,
      args: {
        batchAsaId,
        index: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getCheckpointHumidity");
    const checkpointHumidity = await appClient.send.getCheckpointHumidity({
      sender: account.addr,
      args: {
        batchAsaId,
        index: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getCheckpointGps");
    const checkpointGps = await appClient.send.getCheckpointGps({
      sender: account.addr,
      args: {
        batchAsaId,
        index: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getBatchFarmingPractices");
    const batchFarmingPractices = await appClient.send.getBatchFarmingPractices({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getBatchCreatedAt");
    const batchCreatedAt = await appClient.send.getBatchCreatedAt({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getBatchAsaId");
    const batchAssetId = await appClient.send.getBatchAsaId({
      sender: account.addr,
      args: { batchAsaId },
      populateAppCallResources: true,
    });

    record("Calling getCheckpointTimestamp");
    const checkpointTimestamp = await appClient.send.getCheckpointTimestamp({
      sender: account.addr,
      args: {
        batchAsaId,
        index: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getHandoffPhotoHashes");
    const handoffPhotoHashes = await appClient.send.getHandoffPhotoHashes({
      sender: account.addr,
      args: {
        batchAsaId,
        handoffIndex: BigInt(1),
      },
      populateAppCallResources: true,
    });

    record("Calling getHandoffConfirmedAt");
    const handoffConfirmedAt = await appClient.send.getHandoffConfirmedAt({
      sender: account.addr,
      args: {
        batchAsaId,
        handoffIndex: BigInt(1),
      },
      populateAppCallResources: true,
    });

    expect(hasBatch.return).toBe(true);
    expect(hasHandoff.return).toBe(true);
    expect(batchWeight.return).toBe(BigInt(100));
    expect(checkpointTemperature.return).toBe(BigInt(5));
    expect(checkpointHumidity.return).toBe(BigInt(80));
    expect(batchFarmingPractices.return).toBe("organic");
    expect(batchCreatedAt.return).toBe(BigInt(1700000000));
    expect(mintedAsa.return).toBeGreaterThan(BigInt(0));
    expect(batchAssetId.return).toBe(mintedAsa.return);
    expect(checkpointTimestamp.return).toBe(BigInt(1700000100));
    expect(checkpointGps.return).toBe("12.34|56.78");
    expect(handoffPhotoHashes.return).toBe("handoff-hash-1");
    expect(handoffConfirmedAt.return).toBe(BigInt(1700000200));
    expect(verification.return).toBe("VERIFIED");
    expect(verificationConfidence.return).toBe(BigInt(85));
    expect(verificationReason.return).toBe("All checks passed");
    expect(verificationVerifierAddr.return).toBe(account.addr.toString());
    expect(verificationTimestamp.return).toBeGreaterThan(BigInt(0));
    expect(totalVerifications.return).toBe(BigInt(1));
    record(`hasBatch returned ${hasBatch.return}`);
    record(`hasHandoff returned ${hasHandoff.return}`);
    record(`getBatchWeight returned ${batchWeight.return}`);
    record(`getCheckpointTemperature returned ${checkpointTemperature.return}`);
    record(`getCheckpointHumidity returned ${checkpointHumidity.return}`);
    record(`getBatchFarmingPractices returned ${batchFarmingPractices.return}`);
    record(`getBatchCreatedAt returned ${batchCreatedAt.return}`);
    record(`getBatchAsaId returned ${batchAssetId.return}`);
    record(`getCheckpointTimestamp returned ${checkpointTimestamp.return}`);
    record(`getCheckpointGps returned ${checkpointGps.return}`);
    record(`getHandoffPhotoHashes returned ${handoffPhotoHashes.return}`);
    record(`getHandoffConfirmedAt returned ${handoffConfirmedAt.return}`);
    record(`getVerification returned ${verification.return}`);
    record(`getVerificationConfidence returned ${verificationConfidence.return}`);
    record(`getVerificationReason returned ${verificationReason.return}`);
    record(`getVerificationVerifierAddr returned ${verificationVerifierAddr.return}`);
    record(`getVerificationTimestamp returned ${verificationTimestamp.return}`);
    record(`getTotalVerifications returned ${totalVerifications.return}`);
    record("Flow assertions passed");

    console.info(`\n[Flow Summary]\n${flowTrace.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n`);
  });

  it("rejects invalid batch and indexes", async () => {
    const flowTrace: string[] = [];
    const results: string[] = [];
    const originalError = console.error;
    console.error = () => { };
    const record = (message: string) => {
      flowTrace.push(message);
    };
    const expectReject = async (label: string, action: () => Promise<unknown>) => {
      try {
        await action();
        results.push(`${label}: UNEXPECTED_SUCCESS`);
      } catch (_err) {
        results.push(`${label}: rejected`);
      }
    };

    record("Bootstrapping LocalNet client and dispenser account");
    const algorand = AlgorandClient.defaultLocalNet();
    const account = await algorand.account.kmd.getLocalNetDispenserAccount();
    algorand.setSignerFromAccount(account);

    const factory = new ContractSupplyFactory({
      algorand,
      defaultSender: account.addr,
    });

    record("Creating application");
    const { appClient } = await factory.send.create.createApplication({
      sender: account.addr,
      args: [],
    });

    record("Funding app account for box storage");
    await algorand.send.payment({
      sender: account.addr,
      receiver: appClient.appAddress,
      amount: (2_000_000).microAlgo(),
    });

    record("Creating a valid batch");
    const created = await appClient.send.createBatch({
      sender: account.addr,
      args: {
        cropType: "rice",
        weight: BigInt(100),
        farmGps: "12.34,56.78",
        farmingPractices: "organic",
        organicCertId: "ORG-1",
        farmerAddr: account.addr.toString(),
        createdAt: BigInt(1700000000),
      },
      populateAppCallResources: true,
    });
    const validBatchId = created.return ?? BigInt(0);

    const metadataHash = new Uint8Array(32);
    metadataHash[0] = 1;

    record("Minting ASA for valid batch");
    await appClient.send.mintBatchAsa({
      sender: account.addr,
      args: {
        batchAsaId: validBatchId,
        metadataHash,
      },
      populateAppCallResources: true,
    });

    record("Rejects logCheckpoint with missing batch");
    await expectReject("logCheckpoint missing batch", async () =>
      appClient.send.logCheckpoint({
        sender: account.addr,
        args: {
          batchAsaId: BigInt(9999),
          gpsLat: "0",
          gpsLng: "0",
          temperature: BigInt(1),
          humidity: BigInt(1),
          handlerType: "test",
          notes: "n/a",
          photoHash: "hash",
          checkpointTimestamp: BigInt(1700000100),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects mintBatchAsa with missing batch");
    await expectReject("mintBatchAsa missing batch", async () =>
      appClient.send.mintBatchAsa({
        sender: account.addr,
        args: {
          batchAsaId: BigInt(9999),
          metadataHash,
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects mintBatchAsa when already minted");
    await expectReject("mintBatchAsa duplicate", async () =>
      appClient.send.mintBatchAsa({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          metadataHash,
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects storeVerification with missing batch");
    await expectReject("storeVerification missing batch", async () =>
      appClient.send.storeVerification({
        sender: account.addr,
        args: {
          batchAsaId: BigInt(9999),
          result: "FLAGGED",
          confidence: BigInt(20),
          reason: "Missing batch",
          verifierAddr: account.addr.toString(),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getBatch with missing batch");
    await expectReject("getBatch missing batch", async () =>
      appClient.send.getBatch({
        sender: account.addr,
        args: { batchAsaId: BigInt(9999) },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getBatchWeight with missing batch");
    await expectReject("getBatchWeight missing batch", async () =>
      appClient.send.getBatchWeight({
        sender: account.addr,
        args: { batchAsaId: BigInt(9999) },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getVerification before any verification");
    await expectReject("getVerification missing", async () =>
      appClient.send.getVerification({
        sender: account.addr,
        args: { batchAsaId: validBatchId },
        populateAppCallResources: true,
      }),
    );

    record("Reads getTotalVerifications before any verification");
    const totalVerificationsBefore = await appClient.send.getTotalVerifications({
      sender: account.addr,
      args: {},
      populateAppCallResources: true,
    });
    expect(totalVerificationsBefore.return).toBe(BigInt(0));

    record("Rejects confirmHandoff with invalid index");
    await expectReject("confirmHandoff invalid index", async () =>
      appClient.send.confirmHandoff({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          handoffIndex: BigInt(1),
          confirmedAt: BigInt(1700000200),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getCheckpointTemperature before any checkpoint");
    await expectReject("getCheckpointTemperature missing", async () =>
      appClient.send.getCheckpointTemperature({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          index: BigInt(1),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getCheckpointGps before any checkpoint");
    await expectReject("getCheckpointGps missing", async () =>
      appClient.send.getCheckpointGps({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          index: BigInt(1),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getCheckpointHumidity before any checkpoint");
    await expectReject("getCheckpointHumidity missing", async () =>
      appClient.send.getCheckpointHumidity({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          index: BigInt(1),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getHandoffStatus before any handoff");
    await expectReject("getHandoffStatus missing", async () =>
      appClient.send.getHandoffStatus({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          handoffIndex: BigInt(1),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getCheckpoint with index 0");
    await expectReject("getCheckpoint index 0", async () =>
      appClient.send.getCheckpoint({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          index: BigInt(0),
        },
        populateAppCallResources: true,
      }),
    );

    record("Rejects getHandoff with index 0");
    await expectReject("getHandoff index 0", async () =>
      appClient.send.getHandoff({
        sender: account.addr,
        args: {
          batchAsaId: validBatchId,
          handoffIndex: BigInt(0),
        },
        populateAppCallResources: true,
      }),
    );

    const unexpected = results.filter((item) => item.includes("UNEXPECTED_SUCCESS"));
    expect(unexpected.length).toBe(0);

    record("Error-path assertions passed");
    console.info(
      `\n[Flow Error Summary]\n${flowTrace.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n` +
      `\n[Error Results]\n${results.map((item, index) => `${index + 1}. ${item}`).join("\n")}\n`,
    );
    console.error = originalError;
  });
});
