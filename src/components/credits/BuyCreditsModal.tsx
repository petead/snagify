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

type SubscriptionPlan = {
  id: string;
  slug: string;
  name: string;
  price_aed_monthly: number;
  credits_per_month: number;
  stripe_price_id: string | null;
  white_label?: boolean;
  max_users?: number;
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
  plan,
  onPurchaseSuccess,
}: BuyCreditsModalProps) {
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);
  const [packs, setPacks] = useState<Pack[]>([]);
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [loadingCatalog, setLoadingCatalog] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchPacks = async () => {
      setLoadingCatalog(true);
      try {
        const res = await fetch(`/api/credits/packs?target=${accountType}`);
        const data = (await res.json()) as {
          packs?: Pack[];
          plans?: SubscriptionPlan[];
        };
        setPacks(data.packs ?? []);
        setPlans(data.plans ?? []);
      } catch {
        setPacks([]);
        setPlans([]);
      } finally {
        setLoadingCatalog(false);
      }
    };
    void fetchPacks();
  }, [accountType, isOpen]);

  const firstCoveringPackId = useMemo(() => {
    const first = packs.find((p) => Number(p.credits ?? 0) >= 2);
    return first?.id ?? null;
  }, [packs]);

  const proPlans = useMemo(
    () => plans.filter((p) => ["pro_solo", "pro_agency", "pro_max"].includes(p.slug)),
    [plans]
  );

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

  async function handleSubscribe(priceId: string, planSlug: string) {
    setLoadingPriceId(priceId);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription",
          price_id: priceId,
          plan_slug: planSlug,
        }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to create subscription session");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Subscription failed");
    } finally {
      setLoadingPriceId(null);
    }
  }

  if (!isOpen) return null;

  const isProFree = accountType === "pro" && (plan === "free" || !plan);
  const isProPaid = accountType === "pro" && !isProFree;

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
            Not enough credits
          </h3>
          <p style={{ margin: "8px 0 0", fontSize: 13, color: "#6B7280", lineHeight: 1.5 }}>
            You need 2 credits to start a check-out.
            <br />
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
          Buy credits
        </p>

        {loadingCatalog ? (
          <p style={{ margin: "6px 0", fontSize: 12, color: "#6B7280" }}>Loading offers...</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {accountType === "individual" &&
              packs.map((pack) => {
                const highlighted = pack.id === firstCoveringPackId;
                const pricePerCredit = Number(pack.price_aed) / Math.max(Number(pack.credits), 1);
                const disabled = !pack.stripe_price_id || loadingPriceId === pack.stripe_price_id;
                return (
                  <div
                    key={pack.id}
                    style={{
                      background: highlighted ? "#FAFAFF" : "#fff",
                      border: highlighted ? "2px solid #9A88FD" : "1px solid #EEECFF",
                      borderRadius: 12,
                      padding: 14,
                      position: "relative",
                    }}
                  >
                    {highlighted && <CoversBadge />}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 15, color: "#1A1A2E" }}>
                          {pack.name}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                          {pack.credits} credits
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 18, color: "#9A88FD" }}>
                          {pack.price_aed} AED
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                          {pricePerCredit.toFixed(1)} AED/credit
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pack.stripe_price_id && void handleBuy(pack.stripe_price_id, pack.id)}
                      disabled={disabled}
                      style={{
                        width: "100%",
                        marginTop: 12,
                        border: "none",
                        borderRadius: 10,
                        background: "#9A88FD",
                        color: "#fff",
                        fontWeight: 700,
                        padding: "10px 12px",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.7 : 1,
                      }}
                    >
                      {loadingPriceId === pack.stripe_price_id
                        ? "Loading..."
                        : `Buy - ${pack.price_aed} AED`}
                    </button>
                  </div>
                );
              })}

            {isProFree && (
              <>
                <div
                  style={{
                    borderRadius: 14,
                    padding: 14,
                    background: "linear-gradient(135deg, #9A88FD 0%, #7B65FC 100%)",
                    color: "#fff",
                  }}
                >
                  <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 800 }}>
                    Switch to a Pro plan
                  </p>
                  <p style={{ margin: "6px 0 0", fontSize: 13, opacity: 0.95 }}>
                    Get monthly credits + white-label reports
                  </p>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    {proPlans.map((p) => {
                      const disabled = !p.stripe_price_id || loadingPriceId === p.stripe_price_id;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => p.stripe_price_id && void handleSubscribe(p.stripe_price_id, p.slug)}
                          disabled={disabled}
                          style={{
                            border: "none",
                            borderRadius: 10,
                            background: "#fff",
                            color: "#6D28D9",
                            padding: "9px 12px",
                            fontSize: 13,
                            fontWeight: 700,
                            textAlign: "left",
                            cursor: disabled ? "not-allowed" : "pointer",
                            opacity: disabled ? 0.7 : 1,
                          }}
                        >
                          {loadingPriceId === p.stripe_price_id
                            ? "Loading..."
                            : `Subscribe - ${p.name} (${p.price_aed_monthly} AED/month)`}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <p style={{ margin: "2px 0", fontSize: 12, textAlign: "center", color: "#9CA3AF" }}>
                  or buy a one-time top-up
                </p>
              </>
            )}

            {(isProFree || isProPaid) &&
              packs.map((pack) => {
                const pricePerCredit = Number(pack.price_aed) / Math.max(Number(pack.credits), 1);
                const disabled = !pack.stripe_price_id || loadingPriceId === pack.stripe_price_id;
                return (
                  <div
                    key={pack.id}
                    style={{
                      background: "#fff",
                      border: "1px solid #EEECFF",
                      borderRadius: 12,
                      padding: 14,
                      position: "relative",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                      <div>
                        <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 15, color: "#1A1A2E" }}>
                          {pack.name}
                        </p>
                        <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
                          {pack.credits} credits
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ margin: 0, fontFamily: "'Poppins', sans-serif", fontWeight: 800, fontSize: 18, color: "#9A88FD" }}>
                          {pack.price_aed} AED
                        </p>
                        <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
                          {pricePerCredit.toFixed(1)} AED/credit
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => pack.stripe_price_id && void handleBuy(pack.stripe_price_id, pack.id)}
                      disabled={disabled}
                      style={{
                        width: "100%",
                        marginTop: 12,
                        border: "none",
                        borderRadius: 10,
                        background: "#9A88FD",
                        color: "#fff",
                        fontWeight: 700,
                        padding: "10px 12px",
                        cursor: disabled ? "not-allowed" : "pointer",
                        opacity: disabled ? 0.7 : 1,
                      }}
                    >
                      {loadingPriceId === pack.stripe_price_id
                        ? "Loading..."
                        : `Buy - ${pack.price_aed} AED`}
                    </button>
                  </div>
                );
              })}
          </div>
        )}

        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
          Credits never expire · Secure payment via Stripe
        </p>
      </div>
    </div>
  );
}
