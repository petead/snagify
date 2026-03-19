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

  const inputClass =
    'w-full px-4 py-3 rounded-xl border text-base transition-all duration-200 outline-none'

  const progressActive = currentStep === 1 ? 1 : 2

  return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="w-full max-w-md"
      >
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

        <div className="flex justify-center gap-2 mb-6" aria-label="Progress">
          {([1, 2] as const).map((step) => (
            <motion.div
              key={step}
              animate={{
                width: step === progressActive ? 24 : 8,
                backgroundColor: step <= progressActive ? '#9A88FD' : '#E5E7EB',
              }}
              transition={{ duration: 0.3 }}
              className="h-2 rounded-full"
            />
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-8 shadow-sm border border-gray-100"
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
                        {error}
                      </motion.div>
                    )}
                  </AnimatePresence>

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

                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                      Account type
                    </p>
                    <div className="flex gap-3 mb-1">
                      <button
                        type="button"
                        onClick={() => setAccountType('individual')}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95
                          ${accountType === 'individual'
                            ? 'bg-[#9A88FD] text-white border-[#9A88FD]'
                            : 'bg-white text-gray-500 border-gray-200'
                          }`}
                      >
                        Particulier
                      </button>
                      <button
                        type="button"
                        onClick={() => setAccountType('pro')}
                        className={`flex-1 py-3 rounded-xl text-sm font-semibold border transition-all active:scale-95
                          ${accountType === 'pro'
                            ? 'bg-[#9A88FD] text-white border-[#9A88FD]'
                            : 'bg-white text-gray-500 border-gray-200'
                          }`}
                      >
                        Pro
                      </button>
                    </div>
                  </div>

                  {accountType === 'pro' && (
                    <div>
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
                        className="w-full px-4 py-3 rounded-xl border border-gray-200 text-base bg-white focus:border-[#9A88FD] focus:ring-2 focus:ring-[#9A88FD]/10 outline-none transition-all duration-200"
                      />
                    </div>
                  )}

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
                    disabled={!canContinueStep1 || loading}
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
                  Branding
                </h1>
                <p className="text-sm text-gray-500 mb-6">
                  Company: <span className="font-semibold text-[#1A1A2E]">{companyName.trim() || '—'}</span>
                </p>

                <AnimatePresence>
                  {error && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 text-sm text-red-600 mb-4"
                    >
                      {error}
                    </motion.div>
                  )}
                </AnimatePresence>

                <div className="space-y-4 mb-6">
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
