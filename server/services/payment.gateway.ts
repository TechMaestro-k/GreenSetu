import {
    HTTPFacilitatorClient,
    x402HTTPResourceServer,
    x402ResourceServer,
    type HTTPAdapter,
    type HTTPProcessResult,
    type HTTPRequestContext,
    type ProcessSettleResultResponse,
    type RouteConfig,
    type RoutesConfig,
} from "@x402-avm/core/server";
import type { Network, PaymentPayload, PaymentRequirements } from "@x402-avm/core/types";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/server";
import { x402Config } from "../config/algorand.config.js";
import { HttpRequest } from "../types/http.types.js";
import { PaymentReceipt, VerificationRequest } from "../types/verification.types.js";

const DEFAULT_RESOURCE_DESCRIPTION = "GreenSetu verification";
const DEFAULT_RESOURCE_MIME = "application/json";

export interface PaymentGateway {
    processRequest(req: HttpRequest<VerificationRequest>): Promise<HTTPProcessResult>;
    settlePayment(
        paymentPayload: PaymentPayload,
        paymentRequirements: PaymentRequirements,
        declaredExtensions?: Record<string, unknown>,
    ): Promise<ProcessSettleResultResponse>;
    buildPaymentReceipt(settle: ProcessSettleResultResponse): PaymentReceipt | null;
}

export class X402PaymentGateway implements PaymentGateway {
    private httpServer: x402HTTPResourceServer;
    private initialized = false;
    private initializing: Promise<void> | null = null;
    private routes: RoutesConfig;

    constructor() {
        const facilitatorClient = new HTTPFacilitatorClient({ url: x402Config.facilitatorUrl });
        const resourceServer = new x402ResourceServer(facilitatorClient);
        registerExactAvmScheme(resourceServer);

        this.routes = {
            "/verify": this.buildVerifyRoute(),
        };

        this.httpServer = new x402HTTPResourceServer(resourceServer, this.routes);
    }

    async processRequest(req: HttpRequest<VerificationRequest>): Promise<HTTPProcessResult> {
        await this.ensureInitialized();
        const context = this.buildContext(req);
        console.log('[PaymentGateway] Processing request, headers:', Object.keys(req.headers || {}));
        const result = await this.httpServer.processHTTPRequest(context);
        console.log('[PaymentGateway] Process result type:', result.type);
        if (result.type === 'payment-error') {
            console.log('[PaymentGateway] Payment error response:', result.response);
        }
        return result;
    }

    async settlePayment(
        paymentPayload: PaymentPayload,
        paymentRequirements: PaymentRequirements,
        declaredExtensions?: Record<string, unknown>,
    ): Promise<ProcessSettleResultResponse> {
        await this.ensureInitialized();
        console.log('[PaymentGateway] Settling payment...');
        console.log('[PaymentGateway] Payment payload keys:', Object.keys(paymentPayload || {}));
        console.log('[PaymentGateway] Payment requirements:', paymentRequirements);
        const result = await this.httpServer.processSettlement(paymentPayload, paymentRequirements, declaredExtensions);
        console.log('[PaymentGateway] Settlement result:', { success: result.success, error: result.errorMessage || result.errorReason });
        return result;
    }

    buildPaymentReceipt(settle: ProcessSettleResultResponse): PaymentReceipt | null {
        if (!settle.success) return null;

        const amount = Number.parseInt(settle.requirements.amount, 10);
        const assetId = Number.parseInt(settle.requirements.asset, 10);
        const timestamp = Math.floor(Date.now() / 1000);

        return {
            amount: Number.isFinite(amount) ? amount : 0,
            assetId: Number.isFinite(assetId) ? assetId : undefined,
            txId: settle.transaction,
            timestamp,
        };
    }

    private async ensureInitialized(): Promise<void> {
        if (this.initialized) return;
        if (!x402Config.payTo) {
            throw new Error("AVM_ADDRESS is required for x402 payments");
        }
        if (!this.initializing) {
            this.initializing = this.httpServer
                .initialize()
                .then(() => {
                    this.initialized = true;
                })
                .catch((error) => {
                    // Allow retries if facilitator lookup fails (transient network issues)
                    this.initializing = null;
                    throw error;
                });
        }
        await this.initializing;
    }

    private buildVerifyRoute(): RouteConfig {
        return {
            accepts: {
                scheme: "exact",
                payTo: x402Config.payTo,
                price: this.buildPrice(),
                network: x402Config.network as Network,
                maxTimeoutSeconds: x402Config.maxTimeoutSeconds,
            },
            description: DEFAULT_RESOURCE_DESCRIPTION,
            mimeType: DEFAULT_RESOURCE_MIME,
            unpaidResponseBody: () => ({
                contentType: "application/json",
                body: { error: "payment required" },
            }),
        };
    }

    private buildPrice() {
        return {
            asset: x402Config.assetId,
            amount: x402Config.amount,
            extra: {
                name: x402Config.assetName,
                decimals: x402Config.assetDecimals,
            },
        };
    }

    private buildContext(req: HttpRequest<VerificationRequest>): HTTPRequestContext {
        const method = req.method ?? "GET";
        const rawUrl = req.url ?? "/verify";
        const parsedUrl = new URL(rawUrl, "http://localhost");
        const headers = req.headers ?? {};

        const adapter: HTTPAdapter = {
            getHeader: (name: string) => this.getHeaderValue(headers, name),
            getMethod: () => method,
            getPath: () => parsedUrl.pathname,
            getUrl: () => rawUrl,
            getAcceptHeader: () => this.getHeaderValue(headers, "accept") ?? "*/*",
            getUserAgent: () => this.getHeaderValue(headers, "user-agent") ?? "",
            getQueryParams: () => this.getQueryParams(parsedUrl.searchParams),
            getQueryParam: (name: string) => this.getQueryParam(parsedUrl.searchParams, name),
            getBody: () => req.body,
        };

        return {
            adapter,
            path: parsedUrl.pathname,
            method,
        };
    }

    private getHeaderValue(
        headers: Record<string, string | string[] | undefined>,
        name: string,
    ): string | undefined {
        const key = name.toLowerCase();
        const value = headers[key] ?? headers[name];
        if (Array.isArray(value)) {
            return value.join(",");
        }
        return value;
    }

    private getQueryParams(params: URLSearchParams): Record<string, string | string[]> {
        const result: Record<string, string | string[]> = {};
        params.forEach((value, key) => {
            const existing = result[key];
            if (!existing) {
                result[key] = value;
                return;
            }
            if (Array.isArray(existing)) {
                existing.push(value);
                return;
            }
            result[key] = [existing, value];
        });
        return result;
    }

    private getQueryParam(params: URLSearchParams, name: string): string | string[] | undefined {
        const values = params.getAll(name);
        if (values.length === 0) return undefined;
        if (values.length === 1) return values[0];
        return values;
    }
}
