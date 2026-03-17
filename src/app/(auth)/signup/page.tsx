"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

type AccountType = "individual" | "pro";
type Step = 1 | 2 | 3;

function getErrorMessage(error: string): string {
  if (error.includes("Invalid login credentials"))
    return "Wrong email or password. Please try again.";
  if (error.includes("already registered") || error.includes("already in use"))
    return "This email is already registered. Try signing in.";
  if (error.includes("Too many requests"))
    return "Too many attempts. Please wait a few minutes.";
  if (error.includes("Network")) return "Connection issue. Check your internet.";
  return error;
}

function HouseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  );
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M8 10h.01M16 14h.01M8 14h.01" />
    </svg>
  );
}

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountType, setAccountType] = useState<AccountType | null>(null);
  const [agencyName, setAgencyName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("#9A88FD");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const canContinueStep1 =
    fullName.trim().length > 0 &&
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
    password.length >= 8;

  const handleContinueStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!canContinueStep1) return;
    setCurrentStep(2);
  };

  const handleSignup = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim(),
          accountType: accountType ?? "individual",
          agencyName: accountType === "pro" ? agencyName.trim() : "",
          primaryColor: accountType === "pro" ? primaryColor : "#9A88FD",
        }),
      });

      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error || "Signup failed");

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (signInError) throw signInError;

      router.push("/dashboard");
      router.refresh();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(getErrorMessage(msg));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAccountStep2 = () => {
    setError(null);
    if (!accountType) return;
    if (accountType === "individual") {
      handleSignup();
    } else {
      setCurrentStep(3);
    }
  };

  const handleCreateAccountStep3 = () => {
    setError(null);
    if (accountType !== "pro") return;
    if (!agencyName.trim()) {
      setError("Agency name is required.");
      return;
    }
    handleSignup();
  };

  const inputClass =
    "w-full h-[52px] min-h-[52px] px-4 rounded-xl border border-gray-200 bg-white font-body text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/20 transition-all";

  return (
    <>
      {/* Progress dots */}
      <div className="flex justify-center gap-2 mb-6" aria-label="Progress">
        {([1, 2, 3] as const).map((step) => (
          <div
            key={step}
            className="w-2.5 h-2.5 rounded-full transition-all"
            style={{
              backgroundColor: currentStep >= step ? "#9A88FD" : "#E5E7EB",
            }}
          />
        ))}
      </div>

      {currentStep === 1 && (
        <>
          <div className="mb-6">
            <h1 className="font-heading font-extrabold text-[28px] text-[#1A1A1A] mb-1.5">
              Create your account
            </h1>
            <p className="font-body text-sm text-gray-500">
              Enter your details to get started
            </p>
          </div>

          <form onSubmit={handleContinueStep1} className="space-y-4">
            {error && (
              <div
                role="alert"
                className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600"
              >
                {getErrorMessage(error)}
              </div>
            )}
            <div>
              <label htmlFor="fullName" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
                Full name
              </label>
              <input
                id="fullName"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                className={inputClass}
                placeholder="John Smith"
              />
            </div>
            <div>
              <label htmlFor="email" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                className={inputClass}
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  autoComplete="new-password"
                  className={`${inputClass} pr-12`}
                  placeholder="••••••••"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
              <p className="mt-1 font-body text-xs text-gray-500">At least 8 characters</p>
            </div>
            <button
              type="submit"
              disabled={!canContinueStep1}
              className="w-full h-[52px] min-h-[52px] font-semibold rounded-xl bg-[#9A88FD] text-white hover:bg-[#7B65FC] disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Continue →
            </button>
          </form>
        </>
      )}

      {currentStep === 2 && (
        <>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentStep(1);
              setError(null);
            }}
            className="inline-block font-body text-sm text-[#9A88FD] hover:underline mb-4"
          >
            ← Back
          </Link>
          <div className="mb-6">
            <h1 className="font-heading font-extrabold text-[22px] text-[#1A1A1A] mb-1">
              How will you use Snagify?
            </h1>
            <p className="font-body text-sm text-gray-500">
              This helps us tailor your experience
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
            <button
              type="button"
              onClick={() => setAccountType("individual")}
              className="text-left p-4 rounded-xl border-2 bg-white transition-all hover:border-[#9A88FD]/50"
              style={{
                borderColor: accountType === "individual" ? "#9A88FD" : "#E5E7EB",
              }}
            >
              <HouseIcon className="w-8 h-8 text-[#9A88FD] mb-3" />
              <p className="font-heading font-extrabold text-base text-[#1A1A1A]">Property Owner</p>
              <p className="font-body text-sm text-gray-500 mt-0.5">I manage my own properties</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                Free to start
              </span>
            </button>
            <button
              type="button"
              onClick={() => setAccountType("pro")}
              className="text-left p-4 rounded-xl border-2 bg-white transition-all hover:border-[#9A88FD]/50"
              style={{
                borderColor: accountType === "pro" ? "#9A88FD" : "#E5E7EB",
              }}
            >
              <BuildingIcon className="w-8 h-8 text-[#9A88FD] mb-3" />
              <p className="font-heading font-extrabold text-base text-[#1A1A1A]">Agent / Agency</p>
              <p className="font-body text-sm text-gray-500 mt-0.5">I work in real estate professionally</p>
              <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EDE9FF] text-[#6D28D9]">
                White-label reports
              </span>
            </button>
          </div>

          <button
            type="button"
            onClick={accountType === "individual" ? handleCreateAccountStep2 : handleCreateAccountStep2}
            disabled={!accountType || loading}
            className="w-full h-[52px] min-h-[52px] font-semibold rounded-xl bg-[#9A88FD] text-white hover:bg-[#7B65FC] disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creating account...
              </>
            ) : accountType === "individual" ? (
              "Create my account →"
            ) : (
              "Continue →"
            )}
          </button>
        </>
      )}

      {currentStep === 3 && accountType === "pro" && (
        <>
          <Link
            href="#"
            onClick={(e) => {
              e.preventDefault();
              setCurrentStep(2);
              setError(null);
            }}
            className="inline-block font-body text-sm text-[#9A88FD] hover:underline mb-4"
          >
            ← Back
          </Link>
          <div className="mb-6">
            <h1 className="font-heading font-extrabold text-[22px] text-[#1A1A1A] mb-1">
              Set up your agency
            </h1>
            <p className="font-body text-sm text-gray-500">
              This will appear on all your inspection reports
            </p>
          </div>

          {error && (
            <div role="alert" className="mb-4 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600">
              {getErrorMessage(error)}
            </div>
          )}

          <div className="space-y-4 mb-6">
            <div>
              <label htmlFor="agencyName" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
                Agency name <span className="text-red-500">*</span>
              </label>
              <input
                id="agencyName"
                type="text"
                value={agencyName}
                onChange={(e) => setAgencyName(e.target.value)}
                className={inputClass}
                placeholder="MULKEEF Real Estate"
              />
            </div>
            <div>
              <label htmlFor="primaryColor" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
                Brand color — used on your PDF reports
              </label>
              <div className="flex items-center gap-3">
                <input
                  id="primaryColor"
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="w-12 h-12 rounded-lg border border-gray-200 cursor-pointer p-0"
                />
                <span className="font-mono text-sm text-gray-600">{primaryColor}</span>
              </div>
              <p className="mt-1.5 font-body text-xs text-gray-500">
                You can update your logo and full branding later in Settings
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleCreateAccountStep3}
            disabled={loading}
            className="w-full h-[52px] min-h-[52px] font-semibold rounded-xl bg-[#9A88FD] text-white hover:bg-[#7B65FC] disabled:opacity-50 flex items-center justify-center gap-2 transition-all"
          >
            {loading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                Creating account...
              </>
            ) : (
              "Create my account →"
            )}
          </button>
        </>
      )}

      <p className="mt-8 text-center font-body text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#9A88FD] hover:underline">
          Log in
        </Link>
      </p>
    </>
  );
}
