"use client";

import { useState } from "react";
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

const conditionDot = (c: string | null | undefined) =>
  ({ good: "🟢", fair: "🟡", poor: "🔴" } as Record<string, string>)[
    c?.toLowerCase() ?? ""
  ] || "⚪";

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

function safeFilename(str: string | null | undefined): string {
  return (str ?? "")
    .replace(/\s+/g, "_")
    .replace(/[^a-zA-Z0-9_-]/g, "")
    || "report";
}

export function ReportClient({ inspection, profile }: ReportClientProps) {
  const [showSignModal, setShowSignModal] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ landlord: false, tenant: false });
  const [sentSignUrl, setSentSignUrl] = useState<{
    landlord?: string;
    tenant?: string;
  }>({});
  const [downloadLoading, setDownloadLoading] = useState(false);

  const prop = normalizeOne(inspection.properties) as PropertyRelation | null;
  const tenancy = normalizeOne(inspection.tenancies) as TenancyRelation | null;
  const buildingName = prop?.building_name ?? prop?.address ?? "Property";
  const unitNumber = prop?.unit_number;
  const propertyName = unitNumber
    ? `${buildingName}, Unit ${unitNumber}`
    : buildingName;
  const rooms = (inspection.rooms ?? []) as Room[];
  const signatures = inspection.signatures ?? [];
  const isCheckIn = inspection.type === "check-in";
  const status = inspection.status ?? "draft";

  const roomConditions = rooms
    .map((r) => r.overall_condition)
    .filter(Boolean) as string[];
  const poorCount = roomConditions.filter((c) => c === "poor").length;
  const fairCount = roomConditions.filter((c) => c === "fair").length;
  const overallCondition =
    poorCount > 0
      ? "Poor"
      : fairCount > roomConditions.length / 2
        ? "Fair"
        : "Good";

  const execSummary = inspection.report_data?.executive_summary;
  const disputeScore = inspection.report_data?.dispute_risk_score;
  const riskLabel =
    (disputeScore ?? 0) <= 30
      ? "Low Risk"
      : (disputeScore ?? 0) <= 60
        ? "Medium Risk"
        : "High Risk";
  const riskColor =
    (disputeScore ?? 0) <= 30
      ? "#5a7a2e"
      : (disputeScore ?? 0) <= 60
        ? "#8a6a00"
        : "#cc2222";

  const contractFrom = tenancy?.contract_from;
  const contractTo = tenancy?.contract_to;
  const durationMonths =
    contractFrom && contractTo
      ? Math.round(
          (new Date(contractTo).getTime() -
            new Date(contractFrom).getTime()) /
            (1000 * 60 * 60 * 24 * 30)
        )
      : null;

  const metrics = [
    { icon: "🏠", label: "Type", value: prop?.property_type ?? "—" },
    {
      icon: "📅",
      label: "Date",
      value: inspection.completed_at
        ? new Date(inspection.completed_at).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
          })
        : "—",
    },
    { icon: "🛏️", label: "Rooms", value: `${rooms.length} inspected` },
    { icon: "⭐", label: "Condition", value: overallCondition },
  ];

  const parties = [
    {
      role: "Landlord",
      name: tenancy?.landlord_name,
      contact: tenancy?.landlord_phone || tenancy?.landlord_email,
      color: "#9A88FD",
    },
    {
      role: "Tenant",
      name: tenancy?.tenant_name,
      contact: tenancy?.tenant_phone || tenancy?.tenant_email,
      color: "#FEDE80",
    },
    {
      role: "Agent",
      name: profile?.full_name,
      contact: profile?.agency_name,
      color: "#cafe87",
    },
  ];

  const handleDownloadPDF = async () => {
    setDownloadLoading(true);
    const downloadName = `Snagify_${inspection.type ?? "check-in"}_${safeFilename(prop?.building_name)}_Unit${safeFilename(prop?.unit_number)}.pdf`;
    try {
      const res = await fetch("/api/generate-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId: inspection.id }),
      });

      if (!res.ok) throw new Error("PDF generation failed");

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error("PDF error:", err);
      alert("Could not generate PDF. Please try again.");
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

  return (
    <div className="min-h-screen bg-gray-50 pb-52">
      {/* SECTION 1 — Hero Banner */}
      <div
        className="rounded-b-3xl overflow-hidden"
        style={{
          background: isCheckIn
            ? "linear-gradient(135deg,#9A88FD,#7B65FC)"
            : "linear-gradient(135deg,#FEDE80,#F5C842)",
        }}
      >
        <div className="px-6 py-8 text-center">
          <span
            className="inline-block px-3 py-1 rounded-full text-xs font-bold mb-4"
            style={{
              backgroundColor: "rgba(255,255,255,0.25)",
              color: "white",
            }}
          >
            {isCheckIn ? "🔑 CHECK-IN" : "🚪 CHECK-OUT"} REPORT
          </span>

          <h1
            className="text-2xl font-extrabold text-white mb-1"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            {buildingName}
          </h1>
          {unitNumber && (
            <p className="text-white/80 text-base mb-4">Unit {unitNumber}</p>
          )}

          <span
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-semibold"
            style={{
              backgroundColor: "rgba(255,255,255,0.2)",
              color: "white",
            }}
          >
            {status === "signed"
              ? "✅ Fully Signed"
              : status === "completed"
                ? "📄 Awaiting Signatures"
                : "🔄 In Progress"}
          </span>
        </div>
      </div>

      {/* SECTION 2 — Key Metrics */}
      <div className="flex gap-3 px-4 py-4 overflow-x-auto">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex-shrink-0 min-w-[100px] text-center"
          >
            <p className="text-xl mb-1">{m.icon}</p>
            <p className="text-sm font-bold text-gray-900">{m.value}</p>
            <p className="text-xs text-gray-400">{m.label}</p>
          </div>
        ))}
      </div>

      {/* SECTION 3 — AI Summary */}
      {execSummary && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-50">
            <span className="text-base">📋</span>
            <p
              className="font-bold text-gray-900 text-sm"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              AI Summary
            </p>
          </div>
          <div className="px-4 py-3">
            <p className="text-sm text-gray-600 leading-relaxed">
              {execSummary}
            </p>
          </div>
        </div>
      )}

      {/* SECTION 4 — Dispute Risk */}
      {disputeScore != null && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-4 mb-4 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span>⚠️</span>
              <p
                className="font-bold text-gray-900 text-sm"
                style={{ fontFamily: "Poppins,sans-serif" }}
              >
                Dispute Risk
              </p>
            </div>
            <span
              className="text-xs font-bold px-2 py-1 rounded-full"
              style={{
                backgroundColor: riskColor + "33",
                color: riskColor,
              }}
            >
              {riskLabel}
            </span>
          </div>
          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.min(100, disputeScore)}%`,
                backgroundColor: riskColor,
              }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-xs text-gray-400">Low</span>
            <span
              className="text-xs font-semibold"
              style={{ color: riskColor }}
            >
              {disputeScore}/100
            </span>
            <span className="text-xs text-gray-400">High</span>
          </div>
        </div>
      )}

      {/* SECTION 5 — Parties */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p
            className="font-bold text-gray-900 text-sm"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            👥 Parties
          </p>
        </div>
        {parties.map((party, i, arr) => (
          <div
            key={party.role}
            className={`flex items-center gap-3 px-4 py-3 ${
              i < arr.length - 1 ? "border-b border-gray-50" : ""
            }`}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
              style={{ backgroundColor: party.color + "CC" }}
            >
              {initials(party.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-gray-900 truncate">
                {party.name ?? "—"}
              </p>
              <p className="text-xs text-gray-400 truncate">
                {party.contact ?? "—"}
              </p>
            </div>
            <span className="text-xs text-gray-400 flex-shrink-0">
              {party.role}
            </span>
          </div>
        ))}
      </div>

      {/* SECTION 6 — Contract */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-4 mb-4 p-4">
        <p
          className="font-bold text-gray-900 text-sm mb-3"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          📄 Contract
        </p>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Start", value: formatDate(contractFrom) },
            { label: "End", value: formatDate(contractTo) },
            {
              label: "Annual Rent",
              value:
                tenancy?.annual_rent != null
                  ? `AED ${tenancy.annual_rent.toLocaleString()}`
                  : "—",
            },
            {
              label: "Duration",
              value:
                durationMonths != null ? `${durationMonths} months` : "—",
            },
          ].map((item) => (
            <div key={item.label} className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-400 mb-0.5">{item.label}</p>
              <p className="text-sm font-semibold text-gray-900">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 7 — Rooms */}
      <div className="mx-4 mb-4">
        <p
          className="font-bold text-gray-900 text-sm mb-3"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          🏠 Rooms ({rooms.length} inspected)
        </p>
        {rooms
          .slice()
          .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
          .map((room) => (
            <div
              key={room.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 mb-3 overflow-hidden"
            >
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
                <p
                  className="font-semibold text-gray-900 text-sm"
                  style={{ fontFamily: "Poppins,sans-serif" }}
                >
                  {room.name ?? "Room"}
                </p>
                <span
                  className="text-xs px-2 py-1 rounded-full font-medium capitalize"
                  style={getConditionStyle(room.overall_condition)}
                >
                  {room.overall_condition ?? "Not set"}
                </span>
              </div>
              {(room.room_items ?? []).length > 0 && (
                <div className="divide-y divide-gray-50">
                  {(room.room_items ?? []).map((item) => (
                    <div key={item.id} className="px-4 py-2.5">
                      <div className="flex items-start gap-2">
                        <span className="text-sm mt-0.5 flex-shrink-0">
                          {conditionDot(item.condition)}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800">
                            {item.name ?? "—"}
                          </p>
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
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      {/* SECTION 8 — Signatures */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 mx-4 mb-4 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-50">
          <p
            className="font-bold text-gray-900 text-sm"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            ✍️ Signatures
          </p>
        </div>
        {(["landlord", "tenant"] as const).map((type, i) => {
          const sig = signatures.find((s) => s.signer_type === type);
          return (
            <div
              key={type}
              className={`flex items-center gap-3 px-4 py-3 ${
                i === 0 ? "border-b border-gray-50" : ""
              }`}
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0 ${
                  sig?.otp_verified ? "bg-[#cafe87]" : "bg-gray-100"
                }`}
              >
                {sig?.otp_verified ? "✅" : "⏳"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-gray-900 capitalize">
                  {type}
                </p>
                <p className="text-xs text-gray-400">
                  {sig?.otp_verified && sig.signed_at
                    ? `Signed on ${formatDate(sig.signed_at)}`
                    : "Pending signature"}
                </p>
              </div>
              {!sig?.otp_verified && (
                <button
                  type="button"
                  onClick={() => setShowSignModal(true)}
                  className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                  style={{
                    backgroundColor: "#F0EDFF",
                    color: "#9A88FD",
                  }}
                >
                  Send
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* SECTION 9 — Legal Footer */}
      <div className="mx-4 mb-4 px-4 py-3 bg-gray-50 rounded-2xl">
        {inspection.document_hash && (
          <p className="text-xs text-gray-400 text-center">
            Document SHA-256: {inspection.document_hash.slice(0, 16)}...
            {inspection.document_hash.slice(-8)}
          </p>
        )}
        <p className="text-xs text-gray-300 text-center mt-1">
          Generated by Snagify • snagify.net
        </p>
      </div>

      {/* DANGER ZONE */}
      <div
        style={{
          margin: "32px 16px 16px",
          padding: 16,
          borderRadius: 16,
          border: "1px solid #fee2e2",
          background: "#fff5f5",
        }}
      >
        <p
          style={{
            fontSize: 11,
            fontWeight: 700,
            color: "#ef4444",
            textTransform: "uppercase",
            letterSpacing: 1,
            marginBottom: 12,
          }}
        >
          Danger Zone
        </p>
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
          redirectTo={inspection.property_id ? `/property/${inspection.property_id}` : "/dashboard"}
          variant="button"
        />
      </div>

      {/* BOTTOM FIXED ACTIONS BAR */}
      <div
        className="fixed bottom-16 left-0 right-0 bg-white border-t border-gray-100 px-4 pt-3 max-w-lg mx-auto"
        style={{ paddingBottom: "max(24px, env(safe-area-inset-bottom))" }}
      >
        {/* Row 1 — Download PDF (full width) */}
        <button
          type="button"
          onClick={handleDownloadPDF}
          disabled={downloadLoading}
          className="w-full h-12 rounded-2xl font-semibold text-white flex items-center justify-center gap-2 mb-3 disabled:opacity-70"
          style={{
            background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
            fontFamily: "Poppins, sans-serif",
            opacity: 1,
            cursor: downloadLoading ? "default" : "pointer",
          }}
        >
          {downloadLoading ? "⏳ Generating PDF..." : "⬇️ Download PDF"}
        </button>

        {/* Row 2 — Sign + Share */}
        <div className="flex gap-3">
          {status === "signed" ? (
            <div
              className="flex-1 h-12 rounded-2xl font-semibold bg-[#cafe87] text-gray-800 flex items-center justify-center gap-2 text-sm"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              ✅ Fully Signed
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowSignModal(true)}
              className="flex-1 h-12 rounded-2xl font-semibold border-2 border-[#9A88FD] text-[#9A88FD] flex items-center justify-center gap-2 text-sm active:bg-[#F0EDFF] transition-colors"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              ✍️ Send for Signature
            </button>
          )}

          <button
            type="button"
            onClick={async () => {
              const shareUrl = window.location.href;
              if (navigator.share) {
                await navigator.share({
                  title: `Inspection Report — ${prop?.building_name ?? "Property"}`,
                  text: `Inspection report for Unit ${prop?.unit_number ?? ""}`,
                  url: shareUrl,
                });
              } else {
                await navigator.clipboard.writeText(shareUrl);
                alert("Link copied to clipboard!");
              }
            }}
            className="flex-1 h-12 rounded-2xl font-semibold border-2 border-gray-200 text-gray-600 flex items-center justify-center gap-2 text-sm active:bg-gray-50 transition-colors"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            🔗 Share
          </button>
        </div>
      </div>

      {/* Send for Signature modal */}
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
                    ? {
                        background:
                          "linear-gradient(135deg,#9A88FD,#7B65FC)",
                      }
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
                    ? {
                        background:
                          "linear-gradient(135deg,#9A88FD,#7B65FC)",
                      }
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
