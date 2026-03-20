'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'

interface Props {
  creditsBalance: number
  creditCost?: number
  inspectionType?: "check-in" | "check-out"
  onConfirm: () => Promise<void>
  onCancel: () => void
}

export function CheckoutCreditConfirmModal({
  creditsBalance,
  creditCost = 2,
  inspectionType = "check-out",
  onConfirm,
  onCancel,
}: Props) {
  const [loading, setLoading] = useState(false)
  const balanceAfter = creditsBalance - creditCost

  async function handleConfirm() {
    setLoading(true)
    try {
      await onConfirm()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ paddingBottom: 0 }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(26, 26, 46, 0.6)' }}
        onClick={onCancel}
      />

      {/* Bottom sheet */}
      <div
        className="relative w-full bg-white overflow-hidden"
        style={{
          maxWidth: 430,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
        }}
      >
        {/* Hero header */}
        <div
          className="relative overflow-hidden px-6 pt-8 pb-6 text-center"
          style={{ background: 'linear-gradient(160deg, #EDE9FF 0%, #F3F0FF 100%)' }}
        >
          {/* Decorative circles */}
          <div
            className="absolute rounded-full"
            style={{
              right: -20,
              top: -20,
              width: 80,
              height: 80,
              background: 'rgba(154, 136, 253, 0.1)',
            }}
          />
          <div
            className="absolute rounded-full"
            style={{
              left: -12,
              bottom: -12,
              width: 48,
              height: 48,
              background: 'rgba(154, 136, 253, 0.08)',
            }}
          />

          {/* Credit pill */}
          <div
            className="inline-flex items-center gap-3 bg-white rounded-2xl px-5 py-3 mb-5 relative z-10"
            style={{ boxShadow: '0 4px 16px rgba(154, 136, 253, 0.15)' }}
          >
            <div
              className="flex-shrink-0 flex items-center justify-center rounded-xl"
              style={{ width: 32, height: 32, background: '#EDE9FF' }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="#9A88FD" strokeWidth="1.8" />
                <path d="M12 8v4l2.5 2.5" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </div>
            <span
              className="leading-none"
              style={{ fontSize: 32, fontWeight: 800, color: '#9A88FD' }}
            >
              {creditCost}
            </span>
            <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 500 }}>
              credits
            </span>
          </div>

          <h2
            className="relative z-10 mb-2"
            style={{
              fontSize: 19,
              fontWeight: 800,
              color: '#1A1A2E',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            Generate Check-out Report
          </h2>
          <p
            className="relative z-10"
            style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.5 }}
          >
            {creditCost === 0 ? (
              <>
                This {inspectionType} is <strong>free</strong> ✓
              </>
            ) : (
              <>
                This will use <strong>{creditCost} credit{creditCost > 1 ? "s" : ""}</strong>
                <br />
                to generate the full report.
              </>
            )}
          </p>
        </div>

        {/* Content */}
        <div className="px-6 pt-5 pb-8">
          {/* What's included */}
          <div
            className="rounded-2xl p-4 mb-4"
            style={{ background: '#F8F7F4' }}
          >
            {[
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M14 2v6h6M16 13H8M16 17H8"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
                label: 'Professional PDF report',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                ),
                label: 'Check-in vs check-out comparison',
              },
              {
                icon: (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ),
                label: 'Digital signature flow',
              },
            ].map((item, i, arr) => (
              <div
                key={i}
                className="flex items-center gap-3 py-2.5"
                style={{
                  borderBottom: i < arr.length - 1 ? '1px solid #EEECFF' : 'none',
                }}
              >
                <div
                  className="flex-shrink-0 flex items-center justify-center rounded-lg"
                  style={{ width: 28, height: 28, background: '#EDE9FF' }}
                >
                  {item.icon}
                </div>
                <span className="flex-1" style={{ fontSize: 13, color: '#6B7280' }}>
                  {item.label}
                </span>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M20 6L9 17l-5-5"
                    stroke="#16A34A"
                    strokeWidth="2"
                    strokeLinecap="round"
                  />
                </svg>
              </div>
            ))}
          </div>

          {/* Balance preview */}
          <div
            className="flex items-center justify-between rounded-2xl px-4 py-3 mb-5"
            style={{ background: '#EDE9FF' }}
          >
            <span style={{ fontSize: 12, fontWeight: 600, color: '#6B4FE8' }}>
              Your balance after
            </span>
            <div className="flex items-center gap-2">
              <span
                className="line-through"
                style={{ fontSize: 13, color: '#9A88FD' }}
              >
                {creditsBalance} credits
              </span>
              <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                <path
                  d="M4 8h8M9 5l3 3-3 3"
                  stroke="#9A88FD"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <span
                style={{
                  fontSize: 16,
                  fontWeight: 800,
                  color: balanceAfter < 0 ? '#EF4444' : '#6B4FE8',
                }}
              >
                {Math.max(0, balanceAfter)} credits
              </span>
            </div>
          </div>

          {/* Insufficient credits warning */}
          {balanceAfter < 0 && (
            <div
              className="flex gap-2 items-center rounded-xl p-3 mb-4"
              style={{ background: '#FEF2F2' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.8" />
                <path
                  d="M12 8v4M12 16h.01"
                  stroke="#EF4444"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span style={{ fontSize: 12, color: '#DC2626', fontWeight: 500 }}>
                Not enough credits. Please top up your account first.
              </span>
            </div>
          )}

          {/* Confirm button */}
          <button
            type="button"
            onClick={handleConfirm}
            disabled={loading || balanceAfter < 0}
            className="w-full flex items-center justify-center gap-2 rounded-2xl mb-3 disabled:opacity-50 transition-opacity"
            style={{
              padding: 16,
              background: '#9A88FD',
              color: 'white',
              fontWeight: 800,
              fontSize: 15,
              border: 'none',
              cursor: loading || balanceAfter < 0 ? 'not-allowed' : 'pointer',
              fontFamily: 'Poppins, sans-serif',
            }}
          >
            {loading ? (
              <Loader2 size={18} className="animate-spin" />
            ) : (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="white"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                {creditCost === 0 ? "Generate Report · Free" : `Generate Report · ${creditCost} credits`}
              </>
            )}
          </button>

          {/* Cancel */}
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="w-full disabled:opacity-40"
            style={{
              padding: 10,
              background: 'transparent',
              border: 'none',
              fontSize: 14,
              color: '#9B9BA8',
              fontWeight: 500,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
