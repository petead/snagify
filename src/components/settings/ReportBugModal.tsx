'use client'
import { useState, useRef } from 'react'
import { usePathname } from 'next/navigation'
import { X, Camera, Loader2, CheckCircle } from 'lucide-react'
import { getBreadcrumb } from '@/lib/breadcrumb'

interface Props {
  onClose: () => void
}

type BugType = 'crash' | 'ui' | 'feature' | 'other'

const TYPES: { id: BugType; emoji: string; label: string; sub: string }[] = [
  { id: 'crash', emoji: '🔴', label: 'Something crashed', sub: 'App stopped or errored' },
  { id: 'ui', emoji: '🟡', label: 'Something looks wrong', sub: 'Display or layout issue' },
  { id: 'feature', emoji: '🔵', label: 'Feature not working', sub: 'Button, action, or flow' },
  { id: 'other', emoji: '⚪', label: 'Other', sub: 'Anything else' },
]

export function ReportBugModal({ onClose }: Props) {
  const pathname = usePathname()
  const [selectedType, setSelectedType] = useState<BugType | null>(null)
  const [message, setMessage] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  function getDeviceInfo() {
    if (typeof window === 'undefined') return {}
    return {
      platform: navigator.platform,
      userAgent: navigator.userAgent,
      screenWidth: window.screen.width,
      screenHeight: window.screen.height,
      language: navigator.language,
      online: navigator.onLine,
    }
  }

  function handleScreenshotPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setScreenshot(reader.result as string)
    reader.readAsDataURL(file)
  }

  async function handleSubmit() {
    if (!selectedType) return
    setLoading(true)
    try {
      await fetch('/api/bug-report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: selectedType,
          message: message.trim() || null,
          currentPage: pathname,
          breadcrumb: getBreadcrumb(),
          deviceInfo: getDeviceInfo(),
          screenshotBase64: screenshot,
        }),
      })
      setDone(true)
      setTimeout(() => {
        onClose()
      }, 2500)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ paddingBottom: '64px' }}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1A1A2E]/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-[430px] bg-white
        rounded-t-[28px] overflow-hidden flex flex-col"
        style={{ maxHeight: 'calc(100vh - 80px)' }}>

        {/* Handle */}
        <div className="flex justify-center pt-3 pb-1 flex-shrink-0">
          <div className="w-10 h-1 rounded-full bg-gray-200" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3
          border-b border-[#F3F3F8] flex-shrink-0">
          <div>
            <h2 className="text-[17px] font-extrabold text-[#1A1A2E]"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              Report a problem
            </h2>
            <p className="text-[12px] text-[#9B9BA8] mt-0.5">
              We&apos;ll look into it right away
            </p>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F3F8] flex items-center
              justify-center">
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* Success state */}
        {done ? (
          <div className="flex flex-col items-center justify-center
            py-16 gap-4 px-6 text-center">
            <div className="w-16 h-16 bg-[#DCFCE7] rounded-2xl flex items-center
              justify-center">
              <CheckCircle size={32} color="#16A34A" />
            </div>
            <h3 className="text-[18px] font-extrabold text-[#1A1A2E]"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              Report sent!
            </h3>
            <p className="text-[13px] text-[#6B7280] leading-relaxed">
              Thanks for helping us improve Snagify.
              We&apos;ll investigate and get back to you if needed.
            </p>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1">
            <div className="px-5 pt-4 pb-6 space-y-4">

              {/* Type selector */}
              <div>
                <p className="text-[11px] font-bold text-[#9B9BA8] uppercase
                  tracking-wide mb-3">What happened?</p>
                <div className="space-y-2">
                  {TYPES.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedType(t.id)}
                      className={`w-full flex items-center gap-3 p-3.5
                        rounded-2xl border-2 text-left transition-all ${
                        selectedType === t.id
                          ? 'border-[#9A88FD] bg-[#EDE9FF]/40'
                          : 'border-gray-100 bg-white hover:border-[#DDD6FE]'
                      }`}>
                      <span className="text-[20px] flex-shrink-0 w-8
                        text-center leading-none">
                        {t.emoji}
                      </span>
                      <div className="flex-1">
                        <div className="text-[14px] font-semibold text-[#1A1A2E]">
                          {t.label}
                        </div>
                        <div className="text-[11px] text-[#9B9BA8] mt-0.5">
                          {t.sub}
                        </div>
                      </div>
                      {selectedType === t.id && (
                        <div className="w-5 h-5 rounded-full bg-[#9A88FD]
                          flex items-center justify-center flex-shrink-0">
                          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
                            <path d="M2 6l3 3 5-5" stroke="white"
                              strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Message */}
              <div>
                <p className="text-[11px] font-bold text-[#9B9BA8] uppercase
                  tracking-wide mb-2">
                  Tell us more
                  <span className="normal-case font-normal text-[#C4C4C4]
                    ml-1">(optional)</span>
                </p>
                <textarea
                  value={message}
                  onChange={e => setMessage(e.target.value)}
                  placeholder="Describe what you were doing when it happened..."
                  rows={3}
                  className="w-full px-4 py-3 rounded-2xl border border-gray-200
                    bg-[#F8F7F4] text-[14px] text-[#1A1A2E] resize-none outline-none
                    focus:border-[#9A88FD] focus:bg-white transition-all
                    placeholder:text-[#C4C4C4]"
                  style={{ fontSize: '16px' }}
                />
              </div>

              {/* Screenshot */}
              <div>
                <p className="text-[11px] font-bold text-[#9B9BA8] uppercase
                  tracking-wide mb-2">
                  Screenshot
                  <span className="normal-case font-normal text-[#C4C4C4]
                    ml-1">(optional)</span>
                </p>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  onChange={handleScreenshotPick}
                  className="hidden"
                />

                {screenshot ? (
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={screenshot} alt="screenshot"
                      className="w-full rounded-2xl border border-[#EEECFF]
                        object-cover max-h-40" />
                    <button
                      onClick={() => setScreenshot(null)}
                      className="absolute top-2 right-2 w-7 h-7 bg-white/90
                        rounded-full flex items-center justify-center
                        border border-gray-200">
                      <X size={13} color="#6B7280" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => fileRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2
                      border-2 border-dashed border-[#DDD6FE] rounded-2xl
                      py-4 bg-[#FAFAFE] text-[#9A88FD] font-semibold text-[13px]">
                    <Camera size={16} />
                    Add screenshot
                  </button>
                )}
              </div>

              {/* Context notice */}
              <div className="bg-[#F8F7F4] rounded-xl px-4 py-3 flex gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  className="flex-shrink-0 mt-0.5">
                  <circle cx="12" cy="12" r="10"
                    stroke="#9B9BA8" strokeWidth="1.8"/>
                  <path d="M12 8v4M12 16h.01"
                    stroke="#9B9BA8" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <p className="text-[11px] text-[#9B9BA8] leading-relaxed">
                  We&apos;ll automatically include your current page and recent
                  actions to help us reproduce the issue.
                </p>
              </div>

            </div>
          </div>
        )}

        {/* Submit button */}
        {!done && (
          <div className="px-5 py-4 border-t border-[#F3F3F8] bg-white
            flex-shrink-0">
            <button
              onClick={handleSubmit}
              disabled={!selectedType || loading}
              className="w-full py-4 rounded-2xl bg-[#9A88FD] text-white
                font-extrabold text-[15px] flex items-center justify-center gap-2
                disabled:opacity-40 transition-opacity"
              style={{ fontFamily: 'Poppins, sans-serif' }}>
              {loading
                ? <Loader2 size={18} className="animate-spin" />
                : <>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                      <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"
                        stroke="white" strokeWidth="1.8" strokeLinecap="round"
                        strokeLinejoin="round"/>
                    </svg>
                    Send report
                  </>
              }
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
