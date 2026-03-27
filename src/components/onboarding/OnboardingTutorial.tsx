'use client'

import { useState } from 'react'

function ScreenCheckin() {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.04)', borderRadius: 16,
      overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)',
    }}>
      <div style={{ background: 'rgba(154,136,253,0.2)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(154,136,253,0.15)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4M10 17l5-5-5-5M15 12H3" stroke="#B8AEFF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B8AEFF', fontFamily: 'Poppins, sans-serif', letterSpacing: '0.3px' }}>New Check-in</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Creek Rise Tower 1 — Unit 3301</p>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', margin: 0 }}>Claudia Andrea Gianella…</p>
        </div>
        <div style={{ background: 'linear-gradient(135deg, #9A88FD, #7B65FC)', borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, boxShadow: '0 4px 16px rgba(154,136,253,0.35)' }}>
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none"><path d="M12 5v14M5 12h14" stroke="white" strokeWidth="2.5" strokeLinecap="round"/></svg>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'white', fontFamily: 'Poppins, sans-serif' }}>Start Check-in</span>
        </div>
      </div>
    </div>
  )
}

function ScreenSign() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ background: 'rgba(154,136,253,0.2)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(154,136,253,0.15)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z" stroke="#B8AEFF" strokeWidth="2" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B8AEFF', fontFamily: 'Poppins, sans-serif' }}>Send for Signature</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        {['Landlord — Remote', 'Tenant — In person'].map((label, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>{label}</span>
            <div style={{ background: i === 1 ? 'rgba(202,254,135,0.15)' : 'rgba(154,136,253,0.15)', borderRadius: 20, padding: '3px 8px' }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: i === 1 ? '#CAFE87' : '#B8AEFF' }}>{i === 1 ? '✓ Signed' : 'Link sent'}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ScreenCheckout() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ background: 'rgba(254,222,128,0.12)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(254,222,128,0.1)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M3 9.5L12 3l9 6.5V20H3z" stroke="#FEDE80" strokeWidth="2" strokeLinejoin="round"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#FEDE80', fontFamily: 'Poppins, sans-serif' }}>Creek Rise Tower 1</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: '9px 12px', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: 0 }}>Check-in · 19 Mar 2026</p>
            <p style={{ fontSize: 10, color: '#CAFE87', margin: 0, fontWeight: 600 }}>✓ Signed</p>
          </div>
          <span style={{ fontSize: 9, background: 'rgba(255,255,255,0.07)', padding: '3px 8px', borderRadius: 6, color: 'rgba(255,255,255,0.4)' }}>PDF</span>
        </div>
        <div style={{ background: 'rgba(254,222,128,0.08)', borderRadius: 10, padding: '10px 12px', border: '1.5px solid rgba(254,222,128,0.25)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative' }}>
          <div style={{ position: 'absolute', top: -9, left: 10, background: '#FEDE80', borderRadius: 4, padding: '2px 8px' }}>
            <span style={{ fontSize: 9, fontWeight: 700, color: '#0E0E10', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Tap here</span>
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: '#FEDE80' }}>＋ Start Check-out</span>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 18l6-6-6-6" stroke="#FEDE80" strokeWidth="2" strokeLinecap="round"/></svg>
        </div>
      </div>
    </div>
  )
}

