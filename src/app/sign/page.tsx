'use client'
import { useEffect, useState, useRef, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Image from 'next/image'
import { Loader2, FileText, Check, RotateCcw, ShieldCheck } from 'lucide-react'
import { formatPropertyBuildingUnit } from '@/lib/formatPropertyAddress'
import { RefuseButton } from '@/app/sign/RefuseButton'

export const dynamic = 'force-dynamic'

type Step = 'loading' | 'overview' | 'otp' | 'pad' | 'done' | 'already_signed' | 'error'

interface SignInspectionData {
  type?: string
  created_at?: string
  report_url?: string
  rooms?: unknown[]
  agent?: {
    company?: {
      primary_color?: string
      name?: string
      logo_url?: string
    }
  }
  property?: {
    building_name?: string
    unit_number?: string
    location?: string
    // legacy
    address?: string
    [key: string]: unknown
  }
  tenancy?: {
    tenant_name?: string
    landlord_name?: string
    contract_from?: string
    contract_to?: string
    annual_rent?: string | number
    [key: string]: unknown
  }
}

function SignPageContent() {
  const params = useSearchParams()
  const inspectionId = params.get('inspectionId')
  const signerType = params.get('signerType') as 'landlord' | 'tenant'
  const email = params.get('email')

  const [step, setStep] = useState<Step>('loading')
  const [data, setData] = useState<SignInspectionData | null>(null)
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [otpLoading, setOtpLoading] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [submitLoading, setSubmitLoading] = useState(false)
  const [refuseToken, setRefuseToken] = useState<string | null>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const isDrawing = useRef(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  useEffect(() => {
    if (!inspectionId || !email) { setStep('error'); return }
    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectionId])

  async function fetchData() {
    const res = await fetch(
      `/api/sign/inspection-data?inspectionId=${inspectionId}&signerType=${signerType}&email=${encodeURIComponent(email || '')}`
    )

    if (!res.ok) {
      setStep('error')
      return
    }

    const { inspection, mySig, refuseToken: rt } = await res.json() as {
      inspection: SignInspectionData
      mySig?: { signed_at?: string | null }
      refuseToken?: string | null
    }

    setRefuseToken(rt ?? null)

    if (mySig?.signed_at) {
      setData(inspection)
      setStep('already_signed')
      return
    }

    setData(inspection)
    setStep('overview')
  }

  const primaryColor = data?.agent?.company?.primary_color || '#9A88FD'
  const agencyName = data?.agent?.company?.name || 'Snagify'
  const agencyLogo = data?.agent?.company?.logo_url
  const property = data?.property
  const tenancy = data?.tenancy
  const signerName = signerType === 'tenant'
    ? tenancy?.tenant_name
    : tenancy?.landlord_name

  function formatDate(d?: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-AE', {
      day: 'numeric', month: 'short', year: 'numeric'
    })
  }

  async function handleRequestOtp() {
    setOtpLoading(true)
    try {
      await fetch('/api/signatures/send-inperson-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionId, signerType,
          email, name: signerName,
        }),
      })
      setStep('otp')
      setTimeout(() => inputRefs.current[0]?.focus(), 100)
    } catch {
      setOtpError('Network error — please try again.')
    } finally {
      setOtpLoading(false)
    }
  }

  function handleOtpChange(i: number, val: string) {
    if (!/^\d*$/.test(val)) return
    const next = [...otp]
    next[i] = val.slice(-1)
    setOtp(next)
    setOtpError(null)
    if (val && i < 5) inputRefs.current[i + 1]?.focus()
    if (val && i === 5 && next.every(d => d)) verifyOtp(next.join(''))
  }

  function handleOtpKeyDown(i: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[i] && i > 0) inputRefs.current[i - 1]?.focus()
  }

  async function verifyOtp(code?: string) {
    const otpCode = code || otp.join('')
    if (otpCode.length !== 6) return
    setOtpLoading(true)
    setOtpError(null)
    const res = await fetch('/api/signatures/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId, signerType, otpCode }),
    })
    setOtpLoading(false)
    if (res.ok) {
      setStep('pad')
      setTimeout(() => initCanvas(), 150)
    } else {
      const d = await res.json()
      setOtpError(d.error === 'OTP expired'
        ? 'Code expired. Request a new one.'
        : 'Incorrect code. Please try again.')
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  function initCanvas() {
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    c.width = c.offsetWidth * window.devicePixelRatio
    c.height = c.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.strokeStyle = '#1A1A2E'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function getPos(c: HTMLCanvasElement, e: React.MouseEvent | React.TouchEvent) {
    const r = c.getBoundingClientRect()
    const touch = 'touches' in e ? e.touches[0] : e
    const cx = touch.clientX
    const cy = touch.clientY
    return { x: cx - r.left, y: cy - r.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    isDrawing.current = true
    setHasDrawn(true)
    const p = getPos(c, e)
    ctx.beginPath()
    ctx.moveTo(p.x, p.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing.current) return
    const c = canvasRef.current
    if (!c) return
    const ctx = c.getContext('2d')
    if (!ctx) return
    const p = getPos(c, e)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
  }

  function endDraw() { isDrawing.current = false }

  function clearPad() {
    const c = canvasRef.current
    if (!c) return
    c.getContext('2d')?.clearRect(0, 0, c.width, c.height)
    setHasDrawn(false)
  }

  async function submitSignature() {
    const c = canvasRef.current
    if (!c || !hasDrawn) return
    setSubmitLoading(true)
    try {
      const signatureData = c.toDataURL('image/png', 0.8)
      const res = await fetch('/api/signatures/submit-pad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId, signerType, signatureData }),
      })
      if (res.ok) setStep('done')
    } catch {
      setOtpError('Network error — please try again.')
    } finally {
      setSubmitLoading(false)
    }
  }

  const propAddress = formatPropertyBuildingUnit(property)

  if (step === 'loading') return (
    <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
      <Loader2 size={32} className="animate-spin text-[#9A88FD]" />
    </div>
  )

  if (step === 'error') return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center
      justify-center px-8 text-center gap-4">
      <div className="w-14 h-14 bg-red-50 rounded-2xl flex items-center
        justify-center">
        <FileText size={24} className="text-red-400" />
      </div>
      <div className="text-[17px] font-bold text-[#1A1A2E]">Link invalid</div>
      <div className="text-sm text-gray-500 leading-relaxed">
        This link is invalid or has expired. Please contact your inspector.
      </div>
    </div>
  )

  if (step === 'already_signed') return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center
      justify-center px-8 text-center gap-4">
      <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center
        justify-center">
        <Check size={24} className="text-green-600" />
      </div>
      <div className="text-[17px] font-bold text-[#1A1A2E]">Already signed</div>
      <div className="text-sm text-gray-500">
        You have already signed this report. Thank you!
      </div>
    </div>
  )

  if (step === 'done') return (
    <div className="min-h-screen bg-[#F8F7F4] flex flex-col items-center
      justify-center px-8 text-center gap-4">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center"
        style={{ background: primaryColor + '20' }}>
        <Check size={28} style={{ color: primaryColor }} />
      </div>
      <div className="text-[20px] font-extrabold text-[#1A1A2E]">
        Report signed!
      </div>
      <div className="text-sm text-gray-500 leading-relaxed">
        Your signature has been recorded.<br/>
        A copy will be sent to {email}.
      </div>
      <div className="mt-4 text-xs text-gray-400 flex items-center gap-1.5">
        <div className="w-2 h-2 rounded-full" style={{ background: primaryColor }} />
        Powered by Snagify
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-[#F8F7F4]">

      {/* Agency header */}
      <div className="px-5 pt-5 pb-6" style={{ background: primaryColor }}>
        <div className="flex items-center gap-3">
          {agencyLogo ? (
            <Image
              src={agencyLogo}
              alt={agencyName}
              width={48}
              height={48}
              className="w-12 h-12 rounded-2xl object-contain bg-white/20"
            />
          ) : (
            <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center
              justify-center">
              <span className="text-white font-bold text-lg">
                {agencyName.charAt(0)}
              </span>
            </div>
          )}
          <div>
            <div className="text-[18px] font-extrabold text-white"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              {agencyName}
            </div>
            <div className="text-[12px] text-white/70">
              Property Inspection Report
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 pb-32">

        {/* Property context */}
        <div className="bg-white rounded-2xl p-4 mb-3 border border-[#EEECFF]">
          <div className="text-[10px] font-bold text-[#9A88FD] uppercase
            tracking-wide mb-3">
            Property
          </div>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-10 h-10 bg-[#EDE9FF] rounded-xl flex items-center
              justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9.5L12 3l9 6.5V20H3z"
                  stroke="#9A88FD" strokeWidth="1.8" strokeLinejoin="round"/>
                <path d="M9 20v-6h6v6"
                  stroke="#9A88FD" strokeWidth="1.8" strokeLinejoin="round"/>
              </svg>
            </div>
            <div>
              <div className="text-[14px] font-bold text-[#1A1A2E]">
                {propAddress || '—'}
              </div>
              <div className="text-[12px] text-gray-500 mt-0.5">
                {data?.type === 'check-in' ? 'Check-in' : 'Check-out'}
                {' · '}
                {formatDate(data?.created_at)}
              </div>
            </div>
          </div>
          <div className="border-t border-[#F3F3F8] pt-3 space-y-2">
            {[
              { label: 'Tenant', value: tenancy?.tenant_name },
              { label: 'Landlord', value: tenancy?.landlord_name },
              { label: 'Contract', value: tenancy?.contract_from
                ? `${formatDate(tenancy.contract_from)} → ${formatDate(tenancy.contract_to)}`
                : null
              },
              { label: 'Annual rent', value: tenancy?.annual_rent
                ? `AED ${Number(tenancy.annual_rent).toLocaleString('en-AE')}`
                : null
              },
            ].filter(r => r.value).map((row, i) => (
              <div key={i} className="flex justify-between items-center">
                <span className="text-[12px] text-gray-400">{row.label}</span>
                <span className="text-[12px] font-semibold text-[#1A1A2E]">
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Signer card */}
        <div className="bg-white rounded-2xl p-4 mb-3 border border-[#EEECFF]">
          <div className="text-[10px] font-bold text-[#9A88FD] uppercase
            tracking-wide mb-3">
            You are signing as
          </div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full flex items-center justify-center
              text-white text-sm font-bold flex-shrink-0"
              style={{ background: primaryColor }}>
              {signerName?.split(' ').map((n: string) => n[0]).slice(0,2).join('') || '?'}
            </div>
            <div className="flex-1">
              <div className="text-[14px] font-bold text-[#1A1A2E]">
                {signerName || '—'}
              </div>
              <div className="text-[11px] text-gray-400 uppercase tracking-wide mt-0.5">
                {signerType}
              </div>
            </div>
            <span className="text-[10px] font-semibold text-amber-700
              bg-amber-50 border border-amber-200 rounded-full px-2.5 py-1
              flex-shrink-0">
              Awaiting signature
            </span>
          </div>
        </div>

        {/* Document preview */}
        <div className="bg-white rounded-2xl overflow-hidden mb-3
          border border-[#EEECFF]">
          <div className="flex items-center gap-3 p-4 border-b border-[#F3F3F8]">
            <div className="w-9 h-9 bg-[#EDE9FF] rounded-xl flex items-center
              justify-center flex-shrink-0">
              <FileText size={16} className="text-[#9A88FD]" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-bold text-[#1A1A2E]">
                Inspection Report
              </div>
              <div className="text-[11px] text-gray-400 mt-0.5">
                {property?.building_name || property?.location || 'Property'} ·{' '}
                {data?.type === 'check-in' ? 'Check-in' : 'Check-out'}
              </div>
            </div>
            {data?.report_url && (
              <a
                href={data.report_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[12px] font-semibold text-white rounded-xl
                  px-3 py-2 flex-shrink-0"
                style={{ background: primaryColor }}
              >
                View PDF
              </a>
            )}
          </div>
          {/* Mini page thumbnails */}
          <div className="flex items-center gap-3 px-4 py-3 bg-[#F8F7F4]">
            {[1,2,3].map(i => (
              <div key={i} className="w-12 h-16 bg-white rounded border
                border-[#EEECFF] overflow-hidden flex-shrink-0">
                <div className="h-2.5 w-full"
                  style={{ background: primaryColor }} />
                {[1,2,3].map(j => (
                  <div key={j} className={`h-1.5 bg-[#F3F3F8] rounded mx-1 mt-1
                    ${j === 2 ? 'w-3/5' : 'w-4/5'}`} />
                ))}
              </div>
            ))}
            <div className="text-[11px] text-gray-400 leading-relaxed">
              <span className="text-[13px] font-bold text-[#1A1A2E] block">
                {data?.rooms?.length || '—'} rooms
              </span>
              Read before signing
            </div>
          </div>
        </div>

        {/* Legal notice */}
        <div className="rounded-2xl p-4 mb-4 flex gap-3"
          style={{ background: primaryColor + '15' }}>
          <div className="w-7 h-7 rounded-lg flex items-center justify-center
            flex-shrink-0 mt-0.5"
            style={{ background: primaryColor }}>
            <ShieldCheck size={14} color="white" />
          </div>
          <p className="text-[12px] leading-relaxed"
            style={{ color: primaryColor }}>
            By signing, you confirm you have read this report and agree with its
            findings. This document is legally binding and verified by SHA-256.
          </p>
        </div>

        {/* OTP step */}
        {step === 'otp' && (
          <div className="bg-white rounded-2xl p-5 mb-4 border border-[#EEECFF]">
            <div className="text-[14px] font-bold text-[#1A1A2E] mb-1">
              Enter your verification code
            </div>
            <div className="text-[12px] text-gray-500 mb-4">
              A 6-digit code was sent to{' '}
              <span className="font-semibold text-[#1A1A2E]">{email}</span>
            </div>
            <div className="flex gap-2 justify-center mb-4">
              {otp.map((digit, i) => (
                <input
                  key={i}
                  ref={el => { inputRefs.current[i] = el }}
                  type="tel"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={e => handleOtpChange(i, e.target.value)}
                  onKeyDown={e => handleOtpKeyDown(i, e)}
                  className={`w-11 h-14 text-center text-xl font-bold rounded-xl
                    border-2 outline-none transition-all
                    ${digit
                      ? 'border-[#9A88FD] bg-[#EDE9FF] text-[#6B4FE8]'
                      : 'border-gray-200 bg-gray-50'
                    }
                    ${otpError ? '!border-red-300 !bg-red-50' : ''}`}
                />
              ))}
            </div>
            {otpError && (
              <p className="text-center text-sm text-red-500 mb-3">{otpError}</p>
            )}
            <button
              onClick={() => verifyOtp()}
              disabled={otp.some(d => !d) || otpLoading}
              className="w-full py-3.5 text-white font-bold rounded-xl
                flex items-center justify-center gap-2 disabled:opacity-40"
              style={{ background: primaryColor }}
            >
              {otpLoading
                ? <Loader2 size={18} className="animate-spin" />
                : 'Verify code'
              }
            </button>
            <button onClick={handleRequestOtp}
              disabled={otpLoading}
              className="w-full mt-2 py-2 text-sm text-gray-400 font-medium disabled:opacity-40">
              Resend code
            </button>
          </div>
        )}

        {/* Signature pad step */}
        {step === 'pad' && (
          <div className="bg-white rounded-2xl p-4 mb-4 border border-[#EEECFF]">
            <div className="text-[14px] font-bold text-[#1A1A2E] mb-1">
              Sign below
            </div>
            <div className="text-[12px] text-gray-400 mb-3">
              Use your finger to draw your signature
            </div>
            <div className="relative border-2 border-dashed rounded-2xl
              bg-gray-50 overflow-hidden mb-3"
              style={{ height: 180, borderColor: primaryColor + '40' }}>
              <canvas
                ref={canvasRef}
                className="w-full h-full cursor-crosshair"
                style={{ touchAction: 'none' }}
                onMouseDown={startDraw} onMouseMove={draw}
                onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
              {!hasDrawn && (
                <div className="absolute inset-0 flex items-center justify-center
                  pointer-events-none">
                  <span className="text-sm text-gray-400">Sign here</span>
                </div>
              )}
            </div>
            <div className="flex gap-2">
              <button onClick={clearPad}
                className="flex items-center gap-1.5 bg-gray-100 text-gray-600
                  rounded-xl px-4 py-3 text-sm font-semibold">
                <RotateCcw size={14} /> Clear
              </button>
              <button
                onClick={submitSignature}
                disabled={!hasDrawn || submitLoading}
                className="flex-1 text-white rounded-xl py-3 text-sm font-bold
                  flex items-center justify-center gap-2 disabled:opacity-40"
                style={{ background: primaryColor }}
              >
                {submitLoading
                  ? <Loader2 size={16} className="animate-spin" />
                  : <><Check size={16} /> Confirm signature</>
                }
              </button>
            </div>
            <RefuseButton
              refuseToken={refuseToken}
              inspectionId={inspectionId}
              signerType={signerType}
              email={email}
            />
          </div>
        )}

      </div>

      {/* Sticky CTA button (overview step only) */}
      {step === 'overview' && (
        <div className="fixed bottom-0 left-0 right-0 p-4 bg-gradient-to-t
          from-[#F8F7F4] to-transparent">
          <button
            onClick={handleRequestOtp}
            disabled={otpLoading}
            className="w-full py-4 text-white font-extrabold rounded-2xl
              flex items-center justify-center gap-2 text-[15px]
              disabled:opacity-50"
            style={{ background: primaryColor }}
          >
            {otpLoading
              ? <Loader2 size={20} className="animate-spin" />
              : <>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                      stroke="white" strokeWidth="2" strokeLinecap="round"
                      strokeLinejoin="round"/>
                  </svg>
                  Sign this report
                </>
            }
          </button>
          <RefuseButton
            refuseToken={refuseToken}
            inspectionId={inspectionId}
            signerType={signerType}
            email={email}
          />
          <p className="text-center text-[11px] text-gray-400 mt-2 flex
            items-center justify-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full inline-block"
              style={{ background: primaryColor }} />
            Powered by Snagify
          </p>
        </div>
      )}
    </div>
  )
}

export default function SignPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#F8F7F4] flex items-center justify-center">
        <Loader2 size={32} className="animate-spin text-[#9A88FD]" />
      </div>
    }>
      <SignPageContent />
    </Suspense>
  )
}
