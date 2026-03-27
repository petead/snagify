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
  description?: string | null
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

const PLAN_DESCRIPTIONS: Record<string, string> = {
  starter: 'For independent agents doing a handful of inspections each month.',
  growth:  'For active agents and small agencies managing multiple properties.',
  agency:  'For property management firms running high inspection volumes.',
}

const FEATURES = [
  'AI photo analysis',
  'White-label branding',
  'Digital signatures',
  'PDF report generation',
  'Priority support',
]

export function SubscriptionSection({ company }: Props) {
  const [plans, setPlans]           = useState<DbPlan[]>([])
  const [loading, setLoading]       = useState<string | null>(null)
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [billing, setBilling]       = useState<'monthly' | 'annual'>('annual')

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
      <Loader2 size={20} className="animate-spin" style={{ color:'#9A88FD' }} />
    </div>
  )

  return (
    <div style={{ padding:'4px 0 32px', fontFamily:'DM Sans, sans-serif' }}>

      {/* Past due banner */}
      {company.billing_status === 'past_due' && (
        <div style={{
          background:'#FEF2F2', border:'1px solid #FECACA',
          borderRadius:14, padding:'14px 16px',
          display:'flex', alignItems:'flex-start', gap:12, marginBottom:20,
        }}>
          <div style={{
            width:34, height:34, borderRadius:9,
            background:'rgba(239,68,68,0.1)',
            display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
          }}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex:1 }}>
            <p style={{ fontSize:13, fontWeight:700, color:'#DC2626', margin:'0 0 3px', fontFamily:'Poppins, sans-serif' }}>
              Payment failed
            </p>
            <p style={{ fontSize:12, color:'rgba(239,68,68,0.8)', margin:'0 0 10px', lineHeight:1.5 }}>
              Your last payment did not go through. Please update your payment method.
            </p>
            <button
              type="button"
              onClick={() => void handlePortal()}
              disabled={loading === 'portal'}
              style={{
                background:'#EF4444', color:'white', border:'none',
                borderRadius:8, padding:'7px 14px',
                fontSize:12, fontWeight:700, cursor:'pointer',
                fontFamily:'Poppins, sans-serif', display:'inline-flex', alignItems:'center', gap:6,
              }}
            >
              {loading === 'portal'
                ? <Loader2 size={12} className="animate-spin" />
                : 'Update payment method →'}
            </button>
          </div>
        </div>
      )}

      {/* Current plan row */}
      <div style={{
        display:'flex', alignItems:'center', justifyContent:'space-between',
        padding:'12px 16px',
        background:'#F8F7F4',
        border:'0.5px solid rgba(14,14,16,0.1)',
        borderRadius:12, marginBottom:20,
      }}>
        <div>
          <p style={{ fontSize:10, fontWeight:700, textTransform:'uppercase', letterSpacing:'1.5px', color:'rgba(14,14,16,0.45)', margin:'0 0 2px', fontFamily:'Poppins, sans-serif' }}>
            Current plan
          </p>
          <p style={{ fontSize:14, fontWeight:700, color:'#0E0E10', margin:0, fontFamily:'Poppins, sans-serif', textTransform:'capitalize' }}>
            {normalizedPlan === 'free' ? 'Free' : normalizedPlan}
            {' · '}<span style={{ fontWeight:400, color:'rgba(14,14,16,0.5)' }}>{company.credits_balance} credits</span>
          </p>
        </div>
        {isActive && (
          <button
            type="button"
            onClick={() => void handlePortal()}
            disabled={loading === 'portal'}
            style={{
              background:'white', border:'0.5px solid rgba(14,14,16,0.15)',
              borderRadius:9, padding:'8px 14px',
              fontSize:12, fontWeight:600, color:'#0E0E10',
              cursor:'pointer', display:'flex', alignItems:'center', gap:6,
              fontFamily:'Poppins, sans-serif',
            }}
          >
            {loading === 'portal' ? <Loader2 size={12} className="animate-spin" /> : 'Manage billing'}
          </button>
        )}
      </div>

      {/* Billing toggle */}
      <div style={{ display:'flex', justifyContent:'center', marginBottom:32 }}>
        <div style={{
          display:'inline-flex', gap:3, padding:4,
          background:'#F3F1EB',
          borderRadius:999,
        }}>
          {(['monthly', 'annual'] as const).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setBilling(mode)}
              style={{
                padding:'9px 24px', borderRadius:999, border:'none',
                fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:13,
                cursor:'pointer', display:'flex', alignItems:'center', gap:6,
                background: billing === mode ? '#0E0E10' : 'transparent',
                color: billing === mode ? 'white' : 'rgba(14,14,16,0.5)',
                transition:'all .2s',
                lineHeight:1,
              }}
            >
              {mode === 'monthly' ? 'Monthly' : 'Annual'}
              {mode === 'annual' && (
                <span style={{
                  fontSize:10, fontWeight:700,
                  color: billing === 'annual' ? '#CAFE87' : '#3A7A00',
                  background: billing === 'annual' ? 'rgba(202,254,135,0.15)' : 'rgba(58,122,0,0.08)',
                  padding:'2px 7px', borderRadius:99,
                }}>
                  2 months free
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Plans grid */}
      <div style={{
        display:'grid',
        gridTemplateColumns:'repeat(3, minmax(0, 1fr))',
        gap:14,
        alignItems:'start',
      }}>
        {plans.map((plan) => {
          const isPopular    = plan.highlight
          const isCurrent    = normalizedPlan === plan.slug
          const annualPerMo  = plan.price_aed_monthly
          const monthlyPrice = plan.price_aed_monthly_billing ?? plan.price_aed_monthly
          const displayPrice = billing === 'annual' ? annualPerMo : monthlyPrice
          const annualTotal  = plan.price_aed_annual ?? Math.round(annualPerMo * 12)
          const savedAmount  = Math.round(monthlyPrice * 12 - annualTotal)
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
                border: dark
                  ? '1.5px solid #0E0E10'
                  : isCurrent
                    ? '1.5px solid #9A88FD'
                    : '1px solid rgba(14,14,16,0.1)',
                borderRadius:24,
                padding: dark ? '32px 24px' : '28px 22px',
                position:'relative',
                display:'flex', flexDirection:'column',
                marginTop: dark ? '-8px' : '0',
                boxShadow: dark ? '0 8px 40px rgba(14,14,16,0.18)' : 'none',
              }}
            >
              {/* Popular badge */}
              {isPopular && (
                <div style={{
                  position:'absolute', top:-14, left:'50%',
                  transform:'translateX(-50%)',
                  background:'#9A88FD', color:'white',
                  fontSize:11, fontWeight:700,
                  padding:'5px 16px', borderRadius:999,
                  fontFamily:'Poppins, sans-serif',
                  whiteSpace:'nowrap', letterSpacing:'0.2px',
                  boxShadow:'0 2px 12px rgba(154,136,253,0.4)',
                }}>
                  Most Popular
                </div>
              )}

              {/* Plan name */}
              <p style={{
                fontSize:10, fontWeight:700, textTransform:'uppercase',
                letterSpacing:'2.5px', margin:'0 0 10px',
                color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(14,14,16,0.5)',
                fontFamily:'Poppins, sans-serif',
              }}>
                {plan.name}
              </p>

              {/* Price */}
              <div style={{ display:'flex', alignItems:'baseline', gap:6, marginBottom:6 }}>
                <span style={{
                  fontSize:48, fontWeight:800, letterSpacing:'-3px', lineHeight:1,
                  color: dark ? 'white' : '#0E0E10',
                  fontFamily:'Poppins, sans-serif',
                }}>
                  {displayPrice}
                </span>
                <span style={{
                  fontSize:14, fontWeight:400,
                  color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.45)',
                  marginBottom:6,
                }}>
                  AED/mo
                </span>
              </div>

              {/* Annual savings line */}
              {billing === 'annual' ? (
                <p style={{ fontSize:11, margin:'0 0 12px', color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(14,14,16,0.5)', lineHeight:1.4 }}>
                  {annualTotal.toLocaleString()} AED billed annually ·{' '}
                  <span style={{ color:'#3A7A00', fontWeight:700 }}>
                    Save {savedPct}% · {savedAmount} AED saved
                  </span>
                </p>
              ) : (
                <p style={{ fontSize:11, margin:'0 0 12px', color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(14,14,16,0.35)', lineHeight:1.4 }}>
                  Billed monthly · no commitment
                </p>
              )}

              {/* Description */}
              <p style={{
                fontSize:12, lineHeight:1.5, margin:'0 0 16px',
                color: dark ? 'rgba(255,255,255,0.55)' : 'rgba(14,14,16,0.6)',
              }}>
                {PLAN_DESCRIPTIONS[plan.slug] ?? ''}
              </p>

              {/* Stats block */}
              <div style={{
                display:'grid', gridTemplateColumns:'1fr 1px 1fr',
                background: dark ? 'rgba(255,255,255,0.06)' : '#F3F1EB',
                borderRadius:14, overflow:'hidden', marginBottom:12,
              }}>
                <div style={{ padding:'14px 16px', textAlign:'center' }}>
                  <p style={{
                    fontSize:28, fontWeight:800, letterSpacing:'-1.5px',
                    lineHeight:1, margin:0,
                    color: dark ? 'white' : '#0E0E10',
                    fontFamily:'Poppins, sans-serif',
                  }}>
                    {plan.credits_per_month}
                  </p>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', margin:'4px 0 2px', color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(14,14,16,0.4)' }}>
                    CREDITS
                  </p>
                  <p style={{ fontSize:10, fontWeight:700, color: dark ? '#B8AEFF' : '#9A88FD', margin:0 }}>
                    {pricePerCredit} AED / credit
                  </p>
                </div>
                <div style={{ background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(14,14,16,0.07)' }} />
                <div style={{ padding:'14px 16px', textAlign:'center' }}>
                  <p style={{
                    fontSize:28, fontWeight:800, letterSpacing:'-1.5px',
                    lineHeight:1, margin:0,
                    color: dark ? 'white' : '#0E0E10',
                    fontFamily:'Poppins, sans-serif',
                  }}>
                    {plan.max_users ?? '∞'}
                  </p>
                  <p style={{ fontSize:9, fontWeight:700, textTransform:'uppercase', letterSpacing:'1px', margin:'4px 0 2px', color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(14,14,16,0.4)' }}>
                    USERS
                  </p>
                </div>
              </div>

              {/* Extra credit */}
              <div style={{
                display:'flex', alignItems:'center', gap:7,
                padding:'9px 12px',
                background: dark ? 'rgba(255,255,255,0.06)' : '#F3F1EB',
                borderRadius:9, marginBottom:16, fontSize:12,
                color: dark ? 'rgba(255,255,255,0.5)' : 'rgba(14,14,16,0.6)',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
                Extra credit:{' '}
                <strong style={{ color: dark ? 'white' : '#0E0E10', fontWeight:700 }}>
                  {plan.extra_credit_price_aed} AED each
                </strong>
              </div>

              {/* Features */}
              <ul style={{ listStyle:'none', padding:0, margin:'0 0 20px', display:'flex', flexDirection:'column', gap:7, flex:1 }}>
                {FEATURES.map(feat => (
                  <li key={feat} style={{
                    display:'flex', alignItems:'center', gap:8,
                    fontSize:12,
                    color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(14,14,16,0.7)',
                  }}>
                    <span style={{ color:'#4A8A00', fontWeight:700, fontSize:11, flexShrink:0 }}>✓</span>
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
                  borderRadius:12,
                  fontFamily:'Poppins, sans-serif', fontWeight:700, fontSize:13,
                  cursor: isCurrent ? 'default' : 'pointer',
                  transition:'all .2s',
                  ...(isCurrent ? {
                    background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(14,14,16,0.04)',
                    color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(14,14,16,0.3)',
                    border: 'none',
                  } : isPopular ? {
                    background:'#9A88FD', color:'white',
                    border:'none',
                    boxShadow:'0 4px 16px rgba(154,136,253,0.35)',
                  } : {
                    background:'transparent',
                    color:'#0E0E10',
                    border:'1.5px solid rgba(14,14,16,0.18)',
                  }),
                }}
              >
                {loading === plan.slug
                  ? <Loader2 size={14} className="animate-spin" style={{ display:'inline' }} />
                  : isCurrent
                    ? 'Current plan'
                    : isPopular
                      ? 'Start Free Trial'
                      : 'Get Started'
                }
              </button>
            </div>
          )
        })}
      </div>

      <p style={{ textAlign:'center', fontSize:11, color:'rgba(14,14,16,0.4)', marginTop:16, lineHeight:1.6 }}>
        Need more than 50 inspections/month?{' '}
        <a href="mailto:hello@snagify.net" style={{ color:'#9A88FD', fontWeight:600, textDecoration:'none' }}>
          Contact us
        </a>{' '}
        for a custom plan.
      </p>

    </div>
  )
}
