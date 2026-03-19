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
type Step = 1 | 3

const inputFocus =
  'transition-all duration-200 focus:ring-2 focus:ring-[#9A88FD]/40 focus:border-[#9A88FD] focus:shadow-[0_0_0_4px_rgba(154,136,253,0.12)] outline-none'

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

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType>('individual')
  const [primaryColor, setPrimaryColor] = useState('#9A88FD')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [ctaStep1Hover, setCtaStep1Hover] = useState(false)
  const [ctaStep3Hover, setCtaStep3Hover] = useState(false)
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

  const proCompanyOk = accountType !== 'pro' || companyName.trim().length > 0

  const canContinueStep1 =
    fullName.trim().length > 0 &&
    emailValid &&
    passwordOk &&
    proCompanyOk

  const handleContinueStep1 = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canContinueStep1) return
    if (accountType === 'individual') {
      await handleSignup()
    } else {
      setCurrentStep(3)
    }
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
          accountType,
          companyName: accountType === 'pro' ? companyName.trim() : undefined,
          primaryColor: accountType === 'pro' ? primaryColor : '#9A88FD',
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

  const handleCreateAccountStep3 = () => {
    setError(null)
    if (accountType !== 'pro') return
    if (!companyName.trim()) {
      setError('Company name is required.')
      return
    }
    void handleSignup()
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-base ${inputFocus}`

  const progressActive = currentStep === 1 ? 1 : 2

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#F8F7F4] flex items-center justify-center p-4">
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

      <div className="relative z-10 w-full max-w-md">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
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

        <div className="flex justify-center gap-2 mb-6" aria-label="Progress">
          {([1, 2] as const).map((step) => (
            <motion.div
              key={step}
              animate={{
                width: step === progressActive ? 24 : 8,
                backgroundColor:
                  step === progressActive ? '#9A88FD' : 'rgba(154, 136, 253, 0.25)',
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 30 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.55, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-3xl border border-black/5 bg-white/90 p-8 shadow-2xl shadow-[#9A88FD]/10 ring-1 ring-black/5 backdrop-blur-sm"
        >
          <AnimatePresence mode="wait">
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.25 }}
              >
                <motion.div
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15, duration: 0.45 }}
                >
                  <h1
                    className="text-2xl font-extrabold text-[#1A1A2E] mb-1"
                    style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                  >
                    Create your account
                  </h1>
                  <p className="text-sm text-gray-500 mb-6">Enter your details to get started</p>
                </motion.div>

                <form onSubmit={handleContinueStep1} className="space-y-4">
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

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.4 }}
                  >
                    <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
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
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28, duration: 0.4 }}
                  >
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Account type
                    </p>
                    <div className="relative flex w-full gap-1 rounded-xl bg-gray-100 p-1">
                      <motion.div
                        layoutId="accountTypePill"
                        className="absolute left-1 top-1 bottom-1 z-0 rounded-lg bg-[#9A88FD] shadow-md"
                        style={{ width: 'calc(50% - 6px)' }}
                        initial={false}
                        animate={{
                          x: accountType === 'individual' ? 0 : 'calc(100% + 4px)',
                        }}
                        transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                      />
                      <button
                        type="button"
                        onClick={() => setAccountType('individual')}
                        className={`relative z-10 flex-1 rounded-lg py-3 text-sm font-semibold transition-colors duration-200 ${
                          accountType === 'individual' ? 'text-white' : 'text-gray-500'
                        }`}
                      >
                        Individual
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('pro')}
                        className={`relative z-10 flex-1 rounded-lg py-3 text-sm font-semibold transition-colors duration-200 ${
                          accountType === 'pro' ? 'text-white' : 'text-gray-500'
                        }`}
                      >
                        Pro
                      </button>
                    </div>
                  </motion.div>

                  <AnimatePresence>
                    {accountType === 'pro' && (
                      <motion.div
                        key="company-field"
                        initial={{ opacity: 0, y: 12, height: 0 }}
                        animate={{ opacity: 1, y: 0, height: 'auto' }}
                        exit={{ opacity: 0, y: -8, height: 0 }}
                        transition={{ duration: 0.3 }}
                      >
                        <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 block">
                          Company name
                        </label>
                        <input
                          type="text"
                          placeholder="Company name"
                          value={companyName}
                          onChange={(e) => setCompanyName(e.target.value)}
                          required
                          autoComplete="organization"
                          className={`${inputClass} border-gray-200 bg-white`}
                        />
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.36, duration: 0.4 }}
                  >
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
                  </motion.div>

                  <motion.div
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.44, duration: 0.4 }}
                  >
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
                        className={`${inputClass} pr-10 border-gray-200 bg-gray-50 focus:bg-white`}
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
                  </motion.div>

                  <motion.button
                    type="submit"
                    disabled={!canContinueStep1 || loading}
                    whileHover={{
                      scale: 1.02,
                      boxShadow: '0 8px 30px rgba(154,136,253,0.45)',
                    }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    onHoverStart={() => setCtaStep1Hover(true)}
                    onHoverEnd={() => setCtaStep1Hover(false)}
                    className="relative mt-2 w-full overflow-hidden rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <motion.div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      animate={{ x: ctaStep1Hover ? '200%' : '-100%' }}
                      transition={{ duration: 0.6, ease: 'easeInOut' }}
                    />
                    <span className="pointer-events-none relative z-10 flex items-center justify-center gap-2">
                      {loading ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating account...
                        </>
                      ) : accountType === 'individual' ? (
                        <>
                          Create my account →
                        </>
                      ) : (
                        <>
                          Continue
                          <ArrowRight size={16} />
                        </>
                      )}
                    </span>
                  </motion.button>
                </form>
              </motion.div>
            )}

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
                  onClick={() => {
                    setCurrentStep(1)
                    setError(null)
                  }}
                  className="mb-4 flex items-center gap-1 text-sm font-semibold text-[#9A88FD] hover:underline"
                >
                  <ArrowLeft size={14} />
                  Back
                </button>

                <h1
                  className="mb-1 text-xl font-extrabold text-[#1A1A2E]"
                  style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                >
                  Branding
                </h1>
                <p className="mb-6 text-sm text-gray-500">
                  Company:{' '}
                  <span className="font-semibold text-[#1A1A2E]">{companyName.trim() || '—'}</span>
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

                <div className="mb-6 space-y-4">
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                      Brand color
                    </label>
                    <div className="flex items-center gap-3">
                      <motion.input
                        type="color"
                        value={primaryColor}
                        onChange={(e) => setPrimaryColor(e.target.value)}
                        whileHover={{ scale: 1.05 }}
                        className="h-12 w-12 cursor-pointer overflow-hidden rounded-xl border border-gray-200 p-0"
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
                  whileHover={{
                    scale: 1.02,
                    boxShadow: '0 8px 30px rgba(154,136,253,0.45)',
                  }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  onHoverStart={() => setCtaStep3Hover(true)}
                  onHoverEnd={() => setCtaStep3Hover(false)}
                  className="relative w-full overflow-hidden rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <motion.div
                    aria-hidden
                    className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                    initial={{ x: '-100%' }}
                    animate={{ x: ctaStep3Hover ? '200%' : '-100%' }}
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
                        Create my account →
                      </>
                    )}
                  </span>
                </motion.button>
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
