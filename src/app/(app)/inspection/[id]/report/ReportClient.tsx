"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Link as LinkIcon, Check } from "lucide-react";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";
import {
  type InspectionWithRelations,
  type PropertyRelation,
  type TenancyRelation,
  type Room,
} from "./page";

interface ReportClientProps {
  inspection: InspectionWithRelations;
  profile: { full_name: string | null; agency_name: string | null } | null;
}

const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

const formatDateShort = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "short",
      })
    : "—";

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

const initials = (name: string | null | undefined) =>
  (name ?? "?")
    .trim()
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";

function Section({
  icon,
  title,
  children,
  delay,
  loaded,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  delay: string;
  loaded: boolean;
}) {
  return (
    <div
      className={loaded ? "fade-up" : ""}
      style={{ padding: "0 24px", marginTop: 16, animationDelay: delay }}
    >
      <div
        style={{
          background: "#fff",
          borderRadius: 20,
          overflow: "hidden",
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)",
        }}
      >
        <div
          style={{
            padding: "16px 20px 14px",
            display: "flex",
            alignItems: "center",
            gap: 8,
            borderBottom: "1px solid #F0EFEC",
          }}
        >
          {icon}
          <h3
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14,
              fontWeight: 700,
              color: "#1A1A1A",
              margin: 0,
            }}
          >
            {title}
          </h3>
        </div>
        <div style={{ padding: "14px 20px" }}>{children}</div>
      </div>
    </div>
  );
}

const iconDoc = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
  </svg>
);
const iconUsers = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 00-3-3.87" />
    <path d="M16 3.13a4 4 0 010 7.75" />
  </svg>
);
const iconCalendar = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="4" width="18" height="18" rx="2" />
    <line x1="16" y1="2" x2="16" y2="6" />
    <line x1="8" y1="2" x2="8" y2="6" />
    <line x1="3" y1="10" x2="21" y2="10" />
  </svg>
);
const iconRooms = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <rect x="3" y="3" width="7" height="7" rx="1" />
    <rect x="14" y="3" width="7" height="7" rx="1" />
    <rect x="3" y="14" width="7" height="7" rx="1" />
    <rect x="14" y="14" width="7" height="7" rx="1" />
  </svg>
);
const iconKeys = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 11-7.778 7.778 5.5 5.5 0 017.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
  </svg>
);
const iconSign = (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round">
    <path d="M17 3a2.828 2.828 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
  </svg>
);

