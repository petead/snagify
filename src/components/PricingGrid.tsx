"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
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
    priceMonthly: 163,
    priceAnnual: 1788,
    priceAnnualPerMonth: Math.round(1788 / 12),
    credits: 10,
    extraCredit: 18,
    users: "2",
    usersLabel: "inspectors",
    popular: false,
    color: "#9A88FD",
    priceIdMonthly: "price_1TE2MgKIsjOh5d33hZSBKdcA",
    priceIdAnnual: "price_1TE2MgKIsjOh5d332jt7VWLL",
    savings: null,
  },
  {
    slug: "growth",
    name: "Growth",
    priceMonthly: 272,
    priceAnnual: 2988,
    priceAnnualPerMonth: Math.round(2988 / 12),
    credits: 20,
    extraCredit: 15,
    users: "5",
    usersLabel: "inspectors",
    popular: true,
    color: "#7C3AED",
    priceIdMonthly: "price_1TE2MiKIsjOh5d33TNdCW9Zt",
    priceIdAnnual: "price_1TE2MiKIsjOh5d33eIFo0iZA",
    savings: 16,
  },
  {
    slug: "agency",
    name: "Agency",
    priceMonthly: 381,
    priceAnnual: 4188,
    priceAnnualPerMonth: Math.round(4188 / 12),
    credits: 30,
    extraCredit: 13,
    users: "15",
    usersLabel: "inspectors",
    popular: false,
    color: "#1E1B4B",
    priceIdMonthly: "price_1TE2MjKIsjOh5d33N0LSakoU",
    priceIdAnnual: "price_1TE2MjKIsjOh5d33qysgoe08",
    savings: 22,
  },
] as const;

function normalizePlan(plan: string): string {
  if (plan === "pro_solo") return "starter";
  if (plan === "pro_agency") return "growth";
  if (plan === "pro_max") return "agency";
  return plan;
}

