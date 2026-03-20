'use client'

import { useState } from 'react'

function ScreenCheckin() {
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #EDE9FF' }}>
      <div style={{ background: '#9A88FD', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>New Check-in</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ background: 'white', borderRadius: 8, padding: '9px 12px', border: '1.5px solid #EDE9FF' }}>
          <p style={{ fontSize: 11, color: '#BBB', margin: 0 }}>Creek Rise Tower 1 — Unit 3301</p>
        </div>
        <div style={{ background: 'white', borderRadius: 8, padding: '9px 12px', border: '1.5px solid #EDE9FF' }}>
          <p style={{ fontSize: 11, color: '#BBB', margin: 0 }}>Claudia Andrea Gianella…</p>
        </div>
        <div style={{ background: '#9A88FD', borderRadius: 8, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>Start Check-in</span>
        </div>
      </div>
    </div>
  )
}

function ScreenSign() {
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #EDE9FF' }}>
      <div style={{ background: '#9A88FD', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="white" strokeWidth="2" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>Send for Signature</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {['Landlord — Remote', 'Tenant — In person'].map((label, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 8, padding: '9px 12px', border: '1.5px solid #EDE9FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: '#444' }}>{label}</span>
            <div style={{ background: i === 1 ? '#DCFCE7' : '#EDE9FF', borderRadius: 20, padding: '3px 8px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: i === 1 ? '#16A34A' : '#9A88FD' }}>
                {i === 1 ? '✓ Signed' : 'Link sent'}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenCheckout() {
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #FDE68A' }}>
      <div style={{ background: '#1A1A2E', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20H3z" stroke="white" strokeWidth="2" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>Creek Rise Tower 1</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ background: 'white', borderRadius: 8, padding: '9px 12px', border: '1.5px solid #EDE9FF', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: '#1A1A1A', margin: 0 }}>Check-in · 19 Mar 2026</p>
            <p style={{ fontSize: 10, color: '#16A34A', margin: 0, fontWeight: 600 }}>✓ Signed</p>
          </div>
          <span style={{ fontSize: 10, background: '#F3F3F8', padding: '3px 8px', borderRadius: 6, color: '#666' }}>PDF</span>
        </div>
        <div style={{ background: '#FEF9EC', borderRadius: 8, padding: '10px 12px', border: '2px solid #D97706', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -9, left: 10, background: '#D97706', borderRadius: 4, padding: '2px 8px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: 'white', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tap here</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#D97706' }}>＋ Start Check-out</span>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#D97706" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>
    </div>
  )
}

function ScreenCompare() {
  return (
    <div style={{ background: '#F8F7F4', borderRadius: 12, overflow: 'hidden', border: '1.5px solid #EDE9FF' }}>
      <div style={{ background: '#9A88FD', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="white" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>Check-out Report</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {[
          { room: 'Bedroom 2', verdict: 'Worse', color: '#DC2626', bg: '#FEE2E2' },
          { room: 'Living Room', verdict: 'Same', color: '#6B7280', bg: '#F3F3F8' },
          { room: 'Door Keys', verdict: '×1 missing', color: '#DC2626', bg: '#FEE2E2' },
          { room: 'Bathroom 1', verdict: 'Good', color: '#16A34A', bg: '#DCFCE7' },
        ].map((r, i) => (
          <div key={i} style={{ background: 'white', borderRadius: 8, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#1A1A1A' }}>{r.room}</span>
            <span style={{ fontSize: 9, fontWeight: 700, color: r.color, background: r.bg, padding: '2px 8px', borderRadius: 20 }}>{r.verdict}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

const SCREENS = {
  checkin: ScreenCheckin,
  sign: ScreenSign,
  checkout: ScreenCheckout,
  compare: ScreenCompare,
}

export function OnboardingTutorial({
  accountType,
  onDone,
}: {
  accountType: 'pro' | 'individual';
  onDone: () => void;
}) {
  const steps = [
    {
      id: 'welcome',
      emoji: '👋',
      accentColor: '#9A88FD',
      accentLight: '#EDE9FF',
      badge: 'Step 1',
      title: 'Welcome to Snagify!',
      desc: 'Your digital inspection platform for Dubai real estate.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'property',
      emoji: '🏢',
      accentColor: '#9A88FD',
      accentLight: '#EDE9FF',
      badge: 'Step 2',
      title: 'Add your first property',
      desc: 'Tap Properties to add a property and start inspecting.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'checkin',
      emoji: '📋',
      accentColor: '#9A88FD',
      accentLight: '#EDE9FF',
      badge: 'Step 3',
      title: 'Start an inspection',
      desc: 'Tap + to begin a check-in. AI will analyse every photo.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'report',
      emoji: '🔒',
      accentColor: '#9A88FD',
      accentLight: '#EDE9FF',
      badge: 'Step 4',
      title: 'Generate your report',
      desc: 'Once done, generate a SHA-256 verified PDF in one tap.',
      screen: 'compare',
      show: 'all' as const,
    },
    {
      id: 'plan',
      emoji: '⚡',
      accentColor: '#16A34A',
      accentLight: '#DCFCE7',
      badge: 'Step 5',
      title: 'Activate your plan',
      desc: 'Each inspection uses 1 credit. Go to Profile → Subscription to choose your plan.',
      screen: 'checkout',
      show: 'pro' as const,
    },
    {
      id: 'sign',
      emoji: '✍️',
      accentColor: '#9A88FD',
      accentLight: '#EDE9FF',
      badge: 'Step 6',
      title: 'Send for signature',
      desc: 'Share the report by email or sign in-person. Track opens and get auto-reminders.',
      screen: 'sign',
      show: 'all' as const,
    },
  ].filter((s) => s.show === 'all' || s.show === accountType)

  const [current, setCurrent] = useState(0)
  const [animating, setAnimating] = useState(false)
  const [direction, setDirection] = useState<'left' | 'right'>('left')

  const step = steps[current]
  const ScreenComponent = SCREENS[step.screen as keyof typeof SCREENS]
  const isLast = current === steps.length - 1

  const goTo = (next: number, dir: 'left' | 'right') => {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => {
      setCurrent(next)
      setAnimating(false)
    }, 220)
  }

  const handleNext = () => {
    if (isLast) {
      onDone()
    } else {
      goTo(current + 1, 'left')
    }
  }

  const handlePrev = () => {
    if (current > 0) goTo(current - 1, 'right')
  }

  const handleSkip = () => {
    onDone()
  }

  return (
    <>
      <style>{`
        @keyframes slideInLeft {
          from { opacity: 0; transform: translateX(40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(-40px); }
          to { opacity: 1; transform: translateX(0); }
        }
        @keyframes slideOutLeft {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(-40px); }
        }
        @keyframes slideOutRight {
          from { opacity: 1; transform: translateX(0); }
          to { opacity: 0; transform: translateX(40px); }
        }
        @keyframes sheetUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        @keyframes floatBounce {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-6px); }
        }
        @keyframes shimmerBtn {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        .onboarding-sheet {
          animation: sheetUp 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
        .step-content {
          animation: ${animating
            ? direction === 'left' ? 'slideOutLeft' : 'slideOutRight'
            : direction === 'left' ? 'slideInLeft' : 'slideInRight'
          } 0.22s ease forwards;
        }
        .emoji-float {
          animation: floatBounce 2.5s ease-in-out infinite;
          display: inline-block;
        }
        .shimmer-next {
          background: linear-gradient(90deg, #9A88FD 0%, #b8a9ff 40%, #9A88FD 60%, #7B65FC 100%);
          background-size: 200% auto;
          animation: shimmerBtn 2.5s linear infinite;
        }
        .shimmer-done {
          background: linear-gradient(90deg, #1A1A2E 0%, #2d2060 40%, #1A1A2E 60%, #0d0d1a 100%);
          background-size: 200% auto;
          animation: shimmerBtn 2s linear infinite;
        }
        .dot-pill {
          height: 8px;
          border-radius: 4px;
          transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
        }
      `}</style>

      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 100,
          background: 'rgba(10,8,20,0.7)',
          backdropFilter: 'blur(6px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <div
          className="onboarding-sheet"
          style={{
            width: '100%', maxWidth: 480,
            background: 'linear-gradient(170deg, #1A1A2E 0%, #12102a 100%)',
            borderRadius: '28px 28px 0 0',
            paddingBottom: 'max(32px, env(safe-area-inset-bottom))',
            boxShadow: '0 -24px 80px rgba(154,136,253,0.3)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: -40, left: '50%', transform: 'translateX(-50%)',
            width: 280, height: 140, pointerEvents: 'none',
            background: `radial-gradient(ellipse, ${step.accentColor}40 0%, transparent 70%)`,
            filter: 'blur(20px)',
            transition: 'background 0.5s ease',
          }} />

          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 12 }}>
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)' }} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '8px 20px 0' }}>
            <button
              onClick={handleSkip}
              style={{
                background: 'none', border: 'none',
                fontSize: 12, color: 'rgba(255,255,255,0.3)',
                cursor: 'pointer', padding: '4px 8px',
                fontFamily: 'DM Sans, sans-serif',
              }}
            >
              Skip
            </button>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, padding: '4px 0 20px' }}>
            {steps.map((_, i) => (
              <div
                key={i}
                className="dot-pill"
                style={{
                  width: i === current ? 24 : 8,
                  background: i === current ? step.accentColor : 'rgba(255,255,255,0.15)',
                }}
              />
            ))}
          </div>

          <div className="step-content" style={{ padding: '0 24px' }}>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <span className="emoji-float" style={{ fontSize: 44 }}>{step.emoji}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}>
              <div style={{
                background: `${step.accentColor}25`,
                borderRadius: 20, padding: '4px 14px',
                border: `1px solid ${step.accentColor}40`,
              }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: step.accentColor, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                  {step.badge}
                </span>
              </div>
            </div>

            <h2 style={{
              fontSize: 22, fontWeight: 800, color: 'white',
              textAlign: 'center', margin: '0 0 10px',
              fontFamily: 'Poppins, sans-serif', lineHeight: 1.25,
              letterSpacing: '-0.3px',
            }}>
              {step.title}
            </h2>

            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.5)',
              textAlign: 'center', lineHeight: 1.65,
              margin: '0 0 20px', maxWidth: 300, marginLeft: 'auto', marginRight: 'auto',
            }}>
              {step.desc}
            </p>

            <ScreenComponent />
          </div>

          <div style={{ padding: '20px 24px 0', display: 'flex', gap: 10 }}>
            {current > 0 && (
              <button
                onClick={handlePrev}
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: 'none', borderRadius: 16,
                  padding: '14px 20px', fontSize: 14,
                  fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                }}
              >
                ←
              </button>
            )}
            <button
              onClick={handleNext}
              className={isLast ? 'shimmer-done' : 'shimmer-next'}
              style={{
                flex: 1, border: 'none', borderRadius: 16,
                padding: '16px 0', fontSize: 15,
                fontWeight: 800, color: 'white',
                cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                boxShadow: isLast ? '0 8px 32px rgba(26,26,46,0.5)' : '0 8px 32px rgba(154,136,253,0.4)',
              }}
            >
              {isLast ? "Let's go 🚀" : 'Next →'}
            </button>
          </div>

        </div>
      </div>
    </>
  )
}
