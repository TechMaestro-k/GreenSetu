import Fastify from "fastify";
import cors from "@fastify/cors";
import { postVerify, getStatus, getVerifyPayment } from "./routes/verification.routes.js";
import {
    postCreateBatch,
    postLogCheckpoint,
    postInitiateHandoff,
    postConfirmHandoff,
    getConfirmHandoffTransaction,
    getBatchDetails,
    postFundEscrow,
    postReleaseEscrow,
    getCarbonScore,
    getFarmerReputation,
    getFarmerPayments,
    getFarmerBatches,
    postMintBatchAsa,
    MintBatchRequest,
} from "./routes/supply-chain.routes.js";
import { X402PaymentGateway } from "./services/payment.gateway.js";
import { ContractVerificationEngine } from "./services/verification.engine.js";
import { ContractIndexerClientAdapter } from "./blockchain/indexer.client.js";
import { ContractSupplyService } from "./services/contract-supply.service.js";
import { initializeAlgorandConfig } from "./config/algorand-client.factory.js";
import {
    VerificationRequest,
    CreateBatchRequest,
    LogCheckpointRequest,
    InitiateHandoffRequest,
    ConfirmHandoffRequest,
    FundEscrowRequest,
} from "./types/verification.types.js";

// Initialize Algorand configuration
initializeAlgorandConfig();

const app = Fastify({ logger: true });

// Rate limiting state
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60_000; // 1 minute
const RATE_LIMIT_MAX = Number(process.env.RATE_LIMIT_MAX ?? 60); // requests per window

// CORS — configurable via CORS_ORIGINS env var (comma-separated)
const defaultOrigins = ["http://127.0.0.1:3000", "http://localhost:3000"];
const corsOrigins = process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(",").map((o) => o.trim())
    : defaultOrigins;

await app.register(cors, {
    origin: corsOrigins,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "X-PAYMENT", "Payment-Required", "payment-required", "PAYMENT-SIGNATURE", "payment-signature"],
    exposedHeaders: ["payment-required", "Payment-Required", "x-payment", "X-PAYMENT", "payment-signature", "PAYMENT-SIGNATURE"],
});

// Rate limiting hook
app.addHook("onRequest", async (request, reply) => {
    const ip = request.ip;
    const now = Date.now();
    let entry = rateLimitMap.get(ip);
    if (!entry || now > entry.resetAt) {
        entry = { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };
        rateLimitMap.set(ip, entry);
    }
    entry.count++;
    reply.header("X-RateLimit-Limit", RATE_LIMIT_MAX);
    reply.header("X-RateLimit-Remaining", Math.max(0, RATE_LIMIT_MAX - entry.count));
    reply.header("X-RateLimit-Reset", Math.ceil(entry.resetAt / 1000));
    if (entry.count > RATE_LIMIT_MAX) {
        reply.code(429).send({ error: "Too many requests. Please try again later." });
    }
});

// Periodically clean stale rate-limit entries (every 5 minutes)
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) rateLimitMap.delete(ip);
    }
}, 300_000);

// Initialize services
const contractService = new ContractSupplyService();
const verificationDeps = {
    engine: new ContractVerificationEngine(contractService),
    payment: new X402PaymentGateway(),
    indexer: new ContractIndexerClientAdapter(contractService),
};
const supplyChainDeps = {
    contractService,
    indexer: new ContractIndexerClientAdapter(contractService),
};

app.setErrorHandler((error, _request, reply) => {
    if ((error as { validation?: unknown }).validation) {
        reply.code(400).send({ error: "invalid request", details: error.message });
        return;
    }

    app.log.error(error);
    reply.code(500).send({ error: "internal server error" });
});

// ─── Verification Routes ──────────────────────────

