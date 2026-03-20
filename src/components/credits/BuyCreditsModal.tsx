"use client";

import React, { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

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

  const modalStyles = `
  @keyframes sheetUp {
    from { opacity: 0; transform: translateY(60px); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes coinFloat {
    0%, 100% { transform: translateY(0) rotate(-4deg); }
    50% { transform: translateY(-7px) rotate(4deg); }
  }
  @keyframes shimmerPrimary {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  .buy-sheet {
    animation: sheetUp 0.4s cubic-bezier(0.34, 1.4, 0.64, 1);
  }
  .coin-icon {
    animation: coinFloat 3s ease-in-out infinite;
  }
  .shimmer-cta {
    background: linear-gradient(90deg, #9A88FD 0%, #c4b8ff 45%, #9A88FD 60%, #7B65FC 100%);
    background-size: 200% auto;
    animation: shimmerPrimary 2.5s linear infinite;
  }
  .pack-card {
    transition: all 0.2s cubic-bezier(0.34, 1.4, 0.64, 1);
    cursor: pointer;
  }
  .pack-card:active { transform: scale(0.98); }
  .pack-card.selected { transform: scale(1.015); }
`;

  const currentCredits = currentBalance;
  const loading =
    !!selectedPack?.stripe_price_id &&
    loadingPriceId === selectedPack.stripe_price_id;
  const handlePurchase = () => {
    if (!selectedPack?.stripe_price_id) return;
    void handleBuy(selectedPack.stripe_price_id, selectedPack.id);
  };

  return (
    <>
      <style>{modalStyles}</style>

      <div className="fixed inset-0 z-50 flex min-h-[100dvh] items-end justify-center">
        <div
          className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          onClick={onClose}
          aria-hidden
        />
        <div
          className={cn(
            "buy-sheet relative z-10 w-full max-w-[480px]",
            "rounded-t-3xl bg-[#12102A] px-5 pt-6",
            "min-h-[60vh] max-h-[90vh] overflow-y-auto",
            "pb-[max(6rem,calc(4rem+env(safe-area-inset-bottom)))]",
            "shadow-[0_-20px_60px_rgba(154,136,253,0.25)]"
          )}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              position: "absolute", top: -30, left: "50%",
              transform: "translateX(-50%)",
              width: 260, height: 120, pointerEvents: "none",
              background: "radial-gradient(ellipse, rgba(154,136,253,0.25) 0%, transparent 70%)",
              filter: "blur(16px)",
            }}
          />

          <div style={{ display: "flex", justifyContent: "center", paddingTop: 10, marginBottom: 4 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: "rgba(255,255,255,0.12)" }} />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 0 0" }}>
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                background: "rgba(255,255,255,0.08)",
                border: "none", cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}
              type="button"
              aria-label="Close"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M18 6L6 18M6 6l12 12" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </button>
          </div>

          <div style={{ textAlign: "center", padding: "4px 0 20px", position: "relative" }}>
            <div
              className="coin-icon"
              style={{
                width: 64, height: 64, borderRadius: 18,
                background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
                display: "inline-flex", alignItems: "center", justifyContent: "center",
                marginBottom: 14,
                boxShadow: "0 8px 28px rgba(154,136,253,0.45)",
              }}
            >
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                <line x1="12" y1="1" x2="12" y2="23" stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
                <path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                  stroke="white" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </div>
            <h2 style={{
              fontSize: 26, fontWeight: 800, color: "white",
              margin: "0 0 6px", fontFamily: "Poppins, sans-serif",
              letterSpacing: "-0.3px",
            }}>
              Buy Credits
            </h2>
            <p style={{ fontSize: 13, color: "rgba(255,255,255,0.4)", margin: 0 }}>
              {currentCredits > 0
                ? `You have ${currentCredits} credit${currentCredits !== 1 ? "s" : ""} remaining`
                : "Top up to generate your reports"}
            </p>
          </div>

          <div style={{ padding: "0 0", display: "flex", flexDirection: "column", gap: 10 }}>
            {loadingCatalog ? (
              <p style={{ margin: "8px 0", textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.6)" }}>
                Loading offers...
              </p>
            ) : (
              packs.map((pack, i) => {
                const isSelected = selectedPack?.id === pack.id
                const isBestValue = i === packs.length - 1
                const isStarter = i === 0

                return (
                  <button
                    key={pack.id}
                    type="button"
                    onClick={() => setSelectedPack(pack)}
                    className={`pack-card${isSelected ? " selected" : ""}`}
                    style={{
                      width: "100%", textAlign: "left",
                      background: isSelected
                        ? "rgba(154,136,253,0.18)"
                        : "rgba(255,255,255,0.05)",
                      border: isSelected
                        ? "1.5px solid rgba(154,136,253,0.7)"
                        : isBestValue
                          ? "1.5px solid rgba(254,222,128,0.4)"
                          : "1.5px solid rgba(255,255,255,0.07)",
                      borderRadius: 18,
                      padding: "14px 16px",
                      boxShadow: isSelected ? "0 4px 20px rgba(154,136,253,0.2)" : "none",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 16, flexShrink: 0,
                        background: isSelected
                          ? "linear-gradient(135deg, #9A88FD, #7B65FC)"
                          : isBestValue
                            ? "linear-gradient(135deg, #FEDE80, #D4A800)"
                            : "rgba(154,136,253,0.2)",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isSelected ? "0 4px 16px rgba(154,136,253,0.4)" : "none",
                        position: "relative",
                      }}>
                        <span style={{
                          fontSize: 20, fontWeight: 800,
                          color: isBestValue && !isSelected ? "#1A1A2E" : "white",
                          fontFamily: "Poppins, sans-serif",
                          lineHeight: 1,
                        }}>
                          {pack.credits}
                        </span>
                      </div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
                          <span style={{
                            fontSize: 16, fontWeight: 800, color: "white",
                            fontFamily: "Poppins, sans-serif",
                          }}>
                            {pack.name}
                          </span>
                          {isBestValue && (
                            <span style={{
                              fontSize: 9, fontWeight: 800,
                              background: "linear-gradient(90deg, #FEDE80, #FFB800)",
                              color: "#1A1A2E",
                              padding: "3px 8px", borderRadius: 20,
                              textTransform: "uppercase", letterSpacing: "0.5px",
                              whiteSpace: "nowrap", flexShrink: 0,
                            }}>
                              ⭐ Best value
                            </span>
                          )}
                          {isStarter && (
                            <span style={{
                              fontSize: 9, fontWeight: 700,
                              background: "rgba(154,136,253,0.2)",
                              color: "#9A88FD",
                              padding: "3px 8px", borderRadius: 20,
                              whiteSpace: "nowrap", flexShrink: 0,
                            }}>
                              Starter
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: 12, color: "rgba(255,255,255,0.35)" }}>
                          {pack.credits} credit{pack.credits > 1 ? "s" : ""} · AED {Math.round(pack.price_aed / pack.credits)}/cr
                        </span>
                      </div>

                      <span style={{
                        fontSize: 18, fontWeight: 800,
                        color: isSelected ? "#c4b8ff" : "#9A88FD",
                        fontFamily: "Poppins, sans-serif",
                        whiteSpace: "nowrap", flexShrink: 0,
                      }}>
                        AED {pack.price_aed}
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          <div style={{ padding: "16px 0 0" }}>
            <button
              type="button"
              onClick={handlePurchase}
              disabled={!selectedPack || loading}
              className={cn(
                "w-full rounded-2xl border-none py-4 text-base font-extrabold transition-all",
                "flex items-center justify-center gap-2",
                loading && selectedPack
                  ? "cursor-wait bg-[#9A88FD] text-white opacity-90"
                  : selectedPack
                    ? "shimmer-cta cursor-pointer text-white shadow-[0_8px_28px_rgba(154,136,253,0.4)]"
                    : "cursor-not-allowed bg-white/10 text-white/30"
              )}
            >
              {loading ? (
                <>
                  <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" opacity="0.25"/>
                    <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                  Processing…
                </>
              ) : selectedPack ? (
                `Buy ${selectedPack.credits} credits · AED ${selectedPack.price_aed}`
              ) : (
                "Choose a pack above"
              )}
            </button>

            <div style={{ display: "flex", justifyContent: "center", gap: 20, marginTop: 12 }}>
              {["🔒 Secure", "⚡ Instant", "🇦🇪 AED"].map((t, i) => (
                <span key={i} style={{ fontSize: 10, color: "rgba(255,255,255,0.25)", fontWeight: 500 }}>{t}</span>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  );
}
