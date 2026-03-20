'use client'

import { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'

interface Props {
  company: {
    id: string
    plan: string
    credits_balance: number
    stripe_subscription_id?: string | null
  }
}

export function SubscriptionSection({ company }: Props) {
  const features = [
    { icon: '🤖', label: 'AI Analysis' },
    { icon: '📍', label: 'GPS + Timestamp' },
    { icon: '✍️', label: 'E-Signature' },
    { icon: '📧', label: 'Sign Tracking' },
    { icon: '🔒', label: 'SHA-256' },
    { icon: '📋', label: 'Key Handover' },
    { icon: '🔔', label: 'Renewal Alerts' },
    { icon: '🎨', label: 'White-label' },
    { icon: '⚖️', label: 'RERA Ready' },
    { icon: '📱', label: 'Native PWA' },
  ]

  const plans = [
    {
      slug: 'starter',
      name: 'Starter',
      tagline: 'Solo inspector',
      price: 149,
      credits: 10,
      extraCredit: 18,
      users: '1 inspector',
      color: '#9A88FD',
      darkColor: '#7C6FD4',
      popular: false,
      priceId: 'price_1TC1CrKIsjOh5d33lCuUGmcd',
    },
    {
      slug: 'growth',
      name: 'Growth',
      tagline: 'Small team',
      price: 249,
      credits: 20,
      extraCredit: 15,
      users: 'Up to 3 inspectors',
      color: '#7C3AED',
      darkColor: '#5B21B6',
      popular: true,
      priceId: 'price_1TC1D3KIsjOh5d33oEd1E3T1',
    },
    {
      slug: 'agency',
      name: 'Agency',
      tagline: 'Full agency',
      price: 349,
      credits: 30,
      extraCredit: 13,
      users: 'Unlimited inspectors',
      color: '#1E1B4B',
      darkColor: '#0F0A2E',
      popular: false,
      priceId: 'price_1TC1DPKIsjOh5d33hlQhhUTf',
    },
  ] as const

  const [loading, setLoading] = useState<string | null>(null)
  const [activeIdx, setActiveIdx] = useState(1)

  const normalizedCurrentPlan =
    company.plan === 'pro_solo'
      ? 'starter'
      : company.plan === 'pro_agency'
        ? 'growth'
        : company.plan === 'pro_max'
          ? 'agency'
          : company.plan

  const currentPlan = plans.find((p) => p.slug === normalizedCurrentPlan)?.name ?? 'Free'
  const creditsBalance = company.credits_balance

  async function handleSubscribe(plan: (typeof plans)[number]) {
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
      const data = (await res.json()) as { url?: string; error?: string }
      if (data.url) window.location.href = data.url
    } catch (err) {
      console.error('Checkout error:', err)
    } finally {
      setLoading(null)
    }
  }

  function handleSelectPlan(slug: string) {
    const plan = plans.find((p) => p.slug === slug)
    if (!plan) return
    void handleSubscribe(plan)
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#F8F7F4]">
      <div className="shrink-0 px-5 pb-3 pt-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Current plan
        </p>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-black text-gray-900">
            {currentPlan}
          </h1>
          <div className="flex items-center gap-1.5 rounded-full bg-[#9A88FD]/10 px-3 py-1.5">
            <span className="text-sm font-black text-[#9A88FD]">
              {creditsBalance}
            </span>
            <span className="text-xs text-[#9A88FD]/70">credits</span>
          </div>
        </div>
      </div>

      <div className="shrink-0 pb-3">
        <p className="mb-2 px-5 text-[10px] font-bold uppercase tracking-widest text-gray-400">
          Everything included
        </p>
        <div className="scrollbar-none flex snap-x snap-mandatory gap-2 overflow-x-auto px-5 pb-1">
          {features.map((f, index) => (
            <motion.div
              key={f.label}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.04 }}
              className="snap-start shrink-0 rounded-full border border-gray-100 bg-white px-3 py-1.5 shadow-sm"
            >
              <div className="flex items-center gap-1.5">
                <span className="text-sm">{f.icon}</span>
                <span className="whitespace-nowrap text-xs font-semibold text-gray-600">
                  {f.label}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="mb-4 flex shrink-0 gap-2 px-5">
        {plans.map((p, i) => (
          <motion.button
            key={p.slug}
            onClick={() => setActiveIdx(i)}
            animate={{
              backgroundColor: activeIdx === i ? p.color : '#F3F4F6',
              color: activeIdx === i ? '#fff' : '#6B7280',
            }}
            transition={{ duration: 0.2 }}
            className="flex-1 rounded-xl py-2 text-xs font-bold"
          >
            {p.name}
          </motion.button>
        ))}
      </div>

      <div className="flex-1 overflow-hidden px-4 pb-6">
        <AnimatePresence mode="wait">
          {plans.map((plan, i) =>
            i === activeIdx ? (
              <motion.div
                key={plan.slug}
                initial={{ opacity: 0, y: 30, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.96 }}
                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                className="flex h-full flex-col overflow-hidden rounded-3xl"
                style={{ background: `linear-gradient(145deg, ${plan.color}, ${plan.darkColor})` }}
              >
                {plan.popular && (
                  <div className="flex justify-center pt-3">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.15, type: 'spring', stiffness: 500 }}
                      className="flex items-center gap-1 rounded-full bg-white/20 px-4 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white backdrop-blur-sm"
                    >
                      ⭐ Most popular
                    </motion.div>
                  </div>
                )}

                <div className="flex flex-1 flex-col items-center justify-center px-8 py-6">
                  <motion.p
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="mb-1 text-sm font-medium text-white/60"
                  >
                    {plan.tagline}
                  </motion.p>

                  <motion.div
                    initial={{ opacity: 0, scale: 0.7 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.12, type: 'spring', stiffness: 300 }}
                    className="mb-1 flex items-start gap-1"
                  >
                    <span className="mt-3 text-lg font-bold text-white/70">AED</span>
                    <span className="text-7xl font-black leading-none text-white">
                      {plan.price}
                    </span>
                  </motion.div>

                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.18 }}
                    className="mb-8 text-xs text-white/50"
                  >
                    per month
                  </motion.p>

                  <div className="mb-6 grid w-full grid-cols-3 gap-3">
                    {[
                      { label: 'Credits/mo', value: plan.credits, icon: '⚡' },
                      { label: 'Per credit', value: `AED ${plan.extraCredit}`, icon: '💳' },
                      {
                        label: 'Team',
                        value: plan.users.startsWith('Unlimited') ? '∞' : plan.users.split(' ')[2] ?? '1',
                        icon: '👥',
                      },
                    ].map((stat, si) => (
                      <motion.div
                        key={stat.label}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 + si * 0.06 }}
                        className="rounded-2xl bg-white/10 p-3 text-center backdrop-blur-sm"
                      >
                        <p className="mb-0.5 text-lg">{stat.icon}</p>
                        <p className="text-lg font-black leading-none text-white">
                          {stat.value}
                        </p>
                        <p className="mt-1 text-[10px] text-white/50">
                          {stat.label}
                        </p>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mb-6 w-full">
                    <div className="mb-1.5 flex justify-between">
                      <span className="text-[11px] text-white/60">
                        Monthly credits
                      </span>
                      <span className="text-[11px] font-bold text-white">
                        {plan.credits} / 30
                      </span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-white/20">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${(plan.credits / 30) * 100}%` }}
                        transition={{ delay: 0.3, duration: 0.9, ease: 'easeOut' }}
                        className="h-full rounded-full bg-white"
                      />
                    </div>
                  </div>
                </div>

                <div className="shrink-0 px-5 pb-6">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    type="button"
                    onClick={() => handleSelectPlan(plan.slug)}
                    disabled={normalizedCurrentPlan === plan.slug || loading === plan.slug}
                    className="relative w-full overflow-hidden rounded-2xl bg-white py-4 text-base font-black disabled:cursor-not-allowed disabled:opacity-70"
                    style={{ color: plan.color }}
                  >
                    <motion.div
                      className="absolute inset-0 -skew-x-12 bg-gradient-to-r from-transparent via-black/5 to-transparent"
                      initial={{ x: '-100%' }}
                      whileHover={{ x: '200%' }}
                      transition={{ duration: 0.55 }}
                    />
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      {loading === plan.slug && <Loader2 size={14} className="animate-spin" />}
                      {normalizedCurrentPlan === plan.slug
                        ? '✓ Your current plan'
                        : `Get ${plan.name} →`}
                    </span>
                  </motion.button>

                  <p className="mt-3 text-center text-[10px] text-white/40">
                    Cancel anytime · Credits roll over monthly
                  </p>
                </div>
              </motion.div>
            ) : null
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
