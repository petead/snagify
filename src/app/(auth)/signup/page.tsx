'use client'

import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import type SignatureCanvas from 'react-signature-canvas'
import { ProSignupSignaturePad } from '@/components/auth/ProSignupSignaturePad'
import Cropper, { type Area } from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { Eye, EyeOff, Loader2, ArrowRight, UploadCloud, Check } from 'lucide-react'
import { createBrowserClient } from '@supabase/ssr'
import { PasswordStrengthBar } from '@/components/auth/PasswordStrengthBar'
import { analyzePassword } from '@/lib/passwordStrength'
import { cn } from '@/lib/utils'
import { getCroppedImg } from '@/utils/cropImage'

type AccountType = 'individual' | 'pro'
type IndividualRole = 'owner' | 'tenant'
type Step = 1 | 2 | 3
type ProSubStep = 1 | 2 | 3 | 4

const LOGO_MAX_BYTES = 5 * 1024 * 1024
const LOGO_ACCEPT_TYPES = [
  'image/png',
  'image/svg+xml',
  'image/jpeg',
  'image/webp',
] as const

const inputFocus =
  'transition-all duration-200 focus:ring-2 focus:ring-[#9A88FD]/40 focus:border-[#9A88FD] focus:shadow-[0_0_0_4px_rgba(154,136,253,0.12)] outline-none'

const stepPresence = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
}

const proSubPresence = {
  initial: { opacity: 0, x: 40 },
  animate: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -40 },
  transition: { duration: 0.35, ease: [0.16, 1, 0.3, 1] as const },
}

const COLOR_PRESETS = ['#9A88FD', '#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#1E1E1E'] as const

const springBar = { type: 'spring' as const, stiffness: 300, damping: 30 }
const springCheck = { type: 'spring' as const, stiffness: 500, damping: 28 }

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

function TypewriterHeading({
  text,
  className,
}: {
  text: string
  className?: string
}) {
  const chars = useMemo(() => Array.from(text), [text])
  return (
    <h1
      className={cn(
        'mb-1 text-2xl font-extrabold text-[#1A1A2E]',
        className
      )}
      style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
    >
      {chars.map((c, i) => (
        <motion.span
          key={`${i}-${c}`}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.02, duration: 0.18, ease: 'easeOut' }}
          className="inline-block"
        >
          {c === ' ' ? '\u00A0' : c}
        </motion.span>
      ))}
    </h1>
  )
}

function StaggerField({
  index,
  children,
}: {
  index: number
  children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.08,
        duration: 0.4,
        ease: [0.16, 1, 0.3, 1],
      }}
    >
      {children}
    </motion.div>
  )
}

function ProInputShell({
  children,
  showValid,
  errorMsg,
}: {
  children: React.ReactNode
  showValid: boolean
  errorMsg?: string | null
}) {
  return (
    <div className="relative w-full">
      <div className="relative">
        {children}
        <AnimatePresence>
          {showValid && (
            <motion.span
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0 }}
              transition={springCheck}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-lg text-green-500"
            >
              ✓
            </motion.span>
          )}
        </AnimatePresence>
      </div>
      <AnimatePresence>
        {errorMsg ? (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            className="mt-1 text-xs text-red-500"
          >
            {errorMsg}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  )
}

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h
  const n = parseInt(full, 16)
  if (Number.isNaN(n)) return `rgba(154,136,253,${alpha})`
  const r = (n >> 16) & 255
  const g = (n >> 8) & 255
  const b = n & 255
  return `rgba(${r},${g},${b},${alpha})`
}

