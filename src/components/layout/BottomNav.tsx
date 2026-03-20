"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Home, Building2, Plus, FileText, User } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { ProGateSheet } from "@/components/ProGateSheet";
import type { ProAccessState } from "@/lib/checkProAccess";

type ProfileLite = {
  account_type: "individual" | "pro";
  company_id: string | null;
};

export default function BottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  const [profile, setProfile] = useState<ProfileLite | null>(null);
  const [showGate, setShowGate] = useState(false);
  const [gateState, setGateState] = useState<ProAccessState>("ok");
  const [gateBalance, setGateBalance] = useState(0);
  const [gatePlan, setGatePlan] = useState("free");
  const [pendingFn, setPendingFn] = useState<(() => void) | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user || cancelled) return;
      const { data } = await supabase
        .from("profiles")
        .select("account_type, company_id")
        .eq("id", user.id)
        .single();
      if (cancelled || !data) return;
      setProfile({
        account_type: data.account_type === "pro" ? "pro" : "individual",
        company_id: data.company_id ?? null,
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [supabase]);

  const handleCheckinTap = async (originalProceedFn: () => void) => {
    if (!profile) {
      if (process.env.NODE_ENV === "development") {
        console.warn("ProGate: profile not loaded");
      }
      originalProceedFn();
      return;
    }
    if (profile.account_type !== "pro") {
      originalProceedFn();
      return;
    }
    if (!profile.company_id) {
      setGateState("no_subscription");
      setGateBalance(0);
      setGatePlan("free");
      setPendingFn(() => originalProceedFn);
      setShowGate(true);
      return;
    }

    const { data: company } = await supabase
      .from("companies")
      .select("plan, credits_balance, stripe_subscription_id")
      .eq("id", profile.company_id)
      .single();

    const balance = company?.credits_balance ?? 0;
    const hasActivePlan = !!(
      company?.plan &&
      company.plan !== "free" &&
      company.stripe_subscription_id
    );

    let state: ProAccessState;
    if (!hasActivePlan) {
      state = "no_subscription";
    } else if (balance < 1) {
      state = "no_credits";
    } else {
      state = "ok";
    }

    setGateState(state);
    setGateBalance(balance);
    setGatePlan(company?.plan ?? "free");
    setPendingFn(() => originalProceedFn);
    setShowGate(true);
  };

  const tabs = [
    { icon: Home, label: "Home", path: "/dashboard" },
    { icon: Building2, label: "Properties", path: "/properties" },
    { icon: Plus, label: null, path: "/inspection/new" }, // center button
    { icon: FileText, label: "Reports", path: "/reports" },
    { icon: User, label: "Profile", path: "/profile" },
  ];

  return (
    <nav
      id="bottom-nav"
      className="fixed bottom-0 left-0 right-0 z-50 w-full bg-white border-t border-gray-100"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="flex items-center justify-around h-16 max-w-lg mx-auto px-2">
        {tabs.map((tab, index) => {
          const isCenter = index === 2;
          const isActive =
            pathname === tab.path ||
            (tab.path !== "/dashboard" && pathname.startsWith(tab.path));

          if (isCenter) {
            return (
              <button
                key="new"
                type="button"
                onClick={() =>
                  void handleCheckinTap(() => router.push("/inspection/new"))
                }
                className="flex items-center justify-center w-14 h-14 rounded-2xl shadow-lg -mt-5 transition-transform active:scale-95"
                style={{
                  background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
                }}
              >
                <Plus size={26} color="white" strokeWidth={2.5} />
              </button>
            );
          }

          return (
            <button
              key={tab.path}
              type="button"
              onClick={() => router.push(tab.path)}
              className="flex flex-col items-center justify-center gap-1 flex-1 h-full transition-all active:scale-95"
            >
              <tab.icon
                size={22}
                color={isActive ? "#9A88FD" : "#9CA3AF"}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className="text-xs font-medium"
                style={{ color: isActive ? "#9A88FD" : "#9CA3AF" }}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>

      {showGate && (
        <ProGateSheet
          state={gateState}
          balance={gateBalance}
          plan={gatePlan}
          cost={1}
          actionLabel="Start Check-in"
          onConfirm={() => {
            setShowGate(false);
            if (gateState === "ok") pendingFn?.();
          }}
          onClose={() => {
            setShowGate(false);
            setPendingFn(null);
          }}
        />
      )}
    </nav>
  );
}