export function ReportClient({ inspection, profile }: ReportClientProps) {
  const router = useRouter();
  const [loaded, setLoaded] = useState(false);
  const [showSignModal, setShowSignModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ landlord: false, tenant: false });
  const [downloadLoading, setDownloadLoading] = useState(false);
  const [reportUrl, setReportUrl] = useState<string | null>(inspection.report_url ?? null);
  const [execSummary, setExecSummary] = useState<string | null>(
    inspection.executive_summary ?? inspection.report_data?.executive_summary ?? null
  );

  useEffect(() => {
    setLoaded(true);
  }, []);
  useEffect(() => {
    setReportUrl(inspection.report_url ?? null);
    setExecSummary(
      inspection.executive_summary ?? inspection.report_data?.executive_summary ?? null
    );
  }, [inspection.report_url, inspection.executive_summary, inspection.report_data?.executive_summary]);

  const prop = normalizeOne(inspection.properties) as PropertyRelation | null;
  const tenancy = normalizeOne(inspection.tenancies) as TenancyRelation | null;
  const buildingName = prop?.building_name ?? prop?.address ?? "Property";
  const unitNumber = prop?.unit_number;
  const unitLabel = unitNumber ? `Unit ${unitNumber}` : "";
  const rooms = (inspection.rooms ?? []) as Room[];
  const sortedRooms = rooms.slice().sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
  const totalPhotos = sortedRooms.reduce((acc, r) => acc + (r.photos?.length ?? 0), 0);
  const signatures = inspection.signatures ?? [];
  const landlordSig = signatures.find((s) => s.signer_type === "landlord");
  const tenantSig = signatures.find((s) => s.signer_type === "tenant");
  const landlordSigned = !!(landlordSig?.otp_verified || landlordSig?.signed_at);
  const tenantSigned = !!(tenantSig?.otp_verified || tenantSig?.signed_at);
  const bothSigned = landlordSigned && tenantSigned;
  const isCheckIn = (inspection.type ?? "").toLowerCase().includes("check-in") || (inspection.type ?? "").toLowerCase() === "check_in";
  const typeLabel = isCheckIn ? "Check-in" : "Check-out";
  const status = bothSigned ? "signed" : (inspection.status ?? "draft");
  const statusDisplay =
    status === "signed"
      ? "Fully Signed"
      : status === "completed"
        ? "Awaiting Signatures"
        : "In Progress";
  const contractFrom = tenancy?.contract_from;
  const contractTo = tenancy?.contract_to;
  const durationMonths =
    contractFrom && contractTo
      ? Math.round(
          (new Date(contractTo).getTime() - new Date(contractFrom).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      : null;

  const parties = [
    {
      role: "Landlord",
      name: tenancy?.landlord_name,
      contact: tenancy?.landlord_phone || tenancy?.landlord_email,
    },
    {
      role: "Tenant",
      name: tenancy?.tenant_name,
      contact: tenancy?.tenant_phone || tenancy?.tenant_email,
    },
    {
      role: "Agent",
      name: profile?.full_name,
      contact: profile?.agency_name,
    },
  ];

  const handover = Array.isArray(inspection.key_handover)
    ? inspection.key_handover.filter((k) => k && typeof k.item === "string" && typeof k.qty === "number")
    : [];

  const handleDownloadPDF = async () => {
    setDownloadLoading(true);
    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId: inspection.id }),
      });
      const data = (await res.json()) as {
        report_url?: string;
        executive_summary?: string;
        error?: string;
      };
      if (!res.ok) throw new Error(data?.error ?? "PDF generation failed");
      if (data.report_url) {
        setReportUrl(data.report_url);
        if (data.executive_summary) setExecSummary(data.executive_summary);
        router.refresh();
        window.open(data.report_url, "_blank");
      }
    } catch (err) {
      console.error("Generate report failed:", err);
      alert(
        `Could not generate PDF: ${err instanceof Error ? err.message : "Please try again."}`
      );
    } finally {
      setDownloadLoading(false);
    }
  };

  const handleSendOTP = async (
    signerType: "landlord" | "tenant",
    email: string,
    signerName: string
  ) => {
    if (!email?.trim()) {
      alert("No email for this signer.");
      return;
    }
    setSending(true);
    try {
      const res = await fetch("/api/send-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: email.trim(),
          inspectionId: inspection.id,
          signerType,
          signerName: signerName || "there",
          propertyName: buildingName + (unitNumber ? `, Unit ${unitNumber}` : ""),
          inspectionType: inspection.type ?? "check-in",
        }),
      });
      const data = await res.json();
      if (data.success) setSent((prev) => ({ ...prev, [signerType]: true }));
      else alert("Error: " + (data.error ?? "Failed to send email"));
    } catch {
      alert("Failed to send email");
    } finally {
      setSending(false);
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
        paddingBottom: 180,
      }}
    >
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');
        .back-btn { transition: all 0.2s ease; cursor: pointer; }
        .back-btn:active { transform: scale(0.9); }
        .cta-btn { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
        .cta-btn:active { transform: scale(0.97); }
        .scroll-hide::-webkit-scrollbar { display: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.55s cubic-bezier(0.16,1,0.3,1) forwards; opacity: 0; }
      `}</style>

      {/* Back */}
      <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0s" }}>
        <Link
          href={inspection.property_id ? `/property/${inspection.property_id}` : "/dashboard"}
          className="back-btn"
          style={{
            width: 38,
            height: 38,
            borderRadius: 12,
            background: "#EEEDE9",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A1A" strokeWidth="2.5" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
        </Link>
      </div>

      <div className="scroll-hide" style={{ overflowY: "auto", maxHeight: "calc(100vh - 120px)", paddingBottom: 24 }}>
        {/* Report Header */}
        <div className={loaded ? "fade-up" : ""} style={{ padding: "16px 24px 0", animationDelay: "0.06s" }}>
          <div
            style={{
              background: "#1A1A1A",
              borderRadius: 22,
              padding: "24px 20px",
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: -30,
                right: -20,
                width: 120,
                height: 120,
                borderRadius: "50%",
                border: "1px solid rgba(255,255,255,0.06)",
              }}
            />
            <div
              style={{
                position: "absolute",
                bottom: -40,
                left: -20,
                width: 100,
                height: 100,
                borderRadius: "50%",
                background: "rgba(154,136,253,0.08)",
              }}
            />
            <span
              style={{
                fontSize: 10,
                fontWeight: 700,
                color: "#9A88FD",
                background: "rgba(154,136,253,0.15)",
                padding: "4px 12px",
                borderRadius: 100,
                letterSpacing: 1,
                textTransform: "uppercase",
              }}
            >
              {typeLabel} Report
            </span>
            <h1
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: 22,
                fontWeight: 800,
                color: "#fff",
                margin: "12px 0 2px",
                letterSpacing: -0.3,
              }}
            >
              {buildingName}
            </h1>
            {unitLabel && (
              <p style={{ fontSize: 14, color: "rgba(255,255,255,0.4)", margin: 0 }}>{unitLabel}</p>
            )}
            <div style={{ marginTop: 16 }}>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 600,
                  color: status === "signed" ? "#22C55E" : "#FBBF24",
                  background: status === "signed" ? "rgba(34,197,94,0.15)" : "rgba(251,191,36,0.15)",
                  padding: "5px 14px",
                  borderRadius: 100,
                }}
              >
                {statusDisplay}
              </span>
            </div>
          </div>
        </div>

        {/* Quick Stats */}
        <div
          className={loaded ? "fade-up" : ""}
          style={{
            padding: "14px 24px 0",
            display: "flex",
            gap: 8,
            animationDelay: "0.1s",
          }}
        >
          {[
            { label: "Type", value: prop?.property_type ?? "—" },
            { label: "Date", value: formatDateShort(inspection.completed_at ?? undefined) || "—" },
            { label: "Rooms", value: `${rooms.length} inspected` },
            { label: "Photos", value: String(totalPhotos) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                flex: 1,
                background: "#fff",
                borderRadius: 14,
                padding: "12px 8px",
                textAlign: "center",
                boxShadow: "0 1px 4px rgba(0,0,0,0.03)",
              }}
            >
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: 0,
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {s.value}
              </p>
              <p style={{ fontSize: 10, color: "#BBB", margin: "3px 0 0", fontWeight: 500 }}>
                {s.label}
              </p>
            </div>
          ))}
        </div>

        {/* AI Summary */}
        {execSummary && (
          <Section
            delay="0.16s"
            loaded={loaded}
            icon={iconDoc}
            title="AI Summary"
          >
            <p style={{ fontSize: 13, color: "#666", margin: 0, lineHeight: 1.65 }}>{execSummary}</p>
          </Section>
        )}

        {/* Parties */}
        <Section delay="0.22s" loaded={loaded} icon={iconUsers} title="Parties">
          {parties.map((p, i) => (
            <div
              key={p.role}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "10px 0",
                borderBottom: i < parties.length - 1 ? "1px solid #F0EFEC" : "none",
              }}
            >
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
                    fontSize: 10,
                    fontWeight: 700,
                    color: "#fff",
                    flexShrink: 0,
                  }}
                >
                  {initials(p.name)}
                </div>
                <div style={{ minWidth: 0 }}>
                  <p
                    style={{
                      fontSize: 13,
                      fontWeight: 600,
                      color: "#1A1A1A",
                      margin: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      maxWidth: 190,
                    }}
                  >
                    {p.name ?? "—"}
                  </p>
                  <p style={{ fontSize: 11, color: "#BBB", margin: "1px 0 0" }}>
                    {p.contact ?? "—"}
                  </p>
                </div>
              </div>
              <span style={{ fontSize: 11, color: "#999", fontWeight: 500, flexShrink: 0 }}>
                {p.role}
              </span>
            </div>
          ))}
        </Section>

        {/* Contract */}
        <Section delay="0.28s" loaded={loaded} icon={iconCalendar} title="Contract">
          <div style={{ display: "flex", gap: 8 }}>
            <div
              style={{
                flex: 1,
                background: "#F8F7F4",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: "#BBB",
                  margin: 0,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Start
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: "4px 0 0",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {formatDate(contractFrom)}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                background: "#F8F7F4",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: "#BBB",
                  margin: 0,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                End
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: "4px 0 0",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {formatDate(contractTo)}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
            <div
              style={{
                flex: 1,
                background: "#F8F7F4",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: "#BBB",
                  margin: 0,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Annual Rent
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: "4px 0 0",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {tenancy?.annual_rent != null
                  ? `AED ${tenancy.annual_rent.toLocaleString("en-AE")}`
                  : "—"}
              </p>
            </div>
            <div
              style={{
                flex: 1,
                background: "#F8F7F4",
                borderRadius: 12,
                padding: 12,
              }}
            >
              <p
                style={{
                  fontSize: 10,
                  color: "#BBB",
                  margin: 0,
                  fontWeight: 500,
                  textTransform: "uppercase",
                  letterSpacing: 0.5,
                }}
              >
                Duration
              </p>
              <p
                style={{
                  fontSize: 13,
                  fontWeight: 700,
                  color: "#1A1A1A",
                  margin: "4px 0 0",
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                {durationMonths != null ? `${durationMonths} months` : "—"}
              </p>
            </div>
          </div>
        </Section>

        {/* Rooms */}
        <Section
          delay="0.34s"
          loaded={loaded}
          icon={iconRooms}
          title={`Rooms (${rooms.length} inspected)`}
        >
          {sortedRooms.map((room, i) => {
            const allPhotos = room.photos ?? [];
            const issues = allPhotos.filter(
              (p) => Array.isArray(p.damage_tags) && p.damage_tags.length > 0
            ).length;
            const photoCount = allPhotos.length;
            return (
              <div
                key={room.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "12px 14px",
                  background: "#F8F7F4",
                  borderRadius: 14,
                  marginBottom: i < sortedRooms.length - 1 ? 8 : 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      background: issues > 0 ? "#EF4444" : "#22C55E",
                    }}
                  />
                  <span style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A" }}>
                    {room.name ?? "Room"}
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: "#EEEDE9",
                      padding: "4px 10px",
                      borderRadius: 8,
                    }}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="#999"
                      strokeWidth="2"
                      strokeLinecap="round"
                    >
                      <rect x="3" y="3" width="18" height="18" rx="2" />
                      <circle cx="8.5" cy="8.5" r="1.5" />
                      <path d="M21 15l-5-5L5 21" />
                    </svg>
                    <span style={{ fontSize: 12, fontWeight: 600, color: "#666" }}>{photoCount}</span>
                  </div>
                  {issues > 0 && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 4,
                        background: "rgba(239,68,68,0.08)",
                        padding: "4px 10px",
                        borderRadius: 8,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#EF4444"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        <line x1="12" y1="9" x2="12" y2="13" />
                        <line x1="12" y1="17" x2="12.01" y2="17" />
                      </svg>
                      <span style={{ fontSize: 12, fontWeight: 600, color: "#EF4444" }}>{issues}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </Section>

        {/* Handover Keys */}
        <Section delay="0.4s" loaded={loaded} icon={iconKeys} title="Handover Keys">
          {handover.length > 0 ? (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
              {handover.map((h, i) => (
                <div
                  key={i}
                  style={{
                    flex: "1 1 calc(50% - 4px)",
                    minWidth: "calc(50% - 4px)",
                    background: "#F8F7F4",
                    borderRadius: 14,
                    padding: 14,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 500, color: "#666" }}>{h.item}</span>
                  <span
                    style={{
                      fontSize: 16,
                      fontWeight: 800,
                      color: "#1A1A1A",
                      fontFamily: "'Poppins', sans-serif",
                      background: "#fff",
                      width: 32,
                      height: 32,
                      borderRadius: 10,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {h.qty}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#BBB", margin: 0 }}>No handover items recorded</p>
          )}
        </Section>

        {/* Signatures */}
        <Section delay="0.46s" loaded={loaded} icon={iconSign} title="Signatures">
          {(["landlord", "tenant"] as const).map((type, i) => {
            const sig = signatures.find((s) => s.signer_type === type);
            const signed = !!(sig?.otp_verified ?? sig?.signed_at);
            return (
              <div
                key={type}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "10px 0",
                  borderBottom: i < 1 ? "1px solid #F0EFEC" : "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 10,
                      background: signed ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {signed ? (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#9A88FD"
                        strokeWidth="2.5"
                        strokeLinecap="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    ) : (
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#CCC"
                        strokeWidth="2"
                        strokeLinecap="round"
                      >
                        <circle cx="12" cy="12" r="10" />
                      </svg>
                    )}
                  </div>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                      {type.charAt(0).toUpperCase() + type.slice(1)}
                    </p>
                    <p style={{ fontSize: 11, color: "#BBB", margin: "1px 0 0" }}>
                      {signed && sig?.signed_at
                        ? `Signed on ${formatDate(sig.signed_at)}`
                        : "Pending signature"}
                    </p>
                  </div>
                </div>
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: signed ? "#9A88FD" : "#999",
                    background: signed ? "rgba(154,136,253,0.1)" : "#EEEDE9",
                    padding: "4px 10px",
                    borderRadius: 8,
                    textTransform: "uppercase",
                  }}
                >
                  {signed ? "Signed" : "Pending"}
                </span>
              </div>
            );
          })}
        </Section>

        {/* Hash */}
        {inspection.document_hash && (
          <div
            className={loaded ? "fade-up" : ""}
            style={{ padding: "16px 24px 0", textAlign: "center", animationDelay: "0.5s" }}
          >
            <p style={{ fontSize: 11, color: "#CCC", fontFamily: "monospace" }}>
              SHA-256: {inspection.document_hash.slice(0, 16)}...{inspection.document_hash.slice(-8)}
            </p>
          </div>
        )}

        {/* Delete (subtle) */}
        <div
          className={loaded ? "fade-up" : ""}
          style={{ padding: "12px 24px 0", animationDelay: "0.52s" }}
        >
          <DeleteInspectionButton
            inspectionId={inspection.id}
            inspectionType={(inspection.type ?? "check-in") as "check-in" | "check-out"}
            status={inspection.status}
            signatures={
              (inspection.signatures ?? []) as {
                signer_type: string;
                otp_verified: boolean;
                signed_at?: string | null;
              }[]
            }
            redirectTo={
              inspection.property_id ? `/property/${inspection.property_id}` : "/dashboard"
            }
            variant="button"
          />
        </div>
      </div>

      {/* Action Buttons — fixed bottom */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: "0 auto",
          background: "#fff",
          borderTop: "1px solid #F0EFEC",
          padding: "16px 24px",
          paddingBottom: "max(24px, env(safe-area-inset-bottom))",
          animationDelay: "0.54s",
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={downloadLoading}
          className="cta-btn"
          style={{
            background: "#9A88FD",
            color: "#fff",
            padding: "16px 0",
            borderRadius: 16,
            textAlign: "center",
            fontSize: 15,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 8,
            boxShadow: "0 4px 20px rgba(154,136,253,0.3)",
            fontFamily: "'Poppins', sans-serif",
            width: "100%",
            border: "none",
            cursor: downloadLoading ? "default" : "pointer",
            opacity: downloadLoading ? 0.8 : 1,
          }}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
            <polyline points="7 10 12 15 17 10" />
            <line x1="12" y1="15" x2="12" y2="3" />
          </svg>
          {downloadLoading ? "Generating PDF..." : "Download PDF"}
        </button>

        <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
          {bothSigned ? (
            <div
              style={{
                flex: 1,
                background: "#e8f5e9",
                color: "#2e7d32",
                padding: "13px 0",
                borderRadius: 14,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "'Poppins', sans-serif",
                cursor: "default",
              }}
            >
              <Check size={15} />
              Report Signed
            </div>
          ) : landlordSigned || tenantSigned ? (
            <button
              type="button"
              onClick={() => setShowSignModal(true)}
              className="cta-btn"
              style={{
                flex: 1,
                background: "#fff",
                border: "1.5px solid #FBBF24",
                color: "#92400E",
                padding: "13px 0",
                borderRadius: 14,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <PenLine size={15} />
              Awaiting {landlordSigned ? "Tenant" : "Landlord"}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setShowSignModal(true)}
              className="cta-btn"
              style={{
                flex: 1,
                background: "#fff",
                border: "1.5px solid #9A88FD",
                color: "#9A88FD",
                padding: "13px 0",
                borderRadius: 14,
                textAlign: "center",
                fontSize: 13,
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <PenLine size={15} />
              Send for Signature
            </button>
          )}
          <button
            type="button"
            onClick={async () => {
              const shareUrl = window.location.href;
              if (navigator.share) {
                await navigator.share({
                  title: `Inspection Report — ${buildingName}`,
                  text: unitLabel ? `Inspection report for ${unitLabel}` : "Inspection report",
                  url: shareUrl,
                });
              } else {
                await navigator.clipboard.writeText(shareUrl);
                alert("Link copied to clipboard!");
              }
            }}
            className="cta-btn"
            style={{
              flex: 1,
              background: "#fff",
              border: "1.5px solid #DDDCD8",
              color: "#666",
              padding: "13px 0",
              borderRadius: 14,
              textAlign: "center",
              fontSize: 13,
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            <LinkIcon size={15} />
            Share
          </button>
        </div>
      </div>

      {/* Send for Signature modal */}
      {showSignModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.5)",
            zIndex: 9998,
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "center",
          }}
          onClick={() => setShowSignModal(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: "20px 20px 0 0",
              width: "100%",
              maxWidth: 480,
              padding: 24,
              paddingBottom: "max(80px, env(safe-area-inset-bottom))",
              boxShadow: "0 -4px 32px rgba(0,0,0,0.15)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
              <h2
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 18,
                  fontWeight: 800,
                  color: "#1A1A1A",
                  margin: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                }}
              >
                <PenLine size={18} />
                Send for Signature
              </h2>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 18,
                  color: "#999",
                  cursor: "pointer",
                  padding: 4,
                }}
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            {/* Landlord row */}
            <div style={{ background: landlordSigned ? "#f1f8f1" : "#F8F7F4", borderRadius: 16, padding: 16, marginBottom: 12 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
                  Landlord
                </p>
                {landlordSigned && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#2e7d32",
                    background: "#e8f5e9", padding: "3px 10px", borderRadius: 100,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <Check size={11} /> Signed
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                {tenancy?.landlord_name ?? "—"}
              </p>
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0 12px" }}>
                {tenancy?.landlord_email ?? "—"}
              </p>
              {landlordSigned ? (
                <div style={{
                  width: "100%", padding: "10px 0", borderRadius: 12,
                  background: "#e8f5e9", color: "#2e7d32",
                  fontSize: 13, fontWeight: 600, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <Check size={14} />
                  Landlord signed
                  {landlordSig?.signed_at && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: "#4a8c5c" }}>
                      — {formatDate(landlordSig.signed_at)}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleSendOTP(
                      "landlord",
                      tenancy?.landlord_email ?? "",
                      tenancy?.landlord_name ?? ""
                    )
                  }
                  disabled={sent.landlord || sending}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 12,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: sent.landlord || sending ? "default" : "pointer",
                    background: sent.landlord ? "rgba(34,197,94,0.2)" : "#9A88FD",
                    color: sent.landlord ? "#166534" : "#fff",
                  }}
                >
                  {sent.landlord ? "Email Sent" : "Send via Email"}
                </button>
              )}
            </div>

            {/* Tenant row */}
            <div style={{ background: tenantSigned ? "#f1f8f1" : "#F8F7F4", borderRadius: 16, padding: 16, marginBottom: 24 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <p style={{ fontSize: 10, color: "#999", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
                  Tenant
                </p>
                {tenantSigned && (
                  <span style={{
                    fontSize: 10, fontWeight: 600, color: "#2e7d32",
                    background: "#e8f5e9", padding: "3px 10px", borderRadius: 100,
                    display: "inline-flex", alignItems: "center", gap: 4,
                  }}>
                    <Check size={11} /> Signed
                  </span>
                )}
              </div>
              <p style={{ fontSize: 14, fontWeight: 600, color: "#1A1A1A", margin: 0 }}>
                {tenancy?.tenant_name ?? "—"}
              </p>
              <p style={{ fontSize: 13, color: "#666", margin: "4px 0 12px" }}>
                {tenancy?.tenant_email ?? "—"}
              </p>
              {tenantSigned ? (
                <div style={{
                  width: "100%", padding: "10px 0", borderRadius: 12,
                  background: "#e8f5e9", color: "#2e7d32",
                  fontSize: 13, fontWeight: 600, textAlign: "center",
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                }}>
                  <Check size={14} />
                  Tenant signed
                  {tenantSig?.signed_at && (
                    <span style={{ fontWeight: 400, fontSize: 11, color: "#4a8c5c" }}>
                      — {formatDate(tenantSig.signed_at)}
                    </span>
                  )}
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() =>
                    handleSendOTP(
                      "tenant",
                      tenancy?.tenant_email ?? "",
                      tenancy?.tenant_name ?? ""
                    )
                  }
                  disabled={sent.tenant || sending}
                  style={{
                    width: "100%",
                    padding: "10px 0",
                    borderRadius: 12,
                    border: "none",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: sent.tenant || sending ? "default" : "pointer",
                    background: sent.tenant ? "rgba(34,197,94,0.2)" : "#9A88FD",
                    color: sent.tenant ? "#166534" : "#fff",
                  }}
                >
                  {sent.tenant ? "Email Sent" : "Send via Email"}
                </button>
              )}
            </div>

            {bothSigned && (
              <div
                style={{
                  background: "#e8f5e9",
                  borderRadius: 12,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 13, color: "#2e7d32", fontWeight: 600, margin: 0, display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
                  <Check size={14} />
                  Report fully signed
                </p>
              </div>
            )}
            {!bothSigned && (sent.landlord || sent.tenant) && (
              <div
                style={{
                  background: "rgba(154,136,253,0.1)",
                  borderRadius: 12,
                  padding: 12,
                  textAlign: "center",
                }}
              >
                <p style={{ fontSize: 13, color: "#9A88FD", fontWeight: 500, margin: 0 }}>
                  {sent.landlord && sent.tenant
                    ? "Both emails sent. Waiting for signatures..."
                    : `Email sent to ${sent.landlord ? "landlord" : "tenant"}. Waiting for signature...`}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
