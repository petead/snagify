'use client'

import { useEffect, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'

interface TourStep {
  targetId: string
  title: string
  desc: string
  spotlightPadding?: number
  spotlightRadius?: number
}

interface Rect {
  top: number; left: number; width: number; height: number
}

interface GuidedTourProps {
  steps: TourStep[]
  onDone: () => void
}

function getRect(targetId: string): Rect | null {
  const el = document.querySelector(`[data-tour="${targetId}"]`)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return { top: r.top, left: r.left, width: r.width, height: r.height }
}

export function GuidedTour({ steps, onDone }: GuidedTourProps) {
  const [current, setCurrent] = useState(0)
  const [rect, setRect] = useState<Rect | null>(null)
  const [visible, setVisible] = useState(false)

  const step = steps[current]
  const isLast = current === steps.length - 1
  const PAD = step.spotlightPadding ?? 8
  const RADIUS = step.spotlightRadius ?? 16

  const updateRect = useCallback(() => {
    const r = getRect(step.targetId)
    setRect(r)
  }, [step.targetId])

  useEffect(() => {
    setVisible(false)
    const timer = setTimeout(() => {
      updateRect()
      setVisible(true)
    }, 120)
    window.addEventListener('resize', updateRect)
    window.addEventListener('scroll', updateRect, true)
    return () => {
      clearTimeout(timer)
      window.removeEventListener('resize', updateRect)
      window.removeEventListener('scroll', updateRect, true)
    }
  }, [current, updateRect])

  const handleNext = () => {
    if (isLast) { onDone(); return }
    setCurrent(c => c + 1)
  }

  if (typeof document === 'undefined') return null

  const vw = typeof window !== 'undefined' ? window.innerWidth : 390
  const vh = typeof window !== 'undefined' ? window.innerHeight : 844

  // Tooltip positioning — smart: above or below
  const tooltipWidth = Math.min(300, vw - 48)
  let tooltipTop = 0
  let tooltipLeft = 0
  let arrowAbove = false  // true = arrow points UP (tooltip is below element)

  if (rect) {
    const spotBottom = rect.top + rect.height + PAD
    const spotTop = rect.top - PAD
    const isInBottomHalf = rect.top + rect.height / 2 > vh / 2

    if (isInBottomHalf) {
      // Tooltip above element
      tooltipTop = spotTop - 16 - 120 // estimate tooltip height
      arrowAbove = false
    } else {
      // Tooltip below element
      tooltipTop = spotBottom + 16
      arrowAbove = true
    }

    // Center horizontally on element, clamp to viewport
    tooltipLeft = rect.left + rect.width / 2 - tooltipWidth / 2
    tooltipLeft = Math.max(16, Math.min(tooltipLeft, vw - tooltipWidth - 16))
  }

  const spotlight = rect ? {
    top: rect.top - PAD,
    left: rect.left - PAD,
    width: rect.width + PAD * 2,
    height: rect.height + PAD * 2,
  } : null

  return createPortal(
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 99998,
        opacity: visible ? 1 : 0,
        transition: 'opacity 0.25s ease',
        pointerEvents: visible ? 'all' : 'none',
      }}
    >
      {/* Overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,4,14,0.78)' }} />

      {/* Spotlight cutout */}
      {spotlight && (
        <div
          style={{
            position: 'absolute',
            top: spotlight.top,
            left: spotlight.left,
            width: spotlight.width,
            height: spotlight.height,
            borderRadius: RADIUS,
            boxShadow: '0 0 0 9999px rgba(5,4,14,0.78)',
            pointerEvents: 'none',
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            zIndex: 1,
          }}
        />
      )}

      {/* Tooltip bubble */}
      {rect && (
        <div
          style={{
            position: 'absolute',
            top: tooltipTop,
            left: tooltipLeft,
            width: tooltipWidth,
            zIndex: 2,
            transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
            opacity: visible ? 1 : 0,
          }}
        >
          {/* Arrow pointing toward element */}
          <div style={{
            position: 'absolute',
            left: rect.left + rect.width / 2 - tooltipLeft - 8,
            ...(arrowAbove ? { top: -8 } : { bottom: -8 }),
            width: 0, height: 0,
            borderLeft: '8px solid transparent',
            borderRight: '8px solid transparent',
            ...(arrowAbove
              ? { borderBottom: '8px solid #1C1830' }
              : { borderTop: '8px solid #1C1830' }),
          }}/>

          {/* Card */}
          <div style={{
            background: 'linear-gradient(145deg, #1C1830, #16132c)',
            borderRadius: 18,
            padding: '16px 18px',
            border: '1px solid rgba(154,136,253,0.2)',
            boxShadow: '0 20px 60px rgba(5,4,14,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
          }}>
            {/* Progress dots */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 12 }}>
              {steps.map((_, i) => (
                <div key={i} style={{
                  height: 3, borderRadius: 99,
                  width: i === current ? 18 : 4,
                  background: i <= current ? '#9A88FD' : 'rgba(255,255,255,0.12)',
                  transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
                  boxShadow: i === current ? '0 0 6px rgba(154,136,253,0.6)' : 'none',
                }}/>
              ))}
            </div>

            <p style={{
              fontFamily: 'Poppins, sans-serif', fontWeight: 800,
              fontSize: 14, color: 'white', margin: '0 0 5px',
              letterSpacing: '-0.2px',
            }}>
              {step.title}
            </p>
            <p style={{
              fontSize: 12, color: 'rgba(255,255,255,0.5)',
              margin: '0 0 14px', lineHeight: 1.6,
            }}>
              {step.desc}
            </p>

            {/* Actions */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
              <button
                onClick={onDone}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 11, color: 'rgba(255,255,255,0.25)',
                  fontFamily: 'DM Sans, sans-serif', padding: 0,
                  letterSpacing: '0.5px',
                }}
              >
                SKIP
              </button>
              <button
                onClick={handleNext}
                style={{
                  background: isLast
                    ? 'linear-gradient(135deg, #CAFE87, #a8e85c)'
                    : 'linear-gradient(135deg, #9A88FD, #7B65FC)',
                  border: 'none', borderRadius: 10,
                  padding: '9px 18px', fontSize: 12, fontWeight: 700,
                  color: isLast ? '#0E0E10' : 'white',
                  cursor: 'pointer', fontFamily: 'Poppins, sans-serif',
                  boxShadow: isLast
                    ? '0 4px 16px rgba(202,254,135,0.3)'
                    : '0 4px 16px rgba(154,136,253,0.35)',
                  letterSpacing: '0.1px',
                }}
              >
                {isLast ? "Let's go 🚀" : 'Next →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}
