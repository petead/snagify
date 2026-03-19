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

  const modalStyles = `
  @keyframes modalSlideUp {
    from { opacity: 0; transform: translateY(100%); }
    to { opacity: 1; transform: translateY(0); }
  }
  @keyframes coinFloat {
    0%, 100% { transform: translateY(0) rotate(-5deg); }
    50% { transform: translateY(-8px) rotate(5deg); }
  }
  @keyframes shimmer {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes pulse-ring {
    0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(154,136,253,0.4); }
    70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(154,136,253,0); }
    100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(154,136,253,0); }
  }
  @keyframes badgePop {
    0% { transform: scale(0) rotate(-10deg); }
    60% { transform: scale(1.15) rotate(3deg); }
    100% { transform: scale(1) rotate(0deg); }
  }
  .credit-pack-card {
    transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  }
  .credit-pack-card:active {
    transform: scale(0.97);
  }
  .credit-pack-card.selected {
    transform: scale(1.02);
  }
  .shimmer-btn {
    background: linear-gradient(90deg, #9A88FD 0%, #b8a9ff 40%, #9A88FD 60%, #7B65FC 100%);
    background-size: 200% auto;
    animation: shimmer 2.5s linear infinite;
  }
`;

  const requiredCredits = 2;
  const currentCredits = currentBalance;
  const isPurchasingSelected =
    !!selectedPack?.stripe_price_id &&
    loadingPriceId === selectedPack.stripe_price_id;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: "rgba(15,12,30,0.6)", backdropFilter: "blur(8px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <style>{modalStyles}</style>

      <div
        className="w-full max-w-sm rounded-t-[32px] overflow-hidden relative"
        style={{
          background: "linear-gradient(160deg, #1A1A2E 0%, #16123a 100%)",
          animation: "modalSlideUp 0.45s cubic-bezier(0.34, 1.56, 0.64, 1)",
          paddingBottom: "max(32px, env(safe-area-inset-bottom))",
          boxShadow: "0 -20px 60px rgba(154,136,253,0.25)",
          maxHeight: "92vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-32 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse, rgba(154,136,253,0.3) 0%, transparent 70%)",
            filter: "blur(20px)",
          }}
        />

        <div className="flex justify-end px-5 pt-4 pb-0 relative">
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.1)" }}
            type="button"
            aria-label="Close"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <path d="M18 6L6 18M6 6l12 12" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="flex flex-col items-center px-6 pt-2 pb-5 relative">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
              animation: "coinFloat 3s ease-in-out infinite",
              boxShadow: "0 8px 32px rgba(154,136,253,0.5)",
            }}
          >
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
              <path d="M12 6v1m0 10v1M9 12h1m4 0h1" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
              <path
                d="M10 9.5C10 8.67 10.9 8 12 8s2 .67 2 1.5c0 .76-.64 1.39-1.5 1.5h-1C10.67 11 10 11.67 10 12.5c0 .83.9 1.5 2 1.5s2-.67 2-1.5"
                stroke="white"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
          </div>

          <h2
            className="text-[26px] text-white mb-1 tracking-tight"
            style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800 }}
          >
            Buy Credits
          </h2>
          <p className="text-[13px] text-white/50">
            {currentCredits > 0
              ? `You have ${currentCredits} credit${currentCredits > 1 ? "s" : ""} remaining`
              : "Top up to generate your reports"}
          </p>
        </div>

        <div className="px-4 space-y-3">
          {loadingCatalog ? (
            <p className="text-[12px] text-white/60 text-center py-4">Loading offers...</p>
          ) : (
            packs.map((pack, i) => {
              const isSelected = selectedPack?.id === pack.id;
              const isRecommended = i === 1;
              const isSufficient = pack.credits >= requiredCredits;

              return (
                <button
                  key={pack.id}
                  type="button"
                  onClick={() => setSelectedPack(pack)}
                  className={`credit-pack-card w-full text-left rounded-2xl p-4 relative overflow-hidden ${isSelected ? "selected" : ""}`}
                  style={{
                    background: isSelected
                      ? "linear-gradient(135deg, rgba(154,136,253,0.25), rgba(123,101,252,0.15))"
                      : "rgba(255,255,255,0.06)",
                    border: isSelected
                      ? "1.5px solid rgba(154,136,253,0.8)"
                      : "1.5px solid rgba(255,255,255,0.08)",
                    boxShadow: isSelected ? "0 4px 20px rgba(154,136,253,0.2)" : "none",
                    animation: isSelected ? "pulse-ring 2s infinite" : "none",
                  }}
                >
                  {isRecommended && (
                    <div
                      className="absolute top-3 right-3 text-[9px] font-extrabold uppercase tracking-wider px-2 py-1 rounded-full"
                      style={{
                        background: "linear-gradient(90deg, #FEDE80, #FFB800)",
                        color: "#1A1A2E",
                        animation: "badgePop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)",
                      }}
                    >
                      ⭐ Best value
                    </div>
                  )}

                  {isSufficient && !isRecommended && (
                    <div
                      className="absolute top-3 right-3 text-[9px] font-bold uppercase tracking-wide px-2 py-1 rounded-full"
                      style={{ background: "rgba(154,136,253,0.2)", color: "#9A88FD" }}
                    >
                      Covers this ✓
                    </div>
                  )}

                  <div className="flex items-center justify-between pr-20">
                    <div>
                      <div
                        className="text-[16px] font-extrabold text-white mb-1"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        {pack.name}
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex -space-x-1">
                          {Array.from({ length: Math.min(pack.credits, 5) }).map((_, ci) => (
                            <div
                              key={ci}
                              className="w-5 h-5 rounded-full border border-[#1A1A2E] flex items-center justify-center"
                              style={{
                                background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
                                opacity: 0.7 + ci * 0.06,
                              }}
                            >
                              <svg width="8" height="8" viewBox="0 0 12 12" fill="none">
                                <circle cx="6" cy="6" r="4" stroke="white" strokeWidth="1.5" />
                              </svg>
                            </div>
                          ))}
                          {pack.credits > 5 && (
                            <div
                              className="w-5 h-5 rounded-full border border-[#1A1A2E] flex items-center justify-center text-[7px] font-bold text-white"
                              style={{ background: "rgba(154,136,253,0.4)" }}
                            >
                              +{pack.credits - 5}
                            </div>
                          )}
                        </div>
                        <span className="text-[12px] text-white/40">
                          {pack.credits} credit{pack.credits > 1 ? "s" : ""} · AED {Math.round(pack.price_aed / pack.credits)}/cr
                        </span>
                      </div>
                    </div>

                    <div className="text-right">
                      <span
                        className="text-[20px] font-extrabold"
                        style={{
                          fontFamily: "Poppins, sans-serif",
                          color: isSelected ? "#b8a9ff" : "#9A88FD",
                        }}
                      >
                        AED {pack.price_aed}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        <div className="px-4 mt-5">
          <button
            type="button"
            onClick={() =>
              selectedPack?.stripe_price_id &&
              void handleBuy(selectedPack.stripe_price_id, selectedPack.id)
            }
            disabled={!selectedPack || isPurchasingSelected || !selectedPack.stripe_price_id}
            className="shimmer-btn w-full py-4 rounded-2xl text-white font-extrabold text-[16px] flex items-center justify-center gap-2 disabled:opacity-40 disabled:pointer-events-none"
            style={{
              fontFamily: "Poppins, sans-serif",
              boxShadow: selectedPack ? "0 8px 32px rgba(154,136,253,0.5)" : "none",
            }}
          >
            {isPurchasingSelected ? (
              <>
                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" opacity="0.25" />
                  <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Processing…
              </>
            ) : selectedPack ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 14l-4-4 1.41-1.41L11 13.17l6.59-6.59L19 8l-8 8z"
                    fill="white"
                  />
                </svg>
                Buy {selectedPack.credits} credits · AED {selectedPack.price_aed}
              </>
            ) : (
              "Choose a pack above"
            )}
          </button>

          <div className="flex items-center justify-center gap-4 mt-3">
            {["🔒 Secure payment", "⚡ Instant activation", "🇦🇪 AED pricing"].map((t, i) => (
              <span key={i} className="text-[10px] text-white/30 font-medium">{t}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
