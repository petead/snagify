'use client'

import { useState, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

type DbPlan = {
  id: string
  slug: string
  name: string
  price_aed_monthly: number
  price_aed_monthly_billing: number | null
  price_aed_annual: number | null
  credits_per_month: number
  stripe_price_id: string | null
  stripe_price_id_annual: string | null
  white_label: boolean
  max_users: number | null
  highlight: boolean
  extra_credit_price_aed: number | null
  sort_order: number | null
}

interface Props {
  company: {
    id: string
    plan: string
    credits_balance: number
    stripe_subscription_id?: string | null
    billing_status?: string | null
  }
}

const FEATURES = [
  'AI photo analysis',
  'White-label branding',
  'Digital signatures',
  'PDF report generation',
  'Push notifications',
]

export function SubscriptionSection({ company }: Props) {
  const [plans, setPlans] = useState<DbPlan[]>([])
  const [loading, setLoading] = useState<string | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [billing, setBilling] = useState<'monthly' | 'annual'>('annual')

  const normalizedPlan =
    company.plan === 'pro_solo'   ? 'starter' :
    company.plan === 'pro_agency' ? 'growth'  :
    company.plan === 'pro_max'    ? 'agency'  :
    company.plan

  const isActive = !!company.stripe_subscription_id &&
    company.plan !== 'free' && company.plan !== null

  useEffect(() => {
    fetch('/api/credits/packs')
      .then(r => r.json())
      .then((d: { plans?: DbPlan[] }) => setPlans(d.plans ?? []))
      .catch(() => setPlans([]))
      .finally(() => setLoadingPlans(false))
  }, [])

  async function handleSubscribe(plan: DbPlan) {
    setLoading(plan.slug)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          plan_slug: plan.slug,
          billing_period: billing,
          companyId: company.id,
        }),
      })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  async function handlePortal() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = await res.json() as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  if (loadingPlans) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'3rem 0' }}>
      <Loader2 size={20} style={{ animation:'spin 1s linear infinite', color:'#9A88FD' }} />
    </div>
  )

  return (
    <div style={{ padding:'0 0 32px', fontFamily:'DM Sans, sans-serif' }}>

      {/* Past due banner */}
      {company.billing_status === 'past_due' && (
        <div style={{
          background:'#FEF2F2', border:'0.5px solid #FECACA',
          borderRadius:16, padding:'14px 16px',
          display:'flex', alignItems:'flex-start', gap:12, marginBottom:16,
        }}>
          <div style={{
            width:36, height:36, borderRadius:10,
            background:'rgba(239,68,68,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#DC2626', margin:'0 0 4px', fontFamily:'Poppins, sans-serif' }}>
              Payment failed
            </p>
            <p style={{ fontSize:12, color:'rgba(239,68,68,0.8)', margin:'0 0 10px', lineHeight:1.5 }}>
              Your last payment did not go through. Please update your payment method to avoid losing access.
            </p>
            <button
              type="button"
              onClick={() => void handlePortal()}
              disabled={loading === 'portal'}
              style={{
                background:'#EF4444', color:'white',
                border:'none', borderRadius:8, padding:'8px 16px',
                fontSize:12, fontWeight:700, cursor:'pointer',
                display:'flex', alignItems:'center', gap:6,
                fontFamily:'Poppins, sans-serif',
              }}
            >
              {loading === 'portal' ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : 'Update payment method →'}
            </button>
          </div>
        </div>
      )}

      {/* Current plan + manage billing */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'14px 16px',
        background:'#F8F7F4',
        border:'0.5px solid rgba(14,14,16,0.1)',
        borderRadius:14, marginBottom:20,
      }}>
        <div>
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'rgba(14,14,16,0.5)', margin:'0 0 2px', fontFamily:'Poppins, sans-serif' }}>
            Current plan
          </p>
          <p style={{ fontSize:15, fontWeight:700, color:'#0E0E10', margin:0, fontFamily:'Poppins, sans-serif', textTransform:'capitalize' }}>
            {normalizedPlan === 'free' ? 'Free' : normalizedPlan}
          </p>
          <p style={{ fontSize:12, color:'rgba(14,14,16,0.5)', margin:'2px 0 0' }}>
            {company.credits_balance} credits remaining
          </p>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={() => void handlePortal()}
            disabled={loading === 'portal'}
            style={{
              background:'white', border:'0.5px solid rgba(14,14,16,0.15)',
              borderRadius:10, padding:'9px 16px',
              fontSize:12, fontWeight:600, color:'#0E0E10',
              cursor:'pointer', display:'flex', alignItems:'center', gap:6,
              fontFamily:'Poppins, sans-serif',
            }}
          >
            {loading === 'portal' ? <Loader2 size={12} style={{ animation:'spin 1s linear infinite' }} /> : 'Manage billing'}
          </button>
        )}
      </div>

      {/* Billing toggle */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:20 }}>
        <div style={{
          display:'flex', gap:4, padding:5,
          background:'white', border:'0.5px solid rgba(14,14,16,0.12)',
          borderRadius:999,
        }}>
          <button
            type="button"
            onClick={() => setBilling('monthly')}
            style={{
              padding:'9px 20px', borderRadius:999, border:'none',
              fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:12,
              cursor:'pointer', transition:'all .2s',
              background: billing === 'monthly' ? '#0E0E10' : 'transparent',
              color: billing === 'monthly' ? 'white' : 'rgba(14,14,16,0.5)',
            }}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling('annual')}
            style={{
              padding:'9px 20px', borderRadius:999, border:'none',
              fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:12,
              cursor:'pointer', transition:'all .2s',
              display:'flex', flexDirection:'column', alignItems:'center', gap:1,
              background: billing === 'annual' ? '#0E0E10' : 'transparent',
              color: billing === 'annual' ? 'white' : 'rgba(14,14,16,0.5)',
            }}
          >
            Annual
            <span style={{
              fontSize:10, fontWeight:600,
              color: billing === 'annual' ? '#CAFE87' : '#3A7A00',
            }}>
              2 months free
            </span>
          </button>
        </div>
      </div>

      {/* Plans */}
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {plans.map((plan) => {
          const isPopular   = plan.highlight
          const isCurrent   = normalizedPlan === plan.slug
          const annualPerMo = plan.price_aed_monthly
          const monthlyPrice = plan.price_aed_monthly_billing ?? plan.price_aed_monthly
          const displayPrice = billing === 'annual' ? annualPerMo : monthlyPrice
          const annualTotal  = plan.price_aed_annual ?? annualPerMo * 12
          const savedAmount  = monthlyPrice * 12 - annualTotal
          const savedPct     = Math.round(savedAmount / (monthlyPrice * 12) * 100)
          const pricePerCredit = plan.credits_per_month > 0
            ? (displayPrice / plan.credits_per_month).toFixed(1)
            : '—'

          const dark = isPopular

          return (
            <div
              key={plan.slug}
              style={{
                background: dark ? '#0E0E10' : 'white',
                border: dark ? '0.5px solid #0E0E10' : '0.5px solid rgba(14,14,16,0.12)',
                borderRadius: 20,
                padding: '28px 24px',
                position: 'relative',
              }}
            >
              {/* Popular badge */}
              {isPopular && (
                <div style={{
                  position:'absolute', top:-12, left:'50%', transform:'translateX(-50%)',
                  background:'#9A88FD', color:'#0E0E10',
                  fontSize:10, fontWeight:800,
                  padding:'4px 14px', borderRadius:999,
                  fontFamily:'Poppins, sans-serif',
                  letterSpacing:'0.5px', whiteSpace:'nowrap',
                }}>
                  Most Popular
                </div>
              )}

              {/* Plan name + price */}
              <div style={{ marginBottom:16 }}>
                <p style={{
                  fontSize:10, fontWeight:700, textTransform:'uppercase',
                  letterSpacing:'2px', margin:'0 0 8px',
                  color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(14,14,16,0.5)',
                  fontFamily:'Poppins, sans-serif',
                }}>
                  {plan.name}
                </p>
                <div style={{ display:'flex', alignItems:'baseline', gap:6 }}>
                  <span style={{
                    fontSize:44, fontWeight:800, letterSpacing:'-2.5px', lineHeight:1,
                    color: dark ? 'white' : '#0E0E10',
                    fontFamily:'Poppins, sans-serif',
                  }}>
                    {displayPrice}
                  </span>
                  <span style={{ fontSize:14, color: dark ? 'rgba(255,255,255,0.45)' : 'rgba(14,14,16,0.5)' }}>
                    AED/mo
                  </span>
                </div>
                {billing === 'annual' && (
                  <p style={{ fontSize:11, margin:'4px 0 0', color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.5)' }}>
                    {annualTotal.toLocaleString()} AED billed annually ·{' '}
                    <span style={{ color:'#3A7A00', fontWeight:700 }}>
                      Save {savedPct}% · {savedAmount.toLocaleString()} AED saved
                    </span>
                  </p>
                )}
              </div>

              {/* Stats block */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1fr',
                gap:1, borderRadius:12, overflow:'hidden',
                background: dark ? 'rgba(255,255,255,0.06)' : '#F3F1EB',
                marginBottom:12,
              }}>
                <div style={{ padding:'14px 16px', background: dark ? 'rgba(255,255,255,0.04)' : 'white' }}>
                  <p style={{
                    fontSize:28, fontWeight:800, letterSpacing:'-1.5px', lineHeight:1,
                    color: dark ? 'white' : '#0E0E10', margin:0,
                    fontFamily:'Poppins, sans-serif',
                  }}>
                    {plan.credits_per_month}
                  </p>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', margin:'3px 0 0', color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.5)' }}>
                    Credits / mo
                  </p>
                  <p style={{ fontSize:11, fontWeight:700, color:'#9A88FD', margin:'3px 0 0' }}>
                    {pricePerCredit} AED / credit
                  </p>
                </div>
                <div style={{ padding:'14px 16px', background: dark ? 'rgba(255,255,255,0.04)' : 'white' }}>
                  <p style={{
                    fontSize:28, fontWeight:800, letterSpacing:'-1.5px', lineHeight:1,
                    color: dark ? 'white' : '#0E0E10', margin:0,
                    fontFamily:'Poppins, sans-serif',
                  }}>
                    {plan.max_users ?? '∞'}
                  </p>
                  <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'0.8px', margin:'3px 0 0', color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.5)' }}>
                    Inspectors
                  </p>
                </div>
              </div>

              {/* Extra credit row */}
              <div style={{
                display:'flex', alignItems:'center', gap:8,
                padding:'9px 14px',
                background: dark ? 'rgba(255,255,255,0.06)' : '#F3F1EB',
                borderRadius:10, marginBottom:16,
                fontSize:13,
                color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(14,14,16,0.6)',
              }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Extra credit:{' '}
                <strong style={{ color: dark ? 'white' : '#0E0E10', fontWeight:700 }}>
                  {plan.extra_credit_price_aed} AED each
                </strong>
              </div>

              {/* Feature list */}
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:8 }}>
                {FEATURES.map(feat => (
                  <li key={feat} style={{ display:'flex', alignItems:'center', gap:10, fontSize:13, color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(14,14,16,0.7)' }}>
                    <span style={{ color:'#3A7A00', fontWeight:700, fontSize:12 }}>✓</span>
                    {feat}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              <button
                type="button"
                onClick={() => void handleSubscribe(plan)}
                disabled={!!loading || isCurrent}
                style={{
                  width:'100%', padding:'13px 0',
                  borderRadius:12, border:'none', cursor: isCurrent ? 'default' : 'pointer',
                  fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:14,
                  transition:'all .2s',
                  background: isCurrent
                    ? (dark ? 'rgba(255,255,255,0.1)' : 'rgba(14,14,16,0.06)')
                    : isPopular
                      ? '#9A88FD'
                      : (dark ? 'rgba(255,255,255,0.1)' : 'transparent'),
                  color: isCurrent
                    ? (dark ? 'rgba(255,255,255,0.3)' : 'rgba(14,14,16,0.35)')
                    : isPopular
                      ? '#0E0E10'
                      : (dark ? 'rgba(255,255,255,0.7)' : '#0E0E10'),
                  ...((!isCurrent && !isPopular) ? {
                    border: dark ? '1.5px solid rgba(255,255,255,0.12)' : '1.5px solid rgba(14,14,16,0.2)',
                  } : {}),
                }}
              >
                {loading === plan.slug
                  ? <Loader2 size={16} style={{ animation:'spin 1s linear infinite', display:'inline' }} />
                  : isCurrent
                    ? 'Current plan'
                    : `Get ${plan.name}`
                }
              </button>
            </div>
          )
        })}
      </div>

      <p style={{ textAlign:'center', fontSize:11, color:'rgba(14,14,16,0.4)', marginTop:16, lineHeight:1.6 }}>
        All plans include white-label · digital signatures · AI reports · Prices in AED
      </p>

    </div>
  )
}
