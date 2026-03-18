"use client";

import React, { useEffect, useMemo, useState } from "react";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  accountType: "individual" | "pro";
  plan: string;
  onPurchaseSuccess?: () => void;
}

type Pack = {
  id: string;
  name: string;
  credits: number;
  price_aed: number;
  stripe_price_id: string | null;
  sort_order?: number | null;
};

function CoversBadge() {
  return (
    <span
      style={{
        position: "absolute",
        top: 8,
        right: 8,
        fontSize: 10,
        fontWeight: 700,
        color: "#15803D",
        background: "#DCFCE7",
        borderRadius: 999,
        padding: "3px 7px",
      }}
    >
      Covers this checkout ✓
    </span>
  );
}

export function BuyCreditsModal({
  isOpen,
  onClose,
  currentBalance,
  accountType,
  plan: _plan,
  onPurchaseSuccess,
}: BuyCreditsModalProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPacks = async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetch(`/api/credits/packs?target=individual`);
        const data = (await res.json()) as {
          packs?: Pack[];
        };
        setPacks(data.packs ?? []);
      } catch {
        setPacks([]);
      } finally {
        setLoadingCatalog(false);
      }
    };
    void fetchPacks();
  }, [isOpen]);

  const firstCoveringPackId = useMemo(() => {
    const first = packs.find((p) => Number(p.credits ?? 0) >= 2);
    return first?.id ?? null;
  }, [packs]);

  async function handleBuy(priceId: string, packId: string) {
    setLoadingPriceId(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "one_time",
          price_id: priceId,
          pack_id: packId,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create checkout session");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingPriceId(null);
      if (onPurchaseSuccess) {
        void onPurchaseSuccess();
      }
    }
  }

  if (!isOpen) return null;

  if (accountType !== "individual") {
    return null;
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(17,24,39,0.45)",
        zIndex: 2000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 480,
          borderRadius: 20,
          background: "#F8F7F4",
          padding: 18,
          maxHeight: "90vh",
          overflowY: "auto",
        }}
      >
        <button
          type="button"
          onClick={onClose}
          style={{
            marginLeft: "auto",
            display: "block",
            background: "none",
            border: "none",
            fontSize: 22,
            lineHeight: 1,
            cursor: "pointer",
            color: "#6B7280",
          }}
          aria-label="Close"
        >
          ×
        </button>

        <div style={{ textAlign: "center", marginTop: -6 }}>
          <div style={{ fontSize: 24, color: "#9A88FD", marginBottom: 8 }}>💳</div>
          <h3
            style={{
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#1A1A2E",
            }}
          >
            Buy Credits
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
            You currently have {currentBalance} credit{currentBalance !== 1 ? "s" : ""}.
          </p>
        </div>

        <p
          style={{
            margin: "18px 0 10px",
            fontSize: 11,
            textTransform: "uppercase",
            letterSpacing: 1.1,
            color: "#9CA3AF",
            fontWeight: 700,
          }}
        >
          Choose a pack
        </p>

        {loadingCatalog ? (
          <p style={{ margin: "6px 0", fontSize: 12, color: "#6B7280" }}>Loading offers...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {packs.map((pack) => {
              const isSelected = selectedPack?.id === pack.id;
              const highlighted = pack.id === firstCoveringPackId;
              const pricePerCredit = Number(pack.price_aed) / Math.max(Number(pack.credits), 1);
              const isLoading = loadingPriceId === pack.stripe_price_id;

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  style={{
                    width: "100%",
                    padding: 16,
                    borderRadius: 16,
                    border: isSelected
                      ? "2px solid #9A88FD"
                      : "2px solid #F3F4F6",
                    background: isSelected ? "#EDE9FF" : "#fff",
                    textAlign: "left",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                    position: "relative",
                  }}
                >
                  {highlighted && !isSelected && (
                    <CoversBadge />
                  )}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A2E" }}>
                      {pack.name}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 800, color: "#9A88FD" }}>
                      AED {pack.price_aed}
                    </span>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 13, color: "#6B7280" }}>
                      {pack.credits} credits
                    </span>
                    <span style={{ fontSize: 11, color: "#9CA3AF" }}>
                      · AED {Math.round(pricePerCredit)}/credit
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {selectedPack && (
          <button
            type="button"
            onClick={() => selectedPack.stripe_price_id && void handleBuy(selectedPack.stripe_price_id, selectedPack.id)}
            disabled={!selectedPack.stripe_price_id || loadingPriceId === selectedPack.stripe_price_id}
            style={{
              width: "100%",
              marginTop: 16,
              border: "none",
              borderRadius: 14,
              background: "#9A88FD",
              color: "#fff",
              fontWeight: 700,
              padding: "14px 12px",
              fontSize: 14,
              cursor: (!selectedPack.stripe_price_id || loadingPriceId === selectedPack.stripe_price_id) ? "not-allowed" : "pointer",
              opacity: (!selectedPack.stripe_price_id || loadingPriceId === selectedPack.stripe_price_id) ? 0.7 : 1,
            }}
          >
            {loadingPriceId === selectedPack.stripe_price_id
              ? "Processing..."
              : `Buy ${selectedPack.credits} credits - AED ${selectedPack.price_aed}`}
          </button>
        )}

        <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
          Credits never expire · Secure payment via Stripe
        </p>
      </div>
    </div>
  );
}
