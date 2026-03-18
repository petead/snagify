"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { SubscriptionSection } from "@/components/profile/SubscriptionSection";
import { TeamSection } from "@/components/profile/TeamSection";
import { ReportBugModal } from "@/components/settings/ReportBugModal";
import { Check } from "lucide-react";
import { trackAction } from "@/lib/breadcrumb";

export type ProfileData = {
  full_name: string | null;
  agency_name: string | null;
  phone: string | null;
  memberSince: string | null;
  avatar_url: string | null;
  job_title: string | null;
  whatsapp_number: string | null;
  rera_number: string | null;
  company_logo_url: string | null;
  company_website: string | null;
  company_address: string | null;
  company_trade_license: string | null;
  signature_image_url: string | null;
  company_primary_color: string | null;
};

export type CompanyData = {
  id: string;
  plan: string;
  credits_balance: number;
  max_users: number;
  name: string;
  stripe_subscription_id?: string | null;
} | null;

interface ProfileClientProps {
  userId: string;
  userEmail: string | null;
  profile: ProfileData;
  stats: { properties: number; inspections: number; reports: number };
  accountType: "individual" | "pro";
  role: "owner" | "inspector";
  company: CompanyData;
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

function formatMemberSince(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

export function ProfileClient({
  userId: _userId,
  userEmail,
  profile,
  stats,
  accountType,
  role,
  company,
}: ProfileClientProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loaded, setLoaded] = useState(false);
  const [showBugReport, setShowBugReport] = useState(false);
  const justSubscribed = searchParams.get("subscribed") === "true";
  const isPro = accountType === "pro";
  const isOwner = role === "owner";
  const canManageBilling = isPro && isOwner;
  const subscriptionRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoaded(true);
    trackAction("Viewed Profile");
  }, []);

  useEffect(() => {
    if (searchParams.get("section") === "subscription") {
      setTimeout(() => {
        subscriptionRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }, 300);
    }
  }, [searchParams]);

  const initials = getInitials(profile.full_name, userEmail);
  const displayName = profile.full_name?.trim() || (userEmail ? userEmail.split("@")[0] : "User");
  const displayEmail = userEmail ?? "";
  const memberSince = profile.memberSince ?? null;

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        paddingBottom: 100,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');

        .cta-btn { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); cursor: pointer; }
        .cta-btn:active { transform: scale(0.97); }
        .setting-row { transition: all 0.2s ease; cursor: pointer; }
        .setting-row:active { background: #F0EFEC !important; }
        .stat-card { transition: all 0.25s ease; cursor: pointer; }
        .stat-card:active { transform: scale(0.96); }
        .scroll-hide::-webkit-scrollbar { display: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up {
          animation: fadeUp 0.55s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .nav-item { transition: all 0.2s ease; cursor: pointer; }
        .signout-btn { transition: all 0.2s ease; cursor: pointer; }
        .signout-btn:active {
          transform: scale(0.97);
          background: rgba(239,68,68,0.08) !important;
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
            <span style={{ fontSize: 16, fontWeight: 700, color: "#1A1A1A", letterSpacing: -0.3, fontFamily: "'Poppins', sans-serif" }}>
              Snagify
            </span>
          </div>
        </div>
      </div>

      {/* Title */}
      <div className={loaded ? "fade-up" : ""} style={{ padding: "24px 24px 0", animationDelay: "0.06s" }}>
        <p style={{ fontSize: 13, color: "#BBB", margin: 0, fontWeight: 500, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Account
        </p>
        <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 800, margin: "4px 0 0", color: "#1A1A1A", letterSpacing: -0.5 }}>
          Profile
        </h1>
      </div>

      <div className="scroll-hide" style={{ overflowY: "auto", paddingBottom: 24 }}>
        {/* Success banner for subscription */}
        {justSubscribed && (
          <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0.08s" }}>
            <div
              style={{
                background: "#DCFCE7",
                border: "1px solid #BBF7D0",
                borderRadius: 16,
                padding: 16,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <Check size={18} color="#16A34A" />
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#166534" }}>
                  Subscription activated!
                </div>
                <div style={{ fontSize: 12, color: "#15803D" }}>
                  Your credits have been added to your account.
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Identity card (read-only) */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: "0.1s" }}>
          <div style={{ background: "#fff", borderRadius: 22, padding: "24px", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: "50%",
                  overflow: "hidden",
                  flexShrink: 0,
                  border: "2px solid #EEEDE9",
                  background: profile.avatar_url ? "transparent" : "#9A88FD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {profile.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt=""
                    width={72}
                    height={72}
                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                  />
                ) : (
                  <span style={{ color: "#fff", fontSize: 24, fontWeight: 800, fontFamily: "'Poppins', sans-serif" }}>{initials}</span>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0, fontFamily: "'Poppins', sans-serif" }}>{displayName}</p>
                {profile.job_title?.trim() && (
                  <p style={{ fontSize: 13, color: "#666", margin: "2px 0 0" }}>{profile.job_title}</p>
                )}
                <p style={{ fontSize: 13, color: "#999", margin: "4px 0 0" }}>{displayEmail}</p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {profile.company_logo_url && (
                <Image
                  src={profile.company_logo_url}
                  alt=""
                  width={120}
                  height={32}
                  style={{ height: 32, width: "auto", maxWidth: 120, objectFit: "contain" }}
                />
              )}
              <span style={{ fontSize: 14, color: "#666", fontWeight: 500 }}>
                {profile.agency_name?.trim() || "—"}
              </span>
            </div>
            <Link
              href="/profile/edit"
              className="cta-btn"
              style={{
                display: "block",
                marginTop: 20,
                textAlign: "center",
                padding: "14px 0",
                background: "#9A88FD",
                color: "#fff",
                borderRadius: 14,
                fontSize: 14,
                fontWeight: 600,
                textDecoration: "none",
                fontFamily: "inherit",
              }}
            >
              Edit Profile
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div
          className={loaded ? "fade-up" : ""}
          style={{ padding: "16px 24px 0", display: "flex", gap: 10, animationDelay: "0.16s" }}
        >
          {[
            { label: "Properties", value: String(stats.properties), href: "/properties" },
            { label: "Inspections", value: String(stats.inspections), href: "/reports" },
            { label: "Reports", value: String(stats.reports), href: "/reports" },
          ].map((stat) => (
            <Link
              key={stat.label}
              href={stat.href}
              className="stat-card"
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 16,
                padding: "16px 10px",
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
                textDecoration: "none",
                color: "inherit",
              }}
            >
              <p style={{ fontSize: 26, fontWeight: 800, margin: 0, color: "#1A1A1A", fontFamily: "'Poppins', sans-serif", lineHeight: 1 }}>
                {stat.value}
              </p>
              <p style={{ fontSize: 11, color: "#BBB", margin: "6px 0 0", fontWeight: 500 }}>
                {stat.label}
              </p>
            </Link>
          ))}
        </div>

        {/* Subscription (pro owner only) */}
        {canManageBilling && company && (
          <div ref={subscriptionRef} className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: "0.19s" }}>
            <p style={{ fontSize: 13, color: "#BBB", margin: "0 0 12px", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>
              Subscription
            </p>
            <SubscriptionSection company={company} />
          </div>
        )}

        {/* Team (pro owner only) */}
        {canManageBilling && company && (
          <div className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: "0.24s" }}>
            <p style={{ fontSize: 13, color: "#BBB", margin: "0 0 12px", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>
              Team
            </p>
            <TeamSection company={company} currentUserId={_userId} />
          </div>
        )}

        {/* Settings */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: canManageBilling ? "0.32s" : "0.22s" }}>
          <p style={{ fontSize: 13, color: "#BBB", margin: "0 0 12px", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>
            Settings
          </p>

          <div style={{ background: "#fff", borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            {/* Install App */}
            <Link
              href="/install-guide"
              className="setting-row"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EFEC", textDecoration: "none" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "rgba(154,136,253,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
                    <rect x="5" y="2" width="14" height="20" rx="2" />
                    <line x1="12" y1="18" x2="12.01" y2="18" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Install App</p>
                  <p style={{ fontSize: 11, color: "#BBB", margin: "2px 0 0" }}>Add to home screen</p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#9A88FD", fontWeight: 600 }}>Guide →</span>
            </Link>

            {/* Language */}
            <div
              className="setting-row"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EFEC" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EEEDE9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="2" y1="12" x2="22" y2="12" />
                    <path d="M12 2a15.3 15.3 0 014 10 15.3 15.3 0 01-4 10 15.3 15.3 0 01-4-10 15.3 15.3 0 014-10z" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Language</p>
              </div>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#999", background: "#EEEDE9", padding: "4px 12px", borderRadius: 8 }}>
                English
              </span>
            </div>

            {/* Push Notifications */}
            <PushNotificationToggle />

            {/* Report a problem */}
            <button
              type="button"
              onClick={() => setShowBugReport(true)}
              className="setting-row"
              style={{
                width: "100%",
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid #F0EFEC",
                background: "transparent",
                border: "none",
                borderTop: "1px solid #F0EFEC",
                fontFamily: "inherit",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#FEF2F2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                      stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </div>
                <div style={{ textAlign: "left" }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Report a problem</p>
                  <p style={{ fontSize: 11, color: "#BBB", margin: "2px 0 0" }}>Help us improve Snagify</p>
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <path d="M9 18l6-6-6-6" stroke="#C4C4C4" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
            </button>

            {/* Snagify version */}
            <div style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EEEDE9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="12" y1="16" x2="12" y2="12" />
                    <line x1="12" y1="8" x2="12.01" y2="8" />
                  </svg>
                </div>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Snagify</p>
                  <p style={{ fontSize: 11, color: "#BBB", margin: "2px 0 0" }}>Version 1.0.0 MVP</p>
                </div>
              </div>
              <span style={{ fontSize: 12, color: "#BBB", fontWeight: 500 }}>snagify.net</span>
            </div>
          </div>
        </div>

        {/* Sign Out */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: canManageBilling ? "0.38s" : "0.28s" }}>
          <button
            type="button"
            className="signout-btn"
            onClick={handleSignOut}
            style={{
              width: "100%",
              background: "#fff",
              borderRadius: 16,
              padding: "16px 0",
              textAlign: "center",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              border: "1.5px solid rgba(239,68,68,0.15)",
              cursor: "pointer",
              fontFamily: "inherit",
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#EF4444" }}>Sign Out</span>
          </button>
        </div>

        {/* Member since */}
        {memberSince && (
          <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", textAlign: "center", animationDelay: canManageBilling ? "0.42s" : "0.32s" }}>
            <p style={{ fontSize: 12, color: "#CCC", fontWeight: 500 }}>
              Member since {formatMemberSince(memberSince)}
            </p>
          </div>
        )}
      </div>

      {/* Bug report modal */}
      {showBugReport && (
        <ReportBugModal onClose={() => setShowBugReport(false)} />
      )}
    </div>
  );
}