export default function SignupPage() {
  const [currentStep, setCurrentStep] = useState<Step>(1)
  const [proSubStep, setProSubStep] = useState<ProSubStep>(1)
  const [fullName, setFullName] = useState('')
  const [companyName, setCompanyName] = useState('')
  const [companyEmail, setCompanyEmail] = useState('')
  const [companyPhone, setCompanyPhone] = useState('')
  const [addressLine1, setAddressLine1] = useState('')
  const [city, setCity] = useState('Dubai')
  const [country, setCountry] = useState('UAE')
  const [tradeLicense, setTradeLicense] = useState('')
  const [brandPrimaryColor, setBrandPrimaryColor] = useState('#9A88FD')
  const [croppedLogoBlob, setCroppedLogoBlob] = useState<Blob | null>(null)
  const [logoPreviewUrl, setLogoPreviewUrl] = useState<string | null>(null)
  const [logoError, setLogoError] = useState<string | null>(null)
  const [cropModalOpen, setCropModalOpen] = useState(false)
  const [imageToCropSrc, setImageToCropSrc] = useState<string | null>(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [applyingCrop, setApplyingCrop] = useState(false)
  const croppedAreaPixelsRef = useRef<Area | null>(null)
  const logoFileInputRef = useRef<HTMLInputElement>(null)
  const [reraNumber, setReraNumber] = useState('')
  const [proWebsite, setProWebsite] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [accountType, setAccountType] = useState<AccountType | null>(null)
  const [individualRole, setIndividualRole] = useState<IndividualRole | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [emailTouched, setEmailTouched] = useState(false)
  const [logoHover, setLogoHover] = useState(false)
  const [proFieldErrors, setProFieldErrors] = useState<Record<string, string>>({})
  const sigPadRef = useRef<SignatureCanvas | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [isSigEmpty, setIsSigEmpty] = useState(true)
  const router = useRouter()

  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  )

  useEffect(() => {
    if (!croppedLogoBlob) {
      setLogoPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(croppedLogoBlob)
    setLogoPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [croppedLogoBlob])

  useEffect(() => {
    if (cropModalOpen || !imageToCropSrc) return
    const timer = window.setTimeout(() => {
      setImageToCropSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      croppedAreaPixelsRef.current = null
      if (logoFileInputRef.current) logoFileInputRef.current.value = ''
    }, 400)
    return () => clearTimeout(timer)
  }, [cropModalOpen, imageToCropSrc])

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
  const emailError = emailTouched && email && !emailValid
  const passwordAnalysis = analyzePassword(password)
  const passwordOk = passwordAnalysis.score >= 2
  const companyEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(companyEmail.trim())

  const canContinueStep1 =
    fullName.trim().length > 0 && emailValid && passwordOk

  const showDubaiFlag = city.trim().toLowerCase() === 'dubai'

  const clearProError = useCallback((key: string) => {
    setProFieldErrors((prev) => {
      const next = { ...prev }
      delete next[key]
      return next
    })
  }, [])

  const handleContinueStep1 = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    if (!canContinueStep1) return
    setCurrentStep(2)
  }

  const handleStep2Continue = async () => {
    setError(null)
    if (accountType === null) return
    if (accountType === 'individual') {
      if (individualRole === null) return
      await handleSubmit()
    } else {
      setProSubStep(1)
      setCurrentStep(3)
    }
  }

  const canContinueStep2 =
    (accountType === 'individual' && individualRole !== null) ||
    accountType === 'pro'

  const plans = useMemo(
    () =>
      [
        {
          id: 'individual' as const,
          title: 'Individual',
          subtitle: 'Perfect for landlords & tenants',
          icon: (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
              <polyline points="9 22 9 12 15 12 15 22" />
            </svg>
          ),
          color: '#9A88FD',
          tag: null as string | null,
          tagColor: null as string | null,
          price: 'Free to start',
          priceDetail: 'Pay per inspection',
          features: [
            { icon: '🏠', text: 'Up to 3 properties' },
            { icon: '📋', text: 'Digital inspection reports' },
            { icon: '✍️', text: 'E-signature included' },
            { icon: '📸', text: 'AI photo analysis' },
          ],
          highlight: 'Great for managing your own rental',
        },
        {
          id: 'pro' as const,
          title: 'Pro',
          subtitle: 'Built for agents & managers',
          icon: (
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="2" y="7" width="20" height="14" rx="2" />
              <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
              <line x1="12" y1="12" x2="12" y2="16" />
              <line x1="10" y1="14" x2="14" y2="14" />
            </svg>
          ),
          color: '#7C3AED',
          tag: '⭐ Most Popular',
          tagColor: 'bg-gradient-to-r from-[#7C3AED] to-[#9A88FD]',
          price: 'Credits based',
          priceDetail: 'Volume discounts available',
          features: [
            { icon: '∞', text: 'Unlimited properties' },
            { icon: '🎨', text: 'White-label reports' },
            { icon: '👥', text: 'Team collaboration' },
            { icon: '✍️', text: 'Saved inspector signature' },
          ],
          highlight: 'Trusted by 500+ agents in Dubai',
        },
      ] as const,
    []
  )

  const handleSubmit = async () => {
    if (!accountType) return
    if (accountType === 'individual' && individualRole === null) return
    setLoading(true)
    setError(null)
    // #region agent log
    fetch('http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '116434' },
      body: JSON.stringify({
        sessionId: '116434',
        runId: 'signup-onboarding-pre-fix',
        hypothesisId: 'H2',
        location: 'src/app/(auth)/signup/page.tsx:394',
        message: 'handleSubmit start',
        data: { accountType, hasIndividualRole: Boolean(individualRole) },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    // #endregion
    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName.trim(),
            account_type: accountType,
          },
        },
      })

      if (authError) throw new Error(authError.message)
      const user = authData?.user
      if (!user) throw new Error('Signup failed — no user returned')
      // #region agent log
      fetch('http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '116434' },
        body: JSON.stringify({
          sessionId: '116434',
          runId: 'signup-onboarding-pre-fix',
          hypothesisId: 'H2',
          location: 'src/app/(auth)/signup/page.tsx:417',
          message: 'signUp result',
          data: { hasUser: Boolean(user), hasSession: Boolean(authData?.session) },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion

      if (!authData.session) {
        const { error: signInErr } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (signInErr) throw new Error(signInErr.message)
      }

      let websiteTrimmed = proWebsite.trim()
      if (
        accountType === 'pro' &&
        websiteTrimmed &&
        !/^https?:\/\//i.test(websiteTrimmed)
      ) {
        websiteTrimmed = `https://${websiteTrimmed}`
      }

      const res = await fetch('/api/onboarding/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          fullName: fullName.trim(),
          email,
          accountType,
          individualRole: accountType === 'individual' ? individualRole : null,
          companyName: accountType === 'pro' ? companyName.trim() : undefined,
          companyEmail: accountType === 'pro' ? companyEmail.trim() : undefined,
          phone: accountType === 'pro' ? companyPhone.trim() : undefined,
          address: accountType === 'pro' ? addressLine1.trim() : undefined,
          city: accountType === 'pro' ? city.trim() : undefined,
          country: accountType === 'pro' ? country.trim() : undefined,
          tradeLicense: accountType === 'pro' ? tradeLicense.trim() || undefined : undefined,
          primaryColor: accountType === 'pro' ? brandPrimaryColor : undefined,
          website: accountType === 'pro' ? websiteTrimmed || undefined : undefined,
          reraNumber: accountType === 'pro' ? reraNumber.trim() || undefined : undefined,
        }),
      })
      // #region agent log
      fetch('http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '116434' },
        body: JSON.stringify({
          sessionId: '116434',
          runId: 'signup-onboarding-pre-fix',
          hypothesisId: 'H2',
          location: 'src/app/(auth)/signup/page.tsx:494',
          message: 'onboarding API response status',
          data: { status: res.status, ok: res.ok },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion

      const result = (await res.json()) as {
        error?: string
        companyId?: string
        success?: boolean
      }

      if (!res.ok) {
        const raw = result.error || 'Onboarding failed'
        if (process.env.NODE_ENV === 'development') {
          console.error('[signup] /api/onboarding/complete failed:', res.status, raw)
        }
        throw new Error(raw)
      }

      if (accountType === 'pro' && croppedLogoBlob && result.companyId) {
        const logoFile = new File([croppedLogoBlob], 'logo.png', { type: 'image/png' })
        const logoPath = `logos/${user.id}/company-logo.png`
        const { error: logoErr } = await supabase.storage
          .from('avatars')
          .upload(logoPath, logoFile, { upsert: true })
        if (logoErr) {
          console.error('Logo upload failed:', logoErr)
        } else {
          const {
            data: { publicUrl },
          } = supabase.storage.from('avatars').getPublicUrl(logoPath)
          await supabase.from('profiles').update({ company_logo_url: publicUrl }).eq('id', user.id)
          await supabase
            .from('companies')
            .update({ logo_url: publicUrl })
            .eq('id', result.companyId)
        }
      }

      if (accountType === 'pro') {
        const pad = sigPadRef.current
        let sigBlob: Blob | null = signatureBlob
        if (!sigBlob && pad && !pad.isEmpty()) {
          sigBlob = await new Promise<Blob | null>((resolve) => {
            pad.getTrimmedCanvas().toBlob((b) => resolve(b), 'image/png')
          })
        }
        if (sigBlob) {
          const fd = new FormData()
          fd.append('signature', sigBlob, 'signature.png')
          const sigRes = await fetch('/api/profile/inspector-signature', {
            method: 'POST',
            body: fd,
          })
          if (!sigRes.ok) {
            console.error('[signup] Inspector signature upload failed')
          }
        }
      }

      router.push('/dashboard')
      router.refresh()
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (process.env.NODE_ENV === 'development') {
        console.error('Signup error:', err)
      }
      // #region agent log
      fetch('http://127.0.0.1:7620/ingest/2d2a86d0-4e2c-4ff3-bf45-64aa83a51471', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Debug-Session-Id': '116434' },
        body: JSON.stringify({
          sessionId: '116434',
          runId: 'signup-onboarding-pre-fix',
          hypothesisId: 'H4',
          location: 'src/app/(auth)/signup/page.tsx:568',
          message: 'handleSubmit catch',
          data: { errorMessage: msg },
          timestamp: Date.now(),
        }),
      }).catch(() => {})
      // #endregion
      setError(getErrorMessage(msg))
    } finally {
      setLoading(false)
    }
  }

  const validateProSub1 = () => {
    const err: Record<string, string> = {}
    if (!companyName.trim()) err.companyName = 'Company name is required.'
    if (!companyEmail.trim() || !companyEmailValid)
      err.companyEmail = 'Valid company email is required.'
    if (!companyPhone.trim()) err.phone = 'Phone number is required.'
    const w = proWebsite.trim()
    if (w) {
      try {
        const u = w.match(/^https?:\/\//i) ? w : `https://${w}`
        // eslint-disable-next-line no-new
        new URL(u)
      } catch {
        err.website = 'Enter a valid URL.'
      }
    }
    setProFieldErrors(err)
    return Object.keys(err).length === 0
  }

  const validateProSub2 = () => {
    const err: Record<string, string> = {}
    if (!addressLine1.trim()) err.addressLine1 = 'Address is required.'
    if (!city.trim()) err.city = 'City is required.'
    if (!country.trim()) err.country = 'Country is required.'
    setProFieldErrors(err)
    return Object.keys(err).length === 0
  }

  const handleProStep3Next = (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    clearProError('website')
    const w = proWebsite.trim()
    if (w) {
      try {
        const u = w.match(/^https?:\/\//i) ? w : `https://${w}`
        // eslint-disable-next-line no-new
        new URL(u)
      } catch {
        setProFieldErrors((prev) => ({ ...prev, website: 'Enter a valid URL.' }))
        return
      }
    }
    setProSubStep(4)
  }

  const onLogoFileChosen = (file: File | null) => {
    setLogoError(null)
    if (!file) return
    if (file.size > LOGO_MAX_BYTES) {
      setLogoError('File too large. Max size is 5MB.')
      return
    }
    if (!(LOGO_ACCEPT_TYPES as readonly string[]).includes(file.type)) {
      setLogoError('Please upload a PNG, JPG, WebP or SVG file.')
      return
    }
    setImageToCropSrc((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(file)
    })
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    croppedAreaPixelsRef.current = null
    setCropModalOpen(true)
  }

  const handleCropCancel = () => {
    setCropModalOpen(false)
  }

  const handleCropApply = async () => {
    const src = imageToCropSrc
    const area = croppedAreaPixelsRef.current
    if (!src || !area) return
    setApplyingCrop(true)
    setLogoError(null)
    try {
      const blob = await getCroppedImg(src, area)
      setCroppedLogoBlob(blob)
      setImageToCropSrc((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setCropModalOpen(false)
      setCrop({ x: 0, y: 0 })
      setZoom(1)
      croppedAreaPixelsRef.current = null
      if (logoFileInputRef.current) logoFileInputRef.current.value = ''
    } catch (e) {
      console.error(e)
      setLogoError('Could not crop this image. Try another file.')
    } finally {
      setApplyingCrop(false)
    }
  }

  const inputClass = `w-full px-4 py-3 rounded-xl border text-base ${inputFocus}`
  const cardSpring = { type: 'spring' as const, stiffness: 400, damping: 30 }

  const totalSteps = accountType === 'pro' ? 3 : 2

  const proProgressWidth = `${(proSubStep / 4) * 100}%`

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#F8F7F4] p-4">
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

      <div
        className={cn(
          'relative z-10 w-full',
          currentStep === 3 && accountType === 'pro' ? 'max-w-2xl' : 'max-w-xl'
        )}
      >
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
          <div className="mb-8 flex min-h-[8px] justify-center gap-2" aria-label="Progress">
            <AnimatePresence initial={false} mode="popLayout">
              {Array.from({ length: totalSteps }, (_, i) => i + 1).map((step) => (
                <motion.div
                  key={step}
                  layout
                  initial={
                    step === 3 ? { opacity: 0, scale: 0.4, width: 0 } : false
                  }
                  animate={{
                    opacity: 1,
                    scale: 1,
                    width: currentStep === step ? 24 : 8,
                    backgroundColor:
                      currentStep === step ? '#9A88FD' : 'rgba(154, 136, 253, 0.3)',
                  }}
                  exit={
                    step === 3
                      ? { opacity: 0, scale: 0.4, width: 0 }
                      : { opacity: 0, width: 0 }
                  }
                  transition={cardSpring}
                  className="h-2 shrink-0 rounded-full"
                />
              ))}
            </AnimatePresence>
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
                  className="mb-5 text-sm font-semibold text-[#9A88FD] hover:underline"
                >
                  ← Back
                </motion.button>

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

                <motion.div
                  key="step-2"
                  initial={{ opacity: 0, x: 40 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -40 }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  className="flex flex-col"
                  style={{ gap: 0 }}
                >
                  {/* Header */}
                  <div style={{ marginBottom: 28 }}>
                    <h2 style={{
                      fontFamily: 'Poppins, sans-serif', fontWeight: 800,
                      fontSize: 26, color: '#0E0E10', margin: '0 0 6px', lineHeight: 1.2,
                    }}>
                      How will you use Snagify?
                    </h2>
                    <p style={{ fontSize: 14, color: 'rgba(14,14,16,0.45)', margin: 0 }}>
                      Pick the plan that fits your world.
                    </p>
                  </div>

                  {/* Plan cards */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {plans.map((plan, idx) => {
                      const isSelected = accountType === plan.id
                      const isPro = plan.id === 'pro'

                      return (
                        <motion.div
                          key={plan.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: 0.06 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                          onClick={() => { setAccountType(plan.id); setIndividualRole(null) }}
                          style={{ cursor: 'pointer', position: 'relative' }}
                        >
                          {/* Most popular badge */}
                          {plan.tag && (
                            <div style={{
                              position: 'absolute', top: -11, left: 20, zIndex: 10,
                              background: 'linear-gradient(135deg, #7C3AED, #9A88FD)',
                              color: 'white', fontSize: 9, fontWeight: 800,
                              letterSpacing: '1.2px', textTransform: 'uppercase',
                              padding: '4px 12px', borderRadius: 999,
                              boxShadow: '0 4px 14px rgba(124,58,237,0.4)',
                              fontFamily: 'Poppins, sans-serif',
                            }}>
                              ⭐ Most Popular
                            </div>
                          )}

                          <motion.div
                            animate={{
                              background: isSelected
                                ? isPro
                                  ? 'linear-gradient(145deg, #0E0E10 0%, #1C1A2E 100%)'
                                  : '#FAFAFA'
                                : '#FFFFFF',
                              borderColor: isSelected
                                ? isPro ? '#7C3AED' : '#9A88FD'
                                : 'rgba(14,14,16,0.1)',
                              boxShadow: isSelected
                                ? isPro
                                  ? '0 8px 40px rgba(124,58,237,0.25), inset 0 1px 0 rgba(255,255,255,0.05)'
                                  : '0 4px 24px rgba(154,136,253,0.2)'
                                : '0 1px 4px rgba(0,0,0,0.04)',
                            }}
                            transition={{ duration: 0.25 }}
                            style={{
                              borderRadius: 20, border: '1.5px solid',
                              overflow: 'hidden',
                              paddingTop: plan.tag ? 18 : 0,
                            }}
                          >
                            {/* Animated top bar */}
                            <motion.div
                              animate={{
                                opacity: isSelected ? 1 : 0,
                                scaleX: isSelected ? 1 : 0,
                              }}
                              transition={{ duration: 0.3 }}
                              style={{
                                height: 3, transformOrigin: 'left',
                                background: isPro
                                  ? 'linear-gradient(90deg, #7C3AED, #9A88FD, #CAFE87)'
                                  : 'linear-gradient(90deg, #9A88FD, #B8AEFF)',
                              }}
                            />

                            <div style={{ padding: '18px 20px' }}>
                              {/* Title row */}
                              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                  <motion.div
                                    animate={{
                                      background: isSelected
                                        ? isPro ? 'rgba(154,136,253,0.15)' : 'rgba(154,136,253,0.12)'
                                        : '#F3F4F6',
                                    }}
                                    style={{
                                      width: 44, height: 44, borderRadius: 14,
                                      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                    }}
                                  >
                                    <motion.span
                                      animate={{ color: isSelected ? plan.color : '#9CA3AF' }}
                                    >
                                      {plan.icon}
                                    </motion.span>
                                  </motion.div>
                                  <div>
                                    <motion.p
                                      animate={{ color: isSelected && isPro ? '#FFFFFF' : '#0E0E10' }}
                                      style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 16, margin: 0 }}
                                    >
                                      {plan.title}
                                    </motion.p>
                                    <motion.p
                                      animate={{ color: isSelected && isPro ? 'rgba(255,255,255,0.45)' : 'rgba(14,14,16,0.45)' }}
                                      style={{ fontSize: 12, margin: '2px 0 0' }}
                                    >
                                      {plan.subtitle}
                                    </motion.p>
                                  </div>
                                </div>

                                {/* Radio */}
                                <motion.div
                                  animate={{
                                    borderColor: isSelected ? plan.color : '#D1D5DB',
                                    backgroundColor: isSelected ? plan.color : 'transparent',
                                    scale: isSelected ? 1.1 : 1,
                                  }}
                                  style={{ width: 22, height: 22, borderRadius: '50%', border: '2px solid', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}
                                >
                                  <AnimatePresence>
                                    {isSelected && (
                                      <motion.div
                                        key="dot"
                                        initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}
                                        style={{ width: 8, height: 8, borderRadius: '50%', background: 'white' }}
                                      />
                                    )}
                                  </AnimatePresence>
                                </motion.div>
                              </div>

                              {/* Price pill */}
                              <motion.div
                                animate={{
                                  background: isSelected
                                    ? isPro ? 'rgba(154,136,253,0.15)' : 'rgba(154,136,253,0.1)'
                                    : '#F3F4F6',
                                }}
                                style={{
                                  display: 'inline-flex', alignItems: 'center', gap: 6,
                                  padding: '5px 12px', borderRadius: 999, marginBottom: 14,
                                }}
                              >
                                <motion.span
                                  animate={{ color: isSelected ? plan.color : '#374151' }}
                                  style={{ fontSize: 12, fontWeight: 700, fontFamily: 'Poppins, sans-serif' }}
                                >
                                  {plan.price}
                                </motion.span>
                                <motion.span
                                  animate={{ color: isSelected && isPro ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.4)' }}
                                  style={{ fontSize: 11 }}
                                >
                                  · {plan.priceDetail}
                                </motion.span>
                              </motion.div>

                              {/* Features grid */}
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 8px' }}>
                                {plan.features.map((feat, fi) => (
                                  <motion.div
                                    key={feat.text}
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    transition={{ delay: 0.1 + fi * 0.03 }}
                                    style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                                  >
                                    <span style={{ fontSize: 13, lineHeight: 1 }}>{feat.icon}</span>
                                    <motion.span
                                      animate={{ color: isSelected && isPro ? 'rgba(255,255,255,0.6)' : 'rgba(14,14,16,0.55)' }}
                                      style={{ fontSize: 11, lineHeight: 1.3 }}
                                    >
                                      {feat.text}
                                    </motion.span>
                                  </motion.div>
                                ))}
                              </div>

                              {/* Highlight — selected only */}
                              <AnimatePresence>
                                {isSelected && (
                                  <motion.div
                                    initial={{ opacity: 0, height: 0, marginTop: 0 }}
                                    animate={{ opacity: 1, height: 'auto', marginTop: 14 }}
                                    exit={{ opacity: 0, height: 0, marginTop: 0 }}
                                    transition={{ duration: 0.25 }}
                                    style={{ overflow: 'hidden' }}
                                  >
                                    <div style={{
                                      display: 'flex', alignItems: 'center', gap: 6,
                                      borderTop: `1px solid ${isPro ? 'rgba(255,255,255,0.08)' : 'rgba(14,14,16,0.07)'}`,
                                      paddingTop: 12,
                                    }}>
                                      <svg width="11" height="11" viewBox="0 0 24 24" fill={plan.color}>
                                        <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
                                      </svg>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: isPro ? 'rgba(255,255,255,0.55)' : plan.color }}>
                                        {plan.highlight}
                                      </span>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>

                            {/* Individual role sub-selection */}
                            <AnimatePresence>
                              {plan.id === 'individual' && accountType === 'individual' && (
                                <motion.div
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  exit={{ opacity: 0, height: 0 }}
                                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                                  style={{ overflow: 'hidden', borderTop: '1px solid rgba(14,14,16,0.07)' }}
                                >
                                  <div style={{ padding: '14px 20px' }}>
                                    <p style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1.5px', color: 'rgba(14,14,16,0.4)', margin: '0 0 10px', fontFamily: 'Poppins, sans-serif' }}>
                                      I am a...
                                    </p>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                                      {([
                                        { value: 'owner' as const, label: 'Owner', sub: 'I own a property', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                                        { value: 'tenant' as const, label: 'Tenant', sub: 'I rent a property', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg> },
                                      ]).map(opt => (
                                        <motion.button
                                          key={opt.value}
                                          type="button"
                                          whileTap={{ scale: 0.97 }}
                                          onClick={e => { e.stopPropagation(); setIndividualRole(opt.value) }}
                                          animate={{
                                            borderColor: individualRole === opt.value ? '#9A88FD' : '#E5E7EB',
                                            backgroundColor: individualRole === opt.value ? 'rgba(154,136,253,0.08)' : '#FAFAFA',
                                            color: individualRole === opt.value ? '#9A88FD' : '#6B7280',
                                          }}
                                          style={{
                                            borderRadius: 12, border: '1.5px solid', padding: '10px 12px',
                                            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                                            gap: 4, cursor: 'pointer', background: 'none',
                                          }}
                                        >
                                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                            {opt.icon}
                                            <span style={{ fontFamily: 'Poppins, sans-serif', fontWeight: 700, fontSize: 13 }}>{opt.label}</span>
                                          </div>
                                          <span style={{ fontSize: 11, opacity: 0.7, lineHeight: 1 }}>{opt.sub}</span>
                                        </motion.button>
                                      ))}
                                    </div>
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </motion.div>
                        </motion.div>
                      )
                    })}
                  </div>
                </motion.div>

                  <motion.button
                    type="button"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.28 }}
                    whileHover={
                      canContinueStep2 && !loading
                        ? {
                            scale: 1.02,
                            boxShadow: '0 8px 32px rgba(154,136,253,0.45)',
                          }
                        : {}
                    }
                    whileTap={canContinueStep2 && !loading ? { scale: 0.98 } : {}}
                    disabled={!canContinueStep2 || loading}
                    onClick={() => void handleStep2Continue()}
                    className={cn(
                      'relative mt-4 w-full overflow-hidden rounded-2xl py-4 text-base font-semibold text-white transition-all duration-200',
                      canContinueStep2 && !loading ? 'bg-[#9A88FD]' : 'bg-[#9A88FD]/35',
                      !canContinueStep2 && !loading && 'cursor-not-allowed',
                      loading && 'cursor-wait'
                    )}
                  >
                    <motion.div
                      className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '200%' }}
                      transition={{ duration: 0.55 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading && accountType === 'individual' ? (
                        <>
                          <Loader2 size={18} className="animate-spin" />
                          Creating account...
                        </>
                      ) : (
                        <>Continue →</>
                      )}
                    </span>
                  </motion.button>

              </motion.div>
            )}

            {currentStep === 3 && accountType === 'pro' && (
              <motion.div key="step3-pro" {...stepPresence} className="relative">
                <motion.button
                  type="button"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.25 }}
                  onClick={() => {
                    setError(null)
                    if (proSubStep > 1) {
                      setProSubStep((s) => (s - 1) as ProSubStep)
                    } else {
                      setCurrentStep(2)
                      setProSubStep(1)
                    }
                  }}
                  className="mb-4 text-sm font-semibold text-[#9A88FD] hover:underline"
                >
                  ← Back
                </motion.button>

                <div className="mb-6 h-1 w-full overflow-hidden rounded-full bg-gray-100">
                  <motion.div
                    className="h-full rounded-full bg-[#9A88FD]"
                    initial={false}
                    animate={{ width: proProgressWidth }}
                    transition={springBar}
                  />
                </div>

                <AnimatePresence mode="wait">
                  {proSubStep === 1 && (
                    <motion.div key="pro-sub-1" {...proSubPresence} className="space-y-4">
                      <TypewriterHeading text="Tell us about your company 🏢" />

                      <StaggerField index={0}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Company name <span className="text-red-500">*</span>
                        </label>
                        <ProInputShell
                          showValid={!!companyName.trim() && !proFieldErrors.companyName}
                          errorMsg={proFieldErrors.companyName}
                        >
                          <input
                            type="text"
                            value={companyName}
                            onChange={(e) => {
                              setCompanyName(e.target.value)
                              clearProError('companyName')
                            }}
                            autoComplete="organization"
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.companyName && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={1}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Company email <span className="text-red-500">*</span>
                        </label>
                        <ProInputShell
                          showValid={companyEmailValid && !proFieldErrors.companyEmail}
                          errorMsg={proFieldErrors.companyEmail}
                        >
                          <input
                            type="email"
                            value={companyEmail}
                            onChange={(e) => {
                              setCompanyEmail(e.target.value)
                              clearProError('companyEmail')
                            }}
                            autoComplete="email"
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.companyEmail && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={2}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Phone number <span className="text-red-500">*</span>
                        </label>
                        <ProInputShell
                          showValid={!!companyPhone.trim() && !proFieldErrors.phone}
                          errorMsg={proFieldErrors.phone}
                        >
                          <input
                            type="tel"
                            value={companyPhone}
                            onChange={(e) => {
                              setCompanyPhone(e.target.value)
                              clearProError('phone')
                            }}
                            placeholder="+971 XX XXX XXXX"
                            autoComplete="tel"
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.phone && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={3}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          RERA number{' '}
                          <span className="font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <ProInputShell
                          showValid={!!reraNumber.trim()}
                          errorMsg={null}
                        >
                          <input
                            type="text"
                            value={reraNumber}
                            onChange={(e) => setReraNumber(e.target.value)}
                            placeholder="RERA registration number (optional)"
                            autoComplete="off"
                            className={`${inputClass} border-gray-200 bg-gray-50 pr-10 focus:bg-white`}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={4}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Website{' '}
                          <span className="font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <ProInputShell
                          showValid={!!proWebsite.trim() && !proFieldErrors.website}
                          errorMsg={proFieldErrors.website}
                        >
                          <input
                            type="url"
                            value={proWebsite}
                            onChange={(e) => {
                              setProWebsite(e.target.value)
                              clearProError('website')
                            }}
                            placeholder="https://yourcompany.com"
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.website && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <motion.button
                        type="button"
                        onClick={() => {
                          if (validateProSub1()) setProSubStep(2)
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                        className="mt-2 w-full rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white"
                      >
                        <span className="flex items-center justify-center gap-2">
                          Next
                          <ArrowRight size={18} />
                        </span>
                      </motion.button>
                    </motion.div>
                  )}

                  {proSubStep === 2 && (
                    <motion.div key="pro-sub-2" {...proSubPresence} className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setProSubStep(1)}
                        className="text-sm font-semibold text-[#9A88FD] hover:underline"
                      >
                        ← Back
                      </button>

                      <h1
                        className="mb-1 text-2xl font-extrabold text-[#1A1A2E]"
                        style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                      >
                        Where are you based? 📍
                      </h1>

                      <StaggerField index={0}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Address line 1 <span className="text-red-500">*</span>
                        </label>
                        <ProInputShell
                          showValid={!!addressLine1.trim() && !proFieldErrors.addressLine1}
                          errorMsg={proFieldErrors.addressLine1}
                        >
                          <input
                            type="text"
                            value={addressLine1}
                            onChange={(e) => {
                              setAddressLine1(e.target.value)
                              clearProError('addressLine1')
                            }}
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.addressLine1 && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={1}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          City <span className="text-red-500">*</span>
                        </label>
                        <div className="flex items-start gap-2">
                          <div className="min-w-0 flex-1">
                            <ProInputShell
                              showValid={!!city.trim() && !proFieldErrors.city}
                              errorMsg={proFieldErrors.city}
                            >
                              <input
                                type="text"
                                value={city}
                                onChange={(e) => {
                                  setCity(e.target.value)
                                  clearProError('city')
                                }}
                                className={cn(
                                  inputClass,
                                  'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                                  proFieldErrors.city && 'border-red-400 bg-red-50'
                                )}
                              />
                            </ProInputShell>
                          </div>
                          <AnimatePresence>
                            {showDubaiFlag && (
                              <motion.span
                                initial={{ opacity: 0, scale: 0 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0 }}
                                transition={springCheck}
                                className="mt-3 text-2xl leading-none"
                                aria-hidden
                              >
                                🇦🇪
                              </motion.span>
                            )}
                          </AnimatePresence>
                        </div>
                      </StaggerField>

                      <StaggerField index={2}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Country <span className="text-red-500">*</span>
                        </label>
                        <ProInputShell
                          showValid={!!country.trim() && !proFieldErrors.country}
                          errorMsg={proFieldErrors.country}
                        >
                          <input
                            type="text"
                            value={country}
                            onChange={(e) => {
                              setCountry(e.target.value)
                              clearProError('country')
                            }}
                            className={cn(
                              inputClass,
                              'border-gray-200 bg-gray-50 pr-10 focus:bg-white',
                              proFieldErrors.country && 'border-red-400 bg-red-50'
                            )}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <StaggerField index={3}>
                        <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                          Trade license number{' '}
                          <span className="font-normal normal-case text-gray-400">(optional)</span>
                        </label>
                        <ProInputShell showValid={!!tradeLicense.trim()} errorMsg={null}>
                          <input
                            type="text"
                            value={tradeLicense}
                            onChange={(e) => setTradeLicense(e.target.value)}
                            placeholder="Trade license no. (optional)"
                            className={`${inputClass} border-gray-200 bg-gray-50 pr-10 focus:bg-white`}
                          />
                        </ProInputShell>
                      </StaggerField>

                      <motion.button
                        type="button"
                        onClick={() => {
                          if (validateProSub2()) setProSubStep(3)
                        }}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        className="mt-2 w-full rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white"
                      >
                        <span className="flex items-center justify-center gap-2">
                          Next
                          <ArrowRight size={18} />
                        </span>
                      </motion.button>
                    </motion.div>
                  )}

                  {proSubStep === 3 && (
                    <motion.div key="pro-sub-3" {...proSubPresence} className="space-y-4">
                      <button
                        type="button"
                        onClick={() => setProSubStep(2)}
                        className="text-sm font-semibold text-[#9A88FD] hover:underline"
                      >
                        ← Back
                      </button>

                      <h1
                        className="mb-1 text-2xl font-extrabold text-[#1A1A2E]"
                        style={{ fontFamily: 'var(--font-heading), Poppins, sans-serif' }}
                      >
                        Make it yours ✨
                      </h1>
                      <p className="mb-4 text-sm text-gray-500">
                        Your brand will appear on all inspection reports.
                      </p>

                      <form onSubmit={handleProStep3Next} className="space-y-4">
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

                        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                          <StaggerField index={0}>
                            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Logo
                            </label>
                            <input
                              ref={logoFileInputRef}
                              type="file"
                              accept="image/png,image/svg+xml,image/jpeg,image/webp"
                              className="hidden"
                              onChange={(e) => {
                                const f = e.target.files?.[0] ?? null
                                onLogoFileChosen(f)
                              }}
                            />
                            <motion.div
                              onHoverStart={() => setLogoHover(true)}
                              onHoverEnd={() => setLogoHover(false)}
                              animate={{ scale: logoHover ? 1.01 : 1 }}
                              transition={springCheck}
                              className={cn(
                                'flex min-h-[180px] flex-col items-center justify-center rounded-2xl border-2 border-dashed bg-gray-50 p-6 transition-colors',
                                logoHover ? 'border-[#9A88FD]' : 'border-gray-200',
                                !logoPreviewUrl && 'cursor-pointer'
                              )}
                              onClick={() => {
                                if (!logoPreviewUrl) logoFileInputRef.current?.click()
                              }}
                              role={!logoPreviewUrl ? 'button' : undefined}
                              tabIndex={!logoPreviewUrl ? 0 : undefined}
                              onKeyDown={(e) => {
                                if (!logoPreviewUrl && (e.key === 'Enter' || e.key === ' ')) {
                                  e.preventDefault()
                                  logoFileInputRef.current?.click()
                                }
                              }}
                            >
                              <AnimatePresence mode="wait">
                                {logoPreviewUrl ? (
                                  <motion.div
                                    key="prev"
                                    initial={{ opacity: 0, scale: 0.92 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.92 }}
                                    transition={springCheck}
                                    className="flex flex-col items-center"
                                  >
                                    {/* eslint-disable-next-line @next/next/no-img-element */}
                                    <img
                                      src={logoPreviewUrl}
                                      alt="Logo preview"
                                      className="h-28 w-28 rounded-full object-cover shadow-md ring-2 ring-white"
                                    />
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation()
                                        logoFileInputRef.current?.click()
                                      }}
                                      className="mt-3 text-sm font-semibold text-[#9A88FD] hover:underline"
                                    >
                                      Change
                                    </button>
                                  </motion.div>
                                ) : (
                                  <motion.div
                                    key="placeholder"
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="flex flex-col items-center text-center"
                                  >
                                    <UploadCloud className="mb-2 h-10 w-10 text-gray-400" />
                                    <span className="text-sm font-semibold text-[#1A1A2E]">
                                      Upload your logo
                                    </span>
                                    <span className="mt-1 text-xs text-gray-500">
                                      PNG, JPG or SVG · Max 5MB · Will be cropped to square
                                    </span>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </motion.div>
                            <AnimatePresence>
                              {logoError && (
                                <motion.p
                                  initial={{ opacity: 0, y: -4 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: -4 }}
                                  className="mt-2 text-xs text-red-500"
                                >
                                  {logoError}
                                </motion.p>
                              )}
                            </AnimatePresence>
                          </StaggerField>

                          <StaggerField index={1}>
                            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Brand color
                            </p>
                            <div className="mb-3 grid grid-cols-3 gap-2 sm:grid-cols-6 md:grid-cols-3">
                              {COLOR_PRESETS.map((c) => {
                                const selected = brandPrimaryColor.toLowerCase() === c.toLowerCase()
                                return (
                                  <motion.button
                                    key={c}
                                    type="button"
                                    onClick={() => setBrandPrimaryColor(c)}
                                    whileTap={{ scale: 1.2 }}
                                    transition={springCheck}
                                    className="relative flex h-9 w-9 items-center justify-center rounded-xl border-2 border-transparent shadow-sm"
                                    style={{ backgroundColor: c }}
                                    aria-label={`Color ${c}`}
                                  >
                                    {selected && (
                                      <motion.span
                                        initial={{ scale: 0 }}
                                        animate={{ scale: 1 }}
                                        transition={springCheck}
                                      >
                                        <Check className="h-4 w-4 text-white drop-shadow" strokeWidth={3} />
                                      </motion.span>
                                    )}
                                  </motion.button>
                                )
                              })}
                            </div>
                            <label className="mb-1 block text-xs text-gray-500">Custom color</label>
                            <input
                              type="color"
                              value={brandPrimaryColor}
                              onChange={(e) => setBrandPrimaryColor(e.target.value)}
                              className="h-10 w-full max-w-[120px] cursor-pointer rounded-lg border border-gray-200 bg-white"
                            />

                            <motion.div
                              className="mt-4 overflow-hidden rounded-xl border border-gray-100 shadow-sm transition-colors duration-300"
                              style={{ backgroundColor: brandPrimaryColor }}
                            >
                              <div className="px-4 py-3">
                                <p className="text-sm font-bold text-white">Snagify</p>
                              </div>
                              <div className="bg-white px-4 py-3">
                                <p className="text-xs text-gray-500">Your reports will look like this</p>
                              </div>
                            </motion.div>
                          </StaggerField>
                        </div>

                        <motion.button
                          type="submit"
                          whileHover={{
                            scale: 1.02,
                            boxShadow: `0 8px 30px ${hexToRgba(brandPrimaryColor || '#9A88FD', 0.45)}`,
                          }}
                          whileTap={{ scale: 0.97 }}
                          transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                          style={{
                            backgroundColor: brandPrimaryColor?.trim() || '#9A88FD',
                          }}
                          className="relative mt-4 w-full overflow-hidden rounded-2xl py-4 text-base font-semibold text-white"
                        >
                          <span className="pointer-events-none relative z-10 flex items-center justify-center gap-2">
                            Next
                            <ArrowRight size={18} />
                          </span>
                        </motion.button>
                      </form>
                    </motion.div>
                  )}

                  {proSubStep === 4 && (
                    <motion.div
                      key="pro-sub-4"
                      initial={{ opacity: 0, x: 40 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -40 }}
                      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                      className="space-y-4"
                    >
                      <button
                        type="button"
                        onClick={() => setProSubStep(3)}
                        className="text-sm font-semibold text-[#9A88FD] hover:underline"
                      >
                        ← Back
                      </button>

                      <motion.h2
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.05 }}
                        className="mb-1 text-xl font-bold text-gray-900"
                      >
                        Your signature ✍️
                      </motion.h2>

                      <motion.p
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.1 }}
                        className="mb-6 text-sm text-gray-400"
                      >
                        This will appear on all your inspection reports. Draw it once — use it forever.
                      </motion.p>

                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.15 }}
                        className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[#9A88FD]/40 bg-white"
                        style={{ height: 200 }}
                      >
                        <div className="pointer-events-none absolute bottom-12 left-6 right-6 border-b border-dashed border-gray-200" />

                        <AnimatePresence>
                          {isSigEmpty && (
                            <motion.div
                              key="sig-hint"
                              initial={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2"
                            >
                              <span className="text-3xl">✍️</span>
                              <span className="text-sm text-gray-300">Draw your signature here</span>
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <ProSignupSignaturePad
                          ref={sigPadRef}
                          penColor="#1a1a1a"
                          canvasProps={{
                            className: 'w-full h-full',
                            style: { width: '100%', height: '100%' },
                          }}
                          onBegin={() => setIsSigEmpty(false)}
                          onEnd={() => {
                            sigPadRef.current?.getTrimmedCanvas().toBlob(
                              (blob) => setSignatureBlob(blob),
                              'image/png'
                            )
                          }}
                          backgroundColor="rgba(0,0,0,0)"
                          dotSize={2}
                          minWidth={1.5}
                          maxWidth={3}
                          velocityFilterWeight={0.7}
                        />
                      </motion.div>

                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 }}
                        className="mb-6 mt-3 flex items-center justify-between"
                      >
                        <button
                          type="button"
                          onClick={() => {
                            sigPadRef.current?.clear()
                            setSignatureBlob(null)
                            setIsSigEmpty(true)
                          }}
                          className="flex items-center gap-1.5 text-sm text-gray-400 transition-colors hover:text-red-400"
                        >
                          <svg
                            width="14"
                            height="14"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                          >
                            <polyline points="3 6 5 6 21 6" />
                            <path d="M19 6l-1 14H6L5 6" />
                            <path d="M10 11v6M14 11v6" />
                            <path d="M9 6V4h6v2" />
                          </svg>
                          Clear
                        </button>

                        <AnimatePresence>
                          {!isSigEmpty && signatureBlob && (
                            <motion.div
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              exit={{ opacity: 0, scale: 0.8 }}
                              className="flex items-center gap-1.5 rounded-full bg-[#9A88FD]/10 px-3 py-1 text-xs text-[#9A88FD]"
                            >
                              <span className="h-1.5 w-1.5 rounded-full bg-[#9A88FD]" />
                              Signature captured
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>

                      <p className="mb-2 text-center text-xs text-gray-300">
                        You can also add or update your signature later in Settings.
                      </p>

                      <button
                        type="button"
                        onClick={() => void handleSubmit()}
                        disabled={loading}
                        className="mb-4 w-full text-center text-sm font-semibold text-[#9A88FD] transition-colors hover:underline disabled:opacity-50"
                      >
                        Skip for now →
                      </button>

                      <motion.button
                        type="button"
                        whileHover={{
                          scale: 1.02,
                          boxShadow: '0 8px 30px rgba(154,136,253,0.45)',
                        }}
                        whileTap={{ scale: 0.97 }}
                        disabled={loading || (isSigEmpty && !signatureBlob)}
                        onClick={() => void handleSubmit()}
                        className={cn(
                          'relative w-full overflow-hidden rounded-2xl bg-[#9A88FD] py-4 text-base font-semibold text-white',
                          (isSigEmpty && !signatureBlob) || loading
                            ? 'cursor-not-allowed opacity-50'
                            : ''
                        )}
                      >
                        <motion.div
                          className="pointer-events-none absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                          initial={{ x: '-100%' }}
                          whileHover={{ x: '200%' }}
                          transition={{ duration: 0.6 }}
                        />
                        <span className="relative z-10 flex items-center justify-center gap-2">
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
                      <AnimatePresence>
                        {error && (
                          <motion.p
                            key="signup-final-error"
                            initial={{ opacity: 0, y: -4 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -4 }}
                            className="mt-2 text-center text-sm text-red-500"
                          >
                            {error}
                          </motion.p>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </AnimatePresence>
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

      <AnimatePresence>
        {cropModalOpen && imageToCropSrc && (
          <motion.div
            key="crop-overlay"
            className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-4 sm:items-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 40 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 border-b border-gray-100 px-4 py-3">
                <span className="text-lg" aria-hidden>
                  ✂️
                </span>
                <h2 className="text-lg font-bold text-[#1A1A2E]">Crop your logo</h2>
              </div>
              <div className="relative h-72 w-full bg-gray-900">
                <Cropper
                  image={imageToCropSrc}
                  crop={crop}
                  zoom={zoom}
                  aspect={1}
                  cropShape="round"
                  showGrid={false}
                  onCropChange={setCrop}
                  onZoomChange={setZoom}
                  onCropComplete={(_area, areaPixels) => {
                    croppedAreaPixelsRef.current = areaPixels
                  }}
                />
              </div>
              <div className="flex items-center justify-end gap-3 border-t border-gray-100 px-4 py-4">
                <button
                  type="button"
                  onClick={handleCropCancel}
                  className="text-sm font-semibold text-gray-500 hover:text-gray-800"
                >
                  Cancel
                </button>
                <motion.button
                  type="button"
                  disabled={applyingCrop}
                  onClick={() => void handleCropApply()}
                  whileHover={{ scale: applyingCrop ? 1 : 1.02 }}
                  whileTap={{ scale: applyingCrop ? 1 : 0.98 }}
                  className="rounded-xl bg-[#9A88FD] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                >
                  {applyingCrop ? 'Applying…' : 'Apply crop ✓'}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
