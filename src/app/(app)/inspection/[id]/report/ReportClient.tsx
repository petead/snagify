"use client";

import { useState } from "react";
import Link from "next/link";
import { Download, Share2, PenTool, ArrowLeft, CheckCircle } from "lucide-react";

interface ReportClientProps {
  inspectionId: string;
  inspection: {
    type: string;
    status: string;
    completedAt?: string | null;
    reportUrl?: string | null;
    documentHash?: string | null;
    ejariRef?: string | null;
    contractFrom?: string | null;
    contractTo?: string | null;
  };
  tenancy?: {
    landlordName: string | null;
    landlordPhone: string | null;
    landlordEmail: string | null;
    tenantName: string | null;
    tenantPhone: string | null;
    tenantEmail: string | null;
  };
  property: {
    address: string;
    type?: string | null;
  };
  overallCondition: string;
  roomCount: number;
}

function conditionStyle(cond: string) {
  const c = cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase();
  if (c === "Good") return { bg: "bg-[#cafe87]", text: "text-brand-dark" };
  if (c === "Fair") return { bg: "bg-[#FEDE80]", text: "text-brand-dark" };
  return { bg: "bg-[#FFD5D5]", text: "text-red-800" };
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return dateStr;
  }
}

export function ReportClient({
  inspectionId,
  inspection,
  tenancy,
  property,
  overallCondition,
  roomCount,
}: ReportClientProps) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState({ landlord: false, tenant: false });
  const [sentSignUrl, setSentSignUrl] = useState<{ landlord?: string; tenant?: string }>({});
  const [showSignModal, setShowSignModal] = useState(false);

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
          inspectionId,
          signerType,
          signerName: signerName || "there",
          propertyName: property.address,
          inspectionType: inspection.type,
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

  const cs = conditionStyle(overallCondition);
  const inspType = (inspection.type ?? "check-in").toUpperCase().replace("-", "‑");

  const handleDownload = () => {
    if (!inspection.reportUrl) return;
    const a = document.createElement("a");
    a.href = inspection.reportUrl;
    a.download = `snagify-report-${inspectionId.slice(0, 8)}.pdf`;
    a.target = "_blank";
    a.click();
  };

  const handleShare = async () => {
    const shareData = {
      title: "Snagify Inspection Report",
      text: `Property inspection report for ${property.address}`,
      url: inspection.reportUrl ?? window.location.href,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        /* user cancelled */
      }
    } else {
      await navigator.clipboard.writeText(shareData.url);
      alert("Report link copied to clipboard!");
    }
  };

  return (
    <div className="min-h-screen bg-[#fcfcfc] max-w-[480px] mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft size={24} />
          </Link>
          <span className="font-heading font-bold text-sm text-brand-dark">
            Report
          </span>
          <div className="w-10" />
        </div>
      </header>

      <div className="px-4 py-6 space-y-5">
        {/* Success banner */}
        <div className="bg-[#cafe87] rounded-2xl p-5 text-center">
          <CheckCircle size={40} className="mx-auto text-brand-dark mb-2" />
          <h2 className="font-heading font-bold text-xl text-brand-dark">
            Report Generated!
          </h2>
          <p className="font-body text-sm text-brand-dark/70 mt-1">
            Your inspection report is ready
          </p>
        </div>

        {/* Property info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h3 className="font-heading font-bold text-lg text-brand-dark">
                {property.address}
              </h3>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F0EDFF] text-[#9A88FD] font-heading font-bold text-xs">
              {inspType}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {inspection.ejariRef && (
              <div>
                <p className="font-body text-xs text-gray-400 mb-1">Ejari Ref</p>
                <p className="font-body text-sm text-brand-dark">{inspection.ejariRef}</p>
              </div>
            )}
            {(inspection.contractFrom || inspection.contractTo) && (
              <div>
                <p className="font-body text-xs text-gray-400 mb-1">Contract</p>
                <p className="font-body text-sm text-brand-dark">
                  {[inspection.contractFrom, inspection.contractTo].filter(Boolean).map(formatDate).join(" – ")}
                </p>
              </div>
            )}
            <div>
              <p className="font-body text-xs text-gray-400 mb-1">Overall Condition</p>
              <span className={`inline-block px-3 py-1 rounded-full font-heading font-bold text-sm ${cs.bg} ${cs.text}`}>
                {overallCondition}
              </span>
            </div>
            <div>
              <p className="font-body text-xs text-gray-400 mb-1">Rooms Inspected</p>
              <p className="font-heading font-bold text-lg text-brand-dark">{roomCount}</p>
            </div>
            <div>
              <p className="font-body text-xs text-gray-400 mb-1">Completed</p>
              <p className="font-body text-sm text-brand-dark">{formatDate(inspection.completedAt)}</p>
            </div>
            {property.type && (
              <div>
                <p className="font-body text-xs text-gray-400 mb-1">Property Type</p>
                <p className="font-body text-sm text-brand-dark">{property.type}</p>
              </div>
            )}
          </div>

          {inspection.documentHash && (
            <div className="mt-4 pt-3 border-t border-gray-100">
              <p className="font-body text-xs text-gray-400 mb-1">Document Hash (SHA-256)</p>
              <p className="font-mono text-xs text-gray-500 break-all">
                {inspection.documentHash.slice(0, 32)}...
              </p>
            </div>
          )}
        </div>

        {/* Action buttons */}
        <div className="space-y-3">
          <button
            type="button"
            onClick={handleDownload}
            disabled={!inspection.reportUrl}
            className="w-full h-14 rounded-2xl bg-[#9A88FD] text-white font-heading font-bold text-base flex items-center justify-center gap-3 disabled:opacity-50"
          >
            <Download size={20} />
            Download PDF
          </button>

          <button
            type="button"
            onClick={() => setShowSignModal(true)}
            className="w-full h-14 rounded-2xl bg-[#F0EDFF] text-[#9A88FD] font-heading font-bold text-base flex items-center justify-center gap-3"
          >
            <PenTool size={20} />
            Send for Signature
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="w-full h-14 rounded-2xl border-2 border-gray-200 text-brand-dark font-heading font-bold text-base flex items-center justify-center gap-3"
          >
            <Share2 size={20} />
            Share Report
          </button>
        </div>

        {/* Back to dashboard */}
        <div className="text-center pt-2">
          <Link
            href="/dashboard"
            className="font-body text-sm text-[#9A88FD] font-medium"
          >
            ← Back to Dashboard
          </Link>
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
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Landlord</p>
              <p className="font-semibold text-gray-900">{tenancy?.landlordName ?? "—"}</p>
              <p className="text-sm text-gray-500 mb-3">{tenancy?.landlordEmail ?? "—"}</p>
              <button
                type="button"
                onClick={() =>
                  handleSendOTP(
                    "landlord",
                    tenancy?.landlordEmail ?? "",
                    tenancy?.landlordName ?? ""
                  )
                }
                disabled={sent.landlord || sending}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  sent.landlord
                    ? "bg-[#cafe87] text-gray-800 cursor-default"
                    : "text-white active:scale-[0.98]"
                }`}
                style={!sent.landlord ? { background: "linear-gradient(135deg,#9A88FD,#7B65FC)" } : {}}
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
              <p className="text-xs uppercase tracking-wider text-gray-400 mb-2">Tenant</p>
              <p className="font-semibold text-gray-900">{tenancy?.tenantName ?? "—"}</p>
              <p className="text-sm text-gray-500 mb-3">{tenancy?.tenantEmail ?? "—"}</p>
              <button
                type="button"
                onClick={() =>
                  handleSendOTP(
                    "tenant",
                    tenancy?.tenantEmail ?? "",
                    tenancy?.tenantName ?? ""
                  )
                }
                disabled={sent.tenant || sending}
                className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  sent.tenant
                    ? "bg-[#cafe87] text-gray-800 cursor-default"
                    : "text-white active:scale-[0.98]"
                }`}
                style={!sent.tenant ? { background: "linear-gradient(135deg,#9A88FD,#7B65FC)" } : {}}
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
