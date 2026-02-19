import "./globals.css";
import { WalletProvider } from "./providers";
import Navbar from "./components/Navbar";

export const metadata = {
  title: "ChainVerify | Farm to Shelf Provenance on Algorand",
  description:
    "AI-verified supply chain provenance with x402 micropayments on Algorand. Track products from farm to shelf with immutable on-chain records.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <WalletProvider>
          <Navbar />
          <main>{children}</main>
        </WalletProvider>
      </body>
    </html>
  );
}
