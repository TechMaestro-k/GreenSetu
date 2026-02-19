/**
 * Inspect ContractSupply on-chain storage (boxes + global state).
 *
 * Usage:
 *   npx tsx scripts/inspect-contract-boxes.ts
 */

import algosdk from "algosdk";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

const appId = Number(process.env.CONTRACT_APP_ID || 0);
if (!appId) {
    throw new Error("CONTRACT_APP_ID is required in server/.env");
}

const algodUrl = process.env.ALGORAND_NODE_URL || "https://testnet-api.algonode.cloud";
const indexerUrl = process.env.ALGORAND_INDEXER_URL || "https://testnet-idx.algonode.cloud";

function clientConfig(urlString: string) {
    const url = new URL(urlString);
    return {
        server: `${url.protocol}//${url.hostname}`,
        port: url.port ? Number(url.port) : url.protocol === "https:" ? 443 : 80,
        token: url.hostname === "localhost" ? "a".repeat(64) : "",
    };
}

const algodCfg = clientConfig(algodUrl);
const indexerCfg = clientConfig(indexerUrl);
const algod = new algosdk.Algodv2(algodCfg.token, algodCfg.server, algodCfg.port);
const indexer = new algosdk.Indexer(indexerCfg.token, indexerCfg.server, indexerCfg.port);

function decodeUint64(bytes: Uint8Array): bigint {
    if (bytes.length < 8) return 0n;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return view.getBigUint64(0, false);
}

function toNumberSafe(value: bigint): number | string {
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (value > maxSafe) return value.toString();
    return Number(value);
}

const prefixDefs = [
    { prefix: "cphn", scope: "checkpoint", type: "string", field: "handlerType" },
    { prefix: "cpno", scope: "checkpoint", type: "string", field: "notes" },
    { prefix: "cpts", scope: "checkpoint", type: "uint64", field: "timestamp" },
    { prefix: "cpg", scope: "checkpoint", type: "string", field: "gps" },
    { prefix: "cpt", scope: "checkpoint", type: "uint64", field: "temperature" },
    { prefix: "cph", scope: "checkpoint", type: "uint64", field: "humidity" },
    { prefix: "cpp", scope: "checkpoint", type: "string", field: "photoHash" },

    { prefix: "hof", scope: "handoff", type: "string", field: "fromAddr" },
    { prefix: "hot", scope: "handoff", type: "string", field: "toAddr" },
    { prefix: "hoy", scope: "handoff", type: "string", field: "handoffType" },
    { prefix: "hos", scope: "handoff", type: "string", field: "status" },
    { prefix: "hca", scope: "handoff", type: "uint64", field: "confirmedAt" },
    { prefix: "hph", scope: "handoff", type: "string", field: "photoHashes" },

    { prefix: "bct", scope: "batch", type: "string", field: "cropType" },
    { prefix: "bfg", scope: "batch", type: "string", field: "farmGps" },
    { prefix: "boc", scope: "batch", type: "string", field: "organicCertId" },
    { prefix: "bfa", scope: "batch", type: "string", field: "farmerAddr" },
    { prefix: "bw", scope: "batch", type: "uint64", field: "weight" },
    { prefix: "bfp", scope: "batch", type: "string", field: "farmingPractices" },
    { prefix: "bca", scope: "batch", type: "uint64", field: "createdAt" },
    { prefix: "bas", scope: "batch", type: "uint64", field: "asaId" },

    { prefix: "cpn", scope: "batch", type: "uint64", field: "checkpointCount" },
    { prefix: "hon", scope: "batch", type: "uint64", field: "handoffCount" },

    { prefix: "vrs", scope: "batch", type: "string", field: "verificationResult" },
    { prefix: "vrc", scope: "batch", type: "uint64", field: "verificationConfidence" },
    { prefix: "vrr", scope: "batch", type: "string", field: "verificationReason" },
    { prefix: "vrv", scope: "batch", type: "string", field: "verificationVerifierAddr" },
    { prefix: "vrt", scope: "batch", type: "uint64", field: "verificationTimestamp" },
].sort((a, b) => b.prefix.length - a.prefix.length);