app.post<{ Body: VerificationRequest }>(
    "/verify",
    {
        schema: {
            body: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                    evidence: { type: "object", additionalProperties: true },
                    verifierAddr: { type: "string" },
                    timestamp: { type: "number" },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postVerify(
            {
                body: request.body,
                headers: request.headers,
                method: request.method,
                url: request.url,
            },
            verificationDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Querystring: { batchAsaId?: string } }>(
    "/verify",
    {
        schema: {
            querystring: {
                type: "object",
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getVerifyPayment(
            {
                body: request.query as VerificationRequest,
                headers: request.headers,
                method: request.method,
                url: request.url,
            },
            verificationDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { batchAsaId: string } }>(
    "/status/:batchAsaId",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getStatus(
            { body: undefined, params: request.params },
            verificationDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

// ─── Supply Chain Routes ──────────────────────────

app.post<{ Body: CreateBatchRequest }>(
    "/batch",
    {
        schema: {
            body: {
                type: "object",
                required: ["cropType", "weight", "farmGps", "farmerAddr"],
                properties: {
                    cropType: { type: "string", minLength: 1 },
                    weight: { type: "number", minimum: 1 },
                    farmGps: { type: "string", minLength: 1 },
                    farmingPractices: { type: "string" },
                    organicCertId: { type: "string" },
                    farmerAddr: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postCreateBatch({ body: request.body }, supplyChainDeps);
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.post<{ Body: LogCheckpointRequest }>(
    "/checkpoint",
    {
        schema: {
            body: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                    gpsLat: { type: "string" },
                    gpsLng: { type: "string" },
                    temperature: { type: "number" },
                    humidity: { type: "number" },
                    handlerType: { type: "string" },
                    notes: { type: "string" },
                    photoHash: { type: "string" },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postLogCheckpoint({ body: request.body }, supplyChainDeps);
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.post<{ Body: InitiateHandoffRequest }>(
    "/handoff/initiate",
    {
        schema: {
            body: {
                type: "object",
                required: ["batchAsaId", "fromAddr", "toAddr"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                    fromAddr: { type: "string", minLength: 1 },
                    toAddr: { type: "string", minLength: 1 },
                    handoffType: { type: "string" },
                    handoffPhotoHashes: { type: "string" },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postInitiateHandoff({ body: request.body }, supplyChainDeps);
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.post<{ Body: ConfirmHandoffRequest }>(
    "/handoff/confirm",
    {
        schema: {
            body: {
                type: "object",
                required: ["batchAsaId", "handoffIndex"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                    handoffIndex: { type: "number", minimum: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postConfirmHandoff({ body: request.body }, supplyChainDeps);
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { batchAsaId: string; handoffIndex: string } }>(
    "/handoff/confirm/transaction/:batchAsaId/:handoffIndex",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId", "handoffIndex"],
                properties: {
                    batchAsaId: { type: "string" },
                    handoffIndex: { type: "string" },
                },
            },
        },
    },
    async (request, reply) => {
        const response = await getConfirmHandoffTransaction({ params: request.params });
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { batchAsaId: string } }>(
    "/batch/:batchAsaId",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getBatchDetails(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.post<{ Params: { batchAsaId: string }; Body: FundEscrowRequest }>(
    "/batch/:batchAsaId/escrow/fund",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
            body: {
                type: "object",
                required: ["buyerAddr", "amount"],
                properties: {
                    buyerAddr: { type: "string", minLength: 1 },
                    amount: { type: "number", minimum: 0.000001 },
                    batchId: { type: "string" },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postFundEscrow(
            { body: request.body, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.post<{ Params: { batchAsaId: string } }>(
    "/batch/:batchAsaId/escrow/release",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postReleaseEscrow(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { batchAsaId: string } }>(
    "/batch/:batchAsaId/carbon",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getCarbonScore(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { farmerAddr: string } }>(
    "/farmer/:farmerAddr/reputation",
    {
        schema: {
            params: {
                type: "object",
                required: ["farmerAddr"],
                properties: {
                    farmerAddr: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getFarmerReputation(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { farmerAddr: string } }>(
    "/farmer/:farmerAddr/payments",
    {
        schema: {
            params: {
                type: "object",
                required: ["farmerAddr"],
                properties: {
                    farmerAddr: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getFarmerPayments(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

app.get<{ Params: { farmerAddr: string } }>(
    "/farmer/:farmerAddr/batches",
    {
        schema: {
            params: {
                type: "object",
                required: ["farmerAddr"],
                properties: {
                    farmerAddr: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getFarmerBatches(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";

// ─── Health Check ──────────────────────────────────

app.get("/health", async (_request, reply) => {
    reply.send({
        status: "ok",
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
        services: {
            contractAppId: process.env.CONTRACT_APP_ID || null,
            facilitator: process.env.FACILITATOR_URL || "https://facilitator.goplausible.xyz",
        },
    });
});

// ─── Get Batch Journey ─────────────────────────────

app.get<{ Params: { batchAsaId: string } }>(
    "/batch/:batchAsaId/journey",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await getBatchDetails(
            { body: undefined, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

// ─── Mint Batch ASA (NFT) ──────────────────────────

app.post<{ Params: { batchAsaId: string }; Body: MintBatchRequest }>(
    "/batch/:batchAsaId/mint",
    {
        schema: {
            params: {
                type: "object",
                required: ["batchAsaId"],
                properties: {
                    batchAsaId: { type: "string", minLength: 1 },
                },
            },
            body: {
                type: "object",
                required: ["metadataHash"],
                properties: {
                    metadataHash: { type: "string", minLength: 1 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const response = await postMintBatchAsa(
            { body: request.body, params: request.params },
            supplyChainDeps,
        );
        if (response.headers) {
            reply.headers(response.headers);
        }
        reply.code(response.status).send(response.body);
    },
);

// ─── Testnet CVT Faucet ──────────────────────────

import algosdk from "algosdk";
import { algorandConfig, x402Config } from "./config/algorand.config.js";

app.post<{ Body: { address: string } }>(
    "/faucet/cvt",
    {
        schema: {
            body: {
                type: "object",
                required: ["address"],
                properties: {
                    address: { type: "string", minLength: 32 },
                },
                additionalProperties: false,
            },
        },
    },
    async (request, reply) => {
        const FAUCET_AMOUNT = 10_000; // base units of CVT (= 0.01 CVT with 6 decimals)
        const CVT_ASSET_ID = Number(x402Config.assetId);
        const mnemonic = algorandConfig.defaultSenderMnemonic;

        if (!mnemonic) {
            return reply.code(500).send({ error: "Faucet not configured (no sender mnemonic)" });
        }

        try {
            const algodUrl = algorandConfig.nodeUrl || "https://testnet-api.algonode.cloud";
            const algodClient = new algosdk.Algodv2("", algodUrl, "");
            const merchantAccount = algosdk.mnemonicToSecretKey(mnemonic);
            const merchantAddress = merchantAccount.addr.toString();

            const params = await algodClient.getTransactionParams().do();
            const txn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
                sender: merchantAddress,
                receiver: request.body.address,
                amount: FAUCET_AMOUNT,
                assetIndex: CVT_ASSET_ID,
                suggestedParams: params,
            });

            const txId = txn.txID();
            const signedTxn = txn.signTxn(merchantAccount.sk);
            await algodClient.sendRawTransaction(signedTxn).do();
            await algosdk.waitForConfirmation(algodClient, txId, 6);

            app.log.info(`Faucet: sent ${FAUCET_AMOUNT} CVT base units to ${request.body.address} (txId: ${txId})`);
            return reply.code(200).send({
                success: true,
                txId,
                amount: FAUCET_AMOUNT,
                message: `Sent ${FAUCET_AMOUNT} CVT base units to your wallet`,
            });
        } catch (error: any) {
            app.log.error(`Faucet error: ${error.message}`);
            return reply.code(500).send({ error: error.message || "Faucet transfer failed" });
        }
    },
);

app.listen({ port, host }).catch((err) => {
    app.log.error(err);
    process.exit(1);
});