export function PricingGrid({ currentPlan, creditsBalance, companyId: _companyId, onSuccess }: PricingGridProps) {
  const [selected, setSelected] = useState(1);
  const [loading, setLoading] = useState<string | null>(null);
  const [billingPeriod, setBillingPeriod] = useState<"monthly" | "annual">("annual");
  const activePlan = normalizePlan(currentPlan ?? "free");

  const getPrice = (plan: (typeof plans)[number]) =>
    billingPeriod === "annual" ? plan.priceAnnualPerMonth : plan.priceMonthly;

  const getPriceId = (plan: (typeof plans)[number]) =>
    billingPeriod === "annual" ? plan.priceIdAnnual : plan.priceIdMonthly;

  const handleSelectPlan = async (slug: string) => {
    const plan = plans.find((p) => p.slug === slug);
    if (!plan) return;
    setLoading(plan.slug);
    try {
      const res = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "subscription",
          price_id: getPriceId(plan),
          plan_slug: plan.slug,
          billing_period: billingPeriod,
        }),
      });
      const data = (await res.json()) as { url?: string };
      if (data.url) {
        onSuccess?.();
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Checkout error:", error);
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[#F8F7F4] pb-32">
      <div className="px-5 pt-5 pb-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">Current plan</p>
          <p className="text-2xl font-black text-gray-900 capitalize">{activePlan || "Free"}</p>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">Balance</p>
          <p className="text-2xl font-black text-[#9A88FD]">{creditsBalance} cr</p>
        </div>
      </div>

      <div className="mx-5 mb-5 px-4 py-3 bg-white rounded-2xl border border-gray-100">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Included in every plan</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {["White-label PDF", "AI photo analysis", "GPS & timestamp", "E-signature", "Sign tracking", "SHA-256 verified", "Key handover", "RERA compliant", "Push notifications"].map((f) => (
            <div key={f} className="flex items-center gap-1.5">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
              <span className="text-[11px] text-gray-500">{f}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Monthly / Annual toggle */}
      <div className="px-5 mb-5">
        <div className="flex items-center bg-white rounded-2xl border border-gray-100 p-1 gap-1">
          <button
            type="button"
            onClick={() => setBillingPeriod("monthly")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all"
            style={{
              background: billingPeriod === "monthly" ? "#1A1A1A" : "transparent",
              color: billingPeriod === "monthly" ? "white" : "#9CA3AF",
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBillingPeriod("annual")}
            className="flex-1 py-2.5 rounded-xl text-sm font-bold transition-all relative"
            style={{
              background: billingPeriod === "annual" ? "#9A88FD" : "transparent",
              color: billingPeriod === "annual" ? "white" : "#9CA3AF",
            }}
          >
            Annual
            {/* Savings badge */}
            <span
              style={{
                position: "absolute",
                top: -8,
                right: 8,
                background: "#22C55E",
                color: "white",
                fontSize: 9,
                fontWeight: 800,
                padding: "1px 6px",
                borderRadius: 20,
              }}
            >
              1 month free
            </span>
          </button>
        </div>
        {billingPeriod === "annual" && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 6 }}>
            Billed annually · no commitment
          </p>
        )}
        {billingPeriod === "monthly" && (
          <p style={{ fontSize: 11, color: "#9CA3AF", textAlign: "center", marginTop: 6 }}>
            Billed monthly · no commitment
          </p>
        )}
      </div>

      <div className="px-5 mb-4">
        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Choose a plan</p>
        <div className="grid grid-cols-3 gap-2">
          {plans.map((plan, i) => (
            <motion.button key={plan.slug} onClick={() => setSelected(i)} animate={{ backgroundColor: selected === i ? plan.color : "#FFFFFF", borderColor: selected === i ? plan.color : "#E5E7EB", scale: selected === i ? 1.02 : 1, boxShadow: selected === i ? `0 4px 20px ${plan.color}35` : "0 1px 4px rgba(0,0,0,0.05)" }} transition={{ duration: 0.2 }} className="relative rounded-2xl border-2 p-3 flex flex-col items-center">
              {plan.popular && <div className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-[#7C3AED] text-white text-[8px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap">Popular</div>}
              {plan.savings && (
                <motion.div
                  initial={{ scale: 0, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.05, type: "spring", stiffness: 500 }}
                  className="absolute -top-2 -right-1"
                >
                  <div className="bg-green-500 text-white text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full whitespace-nowrap shadow-sm">
                    -{plan.savings}%
                  </div>
                </motion.div>
              )}
              <motion.p animate={{ color: selected === i ? "#FFFFFF" : "#111827" }} className="text-xs font-bold mb-1">{plan.name}</motion.p>
              <motion.p animate={{ color: selected === i ? "rgba(255,255,255,0.9)" : "#111827" }} className="text-xl font-black leading-none">
                {getPrice(plan)}
              </motion.p>
              <motion.p animate={{ color: selected === i ? "rgba(255,255,255,0.5)" : "#9CA3AF" }} className="text-[9px] mt-0.5">
                AED/mo
              </motion.p>
              {billingPeriod === "annual" && (
                <p
                  style={{
                    fontSize: 8,
                    color: selected === i ? "rgba(255,255,255,0.5)" : "#9CA3AF",
                    marginTop: 1,
                  }}
                >
                  billed {plan.priceAnnual}/yr
                </p>
              )}
            </motion.button>
          ))}
        </div>
      </div>

      <div className="mx-5 bg-white rounded-2xl border border-gray-100 overflow-hidden">
        <div className="grid grid-cols-4 bg-gray-50 border-b border-gray-100">
          <div className="py-3 px-3" />
          {plans.map((plan, i) => (
            <motion.div key={plan.slug} animate={{ backgroundColor: selected === i ? `${plan.color}15` : "transparent" }} className="py-3 text-center">
              <motion.p animate={{ color: selected === i ? plan.color : "#6B7280" }} className="text-[11px] font-bold">{plan.name}</motion.p>
              {plan.savings && selected === i && (
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-[9px] font-bold text-green-600 mt-0.5"
                >
                  -{plan.savings}% vs Starter
                </motion.p>
              )}
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-4 border-b border-gray-50">
          <div className="py-4 px-3 flex items-center"><p className="text-[11px] text-gray-500 leading-tight">Monthly credits</p></div>
          {plans.map((plan, i) => (
            <motion.div key={plan.slug} animate={{ backgroundColor: selected === i ? `${plan.color}08` : "transparent" }} className="py-4 flex flex-col items-center justify-center gap-1">
              <motion.p animate={{ color: selected === i ? plan.color : "#111827" }} className="text-base font-black">{plan.credits}</motion.p>
              <div className="w-8 h-1 bg-gray-100 rounded-full overflow-hidden"><motion.div initial={{ width: 0 }} animate={{ width: `${(plan.credits / 30) * 100}%` }} transition={{ delay: 0.2 + i * 0.05, duration: 0.6 }} className="h-full rounded-full" style={{ backgroundColor: plan.color }} /></div>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-4 border-b border-gray-50">
          <div className="py-4 px-3 flex items-center"><p className="text-[11px] text-gray-500 leading-tight">Included price/cr</p></div>
          {plans.map((plan, i) => (
            <motion.div key={plan.slug} animate={{ backgroundColor: selected === i ? `${plan.color}08` : "transparent" }} className="py-4 flex items-center justify-center">
              <motion.p animate={{ color: selected === i ? plan.color : "#111827" }} className="text-[12px] font-bold">
                {(getPrice(plan) / plan.credits).toFixed(2)}
              </motion.p>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-4 border-b border-gray-50">
          <div className="py-4 px-3 flex items-center"><p className="text-[11px] text-gray-500 leading-tight">Extra credit</p></div>
          {plans.map((plan, i) => (
            <motion.div key={plan.slug} animate={{ backgroundColor: selected === i ? `${plan.color}08` : "transparent" }} className="py-4 flex flex-col items-center justify-center">
              <motion.p animate={{ color: selected === i ? plan.color : "#111827" }} className="text-[12px] font-bold">{plan.extraCredit}</motion.p>
              <p className="text-[9px] text-gray-400">AED/cr</p>
            </motion.div>
          ))}
        </div>
        <div className="grid grid-cols-4">
          <div className="py-4 px-3 flex items-center"><p className="text-[11px] text-gray-500 leading-tight">Team size</p></div>
          {plans.map((plan, i) => (
            <motion.div key={plan.slug} animate={{ backgroundColor: selected === i ? `${plan.color}08` : "transparent" }} className="py-4 flex flex-col items-center justify-center">
              <motion.p animate={{ color: selected === i ? plan.color : "#111827" }} className="text-base font-black">{plan.users}</motion.p>
              <p className="text-[9px] text-gray-400">{plan.usersLabel}</p>
            </motion.div>
          ))}
        </div>
      </div>

      <AnimatePresence>
        {selected > 0 && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }} className="mx-5 mt-3 px-4 py-3 rounded-xl bg-green-50 border border-green-100 flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
            {selected === 1 && (
              <p className="text-xs text-green-700 font-medium">
                Save 16% per credit vs Starter
              </p>
            )}
            {selected === 2 && (
              <p className="text-xs text-green-700 font-medium">
                Save 22% per credit vs Starter — best value
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="fixed bottom-0 left-0 right-0 bg-[#F8F7F4]/95 backdrop-blur-sm px-5 pb-8 pt-4 border-t border-gray-100">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={() => void handleSelectPlan(plans[selected].slug)} disabled={loading === plans[selected].slug || activePlan === plans[selected].slug} className="w-full py-4 rounded-2xl font-bold text-base text-white disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2" style={{ backgroundColor: plans[selected].color }} animate={{ backgroundColor: plans[selected].color }} transition={{ duration: 0.2 }}>
          {loading === plans[selected].slug ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Processing...
            </>
          ) : activePlan === plans[selected].slug ? (
            "✓ Current plan"
          ) : billingPeriod === "annual" ? (
            `Get ${plans[selected].name} — AED ${plans[selected].priceAnnual}/yr`
          ) : (
            `Get ${plans[selected].name} — AED ${plans[selected].priceMonthly}/mo`
          )}
        </motion.button>
      </div>
    </div>
  );
}
