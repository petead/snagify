'use client'

import { useState } from 'react'
import { Loader2, Check, Zap, Building2, Crown } from 'lucide-react'

const PLANS = [
  {
    slug: 'pro_solo',
    name: 'Starter',
    price: 149,
    credits: 10,
    users: '1 user',
    highlight: '5 complete cycles/month',
    extraCredits: 'Extra credits: AED 18/cr',
    priceId: 'price_1TC1CrKIsjOh5d33lCuUGmcd',
    icon: Zap,
    color: '#9A88FD',
    features: ['10 credits/month', 'White-label PDF', '1 inspector'],
  },
  {
    slug: 'pro_agency',
    name: 'Growth',
    price: 249,
    credits: 20,
    users: 'Up to 3 users',
    highlight: '10 complete cycles/month',
    extraCredits: 'Extra credits: AED 15/cr',
    priceId: 'price_1TC1D3KIsjOh5d33oEd1E3T1',
    icon: Building2,
    color: '#9A88FD',
    popular: true,
    features: ['20 credits/month', 'White-label PDF', 'Up to 3 inspectors'],
  },
  {
    slug: 'pro_max',
    name: 'Agency',
    price: 349,
    credits: 30,
    users: 'Unlimited users',
    highlight: '15 complete cycles/month',
    extraCredits: 'Extra credits: AED 13/cr',
    priceId: 'price_1TC1DPKIsjOh5d33hlQhhUTf',
    icon: Crown,
    color: '#9A88FD',
    features: ['30 credits/month', 'White-label PDF', 'Unlimited inspectors'],
  },
]

interface Props {
  company: {
    id: string
    plan: string
    credits_balance: number
    stripe_subscription_id?: string | null
  }
}

export function SubscriptionSection({ company }: Props) {
  const [loading, setLoading] = useState<string | null>(null)
  const currentPlan = PLANS.find(p => p.slug === company.plan)
  const isOnPaidPlan = company.plan !== 'free' && company.plan !== null

  async function handleSubscribe(plan: typeof PLANS[0]) {
    setLoading(plan.slug)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          price_id: plan.priceId,
          plan_slug: plan.slug,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  async function handleManage() {
    setLoading('manage')
    try {
      const res = await fetch('/api/stripe/portal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          returnUrl: `${window.location.origin}/profile`,
        }),
      })
      const data = await res.json() as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Portal error:', err)
    } finally {
      setLoading(null)
    }
  }

  return (
    <div style={{ background: '#fff', borderRadius: 22, overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.03)' }}>
      {/* Current plan banner */}
      <div
        style={{
          padding: '14px 20px',
          background: '#EDE9FF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: '1px solid #DDD6FE',
        }}
      >
        <div>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#9A88FD', textTransform: 'uppercase', letterSpacing: 1 }}>
            Current plan
          </div>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#1A1A2E', marginTop: 2 }}>
            {currentPlan?.name ?? 'Free'}
          </div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: '#9A88FD' }}>
            {company.credits_balance} credits
          </div>
          <div style={{ fontSize: 11, color: '#6B7280' }}>remaining</div>
        </div>
      </div>

      {/* Manage subscription (if on paid plan) */}
      {isOnPaidPlan && (
        <div style={{ padding: '14px 20px', borderBottom: '1px solid #F0EFEC' }}>
          <button
            type="button"
            onClick={handleManage}
            disabled={loading === 'manage'}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: 12,
              border: '1px solid #E5E7EB',
              background: '#fff',
              fontSize: 13,
              fontWeight: 600,
              color: '#6B7280',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              cursor: loading === 'manage' ? 'not-allowed' : 'pointer',
              opacity: loading === 'manage' ? 0.5 : 1,
              transition: 'all 0.2s ease',
            }}
          >
            {loading === 'manage' && <Loader2 size={14} className="animate-spin" />}
            Manage subscription
          </button>
        </div>
      )}

      {/* Plan cards */}
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
          {isOnPaidPlan ? 'Change plan' : 'Choose a plan'}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {PLANS.map(plan => {
            const isCurrent = plan.slug === company.plan
            const Icon = plan.icon

            return (
              <div
                key={plan.slug}
                style={{
                  position: 'relative',
                  borderRadius: 16,
                  border: isCurrent ? '2px solid #9A88FD' : '2px solid #F3F4F6',
                  padding: 16,
                  background: isCurrent ? 'rgba(237, 233, 255, 0.3)' : '#fff',
                  transition: 'all 0.2s ease',
                }}
              >
                {/* Popular badge */}
                {plan.popular && !isCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: '50%',
                      transform: 'translateX(-50%)',
                      background: '#9A88FD',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                    }}
                  >
                    Most popular
                  </div>
                )}

                {/* Current badge */}
                {isCurrent && (
                  <div
                    style={{
                      position: 'absolute',
                      top: -10,
                      left: 16,
                      background: '#16A34A',
                      color: '#fff',
                      fontSize: 10,
                      fontWeight: 700,
                      padding: '4px 12px',
                      borderRadius: 999,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 4,
                    }}
                  >
                    <Check size={10} />
                    Current plan
                  </div>
                )}

                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        background: '#EDE9FF',
                        borderRadius: 10,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Icon size={18} color="#9A88FD" />
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700, color: '#1A1A2E' }}>
                        {plan.name}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          display: 'inline-flex',
                          alignItems: 'center',
                          borderRadius: 999,
                          background: '#EDE9FF',
                          color: '#6D5BD0',
                          padding: '2px 8px',
                          fontSize: 10,
                          fontWeight: 700,
                        }}
                      >
                        {plan.highlight}
                      </div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>
                        {plan.users}
                      </div>
                      <div style={{ fontSize: 10, color: '#6B7280', marginTop: 4 }}>
                        {plan.extraCredits}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1A1A2E' }}>
                      AED {plan.price}
                    </div>
                    <div style={{ fontSize: 10, color: '#9CA3AF' }}>/month</div>
                  </div>
                </div>

                {/* Features */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                  {plan.features.map(f => (
                    <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Check size={12} color="#16A34A" />
                      <span style={{ fontSize: 12, color: '#6B7280' }}>{f}</span>
                    </div>
                  ))}
                </div>

                {/* CTA */}
                {!isCurrent && (
                  <button
                    type="button"
                    onClick={() => handleSubscribe(plan)}
                    disabled={loading === plan.slug}
                    style={{
                      width: '100%',
                      padding: '12px',
                      borderRadius: 12,
                      border: 'none',
                      background: '#9A88FD',
                      color: '#fff',
                      fontSize: 13,
                      fontWeight: 700,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 8,
                      cursor: loading === plan.slug ? 'not-allowed' : 'pointer',
                      opacity: loading === plan.slug ? 0.5 : 1,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    {loading === plan.slug && <Loader2 size={14} className="animate-spin" />}
                    {isOnPaidPlan ? 'Switch to this plan' : 'Get started'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
