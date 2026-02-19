"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import algosdk from "algosdk";
import { DeflyWalletConnect } from "@blockshake/defly-connect";
import { x402Client, x402HTTPClient } from "@x402-avm/core/client";
import { registerExactAvmScheme } from "@x402-avm/avm/exact/client";

const ALGOD_URL =
  process.env.NEXT_PUBLIC_ALGOD_URL || "https://testnet-api.algonode.cloud";
const CVT_ASSET_ID = 755696837;

const deflyWallet = new DeflyWalletConnect();

interface WalletContextType {
  account: string | null;
  loading: boolean;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => Promise<void>;
  optInToCVT: () => Promise<void>;
  httpClient: x402HTTPClient;
  algodClient: algosdk.Algodv2;
  deflyWallet: DeflyWalletConnect;
}

const WalletContext = createContext<WalletContextType | null>(null);

export function useWallet() {
  const ctx = useContext(WalletContext);
  if (!ctx) throw new Error("useWallet must be used within WalletProvider");
  return ctx;
}

export function WalletProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const algodClient = useMemo(
    () => new algosdk.Algodv2("", ALGOD_URL, ""),
    []
  );

  const httpClient = useMemo(() => {
    const client = new x402Client();
    const signer = {
      address: account || "",
      signTransactions: async (txns: Uint8Array[], indexes?: number[]) => {
        if (!account) throw new Error("Wallet not connected");
        const signerIndexes = indexes || txns.map((_, i) => i);

        const txnPayloads = txns.map((txn, i) => ({
          txn: algosdk.decodeUnsignedTransaction(txn),
          signers: signerIndexes.includes(i) ? [account] : [],
        }));

        const signed = await deflyWallet.signTransaction([txnPayloads]);
        const result: (Uint8Array | null)[] = new Array(txns.length).fill(null);

        const toBytes = (item: unknown): Uint8Array | null => {
          if (!item) return null;
          if (item instanceof Uint8Array) return item;
          if (typeof item === "string")
            return new Uint8Array(Buffer.from(item, "base64"));
          if (typeof (item as { blob?: string }).blob === "string")
            return new Uint8Array(
              Buffer.from((item as { blob: string }).blob, "base64")
            );
          return null;
        };

        if (signed.length === txns.length) {
          for (let i = 0; i < txns.length; i++) {
            if (signerIndexes.includes(i)) result[i] = toBytes(signed[i]);
          }
        } else {
          for (
            let j = 0;
            j < signed.length && j < signerIndexes.length;
            j++
          ) {
            result[signerIndexes[j]] = toBytes(signed[j]);
          }
        }
        return result;
      },
    };

    registerExactAvmScheme(client, {
      signer,
      algodConfig: { algodClient },
    });

    return new x402HTTPClient(client);
  }, [account, algodClient]);

  useEffect(() => {
    deflyWallet.reconnectSession().then((accounts) => {
      if (accounts.length) setAccount(accounts[0]);
    });
  }, []);

  const connectWallet = useCallback(async () => {
    const accounts = await deflyWallet.connect();
    setAccount(accounts[0]);
  }, []);

  const disconnectWallet = useCallback(async () => {
    await deflyWallet.disconnect();
    setAccount(null);
  }, []);

  const optInToCVT = useCallback(async () => {
    if (!account) return;
    setLoading(true);
    try {
      const params = await algodClient.getTransactionParams().do();
      const optInTxn =
        algosdk.makeAssetTransferTxnWithSuggestedParamsFromObject({
          sender: account,
          receiver: account,
          amount: 0,
          assetIndex: CVT_ASSET_ID,
          suggestedParams: params,
        });

      // Compute txId from the unsigned transaction before signing
      const txId = optInTxn.txID();

      const signedTxns = await deflyWallet.signTransaction([
        [{ txn: optInTxn, signers: [account] }],
      ]);

      // Defly returns an array — get the first signed txn bytes
      const signedTxnBytes = signedTxns[0] instanceof Uint8Array
        ? signedTxns[0]
        : new Uint8Array(signedTxns[0] as ArrayBuffer);

      await algodClient.sendRawTransaction(signedTxnBytes).do();
      await algosdk.waitForConfirmation(algodClient, txId, 6);
    } finally {
      setLoading(false);
    }
  }, [account, algodClient]);

  return (
    <WalletContext.Provider
      value={{
        account,
        loading,
        connectWallet,
        disconnectWallet,
        optInToCVT,
        httpClient,
        algodClient,
        deflyWallet,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
}
