"use client";

import { useState, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import SignatureCanvas from "react-signature-canvas";

function SignPageContent() {
  const searchParams = useSearchParams();
  const phone = searchParams.get("phone") || "";
  const inspectionId = searchParams.get("inspectionId") || "";
  const signerType = searchParams.get("signerType") || "";

  const [step, setStep] = useState<"verify" | "sign" | "success">("verify");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const sigCanvas = useRef<SignatureCanvas>(null);

  const handleVerify = async () => {
    if (otp.length < 6) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp,
          inspectionId,
          signerType,
          signatureData: null,
        }),
      });
      const data = await res.json();
      if (res.ok) setStep("sign");
      else setError(data.error);
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
    const signatureData = sigCanvas.current.toDataURL("image/png");
    try {
      const res = await fetch("/api/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone,
          otp,
          inspectionId,
          signerType,
          signatureData,
        }),
      });
      const data = await res.json();
      if (data.success) setStep("success");
      else setError(data.error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
            style={{
              background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
            }}
          >
            <span className="text-white text-2xl">🏢</span>
          </div>
          <p
            className="font-bold text-xl"
            style={{ fontFamily: "Poppins,sans-serif" }}
          >
            Snagify
          </p>
          <p className="text-xs text-gray-400">Property Inspection Report</p>
        </div>

        {/* STEP 1 - Verify OTP */}
        {step === "verify" && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2
              className="font-bold text-lg text-center mb-1"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              Enter Verification Code
            </h2>
            <p className="text-sm text-gray-400 text-center mb-6">
              Enter the 6-digit code sent to your WhatsApp or SMS
            </p>

            {error && (
              <div className="bg-red-50 text-red-500 text-sm rounded-xl p-3 mb-4 text-center">
                {error}
              </div>
            )}

            <div className="flex gap-2 justify-center mb-6">
              {[0, 1, 2, 3, 4, 5].map((i) => (
                <input
                  key={i}
                  id={`otp-${i}`}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={otp[i] || ""}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    const arr = otp.split("");
                    arr[i] = val;
                    setOtp(arr.join(""));
                    if (val && i < 5)
                      document.getElementById(`otp-${i + 1}`)?.focus();
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Backspace" && !otp[i] && i > 0) {
                      document.getElementById(`otp-${i - 1}`)?.focus();
                    }
                  }}
                  className="w-11 h-14 text-center text-xl font-bold border-2 
                    border-gray-200 rounded-xl focus:border-[#9A88FD] 
                    focus:outline-none transition-colors"
                />
              ))}
            </div>

            <button
              onClick={handleVerify}
              disabled={otp.length < 6 || loading}
              className="w-full h-12 rounded-xl font-semibold text-white
                transition-all disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #9A88FD, #7B65FC)",
              }}
            >
              {loading ? "Verifying..." : "Verify Code →"}
            </button>
          </div>
        )}

        {/* STEP 2 - Signature Pad */}
        {step === "sign" && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-6">
            <h2
              className="font-bold text-lg text-center mb-1"
              style={{ fontFamily: "Poppins,sans-serif" }}
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

            <div className="border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden mb-3">
              <SignatureCanvas
                ref={sigCanvas}
                canvasProps={{ width: 320, height: 180, className: "w-full" }}
                backgroundColor="white"
              />
            </div>

            <button
              onClick={() => sigCanvas.current?.clear()}
              className="w-full py-2 text-sm text-gray-400 mb-3"
            >
              Clear signature
            </button>

            <p className="text-xs text-gray-400 text-center mb-4">
              By signing, you confirm that you have reviewed and approved this
              inspection report.
            </p>

            <button
              onClick={handleSign}
              disabled={loading}
              className="w-full h-12 rounded-xl font-semibold text-gray-900 disabled:opacity-50"
              style={{ backgroundColor: "#cafe87" }}
            >
              {loading ? "Saving..." : "✓ Confirm Signature"}
            </button>
          </div>
        )}

        {/* STEP 3 - Success */}
        {step === "success" && (
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 text-center">
            <div className="w-16 h-16 bg-[#cafe87] rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
              ✅
            </div>
            <h2
              className="font-bold text-xl mb-2"
              style={{ fontFamily: "Poppins,sans-serif" }}
            >
              Report Signed!
            </h2>
            <p className="text-sm text-gray-400">
              Your signature has been recorded successfully.
            </p>
            <p className="text-xs text-gray-300 mt-6">
              Powered by Snagify • snagify.net
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default function SignPage() {
  return (
    <Suspense>
      <SignPageContent />
    </Suspense>
  );
}
