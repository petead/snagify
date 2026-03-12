"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface ProfileClientProps {
  fullName: string | null;
  userEmail: string | null;
  agencyName: string | null;
  memberSince: string | null;
  stats: { properties: number; inspections: number; reports: number };
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
  fullName,
  userEmail,
  agencyName,
  memberSince,
  stats,
}: ProfileClientProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  const initials = getInitials(fullName, userEmail);
  const displayName = fullName?.trim() || (userEmail ? userEmail.split("@")[0] : "User");
  const displayEmail = userEmail ?? "";

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
            <div
              style={{
                width: 32,
                height: 32,
                borderRadius: 10,
                background: "#9A88FD",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round">
                <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0-6v6" />
              </svg>
            </div>
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
        {/* Profile Card */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: "0.1s" }}>
          <div
            style={{
              background: "#fff",
              borderRadius: 22,
              padding: "24px 20px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <div
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 20,
                  background: "#9A88FD",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontSize: 22,
                  fontWeight: 800,
                  fontFamily: "'Poppins', sans-serif",
                  letterSpacing: 1,
                  flexShrink: 0,
                }}
              >
                {initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <h2 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 18, fontWeight: 700, color: "#1A1A1A", margin: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayName}
                </h2>
                <p style={{ fontSize: 13, color: "#999", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {displayEmail}
                </p>
                {agencyName && (
                  <div style={{ display: "flex", alignItems: "center", gap: 5, marginTop: 6 }}>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
                      <rect x="2" y="7" width="20" height="14" rx="2" />
                      <path d="M16 7V5a4 4 0 00-8 0v2" />
                    </svg>
                    <span style={{ fontSize: 12, color: "#9A88FD", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {agencyName}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <Link
              href="/profile"
              className="cta-btn"
              style={{
                display: "block",
                marginTop: 18,
                background: "#1A1A1A",
                color: "#fff",
                padding: "12px 0",
                borderRadius: 13,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                textDecoration: "none",
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

        {/* Settings */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "20px 24px 0", animationDelay: "0.22s" }}>
          <p style={{ fontSize: 13, color: "#BBB", margin: "0 0 12px", fontWeight: 500, letterSpacing: 2, textTransform: "uppercase" }}>
            Settings
          </p>

          <div style={{ background: "#fff", borderRadius: 22, overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.03)" }}>
            {/* Install App */}
            <div
              className="setting-row"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EFEC" }}
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
            </div>

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

            {/* Notifications */}
            <div
              className="setting-row"
              style={{ padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #F0EFEC" }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                <div style={{ width: 38, height: 38, borderRadius: 12, background: "#EEEDE9", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#999" strokeWidth="2" strokeLinecap="round">
                    <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
                    <path d="M13.73 21a2 2 0 01-3.46 0" />
                  </svg>
                </div>
                <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>Notifications</p>
              </div>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="2" strokeLinecap="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </div>

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
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0.28s" }}>
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
          <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", textAlign: "center", animationDelay: "0.32s" }}>
            <p style={{ fontSize: 12, color: "#CCC", fontWeight: 500 }}>
              Member since {formatMemberSince(memberSince)}
            </p>
          </div>
        )}
      </div>

      {/* Bottom Nav */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: "0 auto",
          background: "#fff",
          borderTop: "1px solid #F0EFEC",
          padding: "10px 0 28px",
          display: "flex",
          justifyContent: "space-around",
          alignItems: "center",
          zIndex: 5,
        }}
      >
        {[
          { id: "home", label: "Home", href: "/dashboard", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg> },
          { id: "properties", label: "Properties", href: "/properties", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></svg> },
          { id: "add", label: "", href: "/inspection/new", isAdd: true },
          { id: "reports", label: "Reports", href: "/reports", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg> },
          { id: "profile", label: "Profile", href: "/dashboard/profile", icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg> },
        ].map((item) => {
          if (item.isAdd) {
            return (
              <Link key={item.id} href={item.href} className="cta-btn" style={{ width: 50, height: 50, borderRadius: 16, background: "#9A88FD", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 20px rgba(154,136,253,0.3)", marginTop: -20, textDecoration: "none" }}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
              </Link>
            );
          }
          const isCurrentPage = typeof window !== "undefined" && window.location.pathname === item.href;
          return (
            <Link key={item.id} href={item.href} className="nav-item" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, color: isCurrentPage ? "#9A88FD" : "#C0BFBA", textDecoration: "none" }}>
              {item.icon}
              <span style={{ fontSize: 10, fontWeight: isCurrentPage ? 600 : 500 }}>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
