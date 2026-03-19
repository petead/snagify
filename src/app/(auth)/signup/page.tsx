'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar'
import { analyzePassword } from '@/lib/passwordStrength'
import { cn } from '@/lib/utils'

type AccountType = 'individual' | 'pro'
type Step = 1 | 2 | 3

const inputFocus =
  'transition-all duration-200 focus:ring-2 focus:ring-[#9A88FD]/40 focus:border-[#9A88FD] focus:shadow-[0_0_0_4px_rgba(154,136,253,0.12)] outline-none'

const stepPresence = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
}

function getErrorMessage(error: string): string {
  if (error.includes('Invalid login credentials'))
    return 'Wrong email or password. Please try again.'
  if (error.includes('already registered') || error.includes('already in use'))
    return 'This email is already registered. Try signing in.'
  if (error.includes('Too many requests'))
    return 'Too many attempts. Please wait a few minutes.'
  if (error.includes('Network')) return 'Connection issue. Check your internet.'
  if (error.includes('COMPANY_EXISTS')) {
    return 'A company with this name already exists. Please contact your manager to be invited as an inspector.'
  }
  if (error.toLowerCase().includes('company already exists')) {
    return 'A company with this name already exists. Please contact your manager to be invited as an inspector.'
  }
  return error
}

const DEFAULT_PRO_COLOR = '#9A88FD'

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [reraNumber, setReraNumber] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [ctaFinalHover, setCtaFinalHover] = useState(false)
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
    fullName.trim().length > 0 && emailValid && passwordOk

  const handleContinueStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canContinueStep1) return
    setCurrentStep(2)
  }

  const handleContinueStep2 = () => {
    setError(null)
    if (accountType === null) return
    setCurrentStep(3)
  }

  const handleSignup = async () => {
    if (!accountType) return
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
          accountType,
          companyName: accountType === 'pro' ? companyName.trim() : undefined,
          primaryColor: DEFAULT_PRO_COLOR,
          reraNumber: reraNumber.trim() || undefined,
        }),
      })

      const data = (await res.json()) as { error?: string }
      if (!res.ok) {
        const msg = data.error || 'Signup failed'
        if (msg.includes('COMPANY_EXISTS')) {
          setError(
            'A company with this name already exists. Please contact your manager to be invited as an inspector.'
          )
        } else {
          setError(getErrorMessage(msg))
        }
        setLoading(false)
        return
      }

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

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!accountType) return
    if (accountType === 'pro' && !companyName.trim()) {
      setError('Company name is required.')
      return
    }
    void handleSignup()
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-base ${inputFocus}`

  const cardSpring = { type: 'spring' as const, stiffness: 400, damping: 30 }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F7F4] p-4">
      {/* Animated background blobs */}
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -left-16 -top-16 h-72 w-72 rounded-full bg-[#9A88FD]/20 blur-3xl"
        animate={{ y: [0, -30, 0], x: [0, 20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#9A88FD]/15 blur-3xl"
        animate={{ y: [0, 25, 0], x: [0, -20, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        aria-hidden
        className="pointer-events-none absolute right-[10%] top-1/3 h-48 w-48 rounded-full bg-[#FEDE80]/25 blur-2xl"
        animate={{ y: [0, -20, 0] }}
        transition={{ duration: 6, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="relative z-10 w-full max-w-xl">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
          className="mb-6 flex items-center justify-center gap-2"
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

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-black/5 bg-white/90 p-8 shadow-2xl shadow-[#9A88FD]/10 ring-1 ring-black/5 backdrop-blur-sm"
        >
          {/* Step indicator — 3 dots */}
          <div className="mb-8 flex justify-center gap-2" aria-label="Progress">
            {([1, 2, 3] as const).map((step) => (
              <motion.div
                key={step}
                className="h-2 rounded-full"
                animate={{
                  width: currentStep === step ? 24 : 8,
                  backgroundColor:
                    currentStep === step ? '#9A88FD' : 'rgba(154, 136, 253, 0.3)',
                }}
                transition={cardSpring}
              />
            ))}
          </div>

          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div key="step1" {...stepPresence}>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.05, duration: 0.3 }}
                >
                  <h1
                    className="mb-1 text-2xl font-extrabold text-[#1A1A2E]"
                    style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                  >
                    Create your account
                  </h1>
                  <p className="mb-6 text-sm text-gray-500">Enter your details to get started</p>
                </motion.div>

                <form onSubmit={handleContinueStep1} className="space-y-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Full name
                    </label>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      autoComplete="name"
                      placeholder="John Smith"
                      className={`${inputClass} border-gray-200 bg-gray-50 focus:bg-white`}
                    />
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
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
                        className={`${inputClass} ${
                          emailError
                            ? 'border-red-300 bg-red-50 focus:border-red-400 focus:ring-red-200'
                            : emailTouched && emailValid
                              ? 'border-green-300 bg-green-50 focus:border-green-400 focus:ring-green-200'
                              : 'border-gray-200 bg-gray-50 focus:bg-white'
                        }`}
                      />
                      <AnimatePresence>
                        {emailTouched && emailValid && (
                          <motion.span
                            initial={{ opacity: 0, scale: 0 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0 }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-lg text-green-500"
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
                          className="mt-1 text-xs text-red-500"
                        >
                          Please enter a valid email address
                        </motion.p>
                      )}
                    </AnimatePresence>
                  </div>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        autoComplete="new-password"
                        placeholder="••••••••"
                        className={`${inputClass} border-gray-200 bg-gray-50 pr-10 focus:bg-white`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 transition-colors hover:text-gray-600"
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
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="mt-2 w-full rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="flex items-center justify-center gap-2">
                      Continue
                      <ArrowRight size={18} />
                    </span>
                  </motion.button>
                </form>
              </motion.div>
            )}

            {currentStep === 2 && (
              <motion.div key="step2" {...stepPresence}>
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => {
                    setCurrentStep(1)
                    setError(null)
                  }}
                  className="mb-5 flex items-center gap-1 text-sm font-semibold text-[#9A88FD] hover:underline"
                >
                  ← Back
                </motion.button>

                <h1
                  className="mb-1 text-2xl font-extrabold text-[#1A1A2E]"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  How will you use Snagify?
                </h1>
                <p className="mb-6 text-sm text-gray-500">
                  We&apos;ll tailor your experience accordingly.
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <motion.button
                    type="button"
                    onClick={() => setAccountType('individual')}
                    animate={{ scale: accountType === 'individual' ? 1.02 : 1 }}
                    transition={cardSpring}
                    className={cn(
                      'relative rounded-2xl border-2 p-5 text-left transition-colors duration-200',
                      accountType === 'individual'
                        ? 'border-[#9A88FD] bg-[#9A88FD]/[0.08] shadow-lg shadow-[#9A88FD]/20'
                        : 'border-gray-200 bg-white'
                    )}
                  >
                    <div className="mb-3 text-4xl" aria-hidden>
                      🏠
                    </div>
                    <p className="text-lg font-bold text-[#1A1A2E]">Individual</p>
                    <p className="mb-3 text-sm text-gray-500">Landlord or tenant</p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> Up to 3 properties
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> Digital inspection reports
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> E-signature included
                      </li>
                    </ul>
                  </motion.button>

                  <motion.button
                    type="button"
                    onClick={() => setAccountType('pro')}
                    animate={{ scale: accountType === 'pro' ? 1.02 : 1 }}
                    transition={cardSpring}
                    className={cn(
                      'relative rounded-2xl border-2 p-5 text-left transition-colors duration-200',
                      accountType === 'pro'
                        ? 'border-[#9A88FD] bg-[#9A88FD]/[0.08] shadow-lg shadow-[#9A88FD]/20'
                        : 'border-gray-200 bg-white'
                    )}
                  >
                    <span className="absolute right-3 top-3 rounded-full bg-[#9A88FD] px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                      Most Popular
                    </span>
                    <div className="mb-3 text-4xl" aria-hidden>
                      🏢
                    </div>
                    <p className="text-lg font-bold text-[#1A1A2E]">Pro</p>
                    <p className="mb-3 text-sm text-gray-500">Agent or property manager</p>
                    <ul className="space-y-2 text-sm text-gray-600">
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> Unlimited properties
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> White-label reports
                      </li>
                      <li className="flex gap-2">
                        <span className="text-[#9A88FD]">✓</span> Team collaboration
                      </li>
                    </ul>
                  </motion.button>
                </div>

                <motion.button
                  type="button"
                  onClick={handleContinueStep2}
                  disabled={accountType === null}
                  whileHover={accountType !== null ? { scale: 1.02 } : {}}
                  whileTap={accountType !== null ? { scale: 0.98 } : {}}
                  transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                  className="mt-8 w-full rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center justify-center gap-2">
                    Continue
                    <ArrowRight size={18} />
                  </span>
                </motion.button>
              </motion.div>
            )}

            {currentStep === 3 && (
              <motion.div key="step3" {...stepPresence}>
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => {
                    setCurrentStep(2)
                    setError(null)
                  }}
                  className="mb-5 flex items-center gap-1 text-sm font-semibold text-[#9A88FD] hover:underline"
                >
                  ← Back
                </motion.button>

                <h1
                  className="mb-1 text-2xl font-extrabold text-[#1A1A2E]"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  Almost there! 🎉
                </h1>
                <p className="mb-6 text-sm text-gray-500">Just a couple more things.</p>

                <form onSubmit={handleFinalSubmit} className="space-y-4">
                  <AnimatePresence>
                    {error && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-600"
                      >
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <AnimatePresence>
                    {accountType === 'pro' && (
                      <motion.div
                        key="company-step3"
                        initial={{ opacity: 0, x: 24 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -16 }}
                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      >
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Company name
                        </label>
                        <input
                          type="text"
                          placeholder="Company name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          autoComplete="organization"
                          className={`${inputClass} border-gray-200 bg-gray-50 focus:bg-white`}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      RERA number <span className="font-normal normal-case text-gray-400">(optional)</span>
                    </label>
                    <input
                      type="text"
                      value={reraNumber}
                      onChange={(e) => setReraNumber(e.target.value)}
                      placeholder="RERA number (optional)"
                      autoComplete="off"
                      className={`${inputClass} border-gray-200 bg-gray-50 focus:bg-white`}
                    />
                  </div>

                  <motion.button
                    type="submit"
                    disabled={loading}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: '0 8px 30px rgba(154,136,253,0.45)',
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onHoverStart={() => setCtaFinalHover(true)}
                    onHoverEnd={() => setCtaFinalHover(false)}
                    className="relative mt-2 w-full overflow-hidden rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: ctaFinalHover ? '200%' : '-100%' }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                    />
                    <span className="pointer-events-none relative z-10 flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>
                          Create my account
                          <ArrowRight size={18} />
                        </>
                      )}
                    </span>
                  </motion.button>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6, duration: 0.4 }}
          className="mt-6 text-center text-sm text-gray-500"
        >
          Already have an account?{' '}
          <Link href="/login" className="font-semibold text-[#9A88FD] hover:underline">
            Log in
          </Link>
        </motion.div>
      </div>
    </div>
  )
}
