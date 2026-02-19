"use client";

import Link from "next/link";
import { useWallet } from "../providers";
import { useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  DollarSign,
} from "lucide-react";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";

type VerificationResponse = {
  verification?: {
    batchAsaId: string;
    result: string;
    confidence: number;
    reason: string;
    verifierAddr: string;
    timestamp: number;
  };
  payment?: {
    amount: number;
    assetId?: number;
    txId?: string;
    timestamp: number;
  };
};

type PaymentRequired = {
  x402Version?: number;
  error?: string;
  accepts?: Array<{
    scheme: string;
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds?: number;
    extra?: {
      name?: string;
      decimals?: number;
      feePayer?: string;
    };
  }>;
};

export default function VerifyPage() {
  const { account, loading: walletLoading, httpClient, optInToCVT } = useWallet();

  const [batchId, setBatchId] = useState("");
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState<PaymentRequired | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResponse | null>(
    null
  );
  const [log, setLog] = useState<string[]>([]);

  const pushLog = (entry: string) =>
    setLog((prev) => [new Date().toLocaleTimeString() + "  " + entry, ...prev]);

  const fetchPaywall = async () => {
    setLoading(true);
    try {
      pushLog("Fetching payment requirements...");
      const res = await fetch(`${API_BASE}/verify`);
      const body = await res.json().catch(() => ({}));

      const headerLookup = (name: string) => {
        const direct = res.headers.get(name);
        if (direct) return direct;
        return res.headers.get(name.toLowerCase());
      };

      const paymentRequired = httpClient.getPaymentRequiredResponse(
        headerLookup,
        body
      ) as PaymentRequired;
      setPaywall(paymentRequired);
      pushLog("✓ Payment requirements fetched");
    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const verifyWithPayment = async () => {
    if (!batchId) {
      pushLog("ERROR: Enter a batch ID");
      return;
    }
    const trimmed = batchId.trim();
    if (!trimmed || trimmed.length > 80) {
      pushLog("ERROR: Invalid batch ID");
      return;
    }
    if (!account) {
      pushLog("ERROR: Connect wallet first");
      return;
    }

    setLoading(true);
    try {
      pushLog("Fetching payment requirements...");
      const paywallRes = await fetch(`${API_BASE}/verify`);
      const paywallBody = await paywallRes.json().catch(() => ({}));
      const paywallHeaderLookup = (name: string) =>
        paywallRes.headers.get(name) || paywallRes.headers.get(name.toLowerCase());

      const paymentRequired = httpClient.getPaymentRequiredResponse(
        paywallHeaderLookup,
        paywallBody
      );

      setPaywall(paymentRequired as PaymentRequired);

      const acceptedScheme = (paymentRequired as PaymentRequired)?.accepts?.[0];
      if (!acceptedScheme) {
        pushLog("ERROR: No payment scheme available from server");
        return;
      }

      if (account === acceptedScheme.payTo) {
        pushLog(
          "ERROR: Your wallet is the merchant. Please connect a different wallet."
        );
        return;
      }

      pushLog(
        `Payment: ${acceptedScheme.amount} ${acceptedScheme.extra?.name || "tokens"} to merchant`
      );

      pushLog("Creating payment — approve in Defly wallet...");
      const payload = await httpClient.createPaymentPayload(paymentRequired);

      const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);
      pushLog("Payment signed. Submitting verification...");

      const res = await fetch(`${API_BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...paymentHeaders },
        body: JSON.stringify({ batchAsaId: batchId }),
      });

      // Try JSON first; if response isn't JSON, also parse the payment-required header
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        let serverError = data?.error || data?.errorMessage || data?.errorReason || '';

        // If no error in body, try extracting from payment-required header
        if (!serverError) {
          const prHeader = res.headers.get("payment-required") || res.headers.get("PAYMENT-REQUIRED");
          if (prHeader) {
            try {
              const decoded = JSON.parse(atob(prHeader));
              serverError = decoded.error || '';
            } catch { /* ignore */ }
          }
        }

        // Make asset opt-in errors more user-friendly
        if (serverError.includes("missing from")) {
          serverError = "You need to opt-in to the CVT asset first. Use the 'Opt-in to CVT' button in the sidebar.";
        }

        throw new Error(serverError || `Verification failed (status ${res.status})`);
      }

      setVerifyResult(data as VerificationResponse);
      const amt = data.payment?.amount;
      pushLog(`✓ Payment: ${amt ? (amt / 1_000_000).toFixed(3) : "?"} CVT`);
      pushLog(
        `✓ Result: ${data.verification?.result} (${data.verification?.confidence}% confidence)`
      );
      pushLog(`✓ Reason: ${data.verification?.reason}`);
    } catch (err) {
      console.error("Verification error:", err);
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const isVerified = verifyResult?.verification?.result === "VERIFIED";

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="mb-2 text-4xl font-bold text-[var(--color-text)]">
            ✓ Verify Batch
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Pay 0.001 CVT to run AI verification on a batch with 6 anomaly checks.
          </p>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Batch ID Input */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-[var(--color-text)]">
                <Eye className="h-6 w-6 text-[var(--color-primary)]" />
                Enter Batch ID
              </h2>

              <div className="space-y-4">
                <input
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  placeholder="e.g., 14 (or local-555697325:1)"
                  className="w-full rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                />

                <p className="text-xs text-[var(--color-text-muted)]">
                  Enter the batch ID from the blockchain (numeric) or local identifier.
                </p>

                <button
                  onClick={fetchPaywall}
                  disabled={loading || !batchId}
                  className="w-full rounded-lg border-2 border-blue-600 bg-transparent px-6 py-3 font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Loading..." : "Check Payment Requirements"}
                </button>
              </div>
            </div>

            {/* Paywall Info */}
            {paywall && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-8">
                <h3 className="mb-4 flex items-center gap-2 font-bold text-amber-900">
                  <DollarSign className="h-5 w-5" />
                  Payment Required to Verify
                </h3>

                {paywall.accepts?.[0] && (
                  <div className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-amber-800">Amount</span>
                      <span className="font-mono font-semibold text-amber-900">
                        {paywall.accepts[0].amount}{" "}
                        {paywall.accepts[0].extra?.name || "tokens"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800">Asset</span>
                      <span className="font-mono font-semibold text-amber-900">
                        {paywall.accepts[0].asset}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800">Pay To</span>
                      <span className="font-mono font-semibold text-amber-900">
                        {paywall.accepts[0].payTo.slice(0, 12)}...
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-amber-800">Scheme</span>
                      <span className="font-mono font-semibold text-amber-900">
                        {paywall.accepts[0].scheme}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Verify with Payment */}
            {paywall && (
              <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
                <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
                  Execute Verification
                </h2>

                <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
                  {account ? (
                    <p className="text-sm text-blue-800">
                      <CheckCircle2 className="inline h-4 w-4 mr-2" />
                      Wallet: {account.slice(0, 8)}...{account.slice(-4)}
                    </p>
                  ) : (
                    <p className="text-sm text-blue-800">
                      <AlertCircle className="inline h-4 w-4 mr-2" />
                      Connect wallet to proceed
                    </p>
                  )}
                </div>

                <button
                  onClick={verifyWithPayment}
                  disabled={loading || !account}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-6 py-4 font-bold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
                >
                  {loading && <Loader2 className="h-5 w-5 animate-spin" />}
                  {loading ? "Processing Payment..." : "Pay & Verify (0.001 CVT)"}
                </button>
              </div>
            )}

            {/* Verification Result */}
            {verifyResult && (
              <div
                className={`rounded-xl border-2 p-8 ${isVerified
                  ? "border-green-200 bg-green-50"
                  : "border-red-200 bg-red-50"
                  }`}
              >
                <div className="flex items-start gap-4">
                  {isVerified ? (
                    <CheckCircle2 className="h-8 w-8 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <XCircle className="h-8 w-8 text-red-600 flex-shrink-0 mt-0.5" />
                  )}

                  <div className="flex-1">
                    <h3 className="mb-3 text-2xl font-bold">
                      {isVerified ? (
                        <span className="text-green-900">✓ Verified</span>
                      ) : (
                        <span className="text-red-900">✗ Flagged</span>
                      )}
                    </h3>

                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-semibold text-gray-700">
                          Batch ID:{" "}
                        </span>
                        <span className="font-mono">
                          {verifyResult.verification?.batchAsaId}
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">
                          Confidence:{" "}
                        </span>
                        <span className="font-mono">
                          {verifyResult.verification?.confidence}%
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">
                          Reason:{" "}
                        </span>
                        <span>{verifyResult.verification?.reason}</span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">
                          Payment:{" "}
                        </span>
                        <span className="font-mono">
                          {verifyResult.payment?.amount
                            ? (
                              verifyResult.payment.amount / 1_000_000
                            ).toFixed(3)
                            : "?"}{" "}
                          CVT
                        </span>
                      </div>
                      <div>
                        <span className="font-semibold text-gray-700">
                          Verifier:{" "}
                        </span>
                        <span className="font-mono">
                          {verifyResult.verification?.verifierAddr.slice(0, 12)}
                          ...
                        </span>
                      </div>
                    </div>

                    <div className="mt-4">
                      <Link
                        href={`/product/${verifyResult.verification?.batchAsaId}`}
                        className="inline-flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        View Full Journey
                      </Link>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* CVT Opt-in Card */}
            {account && (
              <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-6">
                <h3 className="mb-2 text-sm font-bold text-amber-900">
                  Before You Verify
                </h3>
                <p className="mb-4 text-xs text-amber-800">
                  1. Opt-in to the CVT asset (ASA 755696837).<br />
                  2. Get test CVT tokens from the faucet.<br />
                  If you already did both, you&apos;re good to go.
                </p>
                <div className="space-y-2">
                  <button
                    onClick={async () => {
                      try {
                        pushLog("Opting in to CVT asset...");
                        await optInToCVT();
                        pushLog("✓ CVT opt-in successful!");
                      } catch (err) {
                        const msg = (err as Error).message;
                        if (msg.includes("already opted in") || msg.includes("already holds")) {
                          pushLog("✓ Already opted in to CVT");
                        } else {
                          pushLog(`ERROR: CVT opt-in failed: ${msg}`);
                        }
                      }
                    }}
                    disabled={loading || walletLoading}
                    className="w-full rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    1. Opt-in to CVT Asset
                  </button>
                  <button
                    onClick={async () => {
                      try {
                        pushLog("Requesting test CVT from faucet...");
                        const API = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";
                        const res = await fetch(`${API}/faucet/cvt`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ address: account }),
                        });
                        const data = await res.json();
                        if (res.ok) {
                          pushLog(`✓ Received ${data.amount} CVT base units (txId: ${data.txId?.slice(0, 12)}...)`);
                        } else {
                          pushLog(`ERROR: Faucet failed: ${data.error || "Unknown error"}`);
                        }
                      } catch (err) {
                        pushLog(`ERROR: Faucet request failed: ${(err as Error).message}`);
                      }
                    }}
                    disabled={loading || walletLoading}
                    className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    2. Get Test CVT Tokens
                  </button>
                </div>
              </div>
            )}

            {/* Activity Log */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-6 backdrop-blur-sm h-fit sticky top-24">
              <h3 className="mb-4 text-lg font-bold text-[var(--color-text)]">
                Activity Log
              </h3>

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {log.length === 0 ? (
                  <p className="text-xs text-[var(--color-text-muted)]">
                    Enter a batch ID and fetch payment requirements to get started.
                  </p>
                ) : (
                  log.map((entry, idx) => (
                    <div
                      key={`log-${idx}`}
                      className="text-xs font-mono text-[var(--color-text-muted)] break-words"
                    >
                      {entry}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
