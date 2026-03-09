"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

const UAE_PHONE_PREFIX = "+971";

export default function RegisterPage() {
  const [fullName, setFullName] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
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

  function formatPhone(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 9);
    if (digits.length === 0) return "";
    return digits.replace(/(\d{3})(\d{0,3})(\d{0,})/, (_, a, b, c) =>
      [a, b, c].filter(Boolean).join(" ")
    );
  }

  function handlePhoneChange(e: React.ChangeEvent<HTMLInputElement>) {
    setPhone(formatPhone(e.target.value));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const fullPhone = phone ? `${UAE_PHONE_PREFIX} ${phone.trim()}` : null;

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
      setLoading(false);
      setError(signUpError.message);
      return;
    }

    if (authData.user) {
      const { error: profileError } = await supabase
        .from("profiles")
        .upsert(
          {
            id: authData.user.id,
            full_name: fullName || null,
            agency_name: agencyName || null,
            phone: fullPhone,
            role: "agent",
          },
          { onConflict: "id" }
        );

      if (profileError) {
        setError(profileError.message);
        setLoading(false);
        return;
      }
    }

    setLoading(false);
    router.push("/dashboard");
    router.refresh();
  }

  const inputClass =
    "w-full h-[52px] px-4 rounded-xl border-[1.5px] border-gray-200 bg-white font-body text-brand-dark placeholder-gray-400 focus:outline-none focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/20 transition-all";

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading font-extrabold text-3xl text-brand-dark mb-1.5">
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
            className="p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm font-body"
          >
            {error}
          </div>
        )}

        <div>
          <label
            htmlFor="fullName"
            className="block font-body text-sm font-medium text-brand-dark mb-1.5"
          >
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
          <label
            htmlFor="agencyName"
            className="block font-body text-sm font-medium text-brand-dark mb-1.5"
          >
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
          <label
            htmlFor="phone"
            className="block font-body text-sm font-medium text-brand-dark mb-1.5"
          >
            Phone
          </label>
          <div className="flex h-[52px] rounded-xl border-[1.5px] border-gray-200 bg-white focus-within:border-[#9A88FD] focus-within:ring-2 focus-within:ring-[#9A88FD]/20 transition-all">
            <span className="inline-flex items-center px-4 font-body text-sm text-gray-500 border-r border-gray-200 select-none">
              {UAE_PHONE_PREFIX}
            </span>
            <input
              id="phone"
              type="tel"
              value={phone}
              onChange={handlePhoneChange}
              autoComplete="tel"
              className="flex-1 min-w-0 h-full px-4 rounded-r-xl font-body text-brand-dark placeholder-gray-400 focus:outline-none bg-transparent"
              placeholder="50 123 4567"
            />
          </div>
        </div>

        <div>
          <label
            htmlFor="email"
            className="block font-body text-sm font-medium text-brand-dark mb-1.5"
          >
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
          <label
            htmlFor="password"
            className="block font-body text-sm font-medium text-brand-dark mb-1.5"
          >
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
          <p className="mt-1 font-body text-xs text-gray-400">
            At least 6 characters
          </p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full h-[52px] rounded-xl bg-[#9A88FD] text-white font-heading font-medium text-base hover:bg-[#7B65FC] active:scale-[0.97] focus:outline-none focus:ring-2 focus:ring-[#9A88FD] focus:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed transition-all"
        >
          {loading ? "Creating account…" : "Create Account"}
        </button>
      </form>

      <p className="mt-8 text-center font-body text-sm text-gray-500">
        Already have an account?{" "}
        <Link
          href="/login"
          className="font-medium text-[#9A88FD] hover:text-[#7B65FC] hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}
