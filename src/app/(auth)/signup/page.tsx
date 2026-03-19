'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowRight, ArrowLeft } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar'
import { analyzePassword } from '@/lib/passwordStrength'

type AccountType = 'individual' | 'pro'
type Step = 1 | 2 | 3

function getErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials'))
    return 'Wrong email or password. Please try again.'
  if (error.includes('already registered') || error.includes('already in use'))
    return 'This email is already registered. Try signing in.'
  if (error.includes('Too many requests'))
    return 'Too many attempts. Please wait a few minutes.'
  if (error.includes('Network')) return 'Connection issue. Check your internet.'
  return error
}

function HouseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
      <polyline points="9 22 9 12 15 12 15 22" />
    </svg>
  )
}

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <path d="M9 22v-4h6v4M8 6h.01M16 6h.01M12 6h.01M12 10h.01M12 14h.01M16 10h.01M8 10h.01M16 14h.01M8 14h.01" />
    </svg>
  )
}

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [agencyName, setAgencyName] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#9A88FD')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const router = useRouter()

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailError = emailTouched && email && !emailValid
  const passwordAnalysis = analyzePassword(password)
  const passwordOk = passwordAnalysis.score >= 2

  const canContinueStep1 =
    fullName.trim().length > 0 &&
    emailValid &&
    passwordOk

  const handleContinueStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canContinueStep1) return
    setCurrentStep(2)
  }

  const handleSignup = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          fullName: fullName.trim(),
          accountType: accountType ?? 'individual',
          agencyName: accountType === 'pro' ? agencyName.trim() : '',
          primaryColor: accountType === 'pro' ? primaryColor : '#9A88FD',
        }),
      })

      const data = (await res.json()) as { error?: string }
      if (!res.ok) throw new Error(data.error || 'Signup failed')

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      if (signInError) throw signInError

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      setError(getErrorMessage(msg))
      setLoading(false)
    }
  }

  const handleCreateAccountStep2 = () => {
    setError(null)
    if (!accountType) return
    if (accountType === 'individual') {
      handleSignup()
    } else {
      setCurrentStep(3)
    }
  }

  const handleCreateAccountStep3 = () => {
    setError(null)
    if (accountType !== 'pro') return
    if (!agencyName.trim()) {
      setError('Agency name is required.')
      return
    }
    handleSignup()
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl border text-base transition-all duration-200 outline-none'

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
          className="flex items-center justify-center gap-2 mb-6"
        >
          <Image
            src="/icon-512x512.png"
            alt="Snagify"
            width={36}
            height={36}
            className="rounded-xl"
          />
          <span
            className="text-xl font-extrabold text-[#1A1A2E]"
            style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
          >
            Snagify
          </span>
        </motion.div>

        {/* Animated progress dots */}
        <div className="flex justify-center gap-2 mb-6" aria-label="Progress">
          {([1, 2, 3] as const).map((step) => (
            <motion.div
              key={step}
              animate={{
                width: step === currentStep ? 24 : 8,
                backgroundColor: step <= currentStep ? '#9A88FD' : '#E5E7EB',
              }}
              transition={{ duration: 0.3 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
        >
          <AnimatePresence mode="wait">
            {/* Step 1: Credentials */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <h1
                  className="text-2xl font-extrabold text-[#1A1A2E] mb-1"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  Create your account
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  Enter your details to get started
                </p>

                <form onSubmit={handleContinueStep1} className="space-y-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600"
                      >
                        {getErrorMessage(error)}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Full name */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      placeholder="John Smith"
                      className={`${inputClass} border-gray-200 bg-gray-50 focus:border-[#9A88FD] focus:bg-white focus:ring-2 focus:ring-[#9A88FD]/10`}
                    />
                  </div>

                  {/* Email */}
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Email
                    </label>
                    <div className="relative">
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        onBlur={() => setEmailTouched(true)}
                        autoComplete="email"
                        placeholder="you@example.com"
                        className={`${inputClass}
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
                          >
                            ✓
                          </motion.span>
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
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className={`${inputClass} pr-10 border-gray-200 bg-gray-50 focus:border-[#9A88FD] focus:bg-white focus:ring-2 focus:ring-[#9A88FD]/10`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                      </button>
                    </div>
                    <PasswordStrengthBar password={password} />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={!canContinueStep1}
                    whileTap={{ scale: 0.98 }}
                    className="w-full py-3.5 rounded-xl bg-[#9A88FD] text-white font-semibold text-sm
                      flex items-center justify-center gap-2 transition-all duration-150
                      hover:bg-[#8674FC] disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Continue
                    <ArrowRight size={16} />
                  </motion.button>
                </form>
              </motion.div>
            )}

            {/* Step 2: Account type */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={() => { setCurrentStep(1); setError(null) }}
                  className="flex items-center gap-1 text-sm text-[#9A88FD] font-semibold hover:underline mb-4"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>

                <h1
                  className="text-xl font-extrabold text-[#1A1A2E] mb-1"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  How will you use Snagify?
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  This helps us tailor your experience
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4"
                    >
                      {getErrorMessage(error)}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-6">
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAccountType('individual')}
                    className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer
                      ${accountType === 'individual'
                        ? 'border-[#9A88FD] bg-[#EDE9FF]'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <HouseIcon className="w-8 h-8 text-[#9A88FD] mb-3" />
                    <p className="font-extrabold text-base text-[#1A1A2E]" style={{ fontFamily: 'var(--font-heading)' }}>
                      Property Owner
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">I manage my own properties</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                      Free to start
                    </span>
                  </motion.button>

                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAccountType('pro')}
                    className={`text-left p-4 rounded-2xl border-2 transition-all cursor-pointer
                      ${accountType === 'pro'
                        ? 'border-[#9A88FD] bg-[#EDE9FF]'
                        : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                  >
                    <BuildingIcon className="w-8 h-8 text-[#9A88FD] mb-3" />
                    <p className="font-extrabold text-base text-[#1A1A2E]" style={{ fontFamily: 'var(--font-heading)' }}>
                      Agent / Agency
                    </p>
                    <p className="text-sm text-gray-500 mt-0.5">I work in real estate professionally</p>
                    <span className="inline-block mt-2 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#EDE9FF] text-[#6D28D9]">
                      White-label reports
                    </span>
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  onClick={handleCreateAccountStep2}
                  disabled={!accountType || loading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-[#9A88FD] text-white font-semibold text-sm
                    flex items-center justify-center gap-2 transition-all duration-150
                    hover:bg-[#8674FC] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating account...
                    </>
                  ) : accountType === 'individual' ? (
                    <>
                      Create my account
                      <ArrowRight size={16} />
                    </>
                  ) : (
                    <>
                      Continue
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* Step 3: Agency setup */}
            {currentStep === 3 && accountType === 'pro' && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={() => { setCurrentStep(2); setError(null) }}
                  className="flex items-center gap-1 text-sm text-[#9A88FD] font-semibold hover:underline mb-4"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>

                <h1
                  className="text-xl font-extrabold text-[#1A1A2E] mb-1"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  Set up your agency
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  This will appear on all your inspection reports
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4"
                    >
                      {getErrorMessage(error)}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 mb-6">
                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Agency name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={agencyName}
                      onChange={(e) => setAgencyName(e.target.value)}
                      placeholder="MULKEEF Real Estate"
                      className={`${inputClass} border-gray-200 bg-gray-50 focus:border-[#9A88FD] focus:bg-white focus:ring-2 focus:ring-[#9A88FD]/10`}
                    />
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                      Brand color
                    </label>
                    <div className="flex items-center gap-3">
                      <motion.input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        whileHover={{ scale: 1.05 }}
                        className="w-12 h-12 rounded-xl border border-gray-200 cursor-pointer p-0 overflow-hidden"
                      />
                      <span className="font-mono text-sm text-gray-600">{primaryColor}</span>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-500">
                      Used on your PDF reports. Update logo later in Settings.
                    </p>
                  </div>
                </div>

                <motion.button
                  type="button"
                  onClick={handleCreateAccountStep3}
                  disabled={loading}
                  whileTap={{ scale: 0.98 }}
                  className="w-full py-3.5 rounded-xl bg-[#9A88FD] text-white font-semibold text-sm
                    flex items-center justify-center gap-2 transition-all duration-150
                    hover:bg-[#8674FC] disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      Creating account...
                    </>
                  ) : (
                    <>
                      Create my account
                      <ArrowRight size={16} />
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Login link */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="text-center text-sm text-gray-500 mt-6"
        >
          Already have an account?{' '}
          <Link href="/login" className="text-[#9A88FD] font-semibold hover:underline">
            Log in
          </Link>
        </motion.p>
      </motion.div>
    </div>
  )
}
