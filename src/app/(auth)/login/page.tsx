'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'
import { Eye, EyeOff, ArrowRight, Loader2, Mail, Sparkles } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [magicLoading, setMagicLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [emailTouched, setEmailTouched] = useState(false)
  const [forgotSent, setForgotSent] = useState(false)
  const [magicSent, setMagicSent] = useState(false)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailError = emailTouched && email && !emailValid

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(
        error.message.includes('Invalid')
          ? 'Incorrect email or password. Please try again.'
          : error.message
      )
      setLoading(false)
      return
    }
    router.push('/dashboard')
    router.refresh()
  }

  async function handleForgotPassword() {
    if (!email.trim()) { setError('Enter your email above first.'); return }
    setError(null)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    })
    if (resetError) { setError(resetError.message); return }
    setForgotSent(true)
  }

  async function handleMagicLink() {
    if (!email.trim()) { setError('Enter your email above first.'); return }
    if (!emailValid) { setError('Please enter a valid email address.'); return }
    setMagicLoading(true)
    setError(null)
    const { error: otpError } = await supabase.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
        shouldCreateUser: false, // only existing users
      },
    })
    setMagicLoading(false)
    if (otpError) {
      setError(otpError.message.includes('not found') || otpError.message.includes('User')
        ? 'No account found with this email. Please sign up first.'
        : otpError.message
      )
      return
    }
    setMagicSent(true)
  }

  // Magic link sent — show confirmation screen
  if (magicSent) {
    return (
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100 text-center"
          >
            {/* Animated envelope */}
            <motion.div
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 300 }}
              className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5"
              style={{ background: 'linear-gradient(135deg, #EDE9FF, #F8F7F4)' }}
            >
              <Mail size={28} color="#9A88FD" />
            </motion.div>

            <h2
              className="text-xl font-extrabold text-[#1A1A2E] mb-2"
              style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
            >
              Check your inbox
            </h2>
            <p className="text-sm text-gray-500 mb-2 leading-relaxed">
              We sent a sign-in link to
            </p>
            <p className="text-sm font-semibold text-[#9A88FD] mb-5 break-all">
              {email}
            </p>
            <p className="text-xs text-gray-400 leading-relaxed mb-6">
              Click the link in the email to sign in instantly.
              It expires in 60 minutes.
            </p>

            <div className="border-t border-gray-100 pt-5">
              <p className="text-xs text-gray-400 mb-3">Didn&apos;t receive it?</p>
              <div className="flex gap-2 justify-center">
                <button
                  onClick={() => { setMagicSent(false) }}
                  className="text-xs text-[#9A88FD] font-semibold hover:underline"
                >
                  Change email
                </button>
                <span className="text-gray-200">·</span>
                <button
                  onClick={() => { setMagicSent(false); void handleMagicLink() }}
                  className="text-xs text-[#9A88FD] font-semibold hover:underline"
                >
                  Resend link
                </button>
              </div>
            </div>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="text-center text-sm text-gray-500 mt-6"
          >
            <button
              onClick={() => setMagicSent(false)}
              className="text-[#9A88FD] font-semibold hover:underline"
            >
              ← Back to sign in
            </button>
          </motion.p>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
          className="flex items-center justify-center gap-2 mb-8"
        >
          <Image src="/icon-512x512.png" alt="Snagify" width={36} height={36} className="rounded-xl" />
          <span
            className="text-xl font-extrabold text-[#1A1A2E]"
            style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
          >
            Snagify
          </span>
        </motion.div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
        >
          <h1
            className="text-2xl font-extrabold text-[#1A1A2E] mb-1"
            style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
          >
            Welcome back
          </h1>
          <p className="text-sm text-gray-500 mb-6">Sign in to your Snagify account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                Email
              </label>
              <div className="relative">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => { setEmail(e.target.value); setError(null) }}
                  onBlur={() => setEmailTouched(true)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className={`w-full px-4 py-3 rounded-xl border text-base transition-all duration-200 outline-none
                    ${emailError
                      ? 'border-red-300 bg-red-50 focus:border-red-400'
                      : emailTouched && emailValid
                        ? 'border-green-300 bg-green-50 focus:border-green-400'
                        : 'border-gray-200 bg-gray-50 focus:border-[#9A88FD] focus:bg-white focus:ring-2 focus:ring-[#9A88FD]/10'
                    }`}
                />
                <AnimatePresence>
                  {emailTouched && emailValid && (
                    <motion.span
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0 }}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-green-500 text-lg"
                    >✓</motion.span>
                  )}
                </AnimatePresence>
              </div>
              <AnimatePresence>
                {emailError && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-xs text-red-500 mt-1"
                  >
                    Please enter a valid email address
                  </motion.p>
                )}
              </AnimatePresence>
            </div>

            {/* Password */}
            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
                  Password
                </label>
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-[#9A88FD] font-semibold hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full px-4 py-3 pr-10 rounded-xl border border-gray-200 bg-gray-50
                    text-base transition-all duration-200 outline-none
                    focus:border-[#9A88FD] focus:bg-white focus:ring-2 focus:ring-[#9A88FD]/10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Forgot sent success */}
            <AnimatePresence>
              {forgotSent && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 text-sm text-green-700"
                >
                  Reset link sent to your email
                </motion.div>
              )}
            </AnimatePresence>

            {/* Error */}
            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600"
                >
                  {error}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Submit */}
            <motion.button
              type="submit"
              disabled={loading || !email || !password}
              whileTap={{ scale: 0.98 }}
              className="w-full py-3.5 rounded-xl bg-[#9A88FD] text-white font-semibold text-sm
                flex items-center justify-center gap-2 transition-all duration-150
                hover:bg-[#8674FC] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <>Sign In <ArrowRight size={16} /></>
              )}
            </motion.button>
          </form>

          {/* Divider */}
          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-gray-400 font-medium">or</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Magic link button */}
          <motion.button
            type="button"
            onClick={handleMagicLink}
            disabled={magicLoading}
            whileTap={{ scale: 0.98 }}
            className="w-full py-3.5 rounded-xl border-2 border-dashed text-sm font-semibold
              flex items-center justify-center gap-2 transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              borderColor: 'rgba(154,136,253,0.35)',
              color: '#9A88FD',
              background: 'rgba(154,136,253,0.04)',
            }}
          >
            {magicLoading ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <>
                <Sparkles size={15} />
                Send me a magic link
              </>
            )}
          </motion.button>
          <p className="text-center text-xs text-gray-400 mt-2">
            No password needed — we&apos;ll email you a sign-in link
          </p>
        </motion.div>

        {/* Sign up link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-gray-500 mt-6"
        >
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-[#9A88FD] font-semibold hover:underline">
            Sign up
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
