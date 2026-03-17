"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const UAE_PHONE_PREFIX = "+971";

function getPasswordStrength(pwd: string): number {
  let score = 0;
  if (pwd.length >= 8) score++;
  if (/[A-Z]/.test(pwd)) score++;
  if (/[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;
  return score;
}

function getErrorMessage(error: string): string {
  if (error.includes("Invalid login credentials"))
    return "❌ Wrong email or password. Please try again.";
  if (error.includes("Email not confirmed"))
    return "📧 Please check your email and confirm your account.";
  if (error.includes("already registered") || error.includes("already in use"))
    return "📧 This email is already registered. Try signing in.";
  if (error.includes("Too many requests"))
    return "⏳ Too many attempts. Please wait a few minutes.";
  if (error.includes("Network"))
    return "🌐 Connection issue. Check your internet.";
  return "⚠️ " + error;
}

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const strength = getPasswordStrength(password);
  const strengthLabel = strength <= 1 ? "Weak" : strength <= 3 ? "Medium" : "Strong";

  function formatUAEPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length <= 2) return digits;
    if (digits.length <= 5) return digits.slice(0, 2) + " " + digits.slice(2);
    if (digits.length <= 8) return digits.slice(0, 2) + " " + digits.slice(2, 5) + " " + digits.slice(5);
    return digits.slice(0, 2) + " " + digits.slice(2, 5) + " " + digits.slice(5, 9);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    setSuccess(false);

    const fullPhone = phone ? UAE_PHONE_PREFIX + phone.replace(/\s/g, "") : null;

    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            agency_name: agencyName,
            phone: fullPhone,
          },
        },
      });

      if (signUpError) {
        setError(signUpError.message);
        setLoading(false);
        return;
      }

      if (!authData.user) {
        setError("Account could not be created. Please try again.");
        setLoading(false);
        return;
      }

      // 1. Create company first
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: agencyName || null,
          primary_color: "#9A88FD",
        })
        .select("id")
        .single();

      if (companyError) {
        setError(companyError.message);
        setLoading(false);
        return;
      }

      if (!company?.id) {
        setError("Company could not be created. Please try again.");
        setLoading(false);
        return;
      }

      // 2. Create or update profile with company_id and onboarding_completed
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: authData.user.id,
            full_name: fullName || null,
            email: authData.user.email,
            phone: fullPhone,
            role: "agent",
            company_id: company.id,
            onboarding_completed: true,
          },
          { onConflict: "id" }
        );

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => {
        router.push("/dashboard");
        router.refresh();
      }, 800);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  const inputClass =
    "w-full h-[52px] min-h-[52px] px-4 rounded-xl border border-gray-200 bg-white font-body text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/20 transition-all";

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading font-extrabold text-[28px] text-[#1A1A1A] mb-1.5">
          Create your account
        </h1>
        <p className="font-body text-sm text-gray-500">
          Join Snagify — it&apos;s free to get started
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div
            role="alert"
            className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 animate-shake"
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
          <label htmlFor="agencyName" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
            Agency name
          </label>
          <input
            id="agencyName"
            type="text"
            value={agencyName}
            onChange={(e) => setAgencyName(e.target.value)}
            className={inputClass}
            placeholder="Your Agency LLC"
          />
        </div>

        <div>
          <label htmlFor="phone" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
            Phone
          </label>
          <div className="flex h-[52px] min-h-[52px] rounded-xl border border-gray-200 bg-white focus-within:border-[#9A88FD] focus-within:ring-2 focus-within:ring-[#9A88FD]/20 transition-all">
            <span className="inline-flex items-center px-4 font-body text-sm text-gray-500 border-r border-gray-200 select-none" aria-hidden>
              {UAE_PHONE_PREFIX}
            </span>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={(e) => setPhone(formatUAEPhone(e.target.value))}
              autoComplete="tel"
              className="flex-1 min-w-0 h-full px-4 rounded-r-xl font-body text-[#1A1A1A] placeholder-gray-400 focus:outline-none bg-transparent"
              placeholder="58 516 9329"
            />
          </div>
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
              minLength={6}
              autoComplete="new-password"
              className={`${inputClass} pr-12`}
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              tabIndex={-1}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
            </button>
          </div>
          <div className="flex gap-1 mt-1.5">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full transition-all ${
                  i <= strength
                    ? strength <= 1
                      ? "bg-red-400"
                      : strength <= 3
                        ? "bg-yellow-400"
                        : "bg-green-400"
                    : "bg-gray-200"
                }`}
              />
            ))}
          </div>
          <p className="mt-1 font-body text-xs text-gray-500">
            {password.length > 0 ? strengthLabel : "At least 8 characters, mix of letters, numbers & symbols"}
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full h-[52px] min-h-[52px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2
            ${success
              ? "bg-green-500 text-white cursor-default"
              : loading
                ? "bg-[#9A88FD] text-white opacity-80 cursor-wait"
                : "bg-[#9A88FD] text-white hover:bg-[#7B65FC] hover:shadow-lg active:scale-[0.98]"
            }`}
        >
          {success ? (
            <>
              <Check size={20} strokeWidth={2.5} />
              Account created!
            </>
          ) : loading ? (
            <>
              <Loader2 size={20} className="animate-spin text-white" />
              Creating account...
            </>
          ) : (
            "Create Account"
          )}
        </button>
      </form>

      <p className="mt-8 text-center font-body text-sm text-gray-500">
        Already have an account?{" "}
        <Link href="/login" className="font-medium text-[#9A88FD] hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
