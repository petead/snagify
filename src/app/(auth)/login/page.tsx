"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Check, X, Loader2 } from "lucide-react";
import { createBrowserClient } from "@supabase/ssr";

function getErrorMessage(error: string): string {
  if (error.includes("Invalid login credentials"))
    return "❌ Wrong email or password. Please try again.";
  if (error.includes("Email not confirmed"))
    return "📧 Please check your email and confirm your account.";
  if (error.includes("Too many requests"))
    return "⏳ Too many attempts. Please wait a few minutes.";
  if (error.includes("Network"))
    return "🌐 Connection issue. Check your internet.";
  return "⚠️ " + error;
}

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailValid, setEmailValid] = useState<boolean | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);
  const router = useRouter();

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const validateEmail = (value: string) => {
    setEmail(value);
    if (value.length > 0) {
      const isValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      setEmailValid(isValid);
    } else {
      setEmailValid(null);
    }
  };

  const handleLogin = async () => {
    setError("");
    setLoading(true);
    setSuccess(false);

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
    setTimeout(() => {
      router.push("/dashboard");
    }, 800);
  };

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      setError("Enter your email above first.");
      return;
    }
    setError("");
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setForgotSent(true);
  };

  const emailInputBorder =
    emailValid === null
      ? "border-gray-200"
      : emailValid
        ? "border-green-400 focus:border-green-400 focus:ring-green-400/20"
        : "border-red-300 focus:border-red-300 focus:ring-red-300/20";

  return (
    <>
      <div className="mb-8">
        <h1 className="font-heading font-extrabold text-[28px] text-[#1A1A1A] mb-1.5">
          Welcome back 👋
        </h1>
        <p className="font-body text-sm text-gray-500">
          Sign in to your Snagify account
        </p>
      </div>

      {error && (
        <div
          className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-xl p-3 text-sm text-red-600 animate-shake mb-6"
          role="alert"
        >
          {getErrorMessage(error)}
        </div>
      )}

      {forgotSent && (
        <div className="bg-green-50 border border-green-100 rounded-xl p-3 text-sm text-green-700 mb-6">
          📧 Reset link sent to your email
        </div>
      )}

      <div className="space-y-5">
        <div>
          <label htmlFor="email" className="block font-body text-sm font-medium text-[#1A1A1A] mb-1.5">
            Email
          </label>
          <div className="relative">
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => validateEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              className={`w-full h-[52px] pl-4 pr-12 rounded-xl border bg-white font-body text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:ring-2 transition-all ${emailInputBorder}`}
            />
            {emailValid === true && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-green-500">
                <Check size={20} strokeWidth={2.5} />
              </span>
            )}
            {emailValid === false && (
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-red-500">
                <X size={20} strokeWidth={2.5} />
              </span>
            )}
          </div>
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
              placeholder="••••••••"
              autoComplete="current-password"
              className="w-full h-[52px] pl-4 pr-12 rounded-xl border border-gray-200 bg-white font-body text-[#1A1A1A] placeholder-gray-400 focus:outline-none focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/20 transition-all"
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
          <button
            type="button"
            onClick={handleForgotPassword}
            className="mt-1.5 font-body text-sm text-[#9A88FD] hover:text-[#7B65FC] hover:underline"
          >
            Forgot password?
          </button>
        </div>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className={`w-full h-[52px] font-semibold rounded-xl transition-all flex items-center justify-center gap-2 min-h-[52px]
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
              Welcome back!
            </>
          ) : loading ? (
            <>
              <Loader2 size={20} className="animate-spin text-white" />
              Signing in...
            </>
          ) : (
            "Sign In →"
          )}
        </button>
      </div>

      <p className="mt-8 text-center font-body text-sm text-gray-500">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="font-medium text-[#9A88FD] hover:underline">
          Create one free →
        </Link>
      </p>
    </>
  );
}
