"use client";

import React from "react";

interface BuyCreditsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentBalance: number;
  accountType: "individual" | "pro";
  plan: string;
  onPurchaseSuccess?: () => void;
}

type Pack = {
  name: string;
  credits: number;
  price: number;
};

const individualPacks: Pack[] = [
  { name: "Decouverte", credits: 2, price: 49 },
  { name: "Essentiel", credits: 6, price: 119 },
  { name: "Serenite", credits: 10, price: 179 },
];

const proTopups: Pack[] = [
  { name: "Top-up 10", credits: 10, price: 165 },
  { name: "Top-up 30", credits: 30, price: 450 },
];

const WHATSAPP_NUMBER = "971000000000";

function openWhatsapp(packName: string, price: number) {
  if (typeof window === "undefined") return;
  const msg = encodeURIComponent(
    `Hello, I would like to purchase the ${packName} pack (${price} AED) for Snagify.`
  );
  window.open(`https://wa.me/${WHATSAPP_NUMBER}?text=${msg}`, "_blank");
}

function PackCard({
  pack,
  highlighted,
}: {
  pack: Pack;
  highlighted?: boolean;
}) {
  return (
    <div
      style={{
        background: highlighted ? "#FAFAFF" : "#fff",
        border: highlighted ? "2px solid #9A88FD" : "1px solid #EEECFF",
        borderRadius: 12,
        padding: 14,
        position: "relative",
      }}
    >
      {highlighted && (
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
      )}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
        <div>
          <p
            style={{
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: 15,
              color: "#1A1A2E",
            }}
          >
            {pack.name}
          </p>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#6B7280" }}>
            {pack.credits} credits
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              margin: 0,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 800,
              fontSize: 18,
              color: "#9A88FD",
            }}
          >
            {pack.price} AED
          </p>
          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#9CA3AF" }}>
            {(pack.price / pack.credits).toFixed(1)} AED/credit
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => openWhatsapp(pack.name, pack.price)}
        style={{
          width: "100%",
          marginTop: 12,
          border: "none",
          borderRadius: 10,
          background: "#9A88FD",
          color: "#fff",
          fontWeight: 700,
          padding: "10px 12px",
          cursor: "pointer",
        }}
      >
        Buy - {pack.price} AED
      </button>
    </div>
  );
}

export function BuyCreditsModal({
  isOpen,
  onClose,
  currentBalance,
  accountType,
  plan,
  onPurchaseSuccess: _onPurchaseSuccess,
}: BuyCreditsModalProps) {
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

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {accountType === "individual" &&
            individualPacks.map((pack, idx) => (
              <PackCard key={pack.name} pack={pack} highlighted={idx === 0} />
            ))}

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
                  Get 20 credits/month + white-label reports
                </p>
                <p style={{ margin: "8px 0 0", fontWeight: 700, fontSize: 15 }}>
                  399 AED/month
                </p>
                <a
                  href="/settings/billing"
                  style={{
                    display: "inline-block",
                    marginTop: 10,
                    background: "#fff",
                    color: "#6D28D9",
                    borderRadius: 10,
                    padding: "8px 12px",
                    fontSize: 13,
                    fontWeight: 700,
                    textDecoration: "none",
                  }}
                >
                  See plans →
                </a>
              </div>
              <p style={{ margin: "2px 0", fontSize: 12, textAlign: "center", color: "#9CA3AF" }}>
                or buy a one-time top-up
              </p>
              {proTopups.map((pack) => (
                <PackCard key={pack.name} pack={pack} />
              ))}
            </>
          )}

          {isProPaid && (
            <>
              <p style={{ margin: 0, fontSize: 13, color: "#6B7280", fontWeight: 700 }}>
                Buy extra credits
              </p>
              {proTopups.map((pack) => (
                <PackCard key={pack.name} pack={pack} />
              ))}
            </>
          )}
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
          Payment integration coming soon. For now, contact us to add credits manually.
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 11, color: "#9CA3AF", textAlign: "center" }}>
          Credits never expire · Secure payment via Stripe
        </p>
      </div>
    </div>
  );
}