function ScreenCompare() {
  return (
    <div style={{ background: 'rgba(255,255,255,0.04)', borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.08)' }}>
      <div style={{ background: 'rgba(154,136,253,0.2)', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, borderBottom: '1px solid rgba(154,136,253,0.15)' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18" stroke="#B8AEFF" strokeWidth="1.8" strokeLinecap="round"/></svg>
        <span style={{ fontSize: 11, fontWeight: 700, color: '#B8AEFF', fontFamily: 'Poppins, sans-serif' }}>Check-out Report</span>
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 5 }}>
        {[
          { room: 'Bedroom 2', verdict: 'Worse', color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)' },
          { room: 'Living Room', verdict: 'Same', color: 'rgba(255,255,255,0.4)', bg: 'rgba(255,255,255,0.05)' },
          { room: 'Door Keys', verdict: '×1 missing', color: '#FCA5A5', bg: 'rgba(239,68,68,0.12)' },
          { room: 'Bathroom 1', verdict: 'Good', color: '#CAFE87', bg: 'rgba(202,254,135,0.1)' },
        ].map((r, i) => (
          <div key={i} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 8, padding: '7px 10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.65)' }}>{r.room}</span>
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
      accent: '#9A88FD',
      glow: 'rgba(154,136,253,0.25)',
      badge: 'STEP 1',
      title: 'Welcome to Snagify',
      desc: 'Your digital inspection platform for Dubai real estate.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'property',
      emoji: '🏢',
      accent: '#9A88FD',
      glow: 'rgba(154,136,253,0.25)',
      badge: 'STEP 2',
      title: 'Add your first property',
      desc: 'Tap Properties to add a property and start inspecting.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'checkin',
      emoji: '📋',
      accent: '#B8AEFF',
      glow: 'rgba(184,174,255,0.2)',
      badge: 'STEP 3',
      title: 'Start an inspection',
      desc: 'Tap + to begin. AI analyses every photo automatically.',
      screen: 'checkin',
      show: 'all' as const,
    },
    {
      id: 'report',
      emoji: '🔒',
      accent: '#CAFE87',
      glow: 'rgba(202,254,135,0.18)',
      badge: 'STEP 4',
      title: 'Generate your report',
      desc: 'One tap. SHA-256 verified PDF sent to all parties.',
      screen: 'compare',
      show: 'all' as const,
    },
    {
      id: 'plan',
      emoji: '⚡',
      accent: '#FEDE80',
      glow: 'rgba(254,222,128,0.2)',
      badge: 'STEP 5',
      title: 'Activate your plan',
      desc: 'Each inspection uses 1 credit. Go to Profile → Subscription.',
      screen: 'checkout',
      show: 'pro' as const,
    },
    {
      id: 'sign',
      emoji: '✍️',
      accent: '#9A88FD',
      glow: 'rgba(154,136,253,0.25)',
      badge: 'STEP 6',
      title: 'Send for signature',
      desc: 'Share by email or sign in-person. Track opens in real time.',
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
  const progress = (current + 1) / steps.length

  const goTo = (next: number, dir: 'left' | 'right') => {
    if (animating) return
    setDirection(dir)
    setAnimating(true)
    setTimeout(() => { setCurrent(next); setAnimating(false) }, 240)
  }

  const handleNext = () => isLast ? onDone() : goTo(current + 1, 'left')
  const handlePrev = () => { if (current > 0) goTo(current - 1, 'right') }

  return (
    <>
      <style>{`
        @keyframes fadeSlideIn {
          from { opacity: 0; transform: translateX(${direction === 'left' ? '28px' : '-28px'}); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes fadeSlideOut {
          from { opacity: 1; transform: translateX(0); }
          to   { opacity: 0; transform: translateX(${direction === 'left' ? '-28px' : '28px'}); }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(16px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        @keyframes floatY {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-5px); }
        }
        @keyframes pulseGlow {
          0%, 100% { opacity: 0.5; transform: scale(1); }
          50% { opacity: 0.8; transform: scale(1.08); }
        }
        @keyframes shimmer {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
        @keyframes progressIn {
          from { width: 0; }
        }
        .ob-modal {
          animation: modalIn 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }
        .ob-step {
          animation: ${animating ? 'fadeSlideOut' : 'fadeSlideIn'} 0.24s ease forwards;
        }
        .ob-emoji {
          animation: floatY 3s ease-in-out infinite;
          display: inline-block;
        }
        .ob-glow {
          animation: pulseGlow 3s ease-in-out infinite;
        }
        .ob-next {
          background: linear-gradient(90deg, #9A88FD 0%, #c4b8ff 45%, #9A88FD 100%);
          background-size: 200% auto;
          animation: shimmer 2.5s linear infinite;
        }
        .ob-done {
          background: linear-gradient(135deg, #CAFE87, #a8e85c);
        }
      `}</style>

      {/* Backdrop */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: 'rgba(5,4,14,0.85)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '20px',
      }}>

        {/* Modal card */}
        <div className="ob-modal" style={{
          width: '100%', maxWidth: 440,
          background: 'linear-gradient(160deg, #16132e 0%, #0e0c1f 60%, #0a0812 100%)',
          borderRadius: 28,
          border: '1px solid rgba(255,255,255,0.08)',
          boxShadow: `0 40px 100px rgba(5,4,14,0.8), 0 0 0 1px rgba(154,136,253,0.1), inset 0 1px 0 rgba(255,255,255,0.06)`,
          overflow: 'hidden',
          position: 'relative',
        }}>

          {/* Ambient glow blob */}
          <div className="ob-glow" style={{
            position: 'absolute', top: -60, left: '50%',
            transform: 'translateX(-50%)',
            width: 320, height: 200, pointerEvents: 'none',
            background: `radial-gradient(ellipse, ${step.glow} 0%, transparent 70%)`,
            filter: 'blur(30px)', transition: 'background 0.6s ease',
          }}/>

          {/* Top bar: progress + skip */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '18px 20px 0' }}>
            {/* Progress bar */}
            <div style={{ flex: 1, height: 3, background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 99,
                background: `linear-gradient(90deg, ${step.accent}, ${step.accent}99)`,
                width: `${progress * 100}%`,
                transition: 'width 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: `0 0 8px ${step.accent}80`,
              }}/>
            </div>
            <button onClick={onDone} style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.25)',
              fontFamily: 'DM Sans, sans-serif', padding: '2px 0', flexShrink: 0,
              letterSpacing: '0.5px',
            }}>
              SKIP
            </button>
          </div>

          {/* Step content */}
          <div className="ob-step" style={{ padding: '20px 24px 0' }}>

            {/* Emoji + badge */}
            <div style={{ textAlign: 'center', marginBottom: 14 }}>
              <span className="ob-emoji" style={{ fontSize: 46 }}>{step.emoji}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
              <div style={{
                background: `${step.accent}18`,
                border: `1px solid ${step.accent}35`,
                borderRadius: 99, padding: '4px 12px',
              }}>
                <span style={{
                  fontSize: 9, fontWeight: 800, letterSpacing: '2px',
                  color: step.accent, fontFamily: 'Poppins, sans-serif',
                }}>
                  {step.badge}
                </span>
              </div>
            </div>

            <h2 style={{
              fontFamily: 'Poppins, sans-serif', fontWeight: 800,
              fontSize: 22, color: 'white', textAlign: 'center',
              margin: '0 0 8px', letterSpacing: '-0.4px', lineHeight: 1.2,
            }}>
              {step.title}
            </h2>

            <p style={{
              fontSize: 13, color: 'rgba(255,255,255,0.45)',
              textAlign: 'center', lineHeight: 1.65,
              margin: '0 auto 18px', maxWidth: 280,
            }}>
              {step.desc}
            </p>

            <ScreenComponent />
          </div>

          {/* Navigation */}
          <div style={{ padding: '20px 24px 24px', display: 'flex', gap: 10 }}>
            {current > 0 && (
              <button onClick={handlePrev} style={{
                width: 48, height: 52, borderRadius: 14, border: 'none',
                background: 'rgba(255,255,255,0.06)',
                color: 'rgba(255,255,255,0.5)',
                fontSize: 18, cursor: 'pointer', flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                transition: 'background 0.15s',
              }}>
                ←
              </button>
            )}
            <button
              onClick={handleNext}
              className={isLast ? 'ob-done' : 'ob-next'}
              style={{
                flex: 1, border: 'none', borderRadius: 14,
                padding: '15px 0', fontSize: 14, fontWeight: 800,
                color: isLast ? '#0E0E10' : 'white',
                cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                letterSpacing: '0.2px',
                boxShadow: isLast
                  ? '0 8px 24px rgba(202,254,135,0.3)'
                  : '0 8px 28px rgba(154,136,253,0.35)',
                transition: 'transform 0.1s, box-shadow 0.2s',
              }}
            >
              {isLast ? "Let's go 🚀" : 'Next →'}
            </button>
          </div>

          {/* Step dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 16 }}>
            {steps.map((_, i) => (
              <div key={i} style={{
                height: 4, borderRadius: 99,
                width: i === current ? 20 : 5,
                background: i === current ? step.accent : 'rgba(255,255,255,0.12)',
                transition: 'all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: i === current ? `0 0 6px ${step.accent}80` : 'none',
              }}/>
            ))}
          </div>
        </div>
      </div>
    </>
  )
}
