"use client";

import Link from "next/link";
import { ArrowRight, CheckCircle2, Zap, Lock, BarChart3, Leaf } from "lucide-react";

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-[var(--color-bg-light)] via-[var(--color-bg)] to-[var(--color-bg-lighter)]">
      {/* Hero Section */}
      <section className="relative overflow-hidden px-6 py-32">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 inline-block rounded-full bg-green-100/50 px-4 py-1 text-sm font-semibold text-green-700 border border-green-200">
            🚀 AI-Powered Supply Chain Verification
          </div>

          <h1 className="mb-6 text-5xl font-bold tracking-tight text-[var(--color-text)] md:text-6xl">
            Trust Every Link in Your Supply Chain
          </h1>

          <p className="mb-10 text-xl text-[var(--color-text-muted)] max-w-2xl">
            ChainVerify combines AI anomaly detection with blockchain immutability to verify farm-to-consumer provenance. 6 real-time checks. 1000 CVT per verification. 100% on-chain.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row">
            <Link
              href="/verify"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-8 py-4 font-semibold text-white hover:bg-green-700 transition-colors"
            >
              Start Verification <ArrowRight className="w-4 h-4" />
            </Link>
            <Link
              href="/farmer"
              className="inline-flex items-center justify-center rounded-lg border border-[var(--color-border)] bg-white px-8 py-4 font-semibold text-[var(--color-text)] hover:bg-[var(--color-bg-card)] transition-colors"
            >
              Register Batch
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y border-[var(--color-border)] bg-white/50 px-6 py-12">
        <div className="mx-auto flex max-w-5xl justify-around gap-8 flex-wrap">
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">6</div>
            <div className="text-sm text-[var(--color-text-muted)]">AI Checks</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">1000</div>
            <div className="text-sm text-[var(--color-text-muted)]">CVT Per Verify</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">&lt;3s</div>
            <div className="text-sm text-[var(--color-text-muted)]">Verification Time</div>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold text-[var(--color-primary)]">100%</div>
            <div className="text-sm text-[var(--color-text-muted)]">On-Chain</div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-4xl font-bold text-[var(--color-text)]">
            Verification Powered by AI
          </h2>

          <div className="grid gap-8 md:grid-cols-2">
            {/* Feature 1 */}
            <div className="rounded-xl bg-white/70 p-8 border border-[var(--color-border)] backdrop-blur-sm hover:shadow-lg transition-shadow">
              <Leaf className="mb-4 h-8 w-8 text-[var(--color-primary)]" />
              <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">
                On-Chain Provenance
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Every batch, checkpoint, and handoff stored immutably on Algorand smart contracts.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="rounded-xl bg-white/70 p-8 border border-[var(--color-border)] backdrop-blur-sm hover:shadow-lg transition-shadow">
              <Zap className="mb-4 h-8 w-8 text-[var(--color-primary)]" />
              <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">
                x402 AI Verification
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Pay as you verify: 1000 CVT via x402 exact scheme. Micropayments powered by Algorand.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="rounded-xl bg-white/70 p-8 border border-[var(--color-border)] backdrop-blur-sm hover:shadow-lg transition-shadow">
              <BarChart3 className="mb-4 h-8 w-8 text-[var(--color-primary)]" />
              <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">
                6 Anomaly Checks
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Speed, temperature, time gaps, certification, photo integrity, and route consistency verified in real-time.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="rounded-xl bg-white/70 p-8 border border-[var(--color-border)] backdrop-blur-sm hover:shadow-lg transition-shadow">
              <Lock className="mb-4 h-8 w-8 text-[var(--color-primary)]" />
              <h3 className="mb-3 text-lg font-bold text-[var(--color-text)]">
                Multi-Party Handoffs
              </h3>
              <p className="text-[var(--color-text-muted)]">
                Farmer → Distributor → Retailer. Each party signs. Each transfer logged on-chain.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="bg-white/50 border-y border-[var(--color-border)] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-4xl font-bold text-[var(--color-text)]">
            How It Works
          </h2>

          <div className="grid gap-12 md:grid-cols-4">
            {[
              {
                num: "1",
                title: "Register Batch",
                desc: "Farmer creates a batch with crop details, GPS, organic cert.",
              },
              {
                num: "2",
                title: "Log Checkpoints",
                desc: "Track temperature, speed, photos, time at each handoff.",
              },
              {
                num: "3",
                title: "Handoff Chain",
                desc: "Distributor and retailer confirm receipt and conditions.",
              },
              {
                num: "4",
                title: "Verify & Pay",
                desc: "Pay 1000 CVT. AI validates 6 checks. Result on-chain.",
              },
            ].map((step) => (
              <div key={step.num} className="text-center">
                <div className="mb-4 inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--color-primary)] text-white font-bold text-lg">
                  {step.num}
                </div>
                <h3 className="mb-2 font-bold text-[var(--color-text)]">{step.title}</h3>
                <p className="text-sm text-[var(--color-text-muted)]">{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-12 text-center text-4xl font-bold text-[var(--color-text)]">
            Built on Modern Tech
          </h2>

          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Algorand Testnet",
              "TEALScript Contracts",
              "x402 Micropayments",
              "AI Anomaly Detection",
              "Next.js Frontend",
              "Fastify Backend",
              "SQLite Persistence",
              "Defly Wallet",
            ].map((tech) => (
              <div
                key={tech}
                className="rounded-full bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text)] border border-[var(--color-border)]"
              >
                {tech}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="border-t border-[var(--color-border)] bg-gradient-to-r from-green-50 to-blue-50 px-6 py-24">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="mb-4 text-4xl font-bold text-[var(--color-text)]">
            Verify Trust From Farm to Consumer
          </h2>
          <p className="mb-8 text-[var(--color-text-muted)] text-lg">
            Join the supply chain revolution. Register your batches, track checkpoints, and verify with AI.
          </p>

          <div className="flex flex-col gap-4 sm:flex-row justify-center">
            <Link
              href="/farmer"
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-[var(--color-primary)] px-8 py-4 font-semibold text-white hover:bg-green-700 transition-colors"
            >
              <Leaf className="w-4 h-4" />
              Get Started as Farmer
            </Link>
            <Link
              href="/verify"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-[var(--color-primary)] bg-transparent px-8 py-4 font-semibold text-[var(--color-primary)] hover:bg-green-50 transition-colors"
            >
              <CheckCircle2 className="w-4 h-4" />
              Verify a Batch
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-[var(--color-border)] bg-[var(--color-bg-light)] px-6 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid gap-12 md:grid-cols-3 mb-8">
            <div>
              <h4 className="mb-4 font-bold text-[var(--color-text)]">🌿 ChainVerify</h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                AI-verified supply chains on Algorand. Trust every link.
              </p>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-[var(--color-text)]">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <Link
                    href="/farmer"
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  >
                    Farmer Dashboard
                  </Link>
                </li>
                <li>
                  <Link
                    href="/verify"
                    className="text-sm text-[var(--color-text-muted)] hover:text-[var(--color-primary)]"
                  >
                    Verify Batch
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="mb-4 font-bold text-[var(--color-text)]">Network</h4>
              <p className="text-sm text-[var(--color-text-muted)]">
                Algorand Testnet<br />
                App ID: 755697325<br />
                CVT ASA: 755696837
              </p>
            </div>
          </div>

          <div className="border-t border-[var(--color-border)] pt-8 text-center">
            <p className="text-sm text-[var(--color-text-muted)]">
              © 2024 ChainVerify. Verify supply chains with AI and blockchain.
            </p>
          </div>
        </div>
      </footer>
    </main>
  );
}
