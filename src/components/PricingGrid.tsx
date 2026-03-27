"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";

interface PricingGridProps {
  currentPlan: string;
  creditsBalance: number;
  companyId: string;
  onSuccess?: () => void;
}

const plans = [
  {
    slug: "starter",
    name: "Starter",
    priceMonthly: 179,
    priceAnnual: 1788,
    priceAnnualPerMonth: 149,
    credits: 15,
    extraCredit: 28,
    users: 2,
    popular: false,
    description: "For independent agents doing a handful of inspections each month.",
  },
  {
    slug: "growth",
    name: "Growth",
    priceMonthly: 299,
    priceAnnual: 2988,
    priceAnnualPerMonth: 249,
    credits: 30,
    extraCredit: 22,
    users: 5,
    popular: true,
    description: "For active agents and small agencies managing multiple properties.",
  },
  {
    slug: "agency",
    name: "Agency",
    priceMonthly: 449,
    priceAnnual: 4488,
    priceAnnualPerMonth: 374,
    credits: 50,
    extraCredit: 16,
    users: 15,
    popular: false,
    description: "For property management firms running high inspection volumes.",
  },
] as const;

const FEATURES = [
  "AI photo analysis",
  "White-label branding",
  "Digital signatures",
  "PDF report generation",
  "Priority support",
];

function normalizePlan(plan: string): string {
  if (plan === "pro_solo") return "starter";
  if (plan === "pro_agency") return "growth";
  if (plan === "pro_max") return "agency";
  return plan;
}

