"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PenLine, Link as LinkIcon, Check, Mail, Users } from "lucide-react";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";
import { InPersonSignModal } from "@/components/signatures/InPersonSignModal";
import {
  type InspectionWithRelations,
  type PropertyRelation,
  type TenancyRelation,
  type Room,
  type CheckinData,
} from "./page";
import { CheckoutReportView } from "@/components/inspection/CheckoutReportView";

interface ReportClientProps {
  inspection: InspectionWithRelations;
  profile: { full_name: string | null; agency_name: string | null } | null;
  checkinData?: CheckinData | null;
}

const formatDate = (d: string | null | undefined) =>
  d
    ? new Date(d).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";

function formatRelative(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days = Math.floor(diff / 86400000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

type SignatureStatus = {
  signer_type: string
  signed_at: string | null
  opened_at: string | null
  signing_mode: string | null
  sign_url: string | null
  email: string | null
  expires_at: string | null
}

function getRemoteStatus(sig?: SignatureStatus | null) {
  if (!sig) return null
  if (sig.signing_mode !== 'remote') return null
  if (sig.signed_at) return null
  if (sig.opened_at) return {
    label: 'Link opened',
    sub: `Opened ${formatRelative(sig.opened_at)}`,
    color: 'text-[#9A88FD]',
    bg: 'bg-[#EDE9FF]',
    dot: 'bg-[#9A88FD]',
  }
  return {
    label: 'Link sent',
    sub: 'Not opened yet',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
    dot: 'bg-amber-400',
  }
}

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

export function ReportClient({ inspection, profile, checkinData }: ReportClientProps) {
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
  const [inPersonModal, setInPersonModal] = useState<{
    signerType: 'landlord' | 'tenant';
    name: string;
    email: string;
  } | null>(null);
  const [signatureStatus, setSignatureStatus] = useState<SignatureStatus[]>([]);
  const [resendLoading, setResendLoading] = useState<'landlord' | 'tenant' | null>(null);
  const [resendDone, setResendDone] = useState<('landlord' | 'tenant')[]>([]);
  const inspectionId = inspection.id;

  const fetchSignatureStatus = async () => {
    const res = await fetch(`/api/signatures/status?inspectionId=${inspectionId}`)
    if (res.ok) {
      const { signatures } = await res.json()
      setSignatureStatus(signatures)
    }
  }

  const handleResend = async (signerType: 'landlord' | 'tenant') => {
    setResendLoading(signerType)
    await fetch('/api/signatures/resend-remote', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId, signerType }),
    })
    setResendLoading(null)
    setResendDone(prev => [...prev, signerType])
    fetchSignatureStatus()
  }

  useEffect(() => {
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (showSignModal) {
      fetchSignatureStatus()
      setResendDone([])
    }
  }, [showSignModal]);
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
  const landlordSigned = !!landlordSig?.signed_at;
  const tenantSigned = !!tenantSig?.signed_at;
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
  const checkinHandover = Array.isArray((inspection as { checkin_key_handover?: { item: string; qty: number }[] }).checkin_key_handover)
    ? (inspection as { checkin_key_handover: { item: string; qty: number }[] }).checkin_key_handover.filter((k) => k && typeof k.item === "string" && typeof k.qty === "number")
    : [];
  const isCheckout = (inspection.type ?? "").toLowerCase().includes("check-out");
  const keysMissingCount =
    isCheckout && checkinHandover.length > 0
      ? checkinHandover.reduce((sum, c) => sum + Math.max(0, c.qty - (handover.find((h) => h.item === c.item)?.qty ?? 0)), 0)
      : 0;
  const keysAllReturned = isCheckout && checkinHandover.length > 0 && keysMissingCount === 0;

  const handleDownloadPDF = async () => {
    if (downloadLoading) return;
    setDownloadLoading(true);

    try {
      const response = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });

      if (!response.ok) {
        let errMsg = "Failed to generate PDF";
        try {
          const errData = await response.json() as { error?: string };
          errMsg = errData.error ?? errMsg;
        } catch {}
        throw new Error(errMsg);
      }

      // Get the binary PDF blob
      const blob = await response.blob();
      if (blob.size === 0) {
        throw new Error("PDF is empty — please try again");
      }

      // Create a temporary object URL and trigger download
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `Snagify_Report_${inspectionId}.pdf`;
      link.style.display = "none";
      document.body.appendChild(link);
      link.click();

      // Cleanup after short delay
      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
      }, 1000);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      console.error("[DownloadPDF]", msg);
      alert(msg);
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

  // Check-out inspection: always render CheckoutReportView regardless of checkinData
  const isCheckoutInspection = (inspection.type ?? "").toLowerCase().includes("check-out");

  if (isCheckoutInspection) {
    const handleShare = async () => {
      const shareUrl = window.location.href;
      const p = normalizeOne(inspection.properties) as PropertyRelation | null;
      const bName = p?.building_name ?? p?.address ?? "Property";
      const uLabel = p?.unit_number ? `Unit ${p.unit_number}` : "";
      if (navigator.share) {
        await navigator.share({
          title: `Inspection Report — ${bName}`,
          text: uLabel ? `Inspection report for ${uLabel}` : "Inspection report",
          url: shareUrl,
        });
      } else {
        await navigator.clipboard.writeText(shareUrl);
        alert("Link copied to clipboard!");
      }
    };

    const handleSign = (signerType: 'landlord' | 'tenant') => {
      const ten = normalizeOne(inspection.tenancies) as TenancyRelation | null;
      setInPersonModal({
        signerType,
        name: signerType === 'landlord' ? (ten?.landlord_name || 'Landlord') : (ten?.tenant_name || 'Tenant'),
        email: signerType === 'landlord' ? (ten?.landlord_email || '') : (ten?.tenant_email || ''),
      });
    };

    return (
      <>
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&family=Poppins:wght@500;600;700;800&display=swap');
          .back-btn { transition: all 0.2s ease; cursor: pointer; }
          .back-btn:active { transform: scale(0.9); }
          .cta-btn { transition: all 0.3s cubic-bezier(0.4,0,0.2,1); cursor: pointer; }
          .cta-btn:active { transform: scale(0.97); }
        `}</style>

        {/* Back button */}
        <div className="fixed top-0 left-0 right-0 z-10 pt-safe">
          <div className="px-4 pt-5 pb-2">
            <button
              onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-white border border-gray-200 flex items-center justify-center shadow-sm back-btn"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
          </div>
        </div>

        {/* Checkout report content */}
        <div className="pt-16">
          <CheckoutReportView
            inspection={{
              ...inspection,
              property: normalizeOne(inspection.properties) as PropertyRelation | null,
              rooms: (inspection.rooms ?? []).map(r => ({
                id: r.id,
                name: r.name ?? "",
                condition: r.condition,
                photos: r.photos?.map(p => ({
                  id: p.id,
                  url: p.url ?? "",
                  damage_tags: p.damage_tags,
                  width: null,
                  height: null,
                  checkin_photo_id: p.checkin_photo_id ?? null,
                })),
              })),
            }}
            checkinData={checkinData ? {
              ...checkinData,
              rooms: checkinData.rooms?.map(r => ({
                id: r.id,
                name: r.name,
                condition: r.condition,
                photos: r.photos?.map(p => ({
                  id: p.id,
                  url: p.url,
                  damage_tags: p.damage_tags,
                  width: p.width,
                  height: p.height,
                })),
              })),
            } : null}
            tenancy={normalizeOne(inspection.tenancies) as TenancyRelation | null}
            signatures={inspection.signatures?.map(s => ({
              signer_type: s.signer_type ?? "",
              signed_at: s.signed_at,
            }))}
          />
        </div>

        {/* ── STICKY BOTTOM BAR — always rendered outside CheckoutReportView ── */}
        <div
          className="fixed bottom-0 left-0 right-0 z-20 bg-white border-t border-gray-100 px-4 pt-3"
          style={{
            paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 8px)'
          }}
        >
          {/* Download PDF */}
          <button
            onClick={handleDownloadPDF}
            disabled={downloadLoading}
            className="cta-btn w-full py-4 rounded-2xl bg-[#9A88FD] text-white font-extrabold text-[15px] flex items-center justify-center gap-2 mb-2 disabled:opacity-50"
            style={{ fontFamily: 'Poppins, sans-serif' }}
          >
            {downloadLoading ? (
              <>
                <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2.5" opacity="0.25" />
                  <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
                </svg>
                Generating…
              </>
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3"
                    stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
                Download PDF
              </>
            )}
          </button>

          {/* Signature + Share row */}
          <div className="flex gap-2">
            {/* Signature status */}
            {(() => {
              const landlordSigStatus = signatures.find(
                (s) => s.signer_type === 'landlord'
              );
              const tenantSigStatus = signatures.find(
                (s) => s.signer_type === 'tenant'
              );
              const bothSignedStatus = !!landlordSigStatus?.signed_at && !!tenantSigStatus?.signed_at;

              if (bothSignedStatus) return (
                <div className="flex-1 py-3 rounded-2xl border-2 border-green-200 bg-green-50 flex items-center justify-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  <span className="text-[13px] font-bold text-green-700">
                    Fully Signed
                  </span>
                </div>
              );

              const pendingType = !landlordSigStatus?.signed_at ? 'landlord' : 'tenant';
              const pendingLabel = !landlordSigStatus?.signed_at ? 'Awaiting Landlord' : 'Awaiting Tenant';

              return (
                <button
                  onClick={() => handleSign(pendingType)}
                  className="cta-btn flex-1 py-3 rounded-2xl border-2 border-[#D97706] flex items-center justify-center gap-2"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                      stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                  <span className="text-[13px] font-bold text-[#D97706]">
                    {pendingLabel}
                  </span>
                </button>
              );
            })()}

            {/* Share */}
            <button
              onClick={handleShare}
              className="cta-btn flex-1 py-3 rounded-2xl border border-gray-200 bg-white flex items-center justify-center gap-2"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="18" cy="5" r="3" stroke="#6B7280" strokeWidth="1.8"/>
                <circle cx="6" cy="12" r="3" stroke="#6B7280" strokeWidth="1.8"/>
                <circle cx="18" cy="19" r="3" stroke="#6B7280" strokeWidth="1.8"/>
                <path d="M8.59 13.51l6.83 3.98M15.41 6.51l-6.82 3.98"
                  stroke="#6B7280" strokeWidth="1.8" strokeLinecap="round"/>
              </svg>
              <span className="text-[13px] font-semibold text-[#6B7280]">Share</span>
            </button>
          </div>
        </div>

        {/* In Person Sign Modal */}
        {inPersonModal && (
          <InPersonSignModal
            inspectionId={inspection.id}
            signerType={inPersonModal.signerType}
            signerName={inPersonModal.name}
            signerEmail={inPersonModal.email}
            onSuccess={() => {
              setInPersonModal(null);
              router.refresh();
            }}
            onClose={() => setInPersonModal(null)}
          />
        )}
      </>
    );
  }

  return (
    <div
      style={{
        maxWidth: 480,
        margin: "0 auto",
        minHeight: "100vh",
        background: "#F8F7F4",
        fontFamily: "'DM Sans', sans-serif",
        position: "relative",
        paddingBottom: 260,
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
            { label: "Rooms", value: String(rooms.length) },
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

        {/* Keys status (check-out only) */}
        {isCheckout && handover.length > 0 && (
          <div
            className={loaded ? "fade-up" : ""}
            style={{
              padding: "14px 24px 0",
              animationDelay: "0.12s",
            }}
          >
            <div
              style={{
                background: keysAllReturned ? "#dcfce7" : "#fff7ed",
                border: `1px solid ${keysAllReturned ? "rgba(34,197,94,0.3)" : "rgba(230,81,0,0.3)"}`,
                borderRadius: 14,
                padding: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
              }}
            >
              <span style={{ fontSize: 20 }}>🔑</span>
              <p
                style={{
                  margin: 0,
                  fontSize: 13,
                  fontWeight: 700,
                  color: keysAllReturned ? "#166534" : "#c2410c",
                }}
              >
                {keysAllReturned
                  ? "All keys returned"
                  : `${keysMissingCount} key(s) missing — recorded in report`}
              </p>
            </div>
          </div>
        )}

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
          title={`Rooms (${rooms.length})`}
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
            const signed = !!sig?.signed_at;
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

      {/* Action Buttons — fixed above bottom navbar */}
      <div
        className={loaded ? "fade-up" : ""}
        style={{
          position: "fixed",
          bottom: 72,
          left: 0,
          right: 0,
          maxWidth: 480,
          margin: "0 auto",
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderTop: "1px solid #F0EFEC",
          padding: "12px 24px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          animationDelay: "0.54s",
          zIndex: 40,
          borderRadius: "16px 16px 0 0",
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
            cursor: downloadLoading ? "not-allowed" : "pointer",
            opacity: downloadLoading ? 0.7 : 1,
          }}
        >
          {downloadLoading ? "Generating…" : "Download PDF"}
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
              {(() => {
                const landlordStatusSig = signatureStatus.find(s => s.signer_type === 'landlord')
                const landlordRemoteStatus = getRemoteStatus(landlordStatusSig)
                
                if (landlordSigned) {
                  return (
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
                  )
                }
                
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Remote option */}
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
                          flex: 1,
                          padding: "12px 8px",
                          borderRadius: 12,
                          border: "2px solid transparent",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: sent.landlord || sending ? "default" : "pointer",
                          background: sent.landlord ? "rgba(34,197,94,0.15)" : "#F3F3F8",
                          color: sent.landlord ? "#166534" : "#6B7280",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Mail size={16} color={sent.landlord ? "#166534" : "#6B7280"} />
                        <span>{sent.landlord ? "Sent!" : "Remote"}</span>
                        <span style={{ fontSize: 9, color: sent.landlord ? "#166534" : "#9CA3AF", fontWeight: 400 }}>
                          Link by email
                        </span>
                      </button>
                      {/* In person option */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowSignModal(false);
                          setTimeout(() => {
                            setInPersonModal({
                              signerType: 'landlord',
                              name: tenancy?.landlord_name || 'Landlord',
                              email: tenancy?.landlord_email || '',
                            });
                          }, 200);
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 8px",
                          borderRadius: 12,
                          border: "2px solid rgba(154,136,253,0.3)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          background: "#EDE9FF",
                          color: "#9A88FD",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Users size={16} color="#9A88FD" />
                        <span>In person</span>
                        <span style={{ fontSize: 9, color: "rgba(154,136,253,0.6)", fontWeight: 400 }}>
                          Sign on this device
                        </span>
                      </button>
                    </div>

                    {/* Status indicator for remote */}
                    {landlordRemoteStatus && (
                      <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl ${landlordRemoteStatus.bg}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${landlordRemoteStatus.dot}`} />
                        <div>
                          <div className={`text-[11px] font-semibold ${landlordRemoteStatus.color}`}>
                            {landlordRemoteStatus.label}
                          </div>
                          <div className="text-[10px] text-gray-400">{landlordRemoteStatus.sub}</div>
                        </div>
                      </div>
                    )}

                    {/* Resend button */}
                    {landlordStatusSig?.signing_mode === 'remote' && !landlordStatusSig?.signed_at && (
                      <button
                        onClick={() => handleResend('landlord')}
                        disabled={resendLoading === 'landlord'}
                        className="flex items-center gap-2 text-[12px] font-semibold text-[#9A88FD] mt-2 mx-auto disabled:opacity-50"
                        style={{ background: 'none', border: 'none', cursor: resendLoading === 'landlord' ? 'default' : 'pointer' }}
                      >
                        {resendLoading === 'landlord' ? (
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#9A88FD" strokeWidth="2" opacity="0.25"/>
                            <path d="M12 2a10 10 0 0110 10" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        ) : resendDone.includes('landlord') ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M23 3l-9.5 9.5M23 3H16M23 3v7" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {resendDone.includes('landlord') ? 'Reminder sent!' : 'Resend link'}
                      </button>
                    )}
                  </div>
                )
              })()}
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
              {(() => {
                const tenantStatusSig = signatureStatus.find(s => s.signer_type === 'tenant')
                const tenantRemoteStatus = getRemoteStatus(tenantStatusSig)
                
                if (tenantSigned) {
                  return (
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
                  )
                }
                
                return (
                  <div>
                    <div style={{ display: "flex", gap: 8 }}>
                      {/* Remote option */}
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
                          flex: 1,
                          padding: "12px 8px",
                          borderRadius: 12,
                          border: "2px solid transparent",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: sent.tenant || sending ? "default" : "pointer",
                          background: sent.tenant ? "rgba(34,197,94,0.15)" : "#F3F3F8",
                          color: sent.tenant ? "#166534" : "#6B7280",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Mail size={16} color={sent.tenant ? "#166534" : "#6B7280"} />
                        <span>{sent.tenant ? "Sent!" : "Remote"}</span>
                        <span style={{ fontSize: 9, color: sent.tenant ? "#166534" : "#9CA3AF", fontWeight: 400 }}>
                          Link by email
                        </span>
                      </button>
                      {/* In person option */}
                      <button
                        type="button"
                        onClick={() => {
                          setShowSignModal(false);
                          setTimeout(() => {
                            setInPersonModal({
                              signerType: 'tenant',
                              name: tenancy?.tenant_name || 'Tenant',
                              email: tenancy?.tenant_email || '',
                            });
                          }, 200);
                        }}
                        style={{
                          flex: 1,
                          padding: "12px 8px",
                          borderRadius: 12,
                          border: "2px solid rgba(154,136,253,0.3)",
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          background: "#EDE9FF",
                          color: "#9A88FD",
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Users size={16} color="#9A88FD" />
                        <span>In person</span>
                        <span style={{ fontSize: 9, color: "rgba(154,136,253,0.6)", fontWeight: 400 }}>
                          Sign on this device
                        </span>
                      </button>
                    </div>

                    {/* Status indicator for remote */}
                    {tenantRemoteStatus && (
                      <div className={`flex items-center gap-2 mt-2 px-3 py-2 rounded-xl ${tenantRemoteStatus.bg}`}>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 ${tenantRemoteStatus.dot}`} />
                        <div>
                          <div className={`text-[11px] font-semibold ${tenantRemoteStatus.color}`}>
                            {tenantRemoteStatus.label}
                          </div>
                          <div className="text-[10px] text-gray-400">{tenantRemoteStatus.sub}</div>
                        </div>
                      </div>
                    )}

                    {/* Resend button */}
                    {tenantStatusSig?.signing_mode === 'remote' && !tenantStatusSig?.signed_at && (
                      <button
                        onClick={() => handleResend('tenant')}
                        disabled={resendLoading === 'tenant'}
                        className="flex items-center gap-2 text-[12px] font-semibold text-[#9A88FD] mt-2 mx-auto disabled:opacity-50"
                        style={{ background: 'none', border: 'none', cursor: resendLoading === 'tenant' ? 'default' : 'pointer' }}
                      >
                        {resendLoading === 'tenant' ? (
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="#9A88FD" strokeWidth="2" opacity="0.25"/>
                            <path d="M12 2a10 10 0 0110 10" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        ) : resendDone.includes('tenant') ? (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M20 6L9 17l-5-5" stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        ) : (
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <path d="M23 3l-9.5 9.5M23 3H16M23 3v7" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        )}
                        {resendDone.includes('tenant') ? 'Reminder sent!' : 'Resend link'}
                      </button>
                    )}
                  </div>
                )
              })()}
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

      {/* In-person signing modal */}
      {inPersonModal && (
        <InPersonSignModal
          inspectionId={inspectionId}
          signerType={inPersonModal.signerType}
          signerName={inPersonModal.name}
          signerEmail={inPersonModal.email}
          onSuccess={() => {
            setInPersonModal(null);
            router.refresh();
          }}
          onClose={() => setInPersonModal(null)}
        />
      )}
    </div>
  );
}
