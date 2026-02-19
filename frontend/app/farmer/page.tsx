"use client";

import { useWallet } from "../providers";
import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle2, Leaf, Plus, Download, QrCode } from "lucide-react";
import algosdk from "algosdk";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";

type Batch = {
  batchId: string;
  cropType: string;
  weight: number;
  farmGps: string;
  organicCertId: string;
  farmerAddr: string;
  createdAt: number;
};

type FarmerReputation = {
  farmerAddr: string;
  totalBatches: number;
  verifiedCount: number;
  flaggedCount: number;
  tier: string;
  tierEmoji: string;
  carbonCreditsTotal: number;
  totalPaymentsReceived: number;
};

type PaymentRecord = {
  batchId: string;
  amount: number;
  currency: string;
  timestamp: number;
};

export default function FarmerPage() {
  const { account, loading: walletLoading, deflyWallet } = useWallet();
  const [batchId, setBatchId] = useState("");
  const [batch, setBatch] = useState<Batch | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [log, setLog] = useState<string[]>([]);
  const [reputation, setReputation] = useState<FarmerReputation | null>(null);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [repLoading, setRepLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);
  const [pendingHandoffs, setPendingHandoffs] = useState<Array<{ batchId: string; handoffIndex: number; fromAddr: string; toAddr: string }>>([]);

  // Form state
  const [cropType, setCropType] = useState("Coffee");
  const [weight, setWeight] = useState("1200");
  const [farmGps, setFarmGps] = useState("");
  const [organicCertId, setOrganicCertId] = useState("ORG-TEST-001");

  // Checkpoint form state
  const [temperature, setTemperature] = useState("22");
  const [speed, setSpeed] = useState("60");
  const [photoHash, setPhotoHash] = useState("");
  const [location, setLocation] = useState("");
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);

  // Handoff form state
  const [recipientAddr, setRecipientAddr] = useState("");
  const [confirmBatchId, setConfirmBatchId] = useState("");
  const [confirmHandoffIndex, setConfirmHandoffIndex] = useState("1");

  const pushLog = (entry: string) =>
    setLog((prev) => [new Date().toLocaleTimeString() + "  " + entry, ...prev]);

  const detectLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      pushLog("Location not supported in this browser");
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        setCurrentCoords({ lat, lng });
        setFarmGps(`${lat}|${lng}`);
        setLocation((prev) => prev || `${lat}, ${lng}`);
        pushLog("✓ Location detected automatically");
        setLocating(false);
      },
      (error) => {
        pushLog(`ERROR: Location detection failed: ${error.message}`);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
    );
  };

  useEffect(() => {
    const loadFarmerData = async () => {
      if (!account) return;

      setRepLoading(true);
      setPayLoading(true);
      try {
        const [repRes, payRes] = await Promise.all([
          fetch(`${API_BASE}/farmer/${account}/reputation`),
          fetch(`${API_BASE}/farmer/${account}/payments`),
        ]);

        if (repRes.ok) {
          const repData = await repRes.json();
          setReputation(repData);
        }

        if (payRes.ok) {
          const payData = await payRes.json();
          setPayments(payData.payments || []);
        }
      } catch (err) {
        pushLog(`ERROR: Failed to load farmer stats: ${(err as Error).message}`);
      } finally {
        setRepLoading(false);
        setPayLoading(false);
      }
    };

    loadFarmerData();
  }, [account]);

  useEffect(() => {
    detectLocation();
  }, []);

  const createBatch = async () => {
    if (!account) {
      pushLog("ERROR: Connect wallet first");
      return;
    }

    setLoading(true);
    try {
      pushLog("Creating batch...");
      const res = await fetch(`${API_BASE}/batch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cropType,
          weight: parseInt(weight),
          farmGps,
          farmingPractices: "shade-grown",
          organicCertId,
          farmerAddr: account,
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to create batch");

      setBatchId(body.batchId);
      setBatch(body.batch);
      setQrCode(body.qrCode || null);
      pushLog(`✓ Batch ${body.batchId} created`);
      if (body.qrCode) {
        pushLog(`✓ QR code generated`);
      }
    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const logCheckpoint = async () => {
    if (!batchId) {
      pushLog("ERROR: Create a batch first");
      return;
    }

    setLoading(true);
    try {
      const [farmLat, farmLng] = farmGps.split("|");
      const gpsLat = currentCoords ? String(currentCoords.lat) : (farmLat || "0");
      const gpsLng = currentCoords ? String(currentCoords.lng) : (farmLng || "0");

      pushLog("Logging checkpoint...");
      const res = await fetch(`${API_BASE}/checkpoint`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchAsaId: batchId,
          gpsLat,
          gpsLng,
          temperature: parseFloat(temperature),
          humidity: 0,
          handlerType: "farmer",
          notes: location || "Unknown",
          photoHash: photoHash || "photo-" + Date.now(),
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to log checkpoint");

      pushLog(`✓ Checkpoint logged - Temp: ${temperature}°C, Speed: ${speed}km/h`);
    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const initiateHandoff = async () => {
    if (!batchId) {
      pushLog("ERROR: Create a batch first");
      return;
    }

    if (!recipientAddr.trim()) {
      pushLog("ERROR: Please enter a recipient wallet address");
      return;
    }

    const toAddr = recipientAddr.trim();

    setLoading(true);
    try {
      pushLog("Initiating handoff...");

      const res = await fetch(`${API_BASE}/handoff/initiate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          batchAsaId: batchId,
          fromAddr: account,
          toAddr: toAddr,
          handoffType: "transfer",
          handoffPhotoHashes: "",
        }),
      });

      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "Failed to initiate handoff");

      pushLog(`✓ Handoff initiated to ${toAddr.slice(0, 8)}...`);
      pushLog(`⚠️ RECEIVER ACTION NEEDED: Receiver (${toAddr.slice(0, 8)}...) must:`);
      pushLog(`1. Connect their wallet (${toAddr.slice(0, 8)}...)`);
      pushLog(`2. Scroll to "Confirm Pending Handoffs" section below`);
      pushLog(`3. Enter Batch ID: ${batchId}, Handoff Index: 1`);
      pushLog(`4. Click "Confirm Handoff" and approve in wallet`);
    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  const confirmHandoff = async (batchAsaId: string, handoffIndex: number) => {
    if (!account) {
      pushLog("ERROR: Connect wallet first");
      return;
    }

    if (!batchAsaId || !handoffIndex) {
      pushLog("ERROR: Missing batch ID or handoff index");
      return;
    }

    setLoading(true);
    try {
      pushLog(`Confirming handoff ${handoffIndex} for batch ${batchAsaId}...`);

      // Fetch ARC56 contract ABI
      const arc56Response = await fetch('/ContractSupply.arc56.json');
      if (!arc56Response.ok) throw new Error('Failed to load contract ABI');
      const arc56 = await arc56Response.json();

      // Get contract app ID from backend
      const appId = 755778476; // New contract

      // Find confirmHandoff method in ABI
      const method = arc56.methods.find((m: any) => m.name === 'confirmHandoff');
      if (!method) throw new Error('confirmHandoff method not found in ABI');

      // Get suggested params from Algorand
      const algodClient = new algosdk.Algodv2('', 'https://testnet-api.algonode.cloud', '');
      const suggestedParams = await algodClient.getTransactionParams().do();

      // Build ABI method
      const abiMethod = new algosdk.ABIMethod(method);
      const confirmedAt = Math.floor(Date.now() / 1000);
      const batchAsaIdBigInt = BigInt(batchAsaId);
      const handoffPk = batchAsaIdBigInt * 10000n + BigInt(handoffIndex);

      const encoder = new TextEncoder();
      const makeBoxKey = (prefix: string, id: bigint): Uint8Array => {
        const prefixBytes = encoder.encode(prefix);
        const idBytes = algosdk.encodeUint64(id);
        const key = new Uint8Array(prefixBytes.length + idBytes.length);
        key.set(prefixBytes);
        key.set(idBytes, prefixBytes.length);
        return key;
      };

      const boxes = [
        { appIndex: 0, name: makeBoxKey('bct', batchAsaIdBigInt) },
        { appIndex: 0, name: makeBoxKey('hon', batchAsaIdBigInt) },
        { appIndex: 0, name: makeBoxKey('hos', handoffPk) },
        { appIndex: 0, name: makeBoxKey('hca', handoffPk) },
      ];

      // Build transaction (algosdk v3 uses 'sender' instead of 'from')
      const txn = algosdk.makeApplicationNoOpTxnFromObject({
        sender: account,
        appIndex: appId,
        appArgs: [
          abiMethod.getSelector(),
          algosdk.ABIType.from('uint64').encode(batchAsaIdBigInt),
          algosdk.ABIType.from('uint64').encode(BigInt(handoffIndex)),
          algosdk.ABIType.from('uint64').encode(BigInt(confirmedAt)),
        ],
        boxes,
        suggestedParams,
      });

      pushLog('Waiting for wallet approval...');

      // Sign with connected Defly wallet session
      const signedTxns = await deflyWallet.signTransaction([[
        { txn, signers: [account] }
      ]]);

      const signedTx = signedTxns?.[0] as unknown;
      let signedTxnBytes: Uint8Array | null = null;
      if (signedTx instanceof Uint8Array) {
        signedTxnBytes = signedTx;
      } else if (typeof signedTx === 'string') {
        signedTxnBytes = Uint8Array.from(atob(signedTx), (c) => c.charCodeAt(0));
      } else if (typeof (signedTx as { blob?: string })?.blob === 'string') {
        signedTxnBytes = Uint8Array.from(
          atob((signedTx as { blob: string }).blob),
          (c) => c.charCodeAt(0)
        );
      }

      if (!signedTxnBytes) {
        throw new Error('Transaction signing cancelled');
      }

      pushLog('Transaction signed, submitting to blockchain...');

      // Submit to Algorand (algosdk v3 returns { txid } lowercase)
      const { txid } = await algodClient.sendRawTransaction(signedTxnBytes).do();

      pushLog(`Transaction submitted: ${txid.slice(0, 8)}...`);
      pushLog('Waiting for confirmation...');

      // Wait for confirmation
      await algosdk.waitForConfirmation(algodClient, txid, 4);

      pushLog(`✓ Handoff ${handoffIndex} confirmed! Tx: ${txid}`);
      pushLog(`View on AlgoExplorer: https://testnet.explorer.perawallet.app/tx/${txid}`);

      // Remove from pending list
      setPendingHandoffs(prev =>
        prev.filter(h => !(h.batchId === batchAsaId && h.handoffIndex === handoffIndex))
      );

    } catch (err) {
      pushLog(`ERROR: ${(err as Error).message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
      <div className="mx-auto max-w-6xl px-6 py-12">
        {/* Header */}
        <div className="mb-12">
          <h1 className="mb-2 text-4xl font-bold text-[var(--color-text)]">
            🌿 Farmer Dashboard
          </h1>
          <p className="text-[var(--color-text-muted)]">
            Create batches, log checkpoints, and manage handoffs.
          </p>
        </div>

        {/* Wallet Status */}
        <div className="mb-8 rounded-lg border border-[var(--color-border)] bg-white/70 p-4 backdrop-blur-sm">
          {account ? (
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600" />
              <span className="text-sm">
                <strong>Wallet Connected:</strong> {account.slice(0, 8)}...
                {account.slice(-4)}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600" />
              <span className="text-sm">
                <strong>Connect your wallet to create batches</strong>
              </span>
            </div>
          )}
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Create Batch Card */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-[var(--color-text)]">
                <Plus className="h-6 w-6 text-[var(--color-primary)]" />
                Create New Batch
              </h2>

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Crop Type
                  </label>
                  <input
                    type="text"
                    value={cropType}
                    onChange={(e) => setCropType(e.target.value)}
                    placeholder="e.g., Coffee, Cocoa, Tea"
                    className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Weight (kg)
                    </label>
                    <input
                      type="number"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      placeholder="1200"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Organic Cert ID
                    </label>
                    <input
                      type="text"
                      value={organicCertId}
                      onChange={(e) => setOrganicCertId(e.target.value)}
                      placeholder="ORG-TEST-001"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                    Farm GPS (lat|lon)
                  </label>
                  <div className="space-y-2">
                    <input
                      type="text"
                      value={farmGps}
                      onChange={(e) => setFarmGps(e.target.value)}
                      placeholder="Auto-detected on load"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                    <button
                      type="button"
                      onClick={detectLocation}
                      disabled={locating}
                      className="rounded-lg border border-[var(--color-border)] bg-white px-3 py-1.5 text-xs font-semibold text-[var(--color-text)] hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {locating ? "Detecting..." : "Use Current Location"}
                    </button>
                  </div>
                </div>

                <button
                  onClick={createBatch}
                  disabled={loading || !account}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-white hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {loading ? "Creating..." : "Create Batch"}
                </button>
              </div>
            </div>

            {/* QR Code Display Card */}
            {batchId && qrCode && (
              <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-white to-green-50/50 p-8 backdrop-blur-sm">
                <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-[var(--color-text)]">
                  <QrCode className="h-6 w-6 text-[var(--color-primary)]" />
                  Batch QR Code
                </h2>

                <div className="flex flex-col items-center gap-6">
                  <div className="rounded-lg bg-white p-4 shadow-md">
                    <img
                      src={qrCode}
                      alt={`QR Code for Batch ${batchId}`}
                      className="w-48 h-48"
                    />
                  </div>

                  <div className="text-center w-full">
                    <p className="text-sm font-medium text-[var(--color-text)] mb-2">
                      Batch ID: <span className="font-mono text-[var(--color-primary)]">{batchId}</span>
                    </p>
                    <p className="text-xs text-[var(--color-text-muted)] mb-4">
                      Scan this QR code to view the complete product journey
                    </p>

                    <div className="flex gap-3 justify-center">
                      <a
                        href={qrCode}
                        download={`batch-${batchId}-qrcode.png`}
                        className="flex items-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                      >
                        <Download className="h-4 w-4" />
                        Download QR Code
                      </a>
                      <button
                        onClick={() => {
                          const url = `${window.location.origin}/product/${batchId}`;
                          navigator.clipboard.writeText(url);
                          pushLog("✓ Product URL copied to clipboard");
                        }}
                        className="rounded-lg border-2 border-[var(--color-primary)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-green-50 transition-colors"
                      >
                        Copy URL
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Reputation + Earnings */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
              <h2 className="mb-6 flex items-center gap-3 text-2xl font-bold text-[var(--color-text)]">
                <Leaf className="h-6 w-6 text-[var(--color-primary)]" />
                Reputation & Earnings
              </h2>

              {!account ? (
                <p className="text-sm text-[var(--color-text-muted)]">
                  Connect your wallet to see reputation and earnings.
                </p>
              ) : repLoading ? (
                <p className="text-sm text-[var(--color-text-muted)]">Loading reputation...</p>
              ) : reputation ? (
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Tier</p>
                    <p className="text-xl font-bold text-[var(--color-text)] capitalize">
                      {reputation.tier} ({reputation.tierEmoji})
                    </p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Total Batches</p>
                    <p className="text-xl font-bold text-[var(--color-text)]">{reputation.totalBatches}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Verified</p>
                    <p className="text-xl font-bold text-[var(--color-text)]">{reputation.verifiedCount}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-4">
                    <p className="text-xs text-[var(--color-text-muted)]">Carbon Credits</p>
                    <p className="text-xl font-bold text-[var(--color-text)]">{reputation.carbonCreditsTotal}</p>
                  </div>
                  <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 md:col-span-2">
                    <p className="text-xs text-[var(--color-text-muted)]">Total Payments</p>
                    <p className="text-xl font-bold text-[var(--color-text)]">
                      {reputation.totalPaymentsReceived}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-[var(--color-text-muted)]">No reputation data yet.</p>
              )}
            </div>

            {/* Payments History */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
              <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">Payment History</h2>
              {!account ? (
                <p className="text-sm text-[var(--color-text-muted)]">Connect your wallet to view payments.</p>
              ) : payLoading ? (
                <p className="text-sm text-[var(--color-text-muted)]">Loading payments...</p>
              ) : payments.length === 0 ? (
                <p className="text-sm text-[var(--color-text-muted)]">No payments yet.</p>
              ) : (
                <div className="space-y-3">
                  {payments.map((payment, idx) => (
                    <div
                      key={`payment-${idx}`}
                      className="flex items-center justify-between rounded-lg border border-[var(--color-border)] bg-white px-4 py-3"
                    >
                      <div>
                        <p className="text-sm font-semibold text-[var(--color-text)]">
                          {payment.amount} {payment.currency}
                        </p>
                        <p className="text-xs text-[var(--color-text-muted)]">
                          Batch {payment.batchId}
                        </p>
                      </div>
                      <div className="text-xs text-[var(--color-text-muted)]">
                        {new Date(payment.timestamp * 1000).toLocaleDateString()}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Checkpoint Card */}
            {batchId && (
              <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
                <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
                  Log Checkpoint
                </h2>

                <div className="mb-6 rounded-lg bg-blue-50 p-4 border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <strong>Active Batch:</strong> {batchId}
                  </p>
                </div>

                <div className="space-y-5">
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        Temperature (°C)
                      </label>
                      <input
                        type="number"
                        value={temperature}
                        onChange={(e) => setTemperature(e.target.value)}
                        placeholder="22"
                        className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                        Speed (km/h)
                      </label>
                      <input
                        type="number"
                        value={speed}
                        onChange={(e) => setSpeed(e.target.value)}
                        placeholder="60"
                        className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Photo Hash (optional)
                    </label>
                    <input
                      type="text"
                      value={photoHash}
                      onChange={(e) => setPhotoHash(e.target.value)}
                      placeholder="auto-generated if empty"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Location
                    </label>
                    <input
                      type="text"
                      value={location}
                      onChange={(e) => setLocation(e.target.value)}
                      placeholder="e.g., Central Warehouse"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>

                  <button
                    onClick={logCheckpoint}
                    disabled={loading}
                    className="w-full rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Logging..." : "Log Checkpoint"}
                  </button>
                </div>
              </div>
            )}

            {/* Handoff Card */}
            {batchId && (
              <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
                <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
                  Handoff Management
                </h2>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Recipient Wallet Address
                    </label>
                    <input
                      type="text"
                      value={recipientAddr}
                      onChange={(e) => setRecipientAddr(e.target.value)}
                      placeholder="e.g., ZAXZNLKH..."
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm font-mono focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>

                  <button
                    onClick={initiateHandoff}
                    disabled={loading || !recipientAddr.trim()}
                    className="w-full rounded-lg border-2 border-[var(--color-primary)] bg-transparent px-6 py-3 font-semibold text-[var(--color-primary)] hover:bg-green-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {loading ? "Processing..." : "Initiate Handoff to Next Party"}
                  </button>
                </div>

                <p className="mt-4 text-xs text-[var(--color-text-muted)]">
                  Initiate a handoff to transfer custody to a distributor or retailer. Receiver
                  confirms with their wallet.
                </p>
              </div>
            )}

            {/* Pending Handoffs - For Receivers */}
            <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm">
              <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
                🔄 Confirm Pending Handoffs (RECEIVERS ONLY)
              </h2>

              <div className="mb-4 p-4 bg-amber-50 border border-amber-300 rounded-lg">
                <p className="text-sm font-bold text-amber-900 mb-2">
                  ⚠️ ARE YOU THE RECEIVER?
                </p>
                <p className="text-xs text-amber-800 mb-2">
                  If someone initiated a handoff TO YOU, use this section to accept it.
                </p>
                <p className="text-xs text-amber-700">
                  <strong>Steps:</strong>
                  <br />1. Connect YOUR wallet (the receiver wallet)
                  <br />2. Enter the Batch ID and Handoff Index (shown in activity log above)
                  <br />3. Click "Confirm Handoff"
                  <br />4. Approve the transaction in your Defly wallet popup
                </p>
              </div>

              {!account && (
                <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-lg">
                  <p className="text-sm font-bold text-red-800">
                    🚫 Wallet not connected! Connect your wallet first.
                  </p>
                </div>
              )}

              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Batch ID
                    </label>
                    <input
                      type="text"
                      value={confirmBatchId}
                      onChange={(e) => setConfirmBatchId(e.target.value)}
                      placeholder="e.g., 1"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-[var(--color-text)] mb-2">
                      Handoff Index
                    </label>
                    <input
                      type="number"
                      value={confirmHandoffIndex}
                      onChange={(e) => setConfirmHandoffIndex(e.target.value)}
                      placeholder="e.g., 1"
                      className="w-full rounded-lg border border-[var(--color-border)] px-4 py-2 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                    />
                  </div>
                </div>

                <button
                  onClick={() => {
                    if (!confirmBatchId.trim() || !confirmHandoffIndex.trim()) {
                      pushLog('ERROR: Missing batch ID or handoff index');
                      return;
                    }
                    if (!account) {
                      pushLog('ERROR: Wallet not connected');
                      return;
                    }
                    confirmHandoff(confirmBatchId.trim(), parseInt(confirmHandoffIndex, 10));
                  }}
                  disabled={loading || !account || !confirmBatchId.trim()}
                  className="w-full rounded-lg bg-[var(--color-primary)] px-6 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  {loading ? "Processing..." : "✓ Confirm Handoff (Sign with Wallet)"}
                </button>

                {!account && (
                  <p className="text-xs text-red-600 text-center font-bold">
                    ⚠️ Connect your wallet to confirm handoffs
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Activity Log */}
          <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-6 backdrop-blur-sm h-fit sticky top-24">
            <h3 className="mb-4 text-lg font-bold text-[var(--color-text)]">
              Activity Log
            </h3>

            <div className="space-y-2 max-h-96 overflow-y-auto">
              {log.length === 0 ? (
                <p className="text-xs text-[var(--color-text-muted)]">
                  No activity yet. Create a batch to get started.
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
    </main>
  );
}
