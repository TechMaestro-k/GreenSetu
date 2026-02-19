"use client";

import { useEffect, useMemo, useState } from "react";
import algosdk from "algosdk";
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";

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

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";
const ALGOD_URL =
  process.env.NEXT_PUBLIC_ALGOD_URL || "https://testnet-api.algonode.cloud";
const CVT_ASSET_ID = 755696837;

const deflyWallet = new DeflyWalletConnect();

export default function HomePage() {
  const [account, setAccount] = useState<string | null>(null);
  const [batchId, setBatchId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [paywall, setPaywall] = useState<PaymentRequired | null>(null);
  const [verifyResult, setVerifyResult] = useState<VerificationResponse | null>(null);
  const [statusResult, setStatusResult] = useState<VerificationResponse | null>(null);
  const [log, setLog] = useState<string[]>([]);

  const httpClient = useMemo(() => {
    const client = new x402Client();
    const signer = {
      address: account || "",
      signTransactions: async (txns: Uint8Array[], indexes?: number[]) => {
        if (!account) throw new Error("Wallet not connected");

        const signerIndexes = indexes || txns.map((_, i) => i);
        console.log(`[Signer] ${txns.length} txns, signing indexes:`, signerIndexes);

        const txnPayloads = txns.map((txn, i) => {
          const shouldSign = signerIndexes.includes(i);
          const decodedTxn = algosdk.decodeUnsignedTransaction(txn);
          console.log(`[Signer] Txn ${i}: type=${decodedTxn.type}, shouldSign=${shouldSign}`);
          return {
            txn: decodedTxn,
            signers: shouldSign ? [account] : [],
          };
        });

        console.log('[Signer] Requesting Defly signature...');
        const signed = await deflyWallet.signTransaction([txnPayloads]);
        console.log('[Signer] Defly returned:', signed?.length, 'items for', txns.length, 'txns');

        // Build result array matching txns.length.
        // Defly may return ONLY the signed txns (shorter array) instead of
        // a full-length array with nulls for unsigned positions.
        const result: (Uint8Array | null)[] = new Array(txns.length).fill(null);

        const toBytes = (item: unknown): Uint8Array | null => {
          if (!item) return null;
          if (item instanceof Uint8Array) return item;
          if (typeof item === "string") return new Uint8Array(Buffer.from(item, "base64"));
          if (typeof (item as { blob?: string }).blob === "string") {
            return new Uint8Array(Buffer.from((item as { blob: string }).blob, "base64"));
          }
          return null;
        };

        if (signed.length === txns.length) {
          // Full-length array — place signed bytes at signed positions only
          for (let i = 0; i < txns.length; i++) {
            if (signerIndexes.includes(i)) {
              result[i] = toBytes(signed[i]);
            }
          }
        } else {
          // Defly returned only signed txns — map them to correct positions
          console.log('[Signer] Realigning: got', signed.length, 'signed for indexes', signerIndexes);
          for (let j = 0; j < signed.length && j < signerIndexes.length; j++) {
            result[signerIndexes[j]] = toBytes(signed[j]);
          }
        }

        console.log('[Signer] Result:', result.map((r, i) => `${i}:${r ? 'signed' : 'null'}`));
        return result;
      },
    };

    registerExactAvmScheme(client, {
      signer,
      algodConfig: {
        algodClient: new algosdk.Algodv2("", ALGOD_URL, ""),
      },
    });

    return new x402HTTPClient(client);
  }, [account]);

  useEffect(() => {
    deflyWallet.reconnectSession().then((accounts) => {
      if (accounts.length) setAccount(accounts[0]);
    });
  }, []);

  const pushLog = (entry: string) =>
    setLog((prev) => [new Date().toLocaleTimeString() + "  " + entry, ...prev]);

  const getCurrentLocation = async (): Promise<{ lat: number; lng: number }> => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      throw new Error("Geolocation is not supported in this browser");
    }

    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            lat: Number(position.coords.latitude.toFixed(6)),
            lng: Number(position.coords.longitude.toFixed(6)),
          });
        },
        (error) => reject(new Error(error.message)),
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      );
    });
  };

  const connectWallet = async () => {
    const accounts = await deflyWallet.connect();
    setAccount(accounts[0]);
    pushLog("Wallet connected");
  };

  const disconnectWallet = async () => {
    await deflyWallet.disconnect();
    setAccount(null);
    pushLog("Wallet disconnected");
  };

  const optInToCVT = async () => {
    if (!account) return pushLog("Connect wallet first");
    setLoading(true);
    try {
      pushLog("Creating CVT opt-in transaction...");
      const algodClient = new algosdk.Algodv2("", ALGOD_URL, "");
      const params = await algodClient.getTransactionParams().do();

      // Create opt-in transaction (asset transfer to self with amount 0)
      const optInTxn = algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
        sender: account,
        receiver: account,
        amount: 0,
        assetIndex: CVT_ASSET_ID,
        suggestedParams: params,
      });

      pushLog("Requesting signature from Defly...");
      const signedTxns = await deflyWallet.signTransaction([[{
        txn: optInTxn,
        signers: [account],
      }]]);

      pushLog("Sending opt-in transaction...");
      const response = await algodClient.sendRawTransaction(signedTxns[0]).do();
      const txId = (response as unknown as Record<string, string>)['txId'];
      pushLog(`Waiting for confirmation: ${txId}`);

      await algosdk.waitForConfirmation(algodClient, txId, 4);
      pushLog(`✓ Successfully opted in to CVT (Asset ${CVT_ASSET_ID})`);
    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const createBatch = async () => {
    setLoading(true);
    try {
      pushLog("Detecting location...");
      const { lat, lng } = await getCurrentLocation();
      const farmGps = `${lat}|${lng}`;

      const res = await fetch(`${API_BASE}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType: "Coffee",
          weight: 1200,
          farmGps,
          farmingPractices: "shade-grown",
          organicCertId: "ORG-TEST-001",
          farmerAddr: account || "FARMER-TEST-ADDR",
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create batch");
      setBatchId(body.batchId);
      pushLog(`✓ Location detected: ${farmGps}`);
      pushLog(`Batch ${body.batchId} created`);
    } catch (err) {
      pushLog((err as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const fetchPaywall = async () => {
    const res = await fetch(`${API_BASE}/verify`);
    const body = await res.json().catch(() => ({}));

    const headerLookup = (name: string) => {
      const direct = res.headers.get(name);
      if (direct) return direct;
      return res.headers.get(name.toLowerCase());
    };

    try {
      const paymentRequired = httpClient.getPaymentRequiredResponse(
        headerLookup,
        body,
      ) as PaymentRequired;
      setPaywall(paymentRequired);
      return paymentRequired;
    } catch {
      // Fallback: decode the payment-required header directly if available
      const rawHeader = headerLookup("payment-required");
      if (!rawHeader) throw new Error("Missing payment-required header");
      try {
        const normalized = rawHeader.padEnd(rawHeader.length + (4 - (rawHeader.length % 4)) % 4, "=");
        const decoded = JSON.parse(atob(normalized)) as PaymentRequired;
        setPaywall(decoded);
        return decoded;
      } catch (decodeErr) {
        console.error("Failed to decode payment-required header:", rawHeader, decodeErr);
        throw new Error("Could not parse payment requirements from server. The payment-required header may have changed format.");
      }
    }
  };

  const verifyWithPayment = async () => {
    if (!batchId) return pushLog("Set a batch ID first");
    if (!/^\d+$/.test(batchId.trim())) return pushLog("Batch ID must be a positive number");
    if (!account) return pushLog("Connect wallet first");
    setLoading(true);
    try {
      // Step 1: Fetch payment requirements from GET /verify
      pushLog("Fetching payment requirements...");
      const paywallRes = await fetch(`${API_BASE}/verify`);
      const paywallBody = await paywallRes.json().catch(() => ({}));
      const paywallHeaderLookup = (name: string) =>
        paywallRes.headers.get(name) || paywallRes.headers.get(name.toLowerCase());
      const paymentRequired = httpClient.getPaymentRequiredResponse(paywallHeaderLookup, paywallBody);

      // Update paywall display state
      setPaywall(paymentRequired as PaymentRequired);

      const acceptedScheme = (paymentRequired as PaymentRequired)?.accepts?.[0];
      if (!acceptedScheme) {
        pushLog("ERROR: No payment scheme available from server");
        return;
      }

      // Step 2: Guard against self-payment (merchant wallet)
      if (account === acceptedScheme.payTo) {
        pushLog("ERROR: Your connected wallet is the merchant (payment receiver).");
        pushLog("Please connect a DIFFERENT wallet to pay for verification.");
        return;
      }

      pushLog(`Payment: ${acceptedScheme.amount} ${acceptedScheme.extra?.name || "tokens"} to ${acceptedScheme.payTo.slice(0, 8)}...`);

      // Step 3: Create signed payment payload (triggers Defly approval)
      pushLog("Creating payment — approve the transaction in Defly...");
      const payload = await httpClient.createPaymentPayload(paymentRequired);

      // Step 4: Encode payment headers
      const paymentHeaders = httpClient.encodePaymentSignatureHeader(payload);
      pushLog("Payment signed. Submitting verification...");

      // Step 5: POST /verify with payment headers
      const res = await fetch(`${API_BASE}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...paymentHeaders },
        body: JSON.stringify({ batchAsaId: batchId }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || `Verification failed (status ${res.status})`);
      }

      // Step 6: Display results (fixes C3 — setVerifyResult was never called)
      setVerifyResult(data as VerificationResponse);
      const amt = data.payment?.amount;
      pushLog(`✓ Payment: ${amt ? (amt / 1_000_000).toFixed(3) : "?"} CVT`);
      pushLog(`✓ Result: ${data.verification?.result} (${data.verification?.confidence}% confidence)`);
      pushLog(`✓ Reason: ${data.verification?.reason}`);
    } catch (err) {
      console.error("Verification error:", err);
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const fetchStatus = async () => {
    if (!batchId) return pushLog("Set a batch ID first");
    if (!/^\d+$/.test(batchId.trim())) return pushLog("Batch ID must be a positive number");
    pushLog(`Fetching status for batch ${batchId}...`);
    const res = await fetch(`${API_BASE}/status/${batchId}`);
    const body = await res.json();
    if (!res.ok) {
      pushLog(`✗ Status check failed for batch ${batchId}: ${body.error}`);
      return;
    }
    setStatusResult(body);
    pushLog(`✓ Status fetched for batch ${batchId}: ${body.verification?.result}`);
  };

  return (
    <main
      style={{
        padding: "48px 6vw",
        background: "linear-gradient(135deg, #f4f1ec 0%, #efe8dd 40%, #f8f6f2 100%)",
      }}
    >
      <section
        style={{
          maxWidth: 1100,
          margin: "0 auto",
          display: "grid",
          gap: 24,
        }}
      >
        <header
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 16,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h1 style={{ fontSize: 42, margin: 0 }}>GreenSetu</h1>
            <p style={{ margin: "8px 0 0", maxWidth: 560 }}>
              Farm-to-consumer provenance. Smart contract storage. x402 paywall.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            {account ? (
              <>
                <span style={{ fontSize: 14 }}>
                  {account.slice(0, 6)}...{account.slice(-6)}
                </span>
                <button
                  onClick={optInToCVT}
                  disabled={loading}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid #1d2b36",
                    background: "#1d2b36",
                    color: "#f4f1ec",
                  }}
                >
                  Opt-in CVT
                </button>
                <button
                  onClick={disconnectWallet}
                  style={{
                    padding: "10px 16px",
                    borderRadius: 999,
                    border: "1px solid #1d2b36",
                    background: "transparent",
                  }}
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connectWallet}
                style={{
                  padding: "10px 18px",
                  borderRadius: 999,
                  border: "none",
                  background: "#1d2b36",
                  color: "#f4f1ec",
                }}
              >
                Connect Defly Wallet
              </button>
            )}
          </div>
        </header>

        <section
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 16,
          }}
        >
          <div style={cardStyle}>
            <h3>Step 1 — Create Batch</h3>
            <p>Create a batch on-chain from the farmer side.</p>
            <button onClick={createBatch} disabled={loading} style={primaryStyle}>
              Create Batch
            </button>
          </div>

          <div style={cardStyle}>
            <h3>Step 2 — Paywall Preview</h3>
            <p>Fetch the payment requirements for verification.</p>
            <button onClick={fetchPaywall} disabled={loading} style={ghostStyle}>
              Show Paywall
            </button>
            {paywall?.accepts?.[0] && (
              <div style={{ marginTop: 12, fontSize: 14 }}>
                <div>Amount: {paywall.accepts[0].amount}</div>
                <div>Asset: {paywall.accepts[0].extra?.name || paywall.accepts[0].asset}</div>
                <div>Pay To: {paywall.accepts[0].payTo}</div>
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h3>Step 3 — Pay & Verify</h3>
            <p>Pay 0.001 CVT via x402 to verify a batch on-chain.</p>
            <input
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              placeholder="Batch ID"
              style={inputStyle}
            />
            <button onClick={verifyWithPayment} disabled={loading || !account} style={primaryStyle}>
              {loading ? "Processing..." : "Pay & Verify"}
            </button>
            {!account && (
              <p style={{ fontSize: 13, color: "#888", marginTop: 8 }}>
                Connect a wallet first (must NOT be the merchant wallet).
              </p>
            )}
          </div>

          <div style={cardStyle}>
            <h3>Step 4 — Check Status</h3>
            <p>Read the verification stored on-chain.</p>
            <button onClick={fetchStatus} disabled={loading} style={ghostStyle}>
              Fetch Status
            </button>
          </div>
        </section>

        <section style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
          <div style={cardStyle}>
            <h3>Verification Result</h3>
            <pre style={preStyle}>{JSON.stringify(verifyResult, null, 2)}</pre>
          </div>
          <div style={cardStyle}>
            <h3>Status Result</h3>
            <pre style={preStyle}>{JSON.stringify(statusResult, null, 2)}</pre>
          </div>
        </section>

        <section style={cardStyle}>
          <h3>Activity Log</h3>
          <div style={{ display: "grid", gap: 6, fontSize: 13 }}>
            {log.length === 0 ? (
              <span>No actions yet.</span>
            ) : (
              log.map((entry, idx) => <span key={`log-${idx}-${entry.slice(0, 20)}`}>{entry}</span>)
            )}
          </div>
        </section>
      </section>
    </main>
  );
}

const cardStyle: React.CSSProperties = {
  padding: 20,
  borderRadius: 18,
  background: "rgba(255, 255, 255, 0.8)",
  boxShadow: "0 10px 30px rgba(12, 16, 24, 0.08)",
  border: "1px solid rgba(29, 43, 54, 0.08)",
};

const primaryStyle: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "none",
  background: "#1d2b36",
  color: "#f4f1ec",
};

const ghostStyle: React.CSSProperties = {
  marginTop: 12,
  width: "100%",
  padding: "12px 16px",
  borderRadius: 12,
  border: "1px solid #1d2b36",
  background: "transparent",
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid rgba(29, 43, 54, 0.2)",
  marginTop: 8,
};

const preStyle: React.CSSProperties = {
  background: "#0f141a",
  color: "#f4f1ec",
  padding: 12,
  borderRadius: 12,
  overflowX: "auto",
  minHeight: 180,
  fontSize: 12,
};
