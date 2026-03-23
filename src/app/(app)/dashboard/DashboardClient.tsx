"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { PenLine, AlertTriangle, Bell, Check } from "lucide-react";
import { useCredits } from "@/hooks/useCredits";
import { BuyCreditsModal } from "@/components/credits/BuyCreditsModal";
import { OnboardingTutorial } from "@/components/onboarding/OnboardingTutorial";
import { trackAction } from "@/lib/breadcrumb";
import { createClient } from "@/lib/supabase/client";
import { planSlugForBuyCredits, pricePerCreditForBuy } from "@/lib/buyCreditsPlan";
type DashboardNotificationRow = {
  id: string;
  title: string;
  body: string;
  url: string | null;
  type: string;
  read_at: string | null;
  created_at: string;
};

const NOTIF_TYPE_CONFIG: Record<string, { icon: string; color: string; bg: string }> = {
  signature: { icon: "✍️", color: "#9A88FD", bg: "#EDE9FF" },
  lease: { icon: "🔑", color: "#F59E0B", bg: "#FEF3C7" },
  expired: { icon: "🔒", color: "#6B7280", bg: "#F3F4F6" },
  disputed: { icon: "⚠️", color: "#EF4444", bg: "#FEF2F2" },
  report: { icon: "📝", color: "#16A34A", bg: "#DCFCE7" },
  general: { icon: "🔔", color: "#9A88FD", bg: "#EDE9FF" },
};

function notificationTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-AE", {
    day: "numeric",
    month: "short",
  });
}

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

