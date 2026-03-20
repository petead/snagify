'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Check } from 'lucide-react'

const PLANS = [
  {
    slug: 'starter',
    name: 'Starter',
    price: 149,
    credits: 10,
    users: '1 user',
    usersDetail: 'Solo inspector',
    pricePerCredit: 18,
    extraCredit: 18,
    popular: false,
    gradient: 'from-gray-50 to-white',
    accentColor: '#9A88FD',
    savingsVsMax: null,
    priceId: 'price_1TC1CrKIsjOh5d33lCuUGmcd',
  },
  {
    slug: 'growth',
    name: 'Growth',
    price: 249,
    credits: 20,
    users: 'Up to 5 users',
    usersDetail: 'Small team',
    pricePerCredit: 12.45,
    extraCredit: 15,
    popular: true,
    gradient: 'from-[#9A88FD]/8 to-white',
    accentColor: '#9A88FD',
    savingsVsMax: '17% cheaper per credit',
    priceId: 'price_1TC1D3KIsjOh5d33oEd1E3T1',
  },
  {
    slug: 'agency',
    name: 'Agency',
    price: 349,
    credits: 30,
    users: 'Unlimited users',
    usersDetail: 'Full agency',
    pricePerCredit: 11.63,
    extraCredit: 13,
    popular: false,
    gradient: 'from-gray-50 to-white',
    accentColor: '#7C3AED',
    savingsVsMax: '28% cheaper per credit',
    priceId: 'price_1TC1DPKIsjOh5d33hlQhhUTf',
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
  const normalizedCurrentPlan = (
    company.plan === 'pro_solo'
      ? 'starter'
      : company.plan === 'pro_agency'
        ? 'growth'
        : company.plan === 'pro_max'
          ? 'agency'
          : company.plan
  )
  const currentPlan = PLANS.find(p => p.slug === normalizedCurrentPlan)
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

  function handleSelectPlan(slug: string) {
    const plan = PLANS.find((p) => p.slug === slug)
    if (!plan) return
    void handleSubscribe(plan)
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

      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="mx-4 mb-6 rounded-2xl border border-[#9A88FD]/20 bg-[#9A88FD]/8 p-4"
      >
        <p className="mb-3 text-[11px] font-bold uppercase tracking-wider text-[#9A88FD]">
          ✦ Everything included in every plan
        </p>
        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
          {[
            'White-label PDF reports',
            'AI photo analysis',
            'E-signature for all parties',
            'Unlimited properties',
            'Check-in & check-out',
            'SHA-256 document integrity',
          ].map((feat) => (
            <div key={feat} className="flex items-center gap-1.5">
              <svg
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9A88FD"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              <span className="text-[11px] text-gray-500">{feat}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Plan cards */}
      <div style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#9CA3AF', marginBottom: 12 }}>
          {isOnPaidPlan ? 'Change plan' : 'Choose a plan'}
        </div>

        <div className="flex flex-col gap-3">
          {PLANS.map((plan, idx) => {
            const isCurrent = plan.slug === normalizedCurrentPlan
            return (
              <motion.div
                key={plan.slug}
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 + idx * 0.08, ease: [0.16, 1, 0.3, 1] }}
                className={`relative mx-4 mb-4 overflow-hidden rounded-3xl border bg-gradient-to-b ${plan.gradient} ${
                  plan.popular
                    ? 'z-10 scale-[1.02] border-[#9A88FD] shadow-[0_8px_40px_rgba(154,136,253,0.25)]'
                    : 'border-gray-200 shadow-sm'
                }`}
              >
                {plan.popular && (
                  <motion.div
                    animate={{ opacity: [0.4, 0.7, 0.4] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="pointer-events-none absolute inset-0 rounded-3xl"
                    style={{ boxShadow: 'inset 0 0 40px rgba(154,136,253,0.08)' }}
                  />
                )}

                {plan.popular && (
                  <div className="absolute -top-px left-1/2 -translate-x-1/2">
                    <motion.div
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: 0.3, type: 'spring', stiffness: 500 }}
                      className="rounded-b-xl bg-[#9A88FD] px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white"
                    >
                      ⭐ Most popular
                    </motion.div>
                  </div>
                )}

                <div className="p-5 pt-6">
                  {isCurrent && (
                    <div className="mb-3 inline-flex items-center gap-1 rounded-full bg-green-600 px-2.5 py-1 text-[10px] font-bold text-white">
                      <Check size={10} />
                      Current plan
                    </div>
                  )}

                  <div className="mb-4 flex items-start justify-between">
                    <div>
                      <h3 className="text-xl font-black text-gray-900">{plan.name}</h3>
                      <p className="mt-0.5 text-xs text-gray-400">{plan.usersDetail}</p>
                    </div>
                    <div className="text-right">
                      <div className="flex items-baseline gap-0.5">
                        <span className="text-xs text-gray-400">AED</span>
                        <motion.span
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.15 + idx * 0.08, type: 'spring' }}
                          className="text-3xl font-black text-gray-900"
                        >
                          {plan.price}
                        </motion.span>
                      </div>
                      <span className="text-[10px] text-gray-400">/month</span>
                    </div>
                  </div>

                  <div className="mb-4 rounded-2xl bg-gray-50 p-4">
                    <div className="mb-2 flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Monthly credits</span>
                      <motion.span
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.2 + idx * 0.08 }}
                        className="text-lg font-black"
                        style={{ color: plan.accentColor }}
                      >
                        {plan.credits}
                      </motion.span>
                    </div>
                    <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(plan.credits / 30) * 100}%` }}
                        transition={{ delay: 0.3 + idx * 0.08, duration: 0.8, ease: 'easeOut' }}
                        className="h-full rounded-full"
                        style={{
                          background: `linear-gradient(90deg, ${plan.accentColor}90, ${plan.accentColor})`,
                        }}
                      />
                    </div>
                    <div className="mt-2 flex items-center justify-between">
                      <span className="text-[11px] text-gray-400">
                        AED {plan.pricePerCredit.toFixed(2)}/credit included
                      </span>
                      {plan.savingsVsMax && (
                        <motion.span
                          initial={{ opacity: 0, x: 8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + idx * 0.08 }}
                          className="rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-semibold text-green-500"
                        >
                          ↓ {plan.savingsVsMax}
                        </motion.span>
                      )}
                    </div>
                  </div>

                  <div className="mb-5 flex flex-col gap-2">
                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={plan.accentColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                          <circle cx="9" cy="7" r="4" />
                          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                        </svg>
                        <span className="text-xs text-gray-600">Team size</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800">{plan.users}</span>
                    </div>

                    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <svg
                          width="15"
                          height="15"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke={plan.accentColor}
                          strokeWidth="2"
                          strokeLinecap="round"
                        >
                          <circle cx="12" cy="12" r="10" />
                          <line x1="12" y1="8" x2="12" y2="16" />
                          <line x1="8" y1="12" x2="16" y2="12" />
                        </svg>
                        <span className="text-xs text-gray-600">Extra credit</span>
                      </div>
                      <span className="text-xs font-bold text-gray-800">AED {plan.extraCredit}/cr</span>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.02, boxShadow: `0 8px 24px ${plan.accentColor}40` }}
                    whileTap={{ scale: 0.98 }}
                    type="button"
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={isCurrent || loading === plan.slug}
                    className="relative w-full overflow-hidden rounded-2xl py-3.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ backgroundColor: plan.accentColor }}
                  >
                    <motion.div
                      className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-white/20 to-transparent"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '200%' }}
                      transition={{ duration: 0.55 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading === plan.slug && <Loader2 size={14} className="animate-spin" />}
                      {isCurrent ? '✓ Current plan' : 'Get started'}
                    </span>
                  </motion.button>
                </div>
              </motion.div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
