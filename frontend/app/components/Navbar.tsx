"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWallet } from "../providers";

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/farmer", label: "Farmer" },
  { href: "/scan", label: "Scan" },
  { href: "/verify", label: "Verify" },
];

export default function Navbar() {
  const pathname = usePathname();
  const { account, connectWallet, disconnectWallet } = useWallet();

  return (
    <nav className="sticky top-0 z-50 border-b border-[var(--color-border)] bg-[var(--color-bg)]/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2 no-underline">
          <span className="text-2xl font-bold text-[var(--color-text)]">
            🌿 ChainVerify
          </span>
        </Link>

        {/* Nav links */}
        <div className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-lg px-4 py-2 text-sm font-medium no-underline transition-colors ${pathname === link.href
                ? "bg-[var(--color-primary)] text-white"
                : "text-[var(--color-text-muted)] hover:bg-[var(--color-bg-card)] hover:text-[var(--color-text)]"
                }`}
            >
              {link.label}
            </Link>
          ))}
        </div>

        {/* Wallet */}
        <div className="flex items-center gap-3">
          {account ? (
            <>
              <span className="rounded-full bg-[var(--color-bg-card)] px-3 py-1.5 text-xs font-mono border border-[var(--color-border)]">
                {account.slice(0, 6)}...{account.slice(-4)}
              </span>
              <button
                onClick={disconnectWallet}
                className="rounded-lg border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              onClick={connectWallet}
              className="rounded-lg bg-[var(--color-bg-dark)] px-5 py-2 text-sm font-medium text-white hover:bg-[var(--color-bg-darker)] transition-colors"
            >
              Connect Wallet
            </button>
          )}
        </div>
      </div>
    </nav>
  );
}