export function PricingGrid({ currentPlan, creditsBalance: _creditsBalance, companyId: _companyId, onSuccess }: PricingGridProps) {
  const [billing, setBilling] = useState<"monthly" | "annual">("annual");
  const [loading, setLoading] = useState<string | null>(null);
  const activePlan = normalizePlan(currentPlan ?? "free");

  const getPrice = (plan: typeof plans[number]) =>
    billing === "annual" ? plan.priceAnnualPerMonth : plan.priceMonthly;

  const handleSelectPlan = async (slug: string) => {
    setLoading(slug);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription",
          plan_slug: slug,
          billing_period: billing,
        }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        onSuccess?.();
        window.location.href = data.url;
      }
    } catch (e) {
      console.error("Checkout error:", e);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div style={{ background: "#F8F7F4", minHeight: "100%", paddingBottom: 32 }}>

      {/* Billing toggle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "24px 20px 20px" }}>
        <div style={{
          display: "flex", gap: 4, padding: 4,
          background: "white",
          border: "0.5px solid rgba(14,14,16,0.1)",
          borderRadius: 999,
        }}>
          {(["monthly", "annual"] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setBilling(mode)}
              style={{
                padding: "9px 22px", borderRadius: 999, border: "none",
                fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13,
                cursor: "pointer", display: "flex", alignItems: "center", gap: 6,
                background: billing === mode ? "#0E0E10" : "transparent",
                color: billing === mode ? "white" : "rgba(14,14,16,0.45)",
                transition: "all .2s",
              }}
            >
              {mode === "monthly" ? "Monthly" : "Annual"}
              {mode === "annual" && (
                <span style={{
                  fontSize: 10, fontWeight: 700,
                  color: billing === "annual" ? "#CAFE87" : "#3A7A00",
                }}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plan cards */}
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 12 }}>
        {plans.map(plan => {
          const dark = plan.popular;
          const isCurrent = activePlan === plan.slug;
          const displayPrice = getPrice(plan);
          const pricePerCredit = (displayPrice / plan.credits).toFixed(1);
          const annualTotal = plan.priceAnnual;
          const savedPct = Math.round((1 - plan.priceAnnualPerMonth / plan.priceMonthly) * 100);

          return (
            <div
              key={plan.slug}
              style={{
                background: dark ? "#0E0E10" : "white",
                borderRadius: 20,
                padding: "24px 20px",
                border: dark ? "none" : isCurrent ? "1.5px solid #9A88FD" : "0.5px solid rgba(14,14,16,0.1)",
                position: "relative",
                boxShadow: dark ? "0 8px 32px rgba(14,14,16,0.2)" : "none",
              }}
            >
              {plan.popular && (
                <div style={{
                  position: "absolute", top: -12, left: "50%",
                  transform: "translateX(-50%)",
                  background: "#9A88FD", color: "white",
                  fontSize: 10, fontWeight: 700,
                  padding: "4px 14px", borderRadius: 999,
                  fontFamily: "Poppins, sans-serif",
                  whiteSpace: "nowrap",
                  boxShadow: "0 2px 12px rgba(154,136,253,0.4)",
                }}>
                  Most Popular
                </div>
              )}

              {/* Plan name */}
              <p style={{
                fontSize: 10, fontWeight: 700, textTransform: "uppercase",
                letterSpacing: "2.5px", margin: "0 0 8px",
                color: dark ? "rgba(255,255,255,0.45)" : "rgba(14,14,16,0.45)",
                fontFamily: "Poppins, sans-serif",
              }}>
                {plan.name}
              </p>

              {/* Price */}
              <div style={{ display: "flex", alignItems: "baseline", gap: 4, marginBottom: 4 }}>
                <span style={{
                  fontSize: 48, fontWeight: 800, letterSpacing: "-3px", lineHeight: 1,
                  color: dark ? "white" : "#0E0E10",
                  fontFamily: "Poppins, sans-serif",
                }}>
                  {displayPrice}
                </span>
                <span style={{
                  fontSize: 14, color: dark ? "rgba(255,255,255,0.4)" : "rgba(14,14,16,0.45)",
                  marginBottom: 4,
                }}>
                  AED/mo
                </span>
              </div>

              {/* Annual note */}
              {billing === "annual" ? (
                <p style={{ fontSize: 11, margin: "0 0 10px", color: dark ? "rgba(255,255,255,0.4)" : "rgba(14,14,16,0.45)" }}>
                  {annualTotal.toLocaleString()} AED/yr ·{" "}
                  <span style={{ color: "#3A7A00", fontWeight: 700 }}>Save {savedPct}%</span>
                </p>
              ) : (
                <p style={{ fontSize: 11, margin: "0 0 10px", color: dark ? "rgba(255,255,255,0.3)" : "rgba(14,14,16,0.35)" }}>
                  Billed monthly
                </p>
              )}

              {/* Description */}
              <p style={{
                fontSize: 12, lineHeight: 1.5, margin: "0 0 16px",
                color: dark ? "rgba(255,255,255,0.5)" : "rgba(14,14,16,0.6)",
              }}>
                {plan.description}
              </p>

              {/* Stats */}
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1px 1fr",
                background: dark ? "rgba(255,255,255,0.07)" : "#F3F1EB",
                borderRadius: 14, overflow: "hidden", marginBottom: 10,
              }}>
                <div style={{ padding: "12px 14px", textAlign: "center" }}>
                  <p style={{
                    fontSize: 26, fontWeight: 800, letterSpacing: "-1.5px",
                    lineHeight: 1, margin: 0,
                    color: dark ? "white" : "#0E0E10",
                    fontFamily: "Poppins, sans-serif",
                  }}>
                    {plan.credits}
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", margin: "3px 0 0", color: dark ? "rgba(255,255,255,0.4)" : "rgba(14,14,16,0.4)" }}>
                    CREDITS
                  </p>
                  <p style={{ fontSize: 10, fontWeight: 700, color: dark ? "#B8AEFF" : "#9A88FD", margin: "3px 0 0" }}>
                    {pricePerCredit} AED / credit
                  </p>
                </div>
                <div style={{ background: dark ? "rgba(255,255,255,0.08)" : "rgba(14,14,16,0.07)" }} />
                <div style={{ padding: "12px 14px", textAlign: "center" }}>
                  <p style={{
                    fontSize: 26, fontWeight: 800, letterSpacing: "-1.5px",
                    lineHeight: 1, margin: 0,
                    color: dark ? "white" : "#0E0E10",
                    fontFamily: "Poppins, sans-serif",
                  }}>
                    {plan.users}
                  </p>
                  <p style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.8px", margin: "3px 0 0", color: dark ? "rgba(255,255,255,0.4)" : "rgba(14,14,16,0.4)" }}>
                    USERS
                  </p>
                </div>
              </div>

              {/* Extra credit */}
              <div style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "9px 12px",
                background: dark ? "rgba(255,255,255,0.06)" : "#F3F1EB",
                borderRadius: 10, marginBottom: 16, fontSize: 12,
                color: dark ? "rgba(255,255,255,0.5)" : "rgba(14,14,16,0.6)",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
                Extra credit:{" "}
                <strong style={{ color: dark ? "white" : "#0E0E10", fontWeight: 700 }}>
                  {plan.extraCredit} AED each
                </strong>
              </div>

              {/* Features */}
              <ul style={{ listStyle: "none", padding: 0, margin: "0 0 20px", display: "flex", flexDirection: "column", gap: 7 }}>
                {FEATURES.map(feat => (
                  <li key={feat} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: dark ? "rgba(255,255,255,0.7)" : "rgba(14,14,16,0.7)" }}>
                    <span style={{ color: "#4A8A00", fontWeight: 700, fontSize: 11, flexShrink: 0 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                onClick={() => void handleSelectPlan(plan.slug)}
                disabled={!!loading || isCurrent}
                style={{
                  width: "100%", padding: "13px 0",
                  borderRadius: 12, border: "none",
                  fontFamily: "Poppins, sans-serif", fontWeight: 700, fontSize: 13,
                  cursor: isCurrent ? "default" : "pointer",
                  transition: "all .2s",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  ...(isCurrent ? {
                    background: dark ? "rgba(255,255,255,0.07)" : "rgba(14,14,16,0.04)",
                    color: dark ? "rgba(255,255,255,0.3)" : "rgba(14,14,16,0.3)",
                  } : plan.popular ? {
                    background: "#9A88FD", color: "white",
                    boxShadow: "0 4px 16px rgba(154,136,253,0.35)",
                  } : {
                    background: "transparent", color: dark ? "white" : "#0E0E10",
                    border: dark ? "1px solid rgba(255,255,255,0.2)" : "1.5px solid rgba(14,14,16,0.18)",
                  }),
                }}
              >
                {loading === plan.slug ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : isCurrent ? "Current plan" : plan.popular ? "Start Free Trial" : "Get Started"}
              </button>
            </div>
          );
        })}
      </div>

      <p style={{ textAlign: "center", fontSize: 11, color: "rgba(14,14,16,0.4)", margin: "16px 20px 0", lineHeight: 1.6 }}>
        Need more than 50 inspections/month?{" "}
        <a href="mailto:hello@snagify.net" style={{ color: "#9A88FD", fontWeight: 600, textDecoration: "none" }}>
          Contact us
        </a>
      </p>
    </div>
  );
}
