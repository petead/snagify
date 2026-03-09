"use client";

import { useState, useRef } from "react";
import { useParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";

type Step = "verify" | "sign" | "success";

export default function SignPage() {
  const params = useParams();
  const token = typeof params.token === "string" ? params.token : "";

  const [step, setStep] = useState<Step>("verify");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          otp,
          signatureData: null,
        }),
      });
      if (res.ok) {
        setStep("sign");
      } else {
        const data = await res.json();
        setError(data.error ?? "Verification failed");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleSign = async () => {
    if (!sigCanvas.current || sigCanvas.current.isEmpty()) {
      setError("Please draw your signature");
      return;
    }
    setLoading(true);
    setError("");
    const signatureData = sigCanvas.current.toDataURL("image/png");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token,
          otp,
          signatureData,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStep("success");
      } else {
        setError(data.error ?? "Failed to save signature");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4 max-w-sm mx-auto">
      <div className="mb-8 text-center">
        <div
          className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
          style={{ background: "linear-gradient(135deg, #9A88FD, #7B65FC)" }}
        >
          <span className="text-white text-2xl">🏢</span>
        </div>
        <p className="font-bold text-xl text-gray-900" style={{ fontFamily: "Poppins, sans-serif" }}>
          Snagify
        </p>
        <p className="text-xs text-gray-400">Property Inspection Report</p>
      </div>

      {step === "verify" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 w-full">
          <h2
            className="font-bold text-lg text-center mb-1 text-gray-900"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Enter Verification Code
          </h2>
          <p className="text-sm text-gray-400 text-center mb-6">
            Enter the 6-digit code sent to your WhatsApp
          </p>

          {error && (
            <div className="bg-red-50 border border-red-100 text-red-500 text-sm rounded-xl p-3 mb-4 text-center">
              {error}
            </div>
          )}

          <div className="flex gap-2 justify-center mb-6">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <input
                key={i}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={otp[i] ?? ""}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 1);
                  const newOtp = otp.split("");
                  newOtp[i] = v;
                  setOtp(newOtp.join(""));
                  if (v && i < 5) {
                    const next = document.getElementById(`otp-${i + 1}`);
                    (next as HTMLInputElement | null)?.focus();
                  }
                }}
                id={`otp-${i}`}
                className="w-11 h-14 text-center text-xl font-bold border-2 border-gray-200 rounded-xl focus:border-[#9A88FD] focus:outline-none transition-colors"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={handleVerify}
            disabled={otp.length < 6 || loading}
            className="w-full h-12 rounded-xl font-semibold text-white transition-all disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #9A88FD, #7B65FC)" }}
          >
            {loading ? "Verifying..." : "Verify Code →"}
          </button>
        </div>
      )}

      {step === "sign" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6 w-full">
          <h2
            className="font-bold text-lg text-center mb-1 text-gray-900"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Sign the Report
          </h2>
          <p className="text-sm text-gray-400 text-center mb-4">
            Draw your signature below
          </p>

          {error && (
            <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4 text-center">
              {error}
            </div>
          )}

          <div className="border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden mb-3 bg-white">
            <SignatureCanvas
              ref={sigCanvas}
              canvasProps={{
                width: 320,
                height: 180,
                className: "w-full touch-none",
              }}
              backgroundColor="white"
            />
          </div>

          <button
            type="button"
            onClick={() => sigCanvas.current?.clear()}
            className="w-full py-2 text-sm text-gray-400 mb-4"
          >
            Clear signature
          </button>

          <p className="text-xs text-gray-400 text-center mb-4">
            By signing, you confirm that you have reviewed and approved this inspection report.
          </p>

          <button
            type="button"
            onClick={handleSign}
            disabled={loading}
            className="w-full h-12 rounded-xl font-semibold text-gray-900 transition-all disabled:opacity-50"
            style={{ backgroundColor: "#cafe87" }}
          >
            {loading ? "Saving..." : "✓ Confirm Signature"}
          </button>
        </div>
      )}

      {step === "success" && (
        <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 w-full text-center">
          <div className="w-16 h-16 bg-[#cafe87] rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
            ✅
          </div>
          <h2
            className="font-bold text-xl mb-2 text-gray-900"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Report Signed!
          </h2>
          <p className="text-sm text-gray-400 mb-6">
            Your signature has been recorded. The inspection report has been officially signed.
          </p>
          <p className="text-xs text-gray-300">Powered by Snagify • snagify.net</p>
        </div>
      )}
    </div>
  );
}
