import { HttpRequest, HttpResponse } from "../types/http.types.js";
import {
    VerificationRequest,
    VerificationResponse,
    VerificationStatusResponse,
} from "../types/verification.types.js";
import { PaymentGateway } from "../services/payment.gateway.js";
import { VerificationEngine } from "../services/verification.engine.js";
import { IndexerClientAdapter } from "../blockchain/indexer.client.js";
import type { PaymentRequired } from "@x402-avm/core/types";

export interface VerificationRouteDeps {
    engine: VerificationEngine;
    payment: PaymentGateway;
    indexer: IndexerClientAdapter;
}

export async function getVerifyPayment(
    req: HttpRequest<VerificationRequest>,
    deps: VerificationRouteDeps,
): Promise<HttpResponse<PaymentRequired | { error: string }>> {
    try {
        const paymentResult = await deps.payment.processRequest(req);

        if (paymentResult.type === "payment-error") {
            const paymentBody = paymentResult.response.body as PaymentRequired | { error: string } | undefined;
            return {
                status: paymentResult.response.status,
                headers: paymentResult.response.headers,
                body: paymentBody ?? { error: "payment required" },
            };
        }

        return {
            status: 200,
            body: { error: "payment already verified; use POST /verify" },
        };
    } catch (error) {
        console.error("Error generating payment requirement:", error);
        return { status: 500, body: { error: `Payment requirement failed: ${error}` } };
    }
}

export async function postVerify(
    req: HttpRequest<VerificationRequest>,
    deps: VerificationRouteDeps,
): Promise<HttpResponse<VerificationResponse | PaymentRequired | { error: string }>> {
    const batchAsaId = req.body.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    console.log(`[POST /verify] Received request for batch ${batchAsaId}`);
    console.log(`[POST /verify] Request headers:`, Object.keys(req.headers || {}));
    console.log(`[POST /verify] Has payment-signature:`, !!(req.headers as Record<string, unknown>)?.['payment-signature']);
    console.log(`[POST /verify] Has PAYMENT-SIGNATURE:`, !!(req.headers as Record<string, unknown>)?.['PAYMENT-SIGNATURE']);
    const paymentSigVal = (req.headers as Record<string, unknown>)?.['payment-signature'] || (req.headers as Record<string, unknown>)?.['PAYMENT-SIGNATURE'];
    console.log(`[POST /verify] payment-signature value (first 100 chars):`, typeof paymentSigVal === 'string' ? paymentSigVal.substring(0, 100) : paymentSigVal);

    try {
        const paymentResult = await deps.payment.processRequest(req);
        console.log(`[POST /verify] Payment result type: ${paymentResult.type}`);

        if (paymentResult.type === "payment-error") {
            const paymentBody = paymentResult.response.body as PaymentRequired | { error: string } | undefined;
            const responseHeaders = paymentResult.response.headers || {};

            // Extract actual error from the PAYMENT-REQUIRED header (base64 JSON)
            let errorMessage = "payment required";
            const prHeader = (responseHeaders as Record<string, string>)["PAYMENT-REQUIRED"]
                || (responseHeaders as Record<string, string>)["payment-required"];
            if (prHeader) {
                try {
                    const decoded = JSON.parse(Buffer.from(prHeader, "base64").toString("utf-8"));
                    if (decoded.error) errorMessage = decoded.error;
                } catch { /* ignore decode errors */ }
            }

            console.log(`[POST /verify] ❌ Payment error — status: ${paymentResult.response.status}`);
            console.log(`[POST /verify] ❌ Error message: ${errorMessage}`);

            // Ensure the body always has an error field with the actual message
            const body = (paymentBody && typeof paymentBody === "object" && Object.keys(paymentBody).length > 0)
                ? paymentBody
                : { error: errorMessage };

            return {
                status: paymentResult.response.status,
                headers: responseHeaders,
                body,
            };
        }

        if (paymentResult.type === "no-payment-required") {
            return {
                status: 402,
                body: { error: "payment required" },
            };
        }

        console.log(`[POST /verify] Running verification for batch ${batchAsaId}...`);
        const verification = await deps.engine.verify(req.body);
        console.log(`[POST /verify] Verification complete:`, verification);

        console.log(`[POST /verify] Settling payment...`);
        const settlement = await deps.payment.settlePayment(
            paymentResult.paymentPayload,
            paymentResult.paymentRequirements,
            paymentResult.declaredExtensions,
        );
        console.log(`[POST /verify] Settlement success: ${settlement.success}`);
        console.log(`[POST /verify] Settlement full result:`, JSON.stringify({
            success: settlement.success,
            errorMessage: settlement.errorMessage,
            errorReason: settlement.errorReason,
            transaction: settlement.transaction,
        }));

        if (!settlement.success) {
            console.log(`[POST /verify] ❌ Settlement FAILED:`, settlement.errorMessage || settlement.errorReason);
            return {
                status: 402,
                body: { error: settlement.errorMessage || settlement.errorReason || "payment settlement failed" },
            };
        }

        const payment = deps.payment.buildPaymentReceipt(settlement);

        console.log(`[POST /verify] ✅ Success for batch ${batchAsaId}`);
        return {
            status: 200,
            headers: settlement.headers,
            body: { verification, payment: payment ?? undefined },
        };
    } catch (error) {
        console.error("[POST /verify] ❌ Error in verification:", error);
        return {
            status: 500,
            body: { error: `Verification failed: ${error}` },
        };
    }
}

export async function getStatus(
    req: HttpRequest<unknown, { batchAsaId: string }>,
    deps: VerificationRouteDeps,
): Promise<HttpResponse<VerificationStatusResponse | { error: string }>> {
    const batchAsaId = req.params?.batchAsaId?.trim();
    if (!batchAsaId) {
        return { status: 400, body: { error: "batchAsaId is required" } };
    }

    const verification = await deps.indexer.getVerification(batchAsaId);
    if (!verification) {
        return { status: 404, body: { error: "verification not found" } };
    }

    return { status: 200, body: { verification } };
}