function matchPrefix(nameBytes: Uint8Array) {
    const nameStr = Buffer.from(nameBytes).toString("utf8");
    for (const def of prefixDefs) {
        if (nameStr.startsWith(def.prefix)) return def;
    }
    return null;
}

function parseKeyBytes(defPrefix: string, nameBytes: Uint8Array) {
    const prefixBytes = Buffer.from(defPrefix, "utf8");
    const keyBytes = nameBytes.slice(prefixBytes.length);
    const key = decodeUint64(keyBytes);
    return key;
}

function decodeString(valueBytes: Uint8Array): string {
    if (valueBytes.length >= 2) {
        const view = new DataView(valueBytes.buffer, valueBytes.byteOffset, valueBytes.byteLength);
        const len = view.getUint16(0, false);
        if (len > 0 && len <= valueBytes.length - 2) {
            return Buffer.from(valueBytes.slice(2, 2 + len)).toString("utf8");
        }
    }
    return Buffer.from(valueBytes).toString("utf8");
}

function decodeValue(defType: string, valueBytes: Uint8Array) {
    if (defType === "uint64") return toNumberSafe(decodeUint64(valueBytes));
    return decodeString(valueBytes);
}

async function main() {
    console.log(`Inspecting app ${appId}...`);

    // Global state
    const appInfo = await algod.getApplicationByID(appId).do();
    const globalState: Record<string, string | number> = {};
    for (const entry of appInfo.params.globalState || []) {
        const key = Buffer.from(entry.key as unknown as string, "base64").toString("utf8");
        if (entry.value.type === 1) {
            globalState[key] = Buffer.from(entry.value.bytes as unknown as string, "base64").toString("utf8");
        } else {
            globalState[key] = Number(entry.value.uint);
        }
    }

    // Boxes list (indexer)
    let boxes: { name: string }[] = [];
    let next: string | undefined;
    do {
        const url = new URL(`/v2/applications/${appId}/boxes`, indexerUrl);
        if (next) url.searchParams.set("next", next);
        const res = await fetch(url.toString());
        if (!res.ok) {
            throw new Error(`Indexer boxes request failed: ${res.status}`);
        }
        const data = await res.json() as { boxes?: { name: string }[]; "next-token"?: string };
        boxes = boxes.concat(data.boxes || []);
        next = data["next-token"];
    } while (next);

    const output: any = {
        appId,
        globalState,
        batches: {},
        unknownBoxes: [],
    };

    for (const box of boxes) {
        const nameBytes = Buffer.from(box.name, "base64");
        const def = matchPrefix(nameBytes);
        if (!def) {
            output.unknownBoxes.push({ name: box.name });
            continue;
        }

        const key = parseKeyBytes(def.prefix, nameBytes);
        const value = await algod.getApplicationBoxByName(appId, nameBytes).do();
        const decoded = decodeValue(def.type, value.value);

        if (def.scope === "batch") {
            const batchId = key.toString();
            output.batches[batchId] = output.batches[batchId] || { checkpoints: {}, handoffs: {} };
            output.batches[batchId][def.field] = decoded;
        } else if (def.scope === "checkpoint") {
            const pk = Number(key);
            const batchId = Math.floor(pk / 10000).toString();
            const index = (pk % 10000).toString();
            output.batches[batchId] = output.batches[batchId] || { checkpoints: {}, handoffs: {} };
            output.batches[batchId].checkpoints[index] = output.batches[batchId].checkpoints[index] || {};
            output.batches[batchId].checkpoints[index][def.field] = decoded;
        } else if (def.scope === "handoff") {
            const pk = Number(key);
            const batchId = Math.floor(pk / 10000).toString();
            const index = (pk % 10000).toString();
            output.batches[batchId] = output.batches[batchId] || { checkpoints: {}, handoffs: {} };
            output.batches[batchId].handoffs[index] = output.batches[batchId].handoffs[index] || {};
            output.batches[batchId].handoffs[index][def.field] = decoded;
        }
    }

    console.log(JSON.stringify(output, null, 2));
}

main().catch((err) => {
    console.error("Error:", err);
    process.exit(1);
});
