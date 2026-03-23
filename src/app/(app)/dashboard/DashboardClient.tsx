"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";
import { PenLine, AlertTriangle } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal";
import { OnboardingTutorial } from "@/components/onboarding/OnboardingTutorial";
import { trackAction } from "@/lib/breadcrumb";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefresh";
import { regenerateAndDownloadInspectionPdf } from "@/lib/regenerateAndDownloadInspectionPdf";
import { createClient } from "@/lib/supabase/client";
import { planSlugForBuyCredits, pricePerCreditForBuy } from "@/lib/buyCreditsPlan";
import { InspectionStatusBadge } from "@/components/inspection/InspectionStatusBadge";

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type TenancyRow = {
  id: string;
  tenant_name: string | null;
  contract_from: string | null;
  contract_to: string | null;
  actual_end_date?: string | null;
};

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  location: string | null;
  property_type: string | null;
  created_at: string | null;
  tenancies?: TenancyRow[] | null;
  inspections?: InspectionRow[] | null;
};

export type AlertItem = {
  type: string;
  color: string;
  icon: "alert" | "signature";
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
};

type RecentInspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  properties?: unknown;
  tenancies?: unknown;
  signatures?: { signer_type: string; otp_verified: boolean; signed_at?: string | null }[];
  rooms?: { id: string; photos?: { id: string }[] }[];
};

interface DashboardClientProps {
  userId: string | null;
  displayName: string;
  fullName: string | null;
  userEmail: string | null;
  accountType: "pro" | "individual";
  tourCompleted: boolean;
  profileLoading?: boolean;
  showProUpgradeBanner?: boolean;
  properties: PropertyRow[];
  alerts?: AlertItem[];
  recentInspections?: RecentInspectionRow[];
}

function first<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

function getInitials(fullName: string | null, email: string | null): string {
  if (fullName?.trim()) {
    const parts = fullName.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0].slice(0, 2).toUpperCase();
  }
  if (email) return email.split("@")[0].slice(0, 2).toUpperCase();
  return "?";
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function formatCardDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

/** Same rules as ReportsClient `isSigned` — DB uses `completed` (not "pending") for awaiting signatures */
function inspectionFullySigned(insp: RecentInspectionRow): boolean {
  if (insp.status === "signed") return true;
  const sigs = insp.signatures ?? [];
  const landlordSig = sigs.find((s) => s.signer_type === "landlord");
  const tenantSig = sigs.find((s) => s.signer_type === "tenant");
  return !!landlordSig?.signed_at && !!tenantSig?.signed_at;
}

function normalizeProperties(rows: PropertyRow[]): PropertyRow[] {
  return (rows ?? []).map((p) => ({
    ...p,
    inspections: Array.isArray(p.inspections) ? p.inspections : [],
  }));
}

