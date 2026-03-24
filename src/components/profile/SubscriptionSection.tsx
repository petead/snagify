'use client'

import { useState, useEffect } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

type DbPlan = {
  id: string
  slug: string
  name: string
  price_aed_monthly: number
  credits_per_month: number
  stripe_price_id: string | null
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

const PLAN_COLORS: Record<string, string> = {
  starter: '#9A88FD',
  growth: '#7C3AED',
  agency: '#1E1B4B',
}

export function SubscriptionSection({ company }: Props) {
  const [plans, setPlans] = useState<DbPlan[]>([])
  const [loadingPlans, setLoadingPlans] = useState(true)
  const [loading, setLoading] = useState<string | null>(null)
  const [selected, setSelected] = useState(1)
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('annual')

  useEffect(() => {
    async function fetchPlans() {
      try {
        const res = await fetch('/api/credits/packs')
        const data = (await res.json()) as { plans?: DbPlan[] }
        setPlans(data.plans ?? [])
      } catch {
        setPlans([])
      } finally {
        setLoadingPlans(false)
      }
    }
    void fetchPlans()
  }, [])

  const normalizedCurrentPlan =
    company.plan === 'pro_solo' ? 'starter' :
    company.plan === 'pro_agency' ? 'growth' :
    company.plan === 'pro_max' ? 'agency' :
    company.plan

  const isActive = !!company.stripe_subscription_id &&
    company.plan !== 'free' && company.plan !== null

  async function handleSubscribe(plan: DbPlan) {
    setLoading(plan.slug)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'subscription',
          plan_slug: plan.slug,
          billing_period: billingPeriod,
          companyId: company.id,
        }),
      })
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch {
      // silent
    } finally {
      setLoading(null)
    }
  }

  async function handleManageBilling() {
    setLoading('portal')
    try {
      const res = await fetch('/api/stripe/portal', { method: 'POST' })
      const data = (await res.json()) as { url?: string }
      if (data.url) window.location.href = data.url
    } finally {
      setLoading(null)
    }
  }

  if (loadingPlans) return (
    <div className="flex items-center justify-center py-12">
      <Loader2 size={24} className="animate-spin text-[#9A88FD]" />
    </div>
  )

  return (
    <div className="px-4 pb-8">
      {/* Past due warning banner */}
      {company.billing_status === 'past_due' && (
        <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-2xl p-4 mb-4
          flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-[#EF4444]/10 flex items-center
            justify-center flex-shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2"/>
              <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="2"
                strokeLinecap="round"/>
            </svg>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-bold text-[#DC2626] mb-1">
              Payment failed
            </p>
            <p className="text-[12px] text-[#EF4444]/80 leading-relaxed mb-3">
              Your last payment did not go through. Stripe will retry automatically.
              Please update your payment method to avoid losing access.
            </p>
            <button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={loading === 'portal'}
              className="flex items-center gap-2 bg-[#EF4444] rounded-xl px-4 py-2.5
                text-[12px] font-bold text-white disabled:opacity-50"
            >
              {loading === 'portal'
                ? <Loader2 size={12} className="animate-spin" />
                : 'Update payment method →'
              }
            </button>
          </div>
        </div>
      )}

      {/* Current plan banner */}
      <div className="bg-white rounded-2xl border border-[#EEECFF] p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[11px] font-bold text-[#9B9BA8] uppercase tracking-wide mb-1">
              Current plan
            </p>
            <p className="text-[16px] font-bold text-[#1A1A2E] capitalize">
              {normalizedCurrentPlan === 'free' ? 'Free' : normalizedCurrentPlan}
            </p>
            <p className="text-[12px] text-[#9B9BA8] mt-0.5">
              {company.credits_balance} credits remaining
            </p>
          </div>
          {isActive && (
            <button
              type="button"
              onClick={() => void handleManageBilling()}
              disabled={loading === 'portal'}
              className="flex items-center gap-2 bg-[#F3F3F8] rounded-xl px-4 py-2.5
                text-[12px] font-semibold text-[#1A1A2E] disabled:opacity-50"
            >
              {loading === 'portal'
                ? <Loader2 size={12} className="animate-spin" />
                : 'Manage billing'
              }
            </button>
          )}
        </div>
      </div>

      {/* Billing toggle */}
      <div className="flex items-center justify-center gap-3 mb-6">
        <button
          type="button"
          onClick={() => setBillingPeriod('monthly')}
          className={`text-[13px] font-semibold px-4 py-2 rounded-xl transition-all ${
            billingPeriod === 'monthly'
              ? 'bg-[#1A1A2E] text-white'
              : 'text-[#9B9BA8]'
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setBillingPeriod('annual')}
          className={`text-[13px] font-semibold px-4 py-2 rounded-xl transition-all ${
            billingPeriod === 'annual'
              ? 'bg-[#1A1A2E] text-white'
              : 'text-[#9B9BA8]'
          }`}
        >
          Annual
          <span className="ml-1.5 text-[10px] font-bold text-[#16A34A] bg-[#DCFCE7]
            px-1.5 py-0.5 rounded-full">
            Save up to 22%
          </span>
        </button>
      </div>

      {/* Plans */}
      <div className="flex flex-col gap-3">
        {plans.map((plan, i) => {
          const color = PLAN_COLORS[plan.slug] ?? '#9A88FD'
          const isCurrentPlan = normalizedCurrentPlan === plan.slug
          const isSelected = selected === i
          const monthlyPrice = plan.price_aed_monthly
          // Annual price = monthly * 10 (2 months free)
          const annualPricePerMonth = Math.round(monthlyPrice * 10 / 12)
          const displayPrice = billingPeriod === 'annual'
            ? annualPricePerMonth
            : monthlyPrice

          return (
            <motion.div
              key={plan.slug}
              onClick={() => setSelected(i)}
              whileTap={{ scale: 0.98 }}
              className="relative bg-white rounded-2xl border-2 cursor-pointer transition-all"
              style={{
                borderColor: isSelected ? color : '#EEECFF',
              }}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-4">
                  <span className="text-[10px] font-bold text-white px-3 py-1
                    rounded-full" style={{ background: color }}>
                    Most popular
                  </span>
                </div>
              )}

              <div className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="text-[15px] font-bold text-[#1A1A2E]">
                      {plan.name}
                    </div>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-[24px] font-extrabold text-[#1A1A2E]"
                        style={{ fontFamily: 'Poppins, sans-serif' }}>
                        {displayPrice}
                      </span>
                      <span className="text-[12px] text-[#9B9BA8]">AED/mo</span>
                    </div>
                    {billingPeriod === 'annual' && (
                      <div className="text-[11px] text-[#9B9BA8] mt-0.5">
                        Billed {Math.round(monthlyPrice * 10)} AED/year
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[11px] font-bold px-2.5 py-1 rounded-full"
                      style={{ background: `${color}20`, color }}>
                      {plan.credits_per_month} credits/mo
                    </span>
                    <span className="text-[10px] text-[#9B9BA8]">
                      +{plan.extra_credit_price_aed ?? '—'} AED/extra
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-[12px] text-[#6B7280]
                  border-t border-[#F3F3F8] pt-3">
                  <span>
                    {plan.max_users ? `${plan.max_users} inspectors` : 'Unlimited'}
                  </span>
                  {plan.white_label && (
                    <span className="flex items-center gap-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                          stroke="#16A34A" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      White label
                    </span>
                  )}
                </div>
              </div>

              {isSelected && (
                <div className="px-4 pb-4">
                  <button
                    type="button"
                    onClick={() => void handleSubscribe(plan)}
                    disabled={!!loading || isCurrentPlan}
                    className="w-full py-3 rounded-xl text-[14px] font-bold text-white
                      flex items-center justify-center gap-2 disabled:opacity-50
                      transition-all"
                    style={{ background: isCurrentPlan ? '#9B9BA8' : color }}
                  >
                    {loading === plan.slug
                      ? <Loader2 size={16} className="animate-spin" />
                      : isCurrentPlan ? 'Current plan' : 'Subscribe'
                    }
                  </button>
                </div>
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )
}
