"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Search, Package, ArrowRight, X } from "lucide-react";

export default function ScanPage() {
    const router = useRouter();
    const scannerRef = useRef<HTMLDivElement>(null);
    const html5QrRef = useRef<any>(null);
    const [manualId, setManualId] = useState("");
    const [scanning, setScanning] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [cameraAvailable, setCameraAvailable] = useState(true);

    const extractBatchId = (text: string): string | null => {
        // Match /product/BATCH_ID in a URL
        const urlMatch = text.match(/\/product\/([a-zA-Z0-9_-]+)/);
        if (urlMatch) return urlMatch[1];
        // If it's just a number or local-xxx ID
        if (/^(local-[\w-]+|\d+)$/.test(text.trim())) return text.trim();
        return null;
    };

    const startScanner = async () => {
        setError(null);
        setScanning(true);
        try {
            const { Html5Qrcode } = await import("html5-qrcode");
            if (!scannerRef.current) return;

            const scanner = new Html5Qrcode("qr-reader");
            html5QrRef.current = scanner;

            await scanner.start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 250 } },
                (decodedText) => {
                    const batchId = extractBatchId(decodedText);
                    if (batchId) {
                        scanner.stop().catch(() => { });
                        router.push(`/product/${batchId}`);
                    }
                },
                () => { } // ignore errors during scanning
            );
        } catch (err) {
            console.error("Scanner error:", err);
            setCameraAvailable(false);
            setScanning(false);
            setError("Camera not available. Please enter a Batch ID manually.");
        }
    };

    const stopScanner = async () => {
        if (html5QrRef.current) {
            try {
                await html5QrRef.current.stop();
            } catch { }
            html5QrRef.current = null;
        }
        setScanning(false);
    };

    useEffect(() => {
        return () => {
            if (html5QrRef.current) {
                html5QrRef.current.stop().catch(() => { });
            }
        };
    }, []);

    const handleManualLookup = () => {
        const trimmed = manualId.trim();
        if (!trimmed) return;
        const batchId = extractBatchId(trimmed) || trimmed;
        router.push(`/product/${batchId}`);
    };

    return (
        <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
            <div className="mx-auto max-w-lg px-6 py-12">
                {/* Header */}
                <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center h-16 w-16 rounded-full bg-[var(--color-primary)] mb-4">
                        <Camera className="h-8 w-8 text-white" />
                    </div>
                    <h1 className="text-3xl font-bold text-[var(--color-text)] mb-2">
                        Scan Product
                    </h1>
                    <p className="text-[var(--color-text-muted)]">
                        Scan the QR code on your product to verify its authenticity and view the complete supply chain journey.
                    </p>
                </div>

                {/* QR Scanner */}
                <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-6 backdrop-blur-sm mb-6">
                    {!scanning ? (
                        <button
                            onClick={startScanner}
                            disabled={!cameraAvailable}
                            className="w-full flex flex-col items-center gap-4 py-8 rounded-lg border-2 border-dashed border-[var(--color-border)] hover:border-[var(--color-primary)] hover:bg-green-50/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <div className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center">
                                <Camera className="h-10 w-10 text-[var(--color-primary)]" />
                            </div>
                            <div className="text-center">
                                <p className="font-semibold text-[var(--color-text)]">
                                    Tap to Open Camera
                                </p>
                                <p className="text-sm text-[var(--color-text-muted)] mt-1">
                                    Point your camera at the QR code on the product
                                </p>
                            </div>
                        </button>
                    ) : (
                        <div className="relative">
                            <div className="flex items-center justify-between mb-3">
                                <p className="text-sm font-medium text-[var(--color-text)]">
                                    Scanning...
                                </p>
                                <button
                                    onClick={stopScanner}
                                    className="flex items-center gap-1 text-sm text-red-600 hover:text-red-800"
                                >
                                    <X className="h-4 w-4" />
                                    Stop
                                </button>
                            </div>
                            <div
                                id="qr-reader"
                                ref={scannerRef}
                                className="rounded-lg overflow-hidden"
                            />
                        </div>
                    )}

                    {error && (
                        <div className="mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
                            {error}
                        </div>
                    )}
                </div>

                {/* Divider */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                    <span className="text-sm text-[var(--color-text-muted)]">
                        or enter manually
                    </span>
                    <div className="flex-1 h-px bg-[var(--color-border)]" />
                </div>

                {/* Manual Entry */}
                <div className="rounded-xl border border-[var(--color-border)] bg-white/80 p-6 backdrop-blur-sm mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <Package className="h-5 w-5 text-[var(--color-primary)]" />
                        <h2 className="font-semibold text-[var(--color-text)]">
                            Enter Batch ID
                        </h2>
                    </div>

                    <div className="flex gap-3">
                        <input
                            type="text"
                            value={manualId}
                            onChange={(e) => setManualId(e.target.value)}
                            onKeyDown={(e) => e.key === "Enter" && handleManualLookup()}
                            placeholder="e.g., 18 or local-xxx"
                            className="flex-1 rounded-lg border border-[var(--color-border)] px-4 py-3 text-sm focus:border-[var(--color-primary)] focus:ring-2 focus:ring-[var(--color-primary)]/10 outline-none transition"
                        />
                        <button
                            onClick={handleManualLookup}
                            disabled={!manualId.trim()}
                            className="rounded-lg bg-[var(--color-primary)] px-5 py-3 text-white font-semibold hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            <Search className="h-5 w-5" />
                        </button>
                    </div>
                </div>

                {/* Recent Lookup Hint */}
                <div className="text-center">
                    <p className="text-xs text-[var(--color-text-muted)]">
                        Powered by ChainVerify on{" "}
                        <span className="font-semibold text-[var(--color-primary)]">
                            Algorand
                        </span>
                    </p>
                </div>
            </div>
        </main>
    );
}
