"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";
import { regenerateAndDownloadInspectionPdf } from "@/lib/regenerateAndDownloadInspectionPdf";
import { InspectionStatusBadge } from "@/components/inspection/InspectionStatusBadge";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";
import { PullToRefreshIndicator } from "@/components/PullToRefresh";

type ReportRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string;
  report_url?: string | null;
  properties?: unknown;
  tenancies?: unknown;
  signatures?: { signer_type: string; otp_verified: boolean; signed_at?: string | null }[];
  rooms?: { id: string; photos?: { id: string }[] }[];
};

interface ReportsClientProps {
  initialReports: ReportRow[];
  fullName: string | null;
  userEmail: string | null;
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

function tenantInitials(name: string | null | undefined): string {
  if (!name) return "?";
  return name.trim().split(/\s+/).map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function isSigned(report: ReportRow): boolean {
  // Fully signed = status is 'signed' AND both landlord + tenant have signed
  if (report.status === "signed") return true;
  
  // Also check signatures directly: BOTH landlord AND tenant must have signed_at
  const sigs = report.signatures ?? [];
  const landlordSig = sigs.find(s => s.signer_type === 'landlord');
  const tenantSig = sigs.find(s => s.signer_type === 'tenant');
  
  return !!landlordSig?.signed_at && !!tenantSig?.signed_at;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const TABS = ["All", "Pending", "Signed"] as const;
type Tab = (typeof TABS)[number];

export function ReportsClient({ initialReports, fullName, userEmail }: ReportsClientProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [reports, setReports] = useState(initialReports);
  const rollbackRef = useRef<ReportRow[]>([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("All");
  const [search, setSearch] = useState("");

  const handleReportPdfDownload = useCallback(
    async (id: string) => {
      if (pdfLoadingId) return;
      setPdfLoadingId(id);
      try {
        await regenerateAndDownloadInspectionPdf(id);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Download failed";
        console.error("[DownloadPDF]", msg);
        alert(msg);
      } finally {
        setPdfLoadingId(null);
      }
    },
    [pdfLoadingId]
  );

  useEffect(() => {
    setLoaded(true);
  }, []);
  useEffect(() => {
    setReports(initialReports);
  }, [initialReports]);

  const initials = getInitials(fullName, userEmail);

  const pendingCount = reports.filter(
    (r) => r.status === "completed" && !isSigned(r)
  ).length;
  const signedCount = reports.filter((r) => isSigned(r)).length;

  const tabCount = (tab: Tab) => {
    if (tab === "All") return reports.length;
    if (tab === "Pending") return pendingCount;
    return signedCount;
  };

  const handleRefresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  const { pullDistance, isRefreshing, isTriggered, containerRef } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const filtered = reports.filter((r) => {
    const prop = first(r.properties) as { building_name?: string | null; unit_number?: string | null } | null;
    const ten = first(r.tenancies) as { tenant_name?: string | null } | null;
    const signed = isSigned(r);
    const matchesTab =
      activeTab === "All" ||
      (activeTab === "Pending" && r.status === "completed" && !signed) ||
      (activeTab === "Signed" && signed);
    const q = search.toLowerCase();
    const matchesSearch =
      !q ||
      (prop?.building_name ?? "").toLowerCase().includes(q) ||
      (prop?.unit_number ?? "").toLowerCase().includes(q) ||
      (ten?.tenant_name ?? "").toLowerCase().includes(q);
    return matchesTab && matchesSearch;
  });

  return (
    <div
      ref={containerRef}
      className="scroll-hide relative"
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
        transform: `translateY(${pullDistance}px)`,
        transition: isRefreshing ? "transform 0.2s ease" : "none",
      }}
    >
      <PullToRefreshIndicator
        pullDistance={pullDistance}
        isRefreshing={isRefreshing}
        isTriggered={isTriggered}
      />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');

        .report-card {
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .report-card-deleting {
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
        .tab-btn {
          transition: all 0.25s ease;
          cursor: pointer;
        }
        .tab-btn:active {
          transform: scale(0.95);
        }
        .search-input {
          transition: all 0.3s ease;
          border: 1.5px solid transparent;
        }
        .search-input:focus {
          border-color: #9A88FD;
          background: #fff;
          outline: none;
          box-shadow: 0 4px 20px rgba(154,136,253,0.1);
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
        .nav-item { transition: all 0.2s ease; cursor: pointer; }
        .trash-btn { transition: all 0.2s ease; cursor: pointer; }
        .trash-btn:active { transform: scale(0.9); }
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
          <Link
            href="/profile"
            style={{
              width: 42, height: 42, borderRadius: "50%",
              background: "#9A88FD",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#fff", fontSize: 14, fontWeight: 600, letterSpacing: 0.5,
              textDecoration: "none",
            }}
          >
            {initials}
          </Link>
        </div>
      </div>

      {/* Title */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "24px 24px 0", animationDelay: "0.06s" }}
      >
        <p style={{ fontSize: 13, color: "#BBB", margin: 0, fontWeight: 500, letterSpacing: 1.2, textTransform: "uppercase" }}>
          Documents
        </p>
        <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 4 }}>
          <h1 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 30, fontWeight: 800, margin: 0, color: "#1A1A1A", letterSpacing: -0.5 }}>
            Reports
          </h1>
        </div>
      </div>

      {/* Tabs */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "16px 24px 0", display: "flex", gap: 8, animationDelay: "0.1s" }}
      >
        {TABS.map((tab) => {
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              className="tab-btn"
              onClick={() => setActiveTab(tab)}
              style={{
                padding: "8px 18px",
                borderRadius: 100,
                background: isActive ? "#1A1A1A" : "transparent",
                border: isActive ? "none" : "1.5px solid #DDDCD8",
                color: isActive ? "#fff" : "#999",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: 6,
                cursor: "pointer",
              }}
            >
              {tab}
              <span style={{ fontSize: 11, fontWeight: 700, color: isActive ? "rgba(255,255,255,0.5)" : "#CCC" }}>
                {tabCount(tab)}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{ padding: "14px 24px 0", animationDelay: "0.14s" }}
      >
        <div style={{ position: "relative" }}>
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="#BBB" strokeWidth="2.5" strokeLinecap="round"
            style={{ position: "absolute", left: 16, top: "50%", transform: "translateY(-50%)", pointerEvents: "none" }}
          >
            <circle cx="11" cy="11" r="7" />
            <line x1="16.5" y1="16.5" x2="21" y2="21" />
          </svg>
          <input
            className="search-input"
            type="text"
            placeholder="Search by property or tenant..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              padding: "14px 16px 14px 46px",
              borderRadius: 14,
              border: "1.5px solid transparent",
              background: "#EEEDE9",
              fontSize: 16,
              color: "#1A1A1A",
              fontFamily: "'DM Sans', sans-serif",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Report Cards */}
      <div style={{ paddingBottom: 24 }}>
        <div style={{ padding: "14px 24px 0" }}>

          {filtered.length === 0 ? (
            <div style={{ textAlign: "center", padding: "70px 0" }}>
              <div
                style={{
                  width: 72, height: 72, borderRadius: 22,
                  background: "#EEEDE9",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#CCC" strokeWidth="1.5" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
                  <polyline points="14 2 14 8 20 8" />
                  <line x1="16" y1="13" x2="8" y2="13" />
                  <line x1="16" y1="17" x2="8" y2="17" />
                </svg>
              </div>
              <h3 style={{ fontFamily: "'Poppins', sans-serif", fontSize: 17, fontWeight: 700, color: "#1A1A1A", margin: 0 }}>
                {search ? "No reports found" : "No reports yet"}
              </h3>
              <p style={{ fontSize: 13, color: "#BBB", margin: "8px 0 0", lineHeight: 1.5 }}>
                {search
                  ? "Try a different search"
                  : "Complete an inspection to generate your first report"}
              </p>
            </div>
          ) : (
            filtered.map((report, i) => {
              const prop = first(report.properties) as { building_name?: string | null; unit_number?: string | null } | null;
              const ten = first(report.tenancies) as { tenant_name?: string | null } | null;
              const signed = isSigned(report);
              const isDraft = report.status === "in_progress";
              const pending = report.status === "completed" && !signed;
              const typeLabel = report.type === "check-in" ? "Check-in" : "Check-out";
              const propertyName = prop?.building_name ?? "Property";
              const unit = prop?.unit_number ? `Unit ${prop.unit_number}` : "";
              const tenantName = ten?.tenant_name ?? "";

              const rooms = report.rooms ?? [];
              const roomCount = rooms.length;
              const photoCount = rooms.reduce((n, r) => n + (r.photos?.length ?? 0), 0);

              return (
                <div
                  key={report.id}
                  className={`${loaded ? "fade-up" : ""} ${deletingId === report.id ? "report-card-deleting" : "report-card"}`}
                  style={{
                    background: "#fff",
                    borderRadius: 22,
                    padding: 20,
                    marginBottom: 14,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
                    animationDelay: `${0.2 + i * 0.07}s`,
                    position: "relative",
                  }}
                >
                  {/* Top row */}
                  <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                    <div
                      style={{
                        width: 50, height: 50, borderRadius: 15,
                        background: "#EDE9FF",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {report.type === "check-in" ? (
                        // Arrow entering — check-in
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M10 17l5-5-5-5"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M15 12H3"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      ) : (
                        // Arrow leaving — check-out
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                          <path
                            d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M16 17l5-5-5-5"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round" strokeLinejoin="round"
                          />
                          <path
                            d="M21 12H9"
                            stroke="#9A88FD" strokeWidth="1.8"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <h3
                          style={{
                            fontSize: 15, fontWeight: 700, color: "#1A1A1A", margin: 0,
                            fontFamily: "'Poppins', sans-serif",
                            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                            maxWidth: "60%",
                          }}
                        >
                          {propertyName}
                        </h3>
                        {isDraft ? (
                          <span className="flex-shrink-0 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-gray-500">
                            Draft
                          </span>
                        ) : (
                          <InspectionStatusBadge status={report.status} fullySigned={signed} />
                        )}
                      </div>
                      <p style={{ fontSize: 13, color: "#999", margin: "3px 0 0", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {[unit, typeLabel, formatDate(report.created_at)].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                  </div>

                  {/* Tenant */}
                  {tenantName && (
                    <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
                      <div
                        style={{
                          width: 24, height: 24, borderRadius: 7,
                          background: "#9A88FD",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          fontSize: 9, fontWeight: 700, color: "#fff",
                          flexShrink: 0,
                        }}
                      >
                        {tenantInitials(tenantName)}
                      </div>
                      <span style={{ fontSize: 12, color: "#666", fontWeight: 500 }}>
                        {tenantName}
                      </span>
                    </div>
                  )}

                  {/* Stats + Actions */}
                  <div style={{ marginTop: 14, display: "flex", gap: 8, alignItems: "center" }}>
                    <div
                      style={{
                        flex: 1, background: "#F8F7F4", borderRadius: 12,
                        padding: "10px 14px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11, color: "#BBB", fontWeight: 500 }}>Rooms</span>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#1A1A1A" }}>{roomCount}</span>
                    </div>
                    <div
                      style={{
                        flex: 1, background: "#F8F7F4", borderRadius: 12,
                        padding: "10px 14px",
                        display: "flex", justifyContent: "space-between", alignItems: "center",
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#BBB" strokeWidth="2" strokeLinecap="round">
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#9A88FD" }}>{photoCount}</span>
                    </div>

                    {/* Action button */}
                    {isDraft ? (
                      <button
                        type="button"
                        className="cta-btn flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white"
                        onClick={() => router.push(`/inspection/${report.id}`)}
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
                    ) : signed ? (
                      <button
                        type="button"
                        className="cta-btn flex shrink-0 items-center gap-1.5 rounded-xl bg-gray-900 px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
                        disabled={pdfLoadingId === report.id}
                        onClick={() => void handleReportPdfDownload(report.id)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                          <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                          <polyline points="7 10 12 15 17 10" />
                          <line x1="12" y1="15" x2="12" y2="3" />
                        </svg>
                        <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>
                          {pdfLoadingId === report.id ? "…" : "PDF"}
                        </span>
                      </button>
                    ) : pending ? (
                      <button
                        type="button"
                        className="cta-btn flex shrink-0 items-center gap-1.5 rounded-xl bg-[#9A88FD] px-4 py-2 text-sm font-bold text-white"
                        onClick={() => router.push(`/inspection/${report.id}/report`)}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round">
                          <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                        </svg>
                        <span style={{ fontSize: 12, color: "#fff", fontWeight: 600 }}>Sign</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="cta-btn flex shrink-0 items-center gap-1.5 rounded-xl bg-[#9A88FD] px-4 py-2 text-sm font-bold text-white"
                        onClick={() => router.push(`/inspection/${report.id}/report`)}
                      >
                        Open
                      </button>
                    )}

                    {/* Delete button */}
                    <div
                      className="trash-btn"
                      style={{
                        width: 40, height: 40, borderRadius: 12,
                        background: "#F8F7F4",
                        display: "flex", alignItems: "center", justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <DeleteInspectionButton
                        inspectionId={report.id}
                        inspectionType={(report.type ?? "check-in") as "check-in" | "check-out"}
                        status={report.status}
                        signatures={report.signatures ?? []}
                        redirectTo="/reports"
                        variant="icon"
                        onOptimisticRemove={() => {
                          rollbackRef.current = [...reports];
                          setDeletingId(report.id);
                          setTimeout(() => {
                            setReports((prev) => prev.filter((r) => r.id !== report.id));
                            setDeletingId(null);
                          }, 320);
                        }}
                        onRollback={() => {
                          setReports(rollbackRef.current);
                          setDeletingId(null);
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
