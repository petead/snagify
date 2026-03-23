'use client'
import { useState, useRef, useEffect } from 'react'
import { X, Send, RotateCcw, Check, Loader2 } from 'lucide-react'

interface Props {
  inspectionId: string
  signerType: 'landlord' | 'tenant'
  signerName: string
  signerEmail: string
  refuseToken: string | null
  onSuccess: () => void
  onClose: () => void
}

type Step = 'sending' | 'otp' | 'pad' | 'done'

export function InPersonSignModal({
  inspectionId, signerType, signerName, signerEmail,
  refuseToken, onSuccess, onClose
}: Props) {
  const [step, setStep] = useState<Step>('sending')
  const [otp, setOtp] = useState(['', '', '', '', '', ''])
  const [otpError, setOtpError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [showRefuseForm, setShowRefuseForm] = useState(false)
  const [refuseReason, setRefuseReason] = useState('')
  const [refuseLoading, setRefuseLoading] = useState(false)
  const [refuseDone, setRefuseDone] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [isDrawing, setIsDrawing] = useState(false)
  const [hasDrawn, setHasDrawn] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Auto-send OTP on mount
  useEffect(() => {
    sendOtp()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function sendOtp() {
    setStep('sending')
    setLoading(true)
    try {
      const res = await fetch('/api/signatures/send-inperson-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inspectionId, signerType,
          email: signerEmail, name: signerName,
        }),
      })
      if (res.ok) {
        setStep('otp')
        setTimeout(() => inputRefs.current[0]?.focus(), 100)
      }
    } catch {
      setOtpError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (!/^\d*$/.test(value)) return
    const newOtp = [...otp]
    newOtp[index] = value.slice(-1)
    setOtp(newOtp)
    setOtpError(null)
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus()
    }
    if (value && index === 5 && newOtp.every(d => d !== '')) {
      verifyOtp(newOtp.join(''))
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
  }

  async function verifyOtp(code?: string) {
    const otpCode = code || otp.join('')
    if (otpCode.length !== 6) return
    setLoading(true)
    setOtpError(null)
    const res = await fetch('/api/signatures/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ inspectionId, signerType, otpCode }),
    })
    setLoading(false)
    if (res.ok) {
      setStep('pad')
      setTimeout(() => initCanvas(), 100)
    } else {
      const data = await res.json()
      setOtpError(
        data.error === 'OTP expired'
          ? 'Code expired. Please request a new one.'
          : 'Invalid code. Please try again.'
      )
      setOtp(['', '', '', '', '', ''])
      inputRefs.current[0]?.focus()
    }
  }

  function initCanvas() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    canvas.width = canvas.offsetWidth * window.devicePixelRatio
    canvas.height = canvas.offsetHeight * window.devicePixelRatio
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.strokeStyle = '#1A1A2E'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }

  function getPos(canvas: HTMLCanvasElement, e: React.Touch | React.MouseEvent) {
    const rect = canvas.getBoundingClientRect()
    const clientX = 'clientX' in e ? e.clientX : 0
    const clientY = 'clientY' in e ? e.clientY : 0
    return { x: clientX - rect.left, y: clientY - rect.top }
  }

  function startDraw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    setIsDrawing(true)
    setHasDrawn(true)
    const touch = 'touches' in e ? e.touches[0] : e
    const pos = getPos(canvas, touch)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
  }

  function draw(e: React.MouseEvent | React.TouchEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const touch = 'touches' in e ? e.touches[0] : e
    const pos = getPos(canvas, touch)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw() { setIsDrawing(false) }

  function clearPad() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function submitSignature() {
    const canvas = canvasRef.current
    if (!canvas || !hasDrawn) return
    const signatureData = canvas.toDataURL('image/png', 0.8)
    setLoading(true)
    try {
      const res = await fetch('/api/signatures/submit-pad', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inspectionId, signerType, signatureData }),
      })
      if (res.ok) {
        setStep('done')
        setTimeout(() => onSuccess(), 1500)
      }
    } catch {
      setOtpError('Network error — please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRefuse() {
    if (!refuseToken) return
    setRefuseLoading(true)
    try {
      const res = await fetch('/api/signatures/refuse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: refuseToken, reason: refuseReason }),
      })
      if (res.ok) {
        setRefuseDone(true)
        setTimeout(() => onClose(), 2000)
      }
    } catch {
      // silent fail — user can try again
    } finally {
      setRefuseLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end sm:items-center
      justify-center sm:p-4"
      style={{ paddingBottom: 64 }}>
      <div className="bg-white w-full sm:max-w-md rounded-t-3xl sm:rounded-3xl
        flex flex-col"
        style={{ maxHeight: 'calc(100vh - 64px - env(safe-area-inset-bottom))' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
          border-b border-gray-100 flex-shrink-0">
          <div>
            <div className="text-xs font-semibold text-[#9A88FD] uppercase
              tracking-wide mb-0.5">
              {signerType === 'tenant' ? 'Tenant' : 'Landlord'}
            </div>
            <div className="text-[15px] font-bold text-[#1A1A2E]">
              {signerName}
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 flex items-center
              justify-center">
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* STEP: sending */}
        {step === 'sending' && (
          <div className="px-5 py-10 text-center">
            <div className="w-14 h-14 bg-[#EDE9FF] rounded-2xl mx-auto mb-4
              flex items-center justify-center">
              <Loader2 size={24} className="animate-spin text-[#9A88FD]" />
            </div>
            <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">
              Sending code…
            </div>
            <div className="text-sm text-gray-500">
              A 6-digit code is being sent to
            </div>
            <div className="text-sm font-semibold text-[#9A88FD] mt-0.5">
              {signerEmail}
            </div>
          </div>
        )}

        {/* STEP: otp */}
        {step === 'otp' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 py-6">
              <div className="text-center mb-6">
                <div className="w-12 h-12 bg-[#EDE9FF] rounded-2xl mx-auto mb-3
                  flex items-center justify-center">
                  <Send size={20} className="text-[#9A88FD]" />
                </div>
                <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">
                  Enter the code
                </div>
                <div className="text-sm text-gray-500">
                  Ask {signerName.split(' ')[0]} to check{' '}
                  <span className="font-semibold text-[#1A1A2E]">
                    {signerEmail}
                  </span>{' '}
                  and read the 6-digit code
                </div>
              </div>

              {/* OTP inputs */}
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
                        : 'border-gray-200 bg-gray-50 text-[#1A1A2E]'
                      }
                      ${otpError ? 'border-red-300 bg-red-50' : ''}
                      focus:border-[#9A88FD] focus:bg-white`}
                  />
                ))}
              </div>

              {otpError && (
                <p className="text-center text-sm text-red-500">
                  {otpError}
                </p>
              )}
            </div>

            {/* Sticky buttons */}
            <div className="px-5 pb-4 pt-2 bg-white flex-shrink-0 border-t border-gray-100">
              <button
                onClick={() => verifyOtp()}
                disabled={otp.some(d => !d) || loading}
                className="w-full py-3.5 bg-[#9A88FD] text-white font-bold
                  rounded-xl flex items-center justify-center gap-2
                  disabled:opacity-40 transition-opacity"
              >
                {loading
                  ? <Loader2 size={18} className="animate-spin" />
                  : 'Verify code'
                }
              </button>
              <button
                onClick={sendOtp}
                disabled={loading}
                className="w-full mt-2 py-2 text-sm text-gray-400
                  font-medium text-center disabled:opacity-40"
              >
                Resend code
              </button>
            </div>
          </div>
        )}

        {/* STEP: pad */}
        {step === 'pad' && (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Scrollable content */}
            <div className="flex-1 overflow-y-auto px-5 pt-4 pb-2">
              <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">
                Sign below
              </div>
              <div className="text-sm text-gray-500 mb-3">
                Hand the device to {signerName.split(' ')[0]}
              </div>

              {/* Canvas */}
              <div
                className="relative border-2 border-dashed rounded-2xl
                  bg-gray-50 overflow-hidden"
                style={{ height: 200, borderColor: 'rgba(154,136,253,0.3)' }}
              >
                <canvas
                  ref={canvasRef}
                  className="w-full h-full touch-none cursor-crosshair"
                  onMouseDown={startDraw}
                  onMouseMove={draw}
                  onMouseUp={endDraw}
                  onMouseLeave={endDraw}
                  onTouchStart={startDraw}
                  onTouchMove={draw}
                  onTouchEnd={endDraw}
                />
                {!hasDrawn && (
                  <div className="absolute inset-0 flex items-center
                    justify-center pointer-events-none">
                    <span className="text-sm text-gray-400">
                      Sign here with your finger
                    </span>
                  </div>
                )}
              </div>

              {/* Signature line */}
              <div className="flex items-center gap-2 mt-3 px-2">
                <div className="flex-1 h-px bg-gray-200" />
                <span className="text-xs text-gray-400">signature</span>
                <div className="flex-1 h-px bg-gray-200" />
              </div>
            </div>

            {/* Sticky action buttons — always visible */}
            <div className="px-5 py-4 border-t border-gray-100 flex gap-2
              bg-white flex-shrink-0">
              <button
                onClick={clearPad}
                className="flex items-center gap-1.5 bg-gray-100
                  text-gray-600 rounded-xl px-4 py-3 text-sm font-semibold
                  flex-shrink-0"
              >
                <RotateCcw size={14} />
                Clear
              </button>
              <button
                onClick={submitSignature}
                disabled={!hasDrawn || loading}
                className="flex-1 bg-[#9A88FD] text-white rounded-xl py-3
                  text-sm font-bold flex items-center justify-center gap-2
                  disabled:opacity-40 transition-opacity"
              >
                {loading ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <>
                    <Check size={16} />
                    Confirm signature
                  </>
                )}
              </button>
            </div>

            {refuseToken && !refuseDone && (
              <div className="px-5 pb-4 bg-white flex-shrink-0">
                {!showRefuseForm ? (
                  <div className="text-center">
                    <p className="text-[11px] text-gray-400 mb-1">
                      Do you contest the findings?
                    </p>
                    <button
                      type="button"
                      onClick={() => setShowRefuseForm(true)}
                      className="text-[12px] font-semibold text-[#EF4444]
                        underline bg-transparent border-none cursor-pointer"
                    >
                      Refuse to sign this report
                    </button>
                  </div>
                ) : (
                  <div className="bg-red-50 rounded-2xl p-4">
                    <p className="text-[13px] font-bold text-[#EF4444] mb-2">
                      Refuse to sign
                    </p>
                    <p className="text-[11px] text-gray-500 mb-3 leading-relaxed">
                      Your refusal will be documented and sent to all parties.
                      The report remains legally valid.
                    </p>
                    <textarea
                      placeholder="Reason for refusal (optional)..."
                      value={refuseReason}
                      onChange={e => setRefuseReason(e.target.value)}
                      rows={3}
                      className="w-full rounded-xl border border-red-200 bg-white
                        px-3 py-2 text-[12px] resize-none outline-none
                        focus:border-[#EF4444] mb-3"
                    />
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setShowRefuseForm(false); setRefuseReason('') }}
                        className="flex-1 py-2.5 rounded-xl bg-gray-100
                          text-[12px] font-semibold text-gray-500"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRefuse()}
                        disabled={refuseLoading}
                        className="flex-1 py-2.5 rounded-xl bg-[#EF4444]
                          text-[12px] font-bold text-white
                          flex items-center justify-center gap-1.5
                          disabled:opacity-50"
                      >
                        {refuseLoading
                          ? <Loader2 size={14} className="animate-spin" />
                          : 'Confirm refusal'
                        }
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {refuseDone && (
              <div className="px-5 pb-4 bg-white flex-shrink-0">
                <div className="bg-amber-50 rounded-2xl p-4 text-center">
                  <p className="text-[13px] font-bold text-amber-700 mb-1">
                    Refusal recorded
                  </p>
                  <p className="text-[11px] text-amber-600">
                    All parties have been notified.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* STEP: done */}
        {step === 'done' && (
          <div className="px-5 py-10 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-2xl mx-auto mb-4
              flex items-center justify-center">
              <Check size={24} className="text-green-600" />
            </div>
            <div className="text-[15px] font-bold text-[#1A1A2E] mb-1">
              Signed!
            </div>
            <div className="text-sm text-gray-500">
              {signerName.split(' ')[0]}&apos;s signature has been recorded.
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
