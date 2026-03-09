"use client";

import { useState } from "react";
import Link from "next/link";
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
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : "—";

const formatCurrency = (n: number | null | undefined) =>
  n != null ? `AED ${n.toLocaleString("en-AE")}` : "—";

const getConditionStyle = (
  condition: string | null | undefined
): { backgroundColor: string; color: string } => {
  const styles: Record<string, { backgroundColor: string; color: string }> = {
    good: { backgroundColor: "#cafe8733", color: "#5a7a2e" },
    fair: { backgroundColor: "#FEDE8033", color: "#8a6a00" },
    poor: { backgroundColor: "#FF6B6B33", color: "#cc2222" },
  };
  return (
    styles[condition?.toLowerCase() ?? ""] || {
      backgroundColor: "#F3F4F6",
      color: "#6B7280",
    }
  );
};

function Avatar({
  name,
  color,
}: {
  name: string;
  color: string;
}) {
  const initials = name
    .trim()
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "?";
  return (
    <div
      className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0"
      style={{ backgroundColor: color }}
    >
      {initials}
    </div>
  );
}

function normalizeOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

export function ReportClient({ inspection, profile }: ReportClientProps) {
  const [showSignModal, setShowSignModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ landlord: false, tenant: false });
  const [sentSignUrl, setSentSignUrl] = useState<{
    landlord?: string;
    tenant?: string;
  }>({});

  const prop = normalizeOne(inspection.properties) as PropertyRelation | null;
  const tenancy = normalizeOne(inspection.tenancies) as TenancyRelation | null;
  const propertyName =
    prop?.building_name != null && prop?.unit_number != null
      ? `${prop.building_name}, Unit ${prop.unit_number}`
      : prop?.address ?? "Property";
  const rooms = (inspection.rooms ?? []) as Room[];
  const signatures = inspection.signatures ?? [];
  const isCheckIn = inspection.type === "check-in";

  const handleDownloadPDF = () => {
    if (!inspection.report_url) return;
    const a = document.createElement("a");
    a.href = inspection.report_url;
    a.download = `snagify-report-${inspection.id.slice(0, 8)}.pdf`;
    a.target = "_blank";
    a.click();
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
          propertyName,
          inspectionType: inspection.type ?? "check-in",
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSent((prev) => ({ ...prev, [signerType]: true }));
        setSentSignUrl((prev) => ({ ...prev, [signerType]: data.signUrl }));
      } else {
        alert("Error: " + (data.error ?? "Failed to send email"));
      }
    } catch {
      alert("Failed to send email");
    } finally {
      setSending(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert("Copied to clipboard");
  };

  const execSummary = inspection.report_data?.executive_summary;
  const disputeScore = inspection.report_data?.dispute_risk_score ?? 0;
  const riskLabel =
    disputeScore <= 30 ? "Low Risk" : disputeScore <= 60 ? "Medium Risk" : "High Risk";
  const riskColor =
    disputeScore <= 30 ? "#cafe87" : disputeScore <= 60 ? "#FEDE80" : "#FF6B6B";

  const contractFrom = tenancy?.contract_from;
  const contractTo = tenancy?.contract_to;
  const durationMonths =
    contractFrom && contractTo
      ? Math.round(
          (new Date(contractTo).getTime() - new Date(contractFrom).getTime()) /
            (30 * 24 * 60 * 60 * 1000)
        )
      : null;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col mx-4 gap-4 pb-32">
      {/* SECTION 1 — Hero Banner */}
      <div
        className="rounded-2xl overflow-hidden text-white p-8 text-center"
        style={{
          background: isCheckIn
            ? "linear-gradient(135deg,#9A88FD,#7B65FC)"
            : "linear-gradient(135deg,#FEDE80,#F5C842)",
        }}
      >
        <div className="text-5xl mb-2">✅</div>
        <h1
          className="text-xl font-bold mb-1"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          Report Generated!
        </h1>
        <p
          className="text-2xl font-bold mb-2"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          {propertyName}
        </p>
        <span className="inline-block px-3 py-1 rounded-full bg-white/20 text-sm font-semibold mb-2">
          {isCheckIn ? "CHECK-IN" : "CHECK-OUT"}
        </span>
        <p className="text-sm opacity-90">
          {formatDate(inspection.completed_at)}
        </p>
      </div>

      {/* SECTION 2 — AI Summary */}
      {execSummary && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2
            className="font-semibold text-gray-900 mb-3"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            📋 AI Summary
          </h2>
          <p className="text-sm text-gray-600 leading-relaxed mb-3">
            {execSummary}
          </p>
          {inspection.report_data?.dispute_risk_score != null && (
            <span
              className="inline-block px-2 py-1 rounded-full text-xs font-medium"
              style={getConditionStyle(
                disputeScore <= 30 ? "good" : disputeScore <= 60 ? "fair" : "poor"
              )}
            >
              {disputeScore <= 30 ? "Good" : disputeScore <= 60 ? "Fair" : "Poor"}{" "}
              condition
            </span>
          )}
        </div>
      )}

      {/* SECTION 3 — Dispute Risk Score */}
      {inspection.report_data?.dispute_risk_score != null && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <h2
            className="font-semibold text-gray-900 mb-3"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            ⚠️ Dispute Risk
          </h2>
          <div className="h-3 bg-gray-100 rounded-full overflow-hidden mb-2">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, disputeScore)}%`,
                backgroundColor: riskColor,
              }}
            />
          </div>
          <p className="text-sm text-gray-600">
            {disputeScore} / 100 — {riskLabel}
          </p>
        </div>
      )}

      {/* SECTION 4 — Parties */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="flex items-center gap-3 py-3 border-b border-gray-50">
          <Avatar name={tenancy?.landlord_name ?? "Landlord"} color="#9A88FD" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Landlord</p>
            <p className="text-xs text-gray-500">{tenancy?.landlord_name ?? "—"}</p>
            <p className="text-xs text-gray-500">{tenancy?.landlord_email ?? "—"}</p>
            <p className="text-xs text-gray-500">{tenancy?.landlord_phone ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 py-3 border-b border-gray-50">
          <Avatar name={tenancy?.tenant_name ?? "Tenant"} color="#FEDE80" />
          <div>
            <p className="text-sm font-semibold text-gray-900">Tenant</p>
            <p className="text-xs text-gray-500">{tenancy?.tenant_name ?? "—"}</p>
            <p className="text-xs text-gray-500">{tenancy?.tenant_email ?? "—"}</p>
            <p className="text-xs text-gray-500">{tenancy?.tenant_phone ?? "—"}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 py-3">
          <Avatar
            name={profile?.full_name ?? "Agent"}
            color="#cafe87"
          />
          <div>
            <p className="text-sm font-semibold text-gray-900">Agent</p>
            <p className="text-xs text-gray-500">{profile?.full_name ?? "—"}</p>
            <p className="text-xs text-gray-500">{profile?.agency_name ?? "—"}</p>
          </div>
        </div>
      </div>

      {/* SECTION 5 — Contract Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Ejari Ref</p>
            <p className="font-medium text-gray-900">{tenancy?.ejari_ref ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Type</p>
            <p className="font-medium text-gray-900">{tenancy?.tenancy_type ?? "—"}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">From</p>
            <p className="font-medium text-gray-900">{formatDateShort(contractFrom)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">To</p>
            <p className="font-medium text-gray-900">{formatDateShort(contractTo)}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Annual Rent</p>
            <p className="font-medium text-gray-900">
              {formatCurrency(tenancy?.annual_rent)}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Duration</p>
            <p className="font-medium text-gray-900">
              {durationMonths != null ? `${durationMonths} months` : "—"}
            </p>
          </div>
        </div>
      </div>

      {/* SECTION 6 — Rooms Inspected */}
      <div>
        <h2
          className="font-semibold text-gray-900 mb-3 px-1"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          🏠 Rooms Inspected ({rooms.length})
        </h2>
        {rooms
          .slice()
          .sort(
            (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
          )
          .map((room) => (
              <div
                key={room.id}
                className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-3"
              >
                <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                  <p
                    className="font-semibold text-gray-900"
                    style={{ fontFamily: "Poppins,sans-serif" }}
                  >
                    {room.name ?? "Room"}
                  </p>
                  <span
                    className="text-xs px-2 py-1 rounded-full font-medium"
                    style={getConditionStyle(room.overall_condition)}
                  >
                    {room.overall_condition ?? "Not assessed"}
                  </span>
                </div>
                {(room.room_items ?? []).map((item) => (
                  <div
                    key={item.id}
                    className="px-4 py-2.5 border-b border-gray-50 last:border-0"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium text-gray-800">
                        {item.name ?? "—"}
                      </p>
                      <span className="text-xs text-gray-400">
                        {item.condition ?? "—"}
                      </span>
                    </div>
                    {item.ai_description && (
                      <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                        {item.ai_description}
                      </p>
                    )}
                    {item.notes && (
                      <p className="text-xs text-[#9A88FD] mt-0.5">
                        📝 {item.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            ))}
      </div>

      {/* SECTION 7 — Legal Info */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <p className="text-xs text-gray-500 mb-1">Document Hash (SHA-256)</p>
        {inspection.document_hash ? (
          <button
            type="button"
            onClick={() => copyToClipboard(inspection.document_hash!)}
            className="font-mono text-xs text-gray-600 break-all text-left hover:underline"
          >
            {inspection.document_hash.slice(0, 24)}...
          </button>
        ) : (
          <p className="text-xs text-gray-400">—</p>
        )}
        <p className="text-xs text-gray-500 mt-3 mb-1">Report ID</p>
        <button
          type="button"
          onClick={() => copyToClipboard(inspection.id)}
          className="font-mono text-xs text-gray-600 break-all text-left hover:underline"
        >
          {inspection.id.slice(0, 8)}...
        </button>
        <p className="text-xs text-gray-500 mt-3 mb-1">Generated</p>
        <p className="text-xs text-gray-600">{formatDate(inspection.completed_at)}</p>
        <p className="text-xs text-gray-500 mt-3 mb-1">Status</p>
        <span
          className="inline-block px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700"
        >
          {inspection.status ?? "draft"}
        </span>
      </div>

      {/* SECTION 8 — Signature Status */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
        <h2
          className="font-semibold text-gray-900 mb-3"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          ✍️ Signatures
        </h2>
        {(["landlord", "tenant"] as const).map((type) => {
          const sig = signatures.find((s) => s.signer_type === type);
          return (
            <div
              key={type}
              className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm ${
                    sig?.otp_verified ? "bg-[#cafe87]" : "bg-gray-100"
                  }`}
                >
                  {sig?.otp_verified ? "✅" : "⏳"}
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 capitalize">
                    {type}
                  </p>
                  <p className="text-xs text-gray-400">
                    {sig?.otp_verified && sig.signed_at
                      ? `Signed ${formatDateShort(sig.signed_at)}`
                      : "Pending signature"}
                  </p>
                </div>
              </div>
              {!sig?.otp_verified && inspection.status !== "signed" && (
                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  className="text-xs text-[#9A88FD] font-semibold"
                >
                  Resend
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Back link */}
      <div className="text-center py-2">
        <Link
          href="/dashboard"
          className="text-sm text-[#9A88FD] font-medium"
        >
          ← Back to Dashboard
        </Link>
      </div>

      {/* BOTTOM FIXED ACTIONS BAR */}
      <div
        className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4 pb-safe flex gap-3 max-w-lg mx-auto"
        style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}
      >
        <button
          type="button"
          onClick={handleDownloadPDF}
          className="flex-1 h-12 rounded-xl font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
          style={{
            background: "linear-gradient(135deg,#9A88FD,#7B65FC)",
          }}
          disabled={!inspection.report_url}
        >
          ⬇️ Download PDF
        </button>
        {inspection.status !== "signed" && (
          <button
            type="button"
            onClick={() => setShowSignModal(true)}
            className="flex-1 h-12 rounded-xl font-semibold border-2 border-[#9A88FD] text-[#9A88FD] flex items-center justify-center gap-2"
          >
            ✍️ Sign
          </button>
        )}
        {inspection.status === "signed" && (
          <div className="flex-1 h-12 rounded-xl font-semibold bg-[#cafe87] text-gray-800 flex items-center justify-center gap-2">
            ✅ Fully Signed
          </div>
        )}
      </div>

      {/* Send for Signature modal — kept as-is */}
      {showSignModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end">
          <div className="bg-white rounded-t-3xl w-full max-w-lg mx-auto p-6">
            <div className="flex items-center justify-between mb-6">
              <h2
                className="text-lg font-bold text-gray-900"
                style={{ fontFamily: "Poppins, sans-serif" }}
              >
                ✍️ Send for Signature
              </h2>
              <button
                type="button"
                onClick={() => setShowSignModal(false)}
                className="p-2 text-gray-500 hover:text-gray-700"
                aria-label="Close"
              >
                ✕
              </button>
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-3">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Landlord
              </p>
              <p className="font-semibold text-gray-900">
                {tenancy?.landlord_name ?? "—"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {tenancy?.landlord_email ?? "—"}
              </p>
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
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  sent.landlord
                    ? "bg-[#cafe87] text-gray-800 cursor-default"
                    : "text-white active:scale-[0.98]"
                }`}
                style={
                  !sent.landlord
                    ? { background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }
                    : {}
                }
              >
                {sent.landlord ? "✓ Email Sent" : "📧 Send via Email"}
              </button>
              {sent.landlord && sentSignUrl.landlord && (
                <p className="text-xs text-gray-400 mt-2 break-all">
                  🔗 {sentSignUrl.landlord}
                </p>
              )}
            </div>

            <div className="bg-gray-50 rounded-2xl p-4 mb-6">
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">
                Tenant
              </p>
              <p className="font-semibold text-gray-900">
                {tenancy?.tenant_name ?? "—"}
              </p>
              <p className="text-sm text-gray-500 mb-3">
                {tenancy?.tenant_email ?? "—"}
              </p>
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
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  sent.tenant
                    ? "bg-[#cafe87] text-gray-800 cursor-default"
                    : "text-white active:scale-[0.98]"
                }`}
                style={
                  !sent.tenant
                    ? { background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }
                    : {}
                }
              >
                {sent.tenant ? "✓ Email Sent" : "📧 Send via Email"}
              </button>
              {sent.tenant && sentSignUrl.tenant && (
                <p className="text-xs text-gray-400 mt-2 break-all">
                  🔗 {sentSignUrl.tenant}
                </p>
              )}
            </div>

            {sent.landlord && sent.tenant && (
              <div className="bg-[#F0EDFF] rounded-xl p-3 text-center">
                <p className="text-sm text-[#9A88FD] font-medium">
                  ✅ Both emails sent! Waiting for signatures...
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
