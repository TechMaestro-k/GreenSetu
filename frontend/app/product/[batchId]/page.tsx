"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import dynamic from "next/dynamic";
import {
  AlertCircle,
  CheckCircle2,
  Package,
  MapPin,
  Thermometer,
  Zap,
  FileText,
  Share2,
  Download,
  Leaf,
} from "lucide-react";

// Dynamically import the map component with SSR disabled (Leaflet requires window)
const JourneyMap = dynamic(() => import("../../components/JourneyMap"), {
  ssr: false,
  loading: () => (
    <div className="flex h-80 items-center justify-center rounded-lg border border-[var(--color-border)] bg-white/50">
      <p className="text-sm text-[var(--color-text-muted)]">Loading map...</p>
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL || "http://127.0.0.1:4000";

type Checkpoint = {
  index: number;
  gps: string | null;
  temperature: number | null;
  humidity?: number | null;
  handlerType: string | null;
  notes?: string | null;
  photoHash?: string | null;
  timestamp: number | null;
};

type Handoff = {
  index: number;
  status: string | null;
  fromAddr?: string | null;
  toAddr?: string | null;
  handoffType?: string | null;
  confirmedAt?: number | null;
};

type Verification = {
  batchAsaId: string;
  result: string;
  confidence: number;
  reason: string;
  verifierAddr: string;
  timestamp: number;
};

type CarbonScore = {
  batchId: string;
  score: number;
  creditsEarned: number;
  distance: number;
  transportMethod: string;
};

type BatchJourney = {
  batchId: string;
  cropType: string | null;
  weight: number | null;
  farmGps: string | null;
  farmingPractices?: string | null;
  organicCertId?: string | null;
  farmerAddr: string | null;
  createdAt?: number | null;
  checkpointCount: number;
  handoffCount: number;
  checkpoints: Checkpoint[];
  handoffs: Handoff[];
  verification?: Verification;
};

export default function ProductPage() {
  const params = useParams();
  const batchId = params.batchId as string;

  const [journey, setJourney] = useState<BatchJourney | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQR, setShowQR] = useState(false);
  const [carbon, setCarbon] = useState<CarbonScore | null>(null);
  const [carbonError, setCarbonError] = useState<string | null>(null);

  useEffect(() => {
    const fetchJourney = async () => {
      try {
        setLoading(true);
        const res = await fetch(`${API_BASE}/batch/${batchId}/journey`);
        if (!res.ok) {
          throw new Error(
            `Failed to fetch journey: ${res.status} ${res.statusText}`
          );
        }
        const data = await res.json();
        setJourney(data);

        // Generate QR code on client side
        try {
          const productUrl = `${window.location.origin}/product/${batchId}`;
          const qr = await import("qrcode");
          const qrDataUrl = await qr.toDataURL(productUrl, {
            width: 256,
            margin: 2,
            color: { dark: "#10b981", light: "#ffffff" },
          });
          setQrCode(qrDataUrl);
        } catch (qrErr) {
          console.error("Failed to generate QR code:", qrErr);
        }
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    };

    if (batchId) {
      fetchJourney();
    }
  }, [batchId]);

  useEffect(() => {
    const fetchCarbon = async () => {
      try {
        setCarbonError(null);
        const res = await fetch(`${API_BASE}/batch/${batchId}/carbon`);
        if (!res.ok) {
          throw new Error(`Failed to fetch carbon: ${res.status} ${res.statusText}`);
        }
        const data = await res.json();
        setCarbon(data);
      } catch (err) {
        setCarbonError((err as Error).message);
      }
    };

    if (batchId) {
      fetchCarbon();
    }
  }, [batchId]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-lg border border-[var(--color-border)] bg-white/70 p-8 text-center">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-[var(--color-primary)]"></div>
            <p className="mt-4 text-[var(--color-text-muted)]">
              Loading batch journey...
            </p>
          </div>
        </div>
      </main>
    );
  }

  if (error || !journey) {
    return (
      <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
        <div className="mx-auto max-w-5xl px-6 py-12">
          <div className="rounded-lg border-2 border-red-200 bg-red-50 p-8">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div>
                <h2 className="text-lg font-bold text-red-900 mb-2">Error</h2>
                <p className="text-red-800">
                  {error || "Batch not found"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    );
  }

  const isVerified =
    journey.verification?.result === "VERIFIED";

  const formatAddress = (addr: string | null | undefined) => {
    if (!addr) return "N/A";
    if (addr.length <= 16) return addr;
    return `${addr.slice(0, 8)}...${addr.slice(-8)}`;
  };

  // Parse verification warnings
  const parseVerificationReason = (reason: string) => {
    if (!reason) return [];
    // Split by [WARNING] or [ERROR] tags
    const parts = reason.split(/\[(WARNING|ERROR)\]/).filter(Boolean);
    const warnings = [];
    for (let i = 0; i < parts.length; i += 2) {
      if (parts[i] === 'WARNING' || parts[i] === 'ERROR') {
        warnings.push({
          type: parts[i],
          message: parts[i + 1]?.trim().replace(/;\s*$/, '') || ''
        });
      }
    }
    return warnings;
  };

  const formatGPS = (gps: string | null) => {
    if (!gps || gps === '0|0') return 'Not recorded';
    const [lat, lng] = gps.split('|');
    if (lat && lng && lat !== '0' && lng !== '0') {
      return `${lat}, ${lng}`;
    }
    return 'Not recorded';
  };

  const parseGPS = (gps: string | null) => {
    if (!gps || gps === '0|0') return null;
    const [latRaw, lngRaw] = gps.split('|');
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    if (lat === 0 && lng === 0) return null;
    return [lat, lng] as [number, number];
  };

  const locationPoints = (() => {
    const points: Array<[number, number]> = [];
    const farm = parseGPS(journey.farmGps);
    if (farm) points.push(farm);
    journey.checkpoints.forEach((checkpoint) => {
      const coords = parseGPS(checkpoint.gps);
      if (coords) points.push(coords);
    });
    return points;
  })();

  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
      <div className="mx-auto max-w-5xl px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <Package className="h-8 w-8 text-[var(--color-primary)]" />
              <h1 className="text-4xl font-bold text-[var(--color-text)]">
                Product Journey
              </h1>
            </div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="flex items-center gap-2 rounded-lg border-2 border-[var(--color-primary)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-green-50 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              Share
            </button>
          </div>
          <p className="text-[var(--color-text-muted)]">
            Complete supply chain transparency from farm to shelf
          </p>
        </div>

        {/* Verification Status Banner - First thing consumers see when scanning QR */}
        {journey.verification ? (
          <div
            className={`rounded-xl border-2 p-6 mb-8 ${isVerified
              ? "border-green-500 bg-gradient-to-r from-green-50 to-green-100"
              : "border-red-500 bg-gradient-to-r from-red-50 to-red-100"
              }`}
          >
            <div className="flex items-start gap-4">
              <div className={`h-16 w-16 rounded-full flex items-center justify-center flex-shrink-0 ${isVerified ? "bg-green-500" : "bg-red-500"}`}>
                {isVerified ? (
                  <CheckCircle2 className="h-9 w-9 text-white" />
                ) : (
                  <AlertCircle className="h-9 w-9 text-white" />
                )}
              </div>
              <div className="flex-1">
                <h2 className={`text-3xl font-bold mb-3 ${isVerified ? "text-green-900" : "text-red-900"}`}>
                  {isVerified ? "✓ Verified Authentic" : "⚠ Quality Issues Detected"}
                </h2>
                <div className={`text-sm mb-3 ${isVerified ? "text-green-800" : "text-red-800"}`}>
                  <div className="flex items-center gap-4 text-xs font-medium mb-2">
                    <span>Confidence: {journey.verification.confidence}%</span>
                    <span>•</span>
                    <span>Verified: {new Date(journey.verification.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                </div>

                {(() => {
                  const warnings = parseVerificationReason(journey.verification.reason);
                  return warnings.length > 0 ? (
                    <div className="space-y-2">
                      {warnings.map((warning, idx) => (
                        <div
                          key={idx}
                          className={`flex items-start gap-2 p-3 rounded-lg ${warning.type === 'WARNING' ? 'bg-amber-50 border border-amber-200' : 'bg-red-100 border border-red-300'}`}
                        >
                          <AlertCircle className={`h-4 w-4 mt-0.5 flex-shrink-0 ${warning.type === 'WARNING' ? 'text-amber-600' : 'text-red-600'}`} />
                          <div className="flex-1">
                            <p className={`text-xs font-semibold mb-1 ${warning.type === 'WARNING' ? 'text-amber-900' : 'text-red-900'}`}>
                              {warning.type}
                            </p>
                            <p className={`text-sm ${warning.type === 'WARNING' ? 'text-amber-800' : 'text-red-800'}`}>
                              {warning.message}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-green-800">
                      All quality checks passed. This product meets all supply chain standards.
                    </p>
                  );
                })()}
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border-2 border-amber-400 bg-gradient-to-r from-amber-50 to-amber-100 p-6 mb-8">
            <div className="flex items-start gap-4">
              <div className="h-16 w-16 rounded-full bg-amber-400 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="h-9 w-9 text-white" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-amber-900 mb-2">
                  Not Yet Verified
                </h2>
                <p className="text-sm text-amber-800">
                  This product has not been verified yet. Verification ensures product authenticity and quality standards.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* QR Code Modal */}
        {showQR && qrCode && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowQR(false)}>
            <div className="bg-white rounded-xl p-8 max-w-md w-full" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-2xl font-bold text-[var(--color-text)] mb-4">Share This Product</h3>
              <div className="flex flex-col items-center gap-4">
                <div className="rounded-lg bg-white p-4 shadow-md border-2 border-[var(--color-border)]">
                  <img
                    src={qrCode}
                    alt={`QR Code for Batch ${batchId}`}
                    className="w-64 h-64"
                  />
                </div>
                <p className="text-sm text-center text-[var(--color-text-muted)]">
                  Scan to view complete product journey
                </p>
                <div className="flex gap-3 w-full">
                  <a
                    href={qrCode}
                    download={`batch-${batchId}-qr.png`}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-green-700 transition-colors"
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </a>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(window.location.href);
                      alert("URL copied to clipboard!");
                    }}
                    className="flex-1 rounded-lg border-2 border-[var(--color-primary)] bg-transparent px-4 py-2 text-sm font-semibold text-[var(--color-primary)] hover:bg-green-50 transition-colors"
                  >
                    Copy URL
                  </button>
                </div>
                <button
                  onClick={() => setShowQR(false)}
                  className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-text)]"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3 mb-8">
          <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-blue-50 to-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                <MapPin className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text)]">{journey.checkpointCount}</p>
                <p className="text-sm text-[var(--color-text-muted)]">Checkpoints</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-orange-50 to-white p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className="h-10 w-10 rounded-full bg-orange-100 flex items-center justify-center">
                🤝
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text)]">{journey.handoffCount}</p>
                <p className="text-sm text-[var(--color-text-muted)]">Handoffs</p>
              </div>
            </div>
          </div>

          <div className={`rounded-xl border border-[var(--color-border)] p-6 ${journey.verification
            ? isVerified
              ? "bg-gradient-to-br from-green-50 to-white"
              : "bg-gradient-to-br from-red-50 to-white"
            : "bg-gradient-to-br from-amber-50 to-white"
            }`}>
            <div className="flex items-center gap-3 mb-2">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center ${journey.verification
                ? isVerified
                  ? "bg-green-100"
                  : "bg-red-100"
                : "bg-amber-100"
                }`}>
                {journey.verification ? (
                  isVerified ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-red-600" />
                  )
                ) : (
                  <AlertCircle className="h-5 w-5 text-amber-600" />
                )}
              </div>
              <div>
                <p className="text-2xl font-bold text-[var(--color-text)]">
                  {journey.verification ? (isVerified ? "✓" : "✗") : "—"}
                </p>
                <p className="text-sm text-[var(--color-text-muted)]">Verification</p>
              </div>
            </div>
          </div>
        </div>

        {/* Carbon Score */}
        <div className="rounded-xl border border-[var(--color-border)] bg-gradient-to-br from-emerald-50 to-white p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="h-10 w-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <Leaf className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-[var(--color-text)]">Carbon Footprint</h2>
              <p className="text-sm text-[var(--color-text-muted)]">Estimated score and credits</p>
            </div>
          </div>

          {carbon ? (
            <div className="grid gap-4 md:grid-cols-4">
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Score</p>
                <p className="text-2xl font-bold text-emerald-700">{carbon.score}/100</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Credits Earned</p>
                <p className="text-2xl font-bold text-emerald-700">{carbon.creditsEarned}</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Distance</p>
                <p className="text-2xl font-bold text-emerald-700">{carbon.distance} km</p>
              </div>
              <div className="rounded-lg border border-emerald-100 bg-white p-4">
                <p className="text-xs text-[var(--color-text-muted)]">Transport</p>
                <p className="text-2xl font-bold text-emerald-700 capitalize">{carbon.transportMethod}</p>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-emerald-100 bg-white p-4 text-sm text-[var(--color-text-muted)]">
              {carbonError ? `Carbon data unavailable: ${carbonError}` : "Carbon score will appear after checkpoints are logged."}
            </div>
          )}
        </div>

        {/* Batch Overview */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm mb-8">
          <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
            Batch Information
          </h2>

          <div className="grid gap-6 md:grid-cols-2">
            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <Package className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Batch ID
                </p>
                <p className="text-lg font-mono font-bold text-[var(--color-text)] break-all">
                  {journey.batchId}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <Leaf className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Crop Type
                </p>
                <p className="text-lg font-bold text-[var(--color-text)]">
                  {journey.cropType || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <Zap className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Weight
                </p>
                <p className="text-lg font-bold text-[var(--color-text)]">
                  {journey.weight ? `${journey.weight} kg` : "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <MapPin className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Farm Location (GPS)
                </p>
                <p className="text-lg font-mono font-bold text-[var(--color-text)] break-all">
                  {formatGPS(journey.farmGps)}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <FileText className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Organic Certificate
                </p>
                <p className="text-lg font-bold text-[var(--color-text)]">
                  {journey.organicCertId || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <Leaf className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Farming Practices
                </p>
                <p className="text-base font-semibold text-[var(--color-text)]">
                  {journey.farmingPractices || "N/A"}
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-green-50 to-white border border-green-100">
              <FileText className="h-5 w-5 text-[var(--color-primary)] mt-1 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Created At
                </p>
                <p className="text-base font-semibold text-[var(--color-text)]">
                  {journey.createdAt
                    ? new Date(journey.createdAt * 1000).toLocaleString()
                    : "N/A"}
                </p>
              </div>
            </div>

            <div className="md:col-span-2 flex items-start gap-3 p-4 rounded-lg bg-gradient-to-br from-blue-50 to-white border border-blue-100">
              <FileText className="h-5 w-5 text-blue-600 mt-1 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-[var(--color-text-muted)] mb-1">
                  Farmer Address
                </p>
                <p className="text-sm font-mono text-[var(--color-text)] break-all">
                  {journey.farmerAddr || "N/A"}
                </p>
                {journey.farmerAddr && (
                  <p className="text-xs text-[var(--color-text-muted)] mt-1">
                    Short: {formatAddress(journey.farmerAddr)}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Journey Map */}
        <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-8 backdrop-blur-sm mb-8">
          <h2 className="mb-4 text-2xl font-bold text-[var(--color-text)]">Journey Map</h2>
          {locationPoints.length > 0 ? (
            <div className="h-80 w-full overflow-hidden rounded-lg border border-[var(--color-border)]">
              <JourneyMap locationPoints={locationPoints} />
            </div>
          ) : (
            <div className="rounded-lg border border-[var(--color-border)] bg-white p-4 text-sm text-[var(--color-text-muted)]">
              No GPS data available yet. Log checkpoints with GPS to display the route.
            </div>
          )}
        </div>

        {/* Timeline */}
        <div className="mb-8">
          <h2 className="mb-6 text-2xl font-bold text-[var(--color-text)]">
            Journey Timeline
          </h2>

          <div className="space-y-4">
            {/* Created */}
            <div className="relative flex gap-4">
              <div className="flex flex-col items-center">
                <div className="h-12 w-12 rounded-full bg-[var(--color-primary)] flex items-center justify-center text-white flex-shrink-0">
                  🌱
                </div>
                <div className="w-1 bg-[var(--color-border)] flex-1 mt-2"></div>
              </div>
              <div className="pb-4 pt-2">
                <h3 className="font-bold text-[var(--color-text)]">
                  Batch Created
                </h3>
                <p className="text-sm text-[var(--color-text-muted)]">
                  Via ChainVerify API
                </p>
              </div>
            </div>

            {/* Checkpoints */}
            {journey.checkpoints && journey.checkpoints.length > 0 && (
              journey.checkpoints.map((checkpoint, idx) => (
                <div
                  key={`checkpoint-${checkpoint.index}`}
                  className="relative flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-blue-500 flex items-center justify-center text-white flex-shrink-0">
                      📍
                    </div>
                    {idx < journey.checkpoints.length - 1 && journey.handoffs && journey.handoffs.length > 0 && (
                      <div className="w-1 bg-[var(--color-border)] flex-1 mt-2"></div>
                    )}
                  </div>
                  <div className="pb-4 pt-2">
                    <h3 className="font-bold text-[var(--color-text)]">
                      Checkpoint {checkpoint.index}
                    </h3>
                    <div className="mt-2 space-y-2">
                      <div className="grid gap-2 text-sm">
                        <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                          <MapPin className="h-4 w-4" />
                          <span className="font-medium">Location:</span>
                          <span>{formatGPS(checkpoint.gps)}</span>
                        </div>
                        {checkpoint.temperature !== null && (
                          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <Thermometer className="h-4 w-4" />
                            <span className="font-medium">Temperature:</span>
                            <span className={checkpoint.temperature > 8 ? "text-amber-600 font-semibold" : ""}>
                              {checkpoint.temperature}°C
                            </span>
                          </div>
                        )}
                        {checkpoint.humidity !== null && checkpoint.humidity !== undefined && (
                          <div className="flex items-center gap-2 text-[var(--color-text-muted)]">
                            <Zap className="h-4 w-4" />
                            <span className="font-medium">Humidity:</span>
                            <span>{checkpoint.humidity}%</span>
                          </div>
                        )}
                        {checkpoint.notes && (
                          <div className="text-sm text-[var(--color-text-muted)]">
                            <span className="font-medium">Notes:</span> {checkpoint.notes}
                          </div>
                        )}
                        {checkpoint.photoHash && (
                          <div className="text-xs text-[var(--color-text-muted)] break-all">
                            <span className="font-medium">Photo Hash:</span> {checkpoint.photoHash}
                          </div>
                        )}
                        <div className="text-xs text-[var(--color-text-muted)]">
                          <span className="font-medium">{checkpoint.handlerType || "Handler"}</span>
                          {checkpoint.timestamp && (
                            <span> • {new Date(checkpoint.timestamp * 1000).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Handoffs */}
            {journey.handoffs && journey.handoffs.length > 0 && (
              journey.handoffs.map((handoff, idx) => (
                <div
                  key={`handoff-${handoff.index}`}
                  className="relative flex gap-4"
                >
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-orange-500 flex items-center justify-center text-white flex-shrink-0">
                      🤝
                    </div>
                    {idx < journey.handoffs.length - 1 && (
                      <div className="w-1 bg-[var(--color-border)] flex-1 mt-2"></div>
                    )}
                  </div>
                  <div className="pb-4 pt-2">
                    <h3 className="font-bold text-[var(--color-text)]">
                      Handoff #{handoff.index} {
                        handoff.status === "confirmed" ? "✓" : "⏳"
                      }
                    </h3>
                    <div className="mt-2 space-y-1 text-sm text-[var(--color-text-muted)]">
                      <div>
                        <span className="inline-block rounded-full px-2 py-1 text-xs font-semibold bg-blue-100 text-blue-800">
                          {(handoff.status || "pending").toUpperCase()}
                        </span>
                      </div>
                      <div className="grid gap-1 text-xs">
                        <div>
                          <span className="font-medium">Type:</span> {handoff.handoffType || "transfer"}
                        </div>
                        <div>
                          <span className="font-medium">From:</span> {formatAddress(handoff.fromAddr)}
                        </div>
                        <div>
                          <span className="font-medium">To:</span> {formatAddress(handoff.toAddr)}
                        </div>
                        {handoff.confirmedAt && (
                          <div>
                            <span className="font-medium">Confirmed:</span> {new Date(handoff.confirmedAt * 1000).toLocaleString()}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}

            {/* Verification Timeline Entry */}
            {journey.verification && (
              <div className="relative flex gap-4">
                <div className="flex flex-col items-center">
                  <div
                    className={`h-12 w-12 rounded-full flex items-center justify-center text-white flex-shrink-0 ${isVerified ? "bg-green-500" : "bg-red-500"
                      }`}
                  >
                    {isVerified ? "✓" : "✗"}
                  </div>
                </div>
                <div className="pb-4 pt-2">
                  <h3 className="font-bold text-[var(--color-text)]">
                    Quality Verification Completed
                  </h3>
                  <div className="mt-2 text-sm text-[var(--color-text-muted)]">
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${isVerified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                      {journey.verification.result}
                    </span>
                    <span className="ml-3 text-xs">
                      {new Date(journey.verification.timestamp * 1000).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