export function DashboardClient({
  userId,
  displayName,
  fullName,
  userEmail,
  accountType: profileAccountType,
  tourCompleted,
  profileLoading = false,
  showProUpgradeBanner = false,
  properties: initialProperties,
  alerts = [],
  recentInspections: initialRecentInspections = [],
}: DashboardClientProps) {
  const supabase = createClient();
  const { balance, plan, accountType, refresh: refreshCredits } = useCredits();
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [properties, setProperties] = useState(() => normalizeProperties(initialProperties));
  const [recentInspections, setRecentInspections] = useState(initialRecentInspections);
  const recentRollbackRef = useRef<RecentInspectionRow[]>([]);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

  const handleDownloadPDF = useCallback(async (insp: RecentInspectionRow) => {
    if (pdfLoadingId) return;
    setPdfLoadingId(insp.id);
    try {
      await regenerateAndDownloadInspectionPdf(insp.id);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      console.error("[DownloadPDF]", msg);
      alert(msg);
    } finally {
      setPdfLoadingId(null);
    }
  }, [pdfLoadingId]);

  useEffect(() => {
    setLoaded(true);
    trackAction("Viewed Dashboard");
  }, []);
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("credits") === "success" || params.get("payment") === "success") {
      alert("Credits added to your account!");
      void refreshCredits();
      window.history.replaceState({}, "", "/dashboard");
    } else if (params.get("payment") === "cancelled") {
      alert("Payment cancelled.");
      window.history.replaceState({}, "", "/dashboard");
    }
  }, [refreshCredits]);
  useEffect(() => {
    setRecentInspections(initialRecentInspections);
  }, [initialRecentInspections]);

  useEffect(() => {
    setProperties(normalizeProperties(initialProperties));
  }, [initialProperties]);

  const handleRefresh = useCallback(async () => {
    await refreshCredits();
    router.refresh();
  }, [refreshCredits, router]);

  const { pullDistance, isRefreshing, isTriggered, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const allInspections = properties?.flatMap((p) => p.inspections ?? []) ?? [];
  const totalProperties = properties.length;
  const totalInspections = allInspections.length;
  const pendingSigCount = allInspections.filter((i) => i?.status === "completed").length;

  const initials = getInitials(fullName, userEmail);

  useEffect(() => {
    const shouldShowTour = Boolean(userId && !tourCompleted);
    if (shouldShowTour) {
      const t = setTimeout(() => setShowOnboarding(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId, tourCompleted]);

  const completeTour = async () => {
    setShowOnboarding(false);
    if (!userId) return;
    await supabase.from("profiles").update({ tour_completed: true }).eq("id", userId);
  };

  return (
    <div
      ref={containerRef}
      data-pull-scroll
      className="scroll-hide"
      style={{
        maxWidth: 480,
        margin: "0 auto",
        height: "calc(100dvh - 4rem)",
        maxHeight: "calc(100dvh - 4rem)",
        overflowY: "auto",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        paddingBottom: 24,
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          height: pullDistance,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: 10,
        }}
      >
        <PullToRefreshIndicator
          pullDistance={pullDistance}
          isRefreshing={isRefreshing}
          isTriggered={isTriggered}
        />
      </div>

      <div
        style={{
          transform: `translateY(${pullDistance}px)`,
          transition: isRefreshing ? "transform 0.25s ease" : "none",
        }}
      >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');

        .dash-card {
          cursor: pointer;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .dash-card:active {
          transform: scale(0.98);
          opacity: 0.92;
        }
        .dash-card-deleting {
          opacity: 0;
          transform: translateX(-100%) scale(0.9);
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .cta-btn {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          cursor: pointer;
        }
        .cta-btn:active {
          transform: scale(0.97);
        }

        .trash-btn {
          transition: all 0.2s ease;
          cursor: pointer;
        }
        .trash-btn:hover {
          background: rgba(239,68,68,0.12) !important;
        }
        .trash-btn:active {
          transform: scale(0.9);
        }

        .scroll-hide::-webkit-scrollbar { display: none; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }

        .nav-item {
          transition: all 0.2s ease;
          cursor: pointer;
        }

        .stat-card {
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .stat-card:active {
          transform: scale(0.96);
        }
      `}</style>

      {/* Header */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "18px 24px 0", animationDelay: "0s" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Image
              src="/icon-512x512.png"
              alt="Snagify"
              width={32}
              height={32}
              style={{ width: 32, height: 32, borderRadius: 10, objectFit: "contain" }}
              priority
            />
            <span
              style={{
                fontSize: 16,
                fontWeight: 700,
                color: "#1A1A1A",
                letterSpacing: -0.3,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Snagify
            </span>
          </div>
          <Link
            href="/profile"
            style={{
              width: 42,
              height: 42,
              borderRadius: "50%",
              background: "#9A88FD",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              letterSpacing: 0.5,
              textDecoration: "none",
            }}
          >
            {initials}
          </Link>
        </div>
      </div>

      {/* Greeting + CTA */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "24px 24px 0", animationDelay: "0.06s" }}
      >
        <p
          style={{
            fontSize: 13,
            color: "#BBB",
            margin: 0,
            fontWeight: 500,
            letterSpacing: 1.2,
            textTransform: "uppercase",
          }}
        >
          {getGreeting()}
        </p>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            marginTop: 4,
          }}
        >
          <h1
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 30,
              fontWeight: 800,
              margin: 0,
              color: "#1A1A1A",
              letterSpacing: -0.5,
            }}
          >
            {profileLoading ? (
              <span style={{ color: "#9B9BA8", fontWeight: 600 }}>Loading...</span>
            ) : (
              displayName || "there"
            )}
          </h1>
          <Link
            href="/inspection/new"
            className="cta-btn"
            style={{
              background: "#9A88FD",
              color: "#fff",
              padding: "10px 20px",
              borderRadius: 13,
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 2,
              boxShadow: "0 4px 16px rgba(154,136,253,0.3)",
              textDecoration: "none",
            }}
          >
            <svg
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fff"
              strokeWidth="2.5"
              strokeLinecap="round"
            >
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            New Check-in
          </Link>
        </div>
        <p style={{ fontSize: 13, color: "#BBB", margin: "2px 0 0", fontWeight: 400 }}>
          Dubai Property Inspections
        </p>
      </div>

      {/* Pro upgrade banner */}
      {showProUpgradeBanner && (
        <div
          className="mx-6 mt-4 rounded-xl flex items-start gap-3 p-4"
          style={{
            background: "#EDE9FF",
            borderLeft: "3px solid #9A88FD",
          }}
        >
          <span className="text-lg flex-shrink-0" aria-hidden>
            ✨
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-body text-sm text-[#1A1A2E] leading-relaxed">
              You&apos;re on the free plan. Upgrade to start generating check-out reports and unlock your white-label branding.
            </p>
            <button
              type="button"
              onClick={() => router.push("/profile?section=subscription")}
              className="inline-block mt-3 font-semibold text-sm text-[#9A88FD] hover:text-[#7B65FC] hover:underline"
              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >
              View plans →
            </button>
          </div>
        </div>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div
          className={loaded ? "fade-up" : ""}
          style={{ padding: "16px 24px 0", animationDelay: "0.1s" }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginBottom: 10,
            }}
          >
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: "#ef4444",
                animation: "pulse 1.5s ease-in-out infinite",
              }}
            />
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: 1.5,
                textTransform: "uppercase",
                color: "#999",
              }}
            >
              Action Required
            </span>
            <span
              style={{
                marginLeft: "auto",
                background: "#ef4444",
                color: "#fff",
                fontSize: 11,
                fontWeight: 700,
                width: 20,
                height: 20,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {alerts.length}
            </span>
          </div>
          {alerts.map((alert, i) => (
            <div
              key={`${alert.type}-${i}`}
              role="button"
              tabIndex={0}
              onClick={() => router.push(alert.href)}
              onKeyDown={(e) => e.key === "Enter" && router.push(alert.href)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: 14,
                borderRadius: 16,
                marginBottom: 8,
                background: "#fff",
                borderLeft: `4px solid ${alert.color === "#FEDE80" ? "#F59E0B" : "#9A88FD"}`,
                boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                cursor: "pointer",
              }}
            >
              <span style={{ flexShrink: 0 }}>
                {alert.icon === "alert" ? (
                  <AlertTriangle size={18} color="#F59E0B" />
                ) : (
                  <PenLine size={18} color="#9A88FD" />
                )}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    fontSize: 13,
                    fontWeight: 600,
                    color: "#1A1A1A",
                    margin: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alert.title}
                </p>
                <p
                  style={{
                    fontSize: 12,
                    color: "#999",
                    margin: "2px 0 0",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {alert.subtitle}
                </p>
              </div>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#9A88FD",
                  flexShrink: 0,
                }}
              >
                {alert.actionLabel}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Stat Cards — 2×2 Grid */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{
          padding: alerts.length > 0 ? "16px 24px 0" : "20px 24px 0",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: 12,
          animationDelay: "0.14s",
        }}
      >
        {/* Properties — top-left */}
        <Link
          href="/properties"
          className="bg-white rounded-2xl p-4 flex flex-col justify-between h-full"
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 130,
            border: "1px solid #F3F4F6",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#EDE9FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A2E", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
              {totalProperties}
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0", fontWeight: 500 }}>
              Properties
            </p>
          </div>
        </Link>

        {/* Credits — top-right */}
        <div
          role="button"
          tabIndex={0}
          className="stat-card relative"
          onClick={() => accountType === "individual" && setShowBuyCredits(true)}
          onKeyDown={(e) => e.key === "Enter" && accountType === "individual" && setShowBuyCredits(true)}
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 130,
            border: "1px solid #F3F4F6",
            cursor: accountType === "individual" ? "pointer" : "default",
          }}
        >
          <div className="absolute top-3 right-3 z-10">
            <a
              href="/credits"
              className="text-xs font-semibold text-[#9A88FD] active:opacity-70 transition-opacity"
              onClick={(e) => {
                // Conserve le comportement historique: uniquement `individual` ouvre le modal.
                if (accountType !== "individual") {
                  e.preventDefault();
                  e.stopPropagation();
                  return;
                }
                e.preventDefault();
                e.stopPropagation();
                setShowBuyCredits(true);
              }}
            >
              Buy credits →
            </a>
          </div>

          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#EDE9FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="1" x2="12" y2="23" />
              <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A2E", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
              {balance}
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0", fontWeight: 500 }}>
              Credits
            </p>
          </div>
        </div>

        {/* Inspections — bottom-left */}
        <Link
          href="/reports"
          className="stat-card"
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 130,
            border: "1px solid #F3F4F6",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#EDE9FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A2E", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
              {totalInspections}
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0", fontWeight: 500 }}>
              Inspections
            </p>
          </div>
        </Link>

        {/* Pending Sign. — bottom-right */}
        <Link
          href="/reports"
          className="stat-card"
          style={{
            background: "#fff",
            borderRadius: 18,
            padding: 16,
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            textDecoration: "none",
            color: "inherit",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            minHeight: 130,
            border: "1px solid #F3F4F6",
          }}
        >
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: "#EDE9FF",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
              <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
            </svg>
          </div>
          <div>
            <p style={{ fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A2E", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
              {pendingSigCount}
            </p>
            <p style={{ fontSize: 13, color: "#6B7280", margin: "4px 0 0", fontWeight: 500 }}>
              Pending Sign.
            </p>
          </div>
        </Link>
      </div>

      {/* Recent Inspections */}
      <div style={{ paddingBottom: 24 }}>
        <div
          className={loaded ? "fade-up" : ""}
          style={{ padding: "24px 24px 0", animationDelay: "0.22s" }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 14,
            }}
          >
            <h2
              style={{
                fontSize: 13,
                color: "#BBB",
                margin: 0,
                fontWeight: 500,
                letterSpacing: 2,
                textTransform: "uppercase",
              }}
            >
              Recent Inspections
            </h2>
            <Link
              href="/reports"
              style={{
                fontSize: 12,
                color: "#9A88FD",
                fontWeight: 600,
                textDecoration: "none",
              }}
            >
              View all →
            </Link>
          </div>

          {recentInspections.map((insp) => {
            const prop = first(insp.properties) as {
              building_name?: string | null;
              unit_number?: string | null;
            } | null;
            const ten = first(insp.tenancies) as { tenant_name?: string | null } | null;
            const propertyName = prop?.building_name ?? prop?.unit_number ?? "Property";
            const unit = prop?.unit_number ? `Unit ${prop.unit_number}` : "";
            const tenant = ten?.tenant_name?.split(" ")[0] ?? "—";
            const typeLabel = insp.type === "check-in" ? "Check-in" : "Check-out";
            const isDraft = insp.status === "in_progress";
            const isSigned = inspectionFullySigned(insp);
            const dateStr = insp.completed_at ?? insp.created_at;
            const rooms = insp.rooms ?? [];
            const roomCount = rooms.length;
            const photoCount = rooms.reduce((n, r) => n + (r.photos?.length ?? 0), 0);

            return (
              <div
                key={insp.id}
                role="button"
                tabIndex={0}
                className={deletingId === insp.id ? "dash-card-deleting" : "dash-card"}
                onClick={() => {
                  if (insp.status === "in_progress") {
                    router.push(`/inspection/${insp.id}`);
                  } else {
                    router.push(`/inspection/${insp.id}/report`);
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    if (insp.status === "in_progress") {
                      router.push(`/inspection/${insp.id}`);
                    } else {
                      router.push(`/inspection/${insp.id}/report`);
                    }
                  }
                }}
                style={{
                  background: "#fff",
                  borderRadius: 20,
                  padding: 18,
                  marginBottom: 12,
                  boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 48,
                      height: 48,
                      borderRadius: 14,
                      background: "rgba(154,136,253,0.1)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {insp.type === "check-in" ? (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9A88FD"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" />
                        <polyline points="10 17 15 12 10 7" />
                        <line x1="15" y1="12" x2="3" y2="12" />
                      </svg>
                    ) : (
                      <svg
                        width="20"
                        height="20"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9A88FD"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                      </svg>
                    )}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <h3
                        style={{
                          fontSize: 15,
                          fontWeight: 600,
                          color: "#1A1A1A",
                          margin: 0,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {propertyName}
                      </h3>
                      {isDraft ? (
                        <span className="flex-shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                          Draft
                        </span>
                      ) : (
                        <InspectionStatusBadge status={insp.status} fullySigned={isSigned} />
                      )}
                    </div>
                    <p
                      style={{
                        fontSize: 12,
                        color: "#999",
                        margin: "4px 0 0",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {[unit, tenant, typeLabel, formatCardDate(dateStr)].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 14,
                    display: "flex",
                    gap: 8,
                    alignItems: "center",
                  }}
                >
                  <div
                    style={{
                      flex: 1,
                      background: "#F8F7F4",
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontSize: 11, color: "#BBB", fontWeight: 500 }}>Rooms</span>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A" }}>
                      {roomCount}
                    </span>
                  </div>
                  <div
                    style={{
                      flex: 1,
                      background: "#F8F7F4",
                      borderRadius: 12,
                      padding: "10px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#BBB"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span style={{ fontSize: 16, fontWeight: 700, color: "#9A88FD" }}>
                      {photoCount}
                    </span>
                  </div>
                  {isDraft ? (
                    <button
                      type="button"
                      className="cta-btn flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/inspection/${insp.id}`);
                      }}
                    >
                      <svg
                        width="13"
                        height="13"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                        aria-hidden
                      >
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                      </svg>
                      Draft
                    </button>
                  ) : isSigned ? (
                    <button
                      type="button"
                      className="cta-btn flex shrink-0 items-center gap-1.5 rounded-2xl bg-gray-900 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
                      disabled={pdfLoadingId === insp.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDownloadPDF(insp);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      {pdfLoadingId === insp.id ? "…" : "PDF"}
                    </button>
                  ) : insp.status === "completed" && !isSigned ? (
                    <button
                      type="button"
                      className="cta-btn flex shrink-0 items-center gap-1.5 rounded-2xl bg-[#9A88FD] px-4 py-2 text-sm font-semibold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/inspection/${insp.id}/report`);
                      }}
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden
                      >
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                      </svg>
                      Sign
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="cta-btn shrink-0 rounded-2xl bg-[#9A88FD] px-4 py-2 text-sm font-semibold text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push(`/inspection/${insp.id}/report`);
                      }}
                    >
                      Open
                    </button>
                  )}

                  <div
                    className="trash-btn"
                    onClick={(e) => e.stopPropagation()}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: "#F8F7F4",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <DeleteInspectionButton
                      inspectionId={insp.id}
                      inspectionType={(insp.type ?? "check-in") as "check-in" | "check-out"}
                      status={insp.status}
                      signatures={insp.signatures ?? []}
                      redirectTo="/dashboard"
                      variant="icon"
                      onOptimisticRemove={() => {
                        recentRollbackRef.current = [...recentInspections];
                        setDeletingId(insp.id);
                        setTimeout(() => {
                          setRecentInspections((prev) => prev.filter((i) => i.id !== insp.id));
                          setDeletingId(null);
                        }, 320);
                      }}
                      onRollback={() => {
                        setRecentInspections(recentRollbackRef.current);
                        setDeletingId(null);
                      }}
                      onSuccess={() => router.refresh()}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          {recentInspections.length === 0 && (
            <div style={{ textAlign: "center", padding: "50px 0" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 22,
                  background: "#EEEDE9",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg
                  width="32"
                  height="32"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#CCC"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                </svg>
              </div>
              <h3
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 17,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: 0,
                }}
              >
                No inspections yet
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "#BBB",
                  margin: "8px 0 0",
                  lineHeight: 1.5,
                }}
              >
                Tap New Check-in to start your first one
              </p>
            </div>
          )}
        </div>
      </div>
      </div>
      <BuyCreditsModal
        isOpen={showBuyCredits}
        onClose={() => setShowBuyCredits(false)}
        currentBalance={balance}
        accountType={(accountType as "individual" | "pro") || "individual"}
        plan={plan}
        planSlug={planSlugForBuyCredits(plan)}
        pricePerCredit={pricePerCreditForBuy(plan)}
      />
      {showOnboarding && (
        <OnboardingTutorial
          accountType={profileAccountType}
          onDone={() => {
            void completeTour();
          }}
        />
      )}
    </div>
  );
}
