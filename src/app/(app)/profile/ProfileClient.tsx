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
import type { ProfileRole } from "@/lib/profileLabels";

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
  /** When false, agent does not receive the signed PDF by email (landlord/tenant unchanged). */
  receive_signed_report_email: boolean;
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
  role: ProfileRole;
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
  const [receiveSignedReportEmail, setReceiveSignedReportEmail] = useState(
    profile.receive_signed_report_email
  );
  const [showBugReport, setShowBugReport] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);
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
    setReceiveSignedReportEmail(profile.receive_signed_report_email);
  }, [profile.receive_signed_report_email]);

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
    try {
      await supabase.auth.signOut();
    } catch {
      /* sign-out best-effort */
    }
    router.push("/login");
  };

  const handleToggleSignedReportEmail = async () => {
    const newValue = !receiveSignedReportEmail;
    setReceiveSignedReportEmail(newValue);
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setReceiveSignedReportEmail(!newValue);
      return;
    }
    const { error } = await supabase
      .from("profiles")
      .update({ receive_signed_report_email: newValue })
      .eq("id", user.id);
    if (error) {
      setReceiveSignedReportEmail(!newValue);
      alert("Failed to update preference");
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeletingAccount(true);
    try {
      const res = await fetch("/api/account/delete", { method: "DELETE" });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        throw new Error(body.error || "Failed to delete account");
      }
      const supabase = createClient();
      try {
        await supabase.auth.signOut();
      } catch {
        /* session already invalid after delete */
      }
      router.push("/login");
      router.refresh();
    } catch (err) {
      console.error(err);
      alert(
        err instanceof Error
          ? err.message
          : "Failed to delete account. Please try again."
      );
      setIsDeletingAccount(false);
      setShowDeleteConfirm(false);
    }
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

            <div
              style={{
                padding: "12px 20px 4px",
                borderBottom: "1px solid #F0EFEC",
              }}
            >
              <p
                style={{
                  fontSize: 11,
                  color: "#BBB",
                  margin: 0,
                  fontWeight: 600,
                  letterSpacing: 1.4,
                  textTransform: "uppercase",
                }}
              >
                Notifications
              </p>
            </div>

            <div className="flex items-start justify-between gap-4 py-4 border-b border-gray-100 px-5">
              <div className="flex flex-col gap-1">
                <span className="text-sm font-semibold text-gray-800">
                  Receive signed report by email
                </span>
                <span className="text-xs text-gray-400 leading-relaxed max-w-xs">
                  When all parties have signed, a copy of the final PDF report will be sent to your email
                  address. You can disable this if you prefer to access reports directly from the app.
                </span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={receiveSignedReportEmail}
                aria-label="Receive signed report by email"
                onClick={() => void handleToggleSignedReportEmail()}
                className={`relative shrink-0 w-11 h-6 rounded-full transition-colors duration-200 ${
                  receiveSignedReportEmail ? "bg-[#9A88FD]" : "bg-gray-200"
                }`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform duration-200 ${
                    receiveSignedReportEmail ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
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

        {/* Danger zone — self-service account deletion (API uses service role + storage cleanup). */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: canManageBilling ? "0.36s" : "0.26s" }}>
          <div className="bg-white rounded-2xl p-5 border border-red-100">
            <h3 className="font-heading font-extrabold text-base text-gray-900 mb-1">
              Delete account
            </h3>
            <p className="text-sm text-gray-400 mb-4 font-body">
              Permanently delete your account and all associated data including
              properties, inspections, photos and reports. This cannot be undone.
            </p>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-red-200 text-red-500 text-sm font-semibold active:scale-95 transition-transform hover:bg-red-50 min-h-[44px]"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="3 6 5 6 21 6" />
                <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                <path d="M10 11v6" />
                <path d="M14 11v6" />
                <path d="M9 6V4h6v2" />
              </svg>
              Delete my account
            </button>
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

      {showDeleteConfirm && (
        <div
          className="fixed inset-0 z-[100] flex items-end justify-center bg-black/40 px-4 pb-8"
          role="dialog"
          aria-modal="true"
          aria-labelledby="delete-account-title"
        >
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm shadow-xl">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-red-50 mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-red-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h4
              id="delete-account-title"
              className="font-heading font-extrabold text-center text-gray-900 text-lg mb-2"
            >
              Delete your account?
            </h4>
            <p className="text-sm text-gray-400 text-center mb-6 font-body">
              All your properties, inspections, photos and reports will be{" "}
              <span className="font-semibold text-gray-600">permanently deleted</span>.
              This cannot be undone.
            </p>
            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => void handleDeleteAccount()}
                disabled={isDeletingAccount}
                className="w-full py-3 rounded-xl bg-red-500 text-white font-semibold text-sm disabled:opacity-50 disabled:pointer-events-none active:scale-95 transition-transform flex items-center justify-center gap-2 min-h-[44px]"
              >
                {isDeletingAccount ? (
                  <>
                    <svg className="animate-spin w-4 h-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                    </svg>
                    Deleting...
                  </>
                ) : (
                  "Yes, delete everything"
                )}
              </button>
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                disabled={isDeletingAccount}
                className="w-full py-3 rounded-xl bg-gray-100 text-gray-600 font-semibold text-sm active:scale-95 transition-transform min-h-[44px]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