interface DashboardClientProps {
  userId: string | null;
  displayName: string;
  fullName: string | null;
  userEmail: string | null;
  accountType: "pro" | "individual";
  tourCompleted: boolean;
  profileLoading?: boolean;
  showProUpgradeBanner?: boolean;
  stripeSubscriptionId?: string | null;
  properties: PropertyRow[];
  alerts?: AlertItem[];
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
  stripeSubscriptionId = null,
  properties: initialProperties,
  alerts = [],
}: DashboardClientProps) {
  const supabase = createClient();
  const { balance, plan, accountType, refresh: refreshCredits } = useCredits();
  const [showBuyCredits, setShowBuyCredits] = useState(false);
  const [showNoSubscriptionAlert, setShowNoSubscriptionAlert] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [properties, setProperties] = useState(() => normalizeProperties(initialProperties));
  const [showOnboarding, setShowOnboarding] = useState(false);
  const router = useRouter();

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
    setProperties(normalizeProperties(initialProperties));
  }, [initialProperties]);

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

  const [notifications, setNotifications] = useState<DashboardNotificationRow[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(true);

  const fetchNotifications = useCallback(
    async (opts?: { silent?: boolean }) => {
      const silent = opts?.silent;
      if (!silent) setNotificationsLoading(true);
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      setNotifications((data as DashboardNotificationRow[] | null) ?? []);
      if (!silent) setNotificationsLoading(false);
    },
    [supabase]
  );

  useEffect(() => {
    void fetchNotifications();

    const channel = supabase
      .channel("dashboard-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
        },
        () => void fetchNotifications()
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [supabase, fetchNotifications]);

  async function markNotificationAsRead(id: string) {
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("id", id);
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read_at: nowIso } : n)));
  }

  async function markAllNotificationsAsRead() {
    const unreadIds = notifications.filter((n) => !n.read_at).map((n) => n.id);
    if (!unreadIds.length) return;
    await supabase.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unreadIds);
    const nowIso = new Date().toISOString();
    setNotifications((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? nowIso })));
  }

  function handleNotificationRowClick(notif: DashboardNotificationRow) {
    void markNotificationAsRead(notif.id);
    if (notif.url) window.location.href = notif.url;
  }

  const notificationsUnreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <div
      className="fixed inset-0 mx-auto flex min-h-0 w-full max-w-[480px] flex-col overflow-hidden bg-[#F8F7F4]"
      style={{ paddingBottom: 64, fontFamily: "'DM Sans', sans-serif" }}
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

      <div className="flex-shrink-0">
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
          onClick={() => {
            if (accountType === "pro" && (!plan || plan === "free" || !stripeSubscriptionId)) {
              setShowNoSubscriptionAlert(true);
            } else {
              setShowBuyCredits(true);
            }
          }}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setShowBuyCredits(true)}
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
            cursor: "pointer",
          }}
        >
          <div className="absolute top-3 right-3 z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setShowBuyCredits(true);
              }}
              style={{
                background: "none",
                border: "none",
                padding: 0,
                color: "#9A88FD",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              Buy credits →
            </button>
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

      <div className="flex items-center justify-between px-4 pb-2 pt-7">
        <div className="flex items-center gap-2">
          <Bell size={16} className="text-[#9A88FD]" />
          <span className="text-[15px] font-bold text-[#1A1A2E]">Notifications</span>
          {notificationsUnreadCount > 0 && (
            <span className="rounded-full bg-[#9A88FD] px-2 py-0.5 text-[10px] font-bold leading-snug text-white">
              {notificationsUnreadCount} new
            </span>
          )}
        </div>
        {notificationsUnreadCount > 0 && (
          <button
            type="button"
            onClick={() => void markAllNotificationsAsRead()}
            className="flex items-center gap-1 text-[12px] font-semibold text-[#9A88FD]"
          >
            <Check size={11} />
            Mark all read
          </button>
        )}
      </div>
      </div>

      <div
        data-pull-scroll
        className="min-h-0 flex-1 overflow-y-auto px-4 pb-4"
        style={{
          overscrollBehavior: "contain",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        <style>{`[data-pull-scroll]::-webkit-scrollbar { display: none; }`}</style>
        <div className="overflow-hidden rounded-2xl border border-[#EEECFF] bg-white">
          {notificationsLoading ? (
            <div className="flex items-center justify-center py-10">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#9A88FD] border-t-transparent" />
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center px-6 py-10 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EDE9FF]">
                <Bell size={20} className="text-[#9A88FD]" />
              </div>
              <p className="mb-1 text-[13px] font-semibold text-[#1A1A2E]">No notifications yet</p>
              <p className="text-[12px] leading-relaxed text-gray-400">
                Signature updates, lease alerts and reminders will appear here.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F3F8]">
              {notifications.map((notif) => {
                const config = NOTIF_TYPE_CONFIG[notif.type] ?? NOTIF_TYPE_CONFIG.general;
                const isUnread = !notif.read_at;
                return (
                  <button
                    key={notif.id}
                    type="button"
                    onClick={() => handleNotificationRowClick(notif)}
                    className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition-colors active:bg-[#F8F7F4]"
                    style={{ background: isUnread ? "#FAFAFA" : "white" }}
                  >
                    <div
                      className="mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl text-[15px]"
                      style={{ background: config.bg }}
                    >
                      {config.icon}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <span
                          className={`text-[13px] leading-snug ${
                            isUnread ? "font-bold text-[#1A1A2E]" : "font-semibold text-[#374151]"
                          }`}
                        >
                          {notif.title}
                        </span>
                        <span className="mt-0.5 flex-shrink-0 whitespace-nowrap text-[10px] text-gray-400">
                          {notificationTimeAgo(notif.created_at)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-[12px] leading-relaxed text-gray-500">{notif.body}</p>
                    </div>
                    {isUnread && <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-[#9A88FD]" />}
                  </button>
                );
              })}
            </div>
          )}
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
      {showNoSubscriptionAlert &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              background: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "0 20px",
            }}
            onClick={() => setShowNoSubscriptionAlert(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                background: "white",
                borderRadius: 24,
                padding: 24,
                width: "100%",
                maxWidth: 360,
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 16,
                  background: "rgba(154,136,253,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#9A88FD"
                  strokeWidth="2"
                  strokeLinecap="round"
                >
                  <rect x="2" y="5" width="20" height="14" rx="2" />
                  <line x1="2" y1="10" x2="22" y2="10" />
                </svg>
              </div>

              <h3
                style={{
                  fontFamily: "Poppins, sans-serif",
                  fontSize: 17,
                  fontWeight: 800,
                  color: "#1A1A1A",
                  margin: "0 0 8px",
                }}
              >
                No active plan
              </h3>
              <p
                style={{
                  fontSize: 13,
                  color: "#6B7280",
                  lineHeight: 1.6,
                  margin: "0 0 20px",
                }}
              >
                You need an active Pro subscription to buy extra credits.
              </p>

              <button
                type="button"
                onClick={() => {
                  setShowNoSubscriptionAlert(false);
                  router.push("/profile?section=subscription");
                }}
                style={{
                  width: "100%",
                  background: "#9A88FD",
                  color: "white",
                  border: "none",
                  borderRadius: 14,
                  padding: "14px 0",
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                  marginBottom: 10,
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                View plans →
              </button>

              <button
                type="button"
                onClick={() => setShowNoSubscriptionAlert(false)}
                style={{
                  width: "100%",
                  background: "none",
                  border: "none",
                  color: "#9CA3AF",
                  fontSize: 13,
                  cursor: "pointer",
                  padding: "8px 0",
                }}
              >
                Cancel
              </button>
            </div>
          </div>,
          document.body
        )}
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
