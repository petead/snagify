"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Image from "next/image";
import { Loader2, Check } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export const dynamic = "force-dynamic";

type InviteStatus = "loading" | "valid" | "invalid" | "expired" | "done";

type InviteData = {
  id: string;
  email: string;
  role: string | null;
  expires_at: string;
  accepted_at: string | null;
  company?: {
    name?: string | null;
    logo_url?: string | null;
    primary_color?: string | null;
  } | null;
};

function InvitePageInner() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");

  const [invite, setInvite] = useState<InviteData | null>(null);
  const [status, setStatus] = useState<InviteStatus>("loading");
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    fetch(`/api/invite/verify?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((data: { error?: string; invitation?: InviteData }) => {
        if (data.error) {
          setStatus(data.error === "expired" ? "expired" : "invalid");
          return;
        }
        setInvite(data.invitation ?? null);
        setStatus("valid");
      })
      .catch(() => setStatus("invalid"));
  }, [token]);

  async function handleAccept(e: FormEvent) {
    e.preventDefault();
    if (!token) return;

    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, fullName, password }),
      });
      const data = (await res.json()) as { success?: boolean; error?: string; email?: string };

      if (data.error) {
        setError(data.error);
        setSubmitting(false);
        return;
      }

      const supabase = createClient();
      const signInEmail = data.email ?? invite?.email ?? "";
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: signInEmail,
        password,
      });

      if (signInError) {
        setError("Invitation accepted, but auto sign-in failed. Please login manually.");
        setSubmitting(false);
        return;
      }

      setStatus("done");
      setTimeout(() => router.push("/dashboard"), 1500);
    } catch {
      setError("Unexpected error. Please try again.");
      setSubmitting(false);
    }
  }

  const primaryColor = invite?.company?.primary_color || "#9A88FD";
  const agencyName = invite?.company?.name || "Snagify";

  if (status === "loading") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
        <Loader2 size={32} className="animate-spin text-[#9A88FD]" />
      </div>
    );
  }

  if (status === "invalid" || status === "expired") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] px-8 text-center gap-4">
        <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center justify-center">
          <span className="text-2xl">❌</span>
        </div>
        <h1 className="text-[18px] font-bold text-[#1A1A2E]">
          {status === "expired" ? "Invitation expired" : "Invalid link"}
        </h1>
        <p className="text-sm text-gray-500">
          {status === "expired"
            ? "This invitation has expired. Please ask your team owner to send a new one."
            : "This link is invalid. Please check your email for the correct link."}
        </p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#F8F7F4] px-8 text-center gap-4">
        <div className="w-16 h-16 bg-green-50 rounded-2xl flex items-center justify-center">
          <Check size={28} color="#16A34A" />
        </div>
        <h1 className="text-[20px] font-extrabold text-[#1A1A2E]">Welcome aboard!</h1>
        <p className="text-sm text-gray-500">
          You&apos;ve joined {agencyName}. Redirecting to your dashboard...
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="rounded-2xl p-5 mb-6 flex items-center gap-3" style={{ background: primaryColor }}>
          {invite?.company?.logo_url ? (
            <Image
              src={invite.company.logo_url}
              alt={agencyName}
              width={44}
              height={44}
              className="w-11 h-11 rounded-xl object-contain bg-white/20"
            />
          ) : (
            <div className="w-11 h-11 rounded-xl bg-white/20 flex items-center justify-center text-white font-bold text-lg">
              {agencyName.charAt(0)}
            </div>
          )}
          <div>
            <div className="text-[17px] font-extrabold text-white">{agencyName}</div>
            <div className="text-[12px] text-white/70">invited you to join their team</div>
          </div>
        </div>

        <div className="bg-white rounded-3xl p-6 border border-gray-100">
          <h1
            className="text-[22px] font-extrabold text-[#1A1A2E] mb-1"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            Create your account
          </h1>
          <p className="text-sm text-gray-500 mb-6">
            You&apos;ll join {agencyName} as an <strong>Inspector</strong>
          </p>

          <form onSubmit={handleAccept} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Email
              </label>
              <input
                type="email"
                value={invite?.email || ""}
                disabled
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-400 text-sm"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Full name
              </label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
                required
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#9A88FD] focus:bg-white transition-all"
                style={{ fontSize: "16px" }}
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl border border-gray-200 bg-gray-50 text-sm outline-none focus:border-[#9A88FD] focus:bg-white transition-all"
                style={{ fontSize: "16px" }}
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-xl px-4 py-3">{error}</p>}

            <button
              type="submit"
              disabled={submitting || !fullName || !password}
              className="w-full py-4 rounded-2xl text-white font-extrabold text-[15px] flex items-center justify-center gap-2 disabled:opacity-50 transition-opacity"
              style={{ background: primaryColor }}
            >
              {submitting ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                `Join ${agencyName} →`
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-[11px] text-gray-400 mt-4">
          By joining, you agree to Snagify&apos;s Terms of Service
        </p>
      </div>
    </div>
  );
}

export default function InvitePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#F8F7F4]">
          <div className="w-8 h-8 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <InvitePageInner />
    </Suspense>
  );
}
