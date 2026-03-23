"use client";

import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  accountType: "individual" | "pro";
  plan: string;
  /** Current subscription plan slug (starter | growth | agency) for pro checkout metadata */
  planSlug?: string;
  /** From subscription_plans.extra_credit_price_aed or tier default */
  pricePerCredit?: number;
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

function mapPackDisplayName(name: string): string {
  const n = name.trim().toLowerCase();
  if (n === "découverte" || n === "decouverte") return "Starter";
  if (n === "essentiel") return "Essential";
  if (n === "sérénité" || n === "serenite") return "Serenity";
  return name;
}

const MIN_QTY = 1;
const MAX_QTY = 50;

export function BuyCreditsModal({
  isOpen,
  onClose,
  currentBalance,
  accountType,
  plan: _plan,
  planSlug,
  pricePerCredit,
  onPurchaseSuccess,
}: BuyCreditsModalProps) {
  const [mounted, setMounted] = useState(false);
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [quantity, setQuantity] = useState(5);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    if (accountType === "pro") {
      setPacks([]);
      setLoadingCatalog(false);
      return;
    }
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
  }, [isOpen, accountType]);

  async function handleBuy(pack: Pack) {
    setLoadingPriceId(pack.id);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "one_time",
          packId: pack.id,
          successUrl: `${window.location.origin}/dashboard?credits=success`,
          cancelUrl: window.location.href,
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

  async function handleProBuy() {
    setLoadingPriceId("pro");
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "one_time",
          pro_credits: true,
          quantity,
          plan_slug: planSlug,
          price_per_credit: pricePerCredit ?? 18,
          successUrl: `${window.location.origin}/dashboard?credits=success`,
          cancelUrl: window.location.href,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Checkout failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Checkout failed");
    } finally {
      setLoadingPriceId(null);
    }
  }

  const modalStyles = `
  @keyframes coinFloat {
    0%, 100% { transform: translateY(0) rotate(-4deg); }
    50% { transform: translateY(-7px) rotate(4deg); }
  }
  @keyframes shimmerPrimary {
    0% { background-position: -200% center; }
    100% { background-position: 200% center; }
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
  const loadingIndividual = !!selectedPack && loadingPriceId === selectedPack.id;
  const loadingPro = accountType === "pro" && loadingPriceId === "pro";
  const loading = loadingIndividual || loadingPro;
  const canPurchasePro = accountType === "pro";
  const handlePurchase = () => {
    if (accountType === "pro") {
      void handleProBuy();
    } else {
      if (!selectedPack) return;
      void handleBuy(selectedPack);
    }
  };

  const portal = mounted
    ? createPortal(
        <AnimatePresence>
          {isOpen && (
            <motion.div
              key="buy-credits-overlay"
              className="fixed inset-0 z-[9999] flex min-h-0 flex-col justify-end"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={onClose}
                aria-hidden
              />
              <motion.div
                initial={{ y: "100%" }}
                animate={{ y: 0 }}
                exit={{ y: "100%" }}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
                className={cn(
                  "relative z-10 mx-auto flex w-full max-w-[480px] flex-col overflow-hidden rounded-t-3xl bg-[#12102A]",
                  "shadow-[0_-20px_60px_rgba(154,136,253,0.25)]"
                )}
                style={{ maxHeight: "85vh" }}
                onClick={(e) => e.stopPropagation()}
              >
              <div className="flex shrink-0 justify-center pb-1 pt-3">
                <div className="h-1 w-10 rounded-full bg-white/20" />
              </div>

              <button
                type="button"
                onClick={onClose}
                className="absolute right-4 top-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/10 text-lg leading-none text-white/60 transition-colors hover:text-white"
                aria-label="Close"
              >
                ✕
              </button>

              <div
                className="relative min-h-0 flex-1 overflow-y-auto px-5 pb-[max(5rem,calc(2rem+env(safe-area-inset-bottom)))] pt-2"
              >
                <div
                  style={{
                    position: "absolute",
                    top: -30,
                    left: "50%",
                    transform: "translateX(-50%)",
                    width: 260,
                    height: 120,
                    pointerEvents: "none",
                    background:
                      "radial-gradient(ellipse, rgba(154,136,253,0.25) 0%, transparent 70%)",
                    filter: "blur(16px)",
                  }}
                />

                <div
                  style={{
                    textAlign: "center",
                    padding: "4px 0 20px",
                    position: "relative",
                  }}
                >
                  <div
                    className="coin-icon"
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 18,
                      background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginBottom: 14,
                      boxShadow: "0 8px 28px rgba(154,136,253,0.45)",
                    }}
                  >
                    <svg width="30" height="30" viewBox="0 0 24 24" fill="none">
                      <line
                        x1="12"
                        y1="1"
                        x2="12"
                        y2="23"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                      <path
                        d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"
                        stroke="white"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                  <h2
                    style={{
                      fontSize: 26,
                      fontWeight: 800,
                      color: "white",
                      margin: "0 0 6px",
                      fontFamily: "Poppins, sans-serif",
                      letterSpacing: "-0.3px",
                    }}
                  >
                    Buy Credits
                  </h2>
                  <p
                    style={{
                      fontSize: 13,
                      color: "rgba(255,255,255,0.4)",
                      margin: 0,
                    }}
                  >
                    {currentCredits > 0
                      ? `You have ${currentCredits} credit${currentCredits !== 1 ? "s" : ""} remaining`
                      : "Top up to generate your reports"}
                  </p>
                </div>

                <div
                  style={{
                    padding: "0 0",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  {accountType === "pro" ? (
                    <div style={{ padding: "8px 0" }}>
                      <div
                        style={{
                          background: "rgba(154,136,253,0.1)",
                          borderRadius: 14,
                          padding: "12px 16px",
                          marginBottom: 16,
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <span style={{ fontSize: 13, color: "rgba(255,255,255,0.6)" }}>
                          Price per credit
                        </span>
                        <span
                          style={{
                            fontSize: 16,
                            fontWeight: 800,
                            color: "#9A88FD",
                            fontFamily: "Poppins, sans-serif",
                          }}
                        >
                          AED {pricePerCredit ?? 18}
                        </span>
                      </div>

                      <div
                        style={{
                          background: "rgba(255,255,255,0.05)",
                          border: "1.5px solid rgba(154,136,253,0.4)",
                          borderRadius: 20,
                          padding: "20px 20px",
                        }}
                      >
                        <p
                          style={{
                            color: "rgba(255,255,255,0.5)",
                            fontSize: 12,
                            margin: "0 0 16px",
                            textAlign: "center",
                          }}
                        >
                          How many credits do you need?
                        </p>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: 24,
                            marginBottom: 20,
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setQuantity((q) => Math.max(MIN_QTY, q - 1))}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 14,
                              background:
                                quantity <= MIN_QTY
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(154,136,253,0.2)",
                              border: "none",
                              cursor: quantity <= MIN_QTY ? "not-allowed" : "pointer",
                              color: "white",
                              fontSize: 22,
                              fontWeight: 300,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>

                          <div style={{ textAlign: "center" }}>
                            <span
                              style={{
                                fontSize: 52,
                                fontWeight: 800,
                                color: "white",
                                fontFamily: "Poppins, sans-serif",
                                lineHeight: 1,
                              }}
                            >
                              {quantity}
                            </span>
                            <p
                              style={{
                                color: "rgba(255,255,255,0.4)",
                                fontSize: 12,
                                margin: "4px 0 0",
                              }}
                            >
                              credit{quantity > 1 ? "s" : ""}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setQuantity((q) => Math.min(MAX_QTY, q + 1))}
                            style={{
                              width: 44,
                              height: 44,
                              borderRadius: 14,
                              background:
                                quantity >= MAX_QTY
                                  ? "rgba(255,255,255,0.05)"
                                  : "rgba(154,136,253,0.2)",
                              border: "none",
                              cursor: quantity >= MAX_QTY ? "not-allowed" : "pointer",
                              color: "white",
                              fontSize: 22,
                              fontWeight: 300,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            ＋
                          </button>
                        </div>

                        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
                          {[5, 10, 20].map((q) => (
                            <button
                              key={q}
                              type="button"
                              onClick={() => setQuantity(q)}
                              style={{
                                padding: "6px 14px",
                                borderRadius: 20,
                                border: "none",
                                background: quantity === q ? "#9A88FD" : "rgba(255,255,255,0.08)",
                                color: quantity === q ? "white" : "rgba(255,255,255,0.4)",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              {q}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginTop: 16,
                          padding: "12px 4px",
                        }}
                      >
                        <span style={{ color: "rgba(255,255,255,0.5)", fontSize: 13 }}>
                          Total
                        </span>
                        <span
                          style={{
                            fontSize: 22,
                            fontWeight: 800,
                            color: "white",
                            fontFamily: "Poppins, sans-serif",
                          }}
                        >
                          AED {(quantity * (pricePerCredit ?? 18)).toLocaleString("en-AE")}
                        </span>
                      </div>
                    </div>
                  ) : (
                    <>
                      {loadingCatalog ? (
                        <p
                          style={{
                            margin: "8px 0",
                            textAlign: "center",
                            fontSize: 12,
                            color: "rgba(255,255,255,0.6)",
                          }}
                        >
                          Loading offers...
                        </p>
                      ) : (
                        packs.map((pack, i) => {
                          const isSelected = selectedPack?.id === pack.id;
                          const isBestValue = i === packs.length - 1;
                          const isStarter = i === 0;

                          return (
                            <button
                              key={pack.id}
                              type="button"
                              onClick={() => setSelectedPack(pack)}
                              className={`pack-card${isSelected ? " selected" : ""}`}
                              style={{
                                width: "100%",
                                textAlign: "left",
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
                                boxShadow: isSelected
                                  ? "0 4px 20px rgba(154,136,253,0.2)"
                                  : "none",
                              }}
                            >
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: 14,
                                }}
                              >
                                <div
                                  style={{
                                    width: 52,
                                    height: 52,
                                    borderRadius: 16,
                                    flexShrink: 0,
                                    background: isSelected
                                      ? "linear-gradient(135deg, #9A88FD, #7B65FC)"
                                      : isBestValue
                                        ? "linear-gradient(135deg, #FEDE80, #D4A800)"
                                        : "rgba(154,136,253,0.2)",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    boxShadow: isSelected
                                      ? "0 4px 16px rgba(154,136,253,0.4)"
                                      : "none",
                                    position: "relative",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: 20,
                                      fontWeight: 800,
                                      color:
                                        isBestValue && !isSelected
                                          ? "#1A1A2E"
                                          : "white",
                                      fontFamily: "Poppins, sans-serif",
                                      lineHeight: 1,
                                    }}
                                  >
                                    {pack.credits}
                                  </span>
                                </div>

                                <div style={{ flex: 1, minWidth: 0 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      gap: 6,
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: 16,
                                        fontWeight: 800,
                                        color: "white",
                                        fontFamily: "Poppins, sans-serif",
                                      }}
                                    >
                                      {mapPackDisplayName(pack.name)}
                                    </span>
                                    {isBestValue && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 800,
                                          background:
                                            "linear-gradient(90deg, #FEDE80, #FFB800)",
                                          color: "#1A1A2E",
                                          padding: "3px 8px",
                                          borderRadius: 20,
                                          textTransform: "uppercase",
                                          letterSpacing: "0.5px",
                                          whiteSpace: "nowrap",
                                          flexShrink: 0,
                                        }}
                                      >
                                        ⭐ Best value
                                      </span>
                                    )}
                                    {isStarter && (
                                      <span
                                        style={{
                                          fontSize: 9,
                                          fontWeight: 700,
                                          background: "rgba(154,136,253,0.2)",
                                          color: "#9A88FD",
                                          padding: "3px 8px",
                                          borderRadius: 20,
                                          whiteSpace: "nowrap",
                                          flexShrink: 0,
                                        }}
                                      >
                                        Starter
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: 12,
                                      color: "rgba(255,255,255,0.35)",
                                    }}
                                  >
                                    {pack.credits} credit{pack.credits > 1 ? "s" : ""}{" "}
                                    · AED{" "}
                                    {Math.round(pack.price_aed / pack.credits)}/cr
                                  </span>
                                </div>

                                <span
                                  style={{
                                    fontSize: 18,
                                    fontWeight: 800,
                                    color: isSelected ? "#c4b8ff" : "#9A88FD",
                                    fontFamily: "Poppins, sans-serif",
                                    whiteSpace: "nowrap",
                                    flexShrink: 0,
                                  }}
                                >
                                  AED {pack.price_aed}
                                </span>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </>
                  )}
                </div>

                <div style={{ padding: "16px 0 0" }}>
                  <button
                    type="button"
                    onClick={handlePurchase}
                    disabled={
                      accountType === "pro"
                        ? loadingPriceId === "pro"
                        : !selectedPack || loading
                    }
                    className={cn(
                      "w-full rounded-2xl border-none py-4 text-base font-extrabold transition-all",
                      "flex items-center justify-center gap-2",
                      loading && (selectedPack || canPurchasePro)
                        ? "cursor-wait bg-[#9A88FD] text-white opacity-90"
                        : selectedPack || canPurchasePro
                          ? "shimmer-cta cursor-pointer text-white shadow-[0_8px_28px_rgba(154,136,253,0.4)]"
                          : "cursor-not-allowed bg-white/10 text-white/30"
                    )}
                  >
                    {loading ? (
                      <>
                        <svg
                          className="animate-spin"
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="white"
                            strokeWidth="2.5"
                            opacity="0.25"
                          />
                          <path
                            d="M12 2a10 10 0 0110 10"
                            stroke="white"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                          />
                        </svg>
                        Processing…
                      </>
                    ) : selectedPack ? (
                      `Buy ${selectedPack.credits} credits · AED ${selectedPack.price_aed}`
                    ) : canPurchasePro ? (
                      `Buy ${quantity} credits · AED ${quantity * (pricePerCredit ?? 18)}`
                    ) : (
                      "Choose a pack above"
                    )}
                  </button>

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "center",
                      gap: 20,
                      marginTop: 12,
                    }}
                  >
                    {["🔒 Secure", "⚡ Instant", "🇦🇪 AED"].map((t, i) => (
                      <span
                        key={i}
                        style={{
                          fontSize: 10,
                          color: "rgba(255,255,255,0.25)",
                          fontWeight: 500,
                        }}
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )
    : null;

  return (
    <>
      <style>{modalStyles}</style>
      {portal}
    </>
  );
}
