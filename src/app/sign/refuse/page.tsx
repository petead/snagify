"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

function RefusePageContent() {
  const params = useSearchParams();
  const token = params.get("token");
  const inspectionId = params.get("inspectionId");
  const signerType = params.get("signerType");
  const email = params.get("email");

  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const backToSign =
    inspectionId && signerType && email
      ? `/sign?inspectionId=${encodeURIComponent(inspectionId)}&signerType=${encodeURIComponent(signerType)}&email=${encodeURIComponent(email)}`
      : null;

  const handleRefuse = async () => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/signatures/refuse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, reason }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Request failed");
      setDone(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F7F4",
          padding: 24,
        }}
      >
        <div
          style={{
            background: "white",
            borderRadius: 24,
            padding: 32,
            maxWidth: 380,
            width: "100%",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: 64,
              height: 64,
              borderRadius: 20,
              background: "#FEF3C7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 20px",
            }}
          >
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#F59E0B"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <h2
            style={{
              fontFamily: "Poppins,sans-serif",
              fontSize: 20,
              fontWeight: 800,
              color: "#1A1A1A",
              margin: "0 0 12px",
            }}
          >
            Refusal recorded
          </h2>
          <p
            style={{
              fontSize: 14,
              color: "#6B7280",
              lineHeight: 1.6,
              margin: "0 0 16px",
            }}
          >
            Your refusal has been documented. All parties have been notified and will receive the
            report with your refusal noted.
          </p>
          <p
            style={{ fontSize: 12, color: "#9B9BA8", lineHeight: 1.5, margin: 0 }}
          >
            This report remains legally valid and can be submitted to the RERA Dispute Centre.
          </p>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#F8F7F4",
          padding: 24,
        }}
      >
        <p style={{ color: "#6B7280", fontSize: 14 }}>Missing or invalid link.</p>
      </div>
    );
  }

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#F8F7F4",
        padding: 24,
      }}
    >
      <div
        style={{
          background: "white",
          borderRadius: 24,
          padding: 32,
          maxWidth: 380,
          width: "100%",
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 16,
            background: "rgba(239,68,68,0.1)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 0 20px",
          }}
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#EF4444"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="15" y1="9" x2="9" y2="15" />
            <line x1="9" y1="9" x2="15" y2="15" />
          </svg>
        </div>

        <h2
          style={{
            fontFamily: "Poppins,sans-serif",
            fontSize: 20,
            fontWeight: 800,
            color: "#1A1A1A",
            margin: "0 0 8px",
          }}
        >
          Refuse to sign
        </h2>
        <p
          style={{
            fontSize: 14,
            color: "#6B7280",
            lineHeight: 1.6,
            margin: "0 0 24px",
          }}
        >
          You are about to refuse to sign this inspection report. Your refusal will be documented
          and sent to all parties. The report remains legally valid.
        </p>

        <label
          style={{
            fontSize: 13,
            fontWeight: 600,
            color: "#374151",
            display: "block",
            marginBottom: 8,
          }}
        >
          Reason for refusal (optional but recommended)
        </label>
        <textarea
          placeholder="e.g. I disagree with the damage assessment in the living room..."
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          style={{
            width: "100%",
            borderRadius: 12,
            border: "1.5px solid #E5E7EB",
            padding: "12px 14px",
            fontSize: 13,
            resize: "none",
            fontFamily: "sans-serif",
            outline: "none",
            marginBottom: 20,
            boxSizing: "border-box",
            lineHeight: 1.5,
          }}
        />

        {error && (
          <p
            style={{
              color: "#EF4444",
              fontSize: 13,
              margin: "0 0 16px",
              textAlign: "center",
            }}
          >
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => void handleRefuse()}
          disabled={loading}
          style={{
            width: "100%",
            background: "#EF4444",
            color: "white",
            border: "none",
            borderRadius: 14,
            padding: "15px 0",
            fontSize: 14,
            fontWeight: 700,
            cursor: "pointer",
            marginBottom: 12,
            opacity: loading ? 0.6 : 1,
            fontFamily: "Poppins,sans-serif",
          }}
        >
          {loading ? "Recording refusal..." : "Confirm — I refuse to sign"}
        </button>

        {backToSign ? (
          <a
            href={backToSign}
            style={{
              display: "block",
              textAlign: "center",
              fontSize: 13,
              color: "#9B9BA8",
              textDecoration: "none",
            }}
          >
            ← Go back and sign instead
          </a>
        ) : null}
      </div>
    </div>
  );
}

export default function RefusePage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            minHeight: "100vh",
            background: "#F8F7F4",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loader2 size={32} className="animate-spin text-[#9A88FD]" />
        </div>
      }
    >
      <RefusePageContent />
    </Suspense>
  );
}
