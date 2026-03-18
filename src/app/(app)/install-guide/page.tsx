'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Check } from 'lucide-react'

type OS = 'ios' | 'android'

const iosSteps = [
  {
    title: 'Open Safari',
    desc: "Make sure you're using Safari — this only works in Safari on iPhone, not Chrome.",
    visual: 'safari-tip',
  },
  {
    title: 'Tap the Share button',
    desc: 'At the bottom of Safari, tap the square with an arrow pointing up.',
    visual: 'share-button',
  },
  {
    title: 'Tap "Add to Home Screen"',
    desc: 'Scroll the menu and tap "Add to Home Screen". It has a + icon.',
    visual: 'add-to-home',
  },
  {
    title: "Tap \"Add\" — you're done!",
    desc: 'A name is already filled in. Just tap "Add" in the top right corner.',
    visual: 'confirm-add',
  },
]

const androidSteps = [
  {
    title: 'Open Chrome',
    desc: "Make sure you're using Chrome. Go to app.snagify.net in the address bar.",
    visual: 'chrome-tip',
  },
  {
    title: 'Tap the 3 dots (⋮)',
    desc: 'In Chrome, tap the three dots in the top right corner of the screen.',
    visual: 'three-dots',
  },
  {
    title: 'Tap "Add to Home screen"',
    desc: 'Find this in the menu. It might also say "Install app".',
    visual: 'android-menu',
  },
  {
    title: "Tap \"Add\" — you're done!",
    desc: 'A popup appears. Just tap "Add" to add Snagify to your home screen.',
    visual: 'android-confirm',
  },
]

function StepVisual({ type }: { type: string }) {
  const phoneWrap = 'bg-[#1A1A2E] rounded-2xl p-2 w-[160px] mx-auto'
  const screen = 'bg-white rounded-xl overflow-hidden'

  if (type === 'safari-tip' || type === 'chrome-tip') {
    const isSafari = type === 'safari-tip'
    return (
      <div className="flex items-center justify-center gap-3 py-3">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl
          ${isSafari ? 'bg-blue-50' : 'bg-yellow-50'}`}>
          {isSafari ? '🧭' : '🌐'}
        </div>
        <div>
          <div className="text-sm font-bold text-[#1A1A2E]">
            {isSafari ? 'Safari' : 'Chrome'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isSafari ? 'The blue compass icon' : 'The colorful circle icon'}
          </div>
        </div>
      </div>
    )
  }

  if (type === 'share-button') {
    return (
      <div className="py-3">
        <div className={phoneWrap}>
          <div className={screen}>
            <div className="bg-[#F2F2F7] px-2 py-1.5 flex items-center gap-2">
              <div className="flex-1 bg-white rounded-lg px-2 py-1 text-[9px] text-gray-500">
                app.snagify.net
              </div>
            </div>
            <div className="h-12 bg-white flex items-center justify-center">
              <div className="text-[10px] text-gray-400">Snagify</div>
            </div>
            <div className="bg-[#F2F2F7] px-2 py-1.5 flex justify-around items-center">
              <div className="w-5 h-5 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M15 6H9" stroke="#9B9BA8" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M20 11H4" stroke="#9B9BA8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="w-5 h-5 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path d="M9 6h6" stroke="#9B9BA8" strokeWidth="1.5" strokeLinecap="round"/>
                  <path d="M4 11h16" stroke="#9B9BA8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
              <div className="w-8 h-8 bg-[#9A88FD] rounded-xl flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <rect x="4" y="8" width="16" height="13" rx="2" stroke="white" strokeWidth="1.5"/>
                  <path d="M12 3v10M9 6l3-3 3 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <div className="w-5 h-5 flex items-center justify-center">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="#9B9BA8">
                  <path d="M3 6h18M3 12h18M3 18h18" stroke="#9B9BA8" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap the purple highlighted button ↑
        </p>
      </div>
    )
  }

  if (type === 'add-to-home') {
    return (
      <div className="py-3">
        <div className="bg-white rounded-2xl border border-[#EEECFF] overflow-hidden mx-auto max-w-[200px]">
          <div className="text-[9px] text-gray-400 text-center py-1.5 border-b border-[#F3F3F8]">Share</div>
          <div className="flex gap-2 p-2 overflow-hidden">
            {['Copy', 'Message', 'Mail'].map(name => (
              <div key={name} className="flex flex-col items-center gap-1 flex-shrink-0">
                <div className="w-10 h-10 bg-[#F2F2F7] rounded-xl" />
                <div className="text-[8px] text-gray-500">{name}</div>
              </div>
            ))}
          </div>
          <div className="border-t border-[#F3F3F8]">
            {['Bookmark', 'Find on Page'].map(item => (
              <div key={item} className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F3F8]">
                <div className="w-6 h-6 bg-[#F2F2F7] rounded-lg" />
                <span className="text-[9px] text-gray-600">{item}</span>
              </div>
            ))}
            <div className="flex items-center gap-2 px-3 py-2 bg-[#EDE9FF]">
              <div className="w-6 h-6 bg-[#9A88FD] rounded-lg flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                  <rect x="3" y="3" width="18" height="18" rx="3" fill="white"/>
                  <path d="M12 8v8M8 12h8" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </div>
              <span className="text-[9px] font-bold text-[#6B4FE8]">Add to Home Screen</span>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (type === 'confirm-add' || type === 'android-confirm') {
    return (
      <div className="py-3">
        <div className="bg-white rounded-2xl border border-[#EEECFF] overflow-hidden mx-auto max-w-[200px]">
          <div className="flex items-center justify-between px-3 py-2 border-b border-[#EEECFF]">
            <span className="text-[9px] text-gray-400">Cancel</span>
            <span className="text-[9px] font-bold text-gray-400">Add to Home Screen</span>
            <span className="text-[9px] font-bold text-[#9A88FD]">Add ←</span>
          </div>
          <div className="p-3 flex items-center gap-2">
            <div className="w-10 h-10 bg-[#9A88FD] rounded-xl flex items-center justify-center flex-shrink-0">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                <path d="M3 9.5L12 3l9 6.5V20H3V9.5z" fill="white"/>
              </svg>
            </div>
            <div>
              <div className="text-[10px] font-bold text-[#1A1A2E]">Snagify</div>
              <div className="text-[8px] text-gray-400">app.snagify.net</div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap &quot;Add&quot; on the right ↑
        </p>
      </div>
    )
  }

  if (type === 'three-dots') {
    return (
      <div className="py-3">
        <div className={phoneWrap}>
          <div className={screen}>
            <div className="bg-white px-2 py-1.5 flex items-center gap-2 border-b border-gray-100">
              <div className="flex-1 bg-[#F2F2F7] rounded-full px-2 py-1 text-[9px] text-gray-500">
                app.snagify.net
              </div>
              <div className="w-7 h-7 bg-[#9A88FD] rounded-lg flex items-center justify-center">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="5" r="1.8"/>
                  <circle cx="12" cy="12" r="1.8"/>
                  <circle cx="12" cy="19" r="1.8"/>
                </svg>
              </div>
            </div>
            <div className="h-14 flex items-center justify-center">
              <div className="text-[10px] text-gray-400">Snagify</div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap the purple highlighted button ↑
        </p>
      </div>
    )
  }

  if (type === 'android-menu') {
    return (
      <div className="py-3">
        <div className="bg-white rounded-2xl border border-[#EEECFF] overflow-hidden mx-auto max-w-[200px]">
          {['New tab', 'Bookmarks', 'History'].map(item => (
            <div key={item} className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F3F8]">
              <div className="w-4 h-4 bg-[#F2F2F7] rounded" />
              <span className="text-[9px] text-gray-600">{item}</span>
            </div>
          ))}
          <div className="flex items-center gap-2 px-3 py-2 bg-[#EDE9FF] border-b border-[#EEECFF]">
            <div className="w-4 h-4 bg-[#9A88FD] rounded flex items-center justify-center">
              <svg width="8" height="8" viewBox="0 0 24 24" fill="none">
                <rect x="3" y="3" width="18" height="18" rx="3" fill="white"/>
                <path d="M12 8v8M8 12h8" stroke="#9A88FD" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <span className="text-[9px] font-bold text-[#6B4FE8]">Add to Home screen</span>
          </div>
          {['Share', 'Settings'].map(item => (
            <div key={item} className="flex items-center gap-2 px-3 py-2 border-b border-[#F3F3F8]">
              <div className="w-4 h-4 bg-[#F2F2F7] rounded" />
              <span className="text-[9px] text-gray-600">{item}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return null
}

export default function InstallGuidePage() {
  const router = useRouter()
  const [os, setOs] = useState<OS>('ios')

  const steps = os === 'ios' ? iosSteps : androidSteps

  return (
    <div className="min-h-screen bg-[#F8F7F4] pb-24">
      {/* Header */}
      <div className="bg-white px-4 py-3 flex items-center gap-3 border-b border-[#EEECFF]">
        <button
          onClick={() => router.back()}
          className="w-9 h-9 rounded-xl bg-[#F3F2F0] flex items-center justify-center"
        >
          <ArrowLeft size={18} color="#1A1A2E" />
        </button>
        <span className="text-[17px] font-bold text-[#1A1A2E]">Install Snagify</span>
      </div>

      {/* Hero */}
      <div className="bg-[#9A88FD] px-6 py-7 text-center relative overflow-hidden">
        <div className="absolute -right-6 -top-6 w-24 h-24 rounded-full border-[18px] border-white/10" />
        <div className="absolute -left-4 -bottom-4 w-16 h-16 rounded-full border-[12px] border-white/[0.08]" />
        <div className="w-16 h-16 bg-white rounded-2xl mx-auto mb-3 flex items-center justify-center relative z-10">
          <img src="/icon-512x512.png" alt="Snagify" className="w-12 h-12 rounded-xl" />
        </div>
        <h1 className="text-xl font-extrabold text-white mb-1 relative z-10"
          style={{ fontFamily: 'Poppins, sans-serif' }}>
          Add to your home screen
        </h1>
        <p className="text-sm text-white/75 relative z-10 leading-relaxed">
          Works like a real app — no App Store needed.<br />Just 3 simple steps.
        </p>
      </div>

      <div className="px-4 pt-4">
        {/* OS Tabs */}
        <div className="flex gap-3 mb-5">
          {([
            { id: 'ios', label: 'iPhone', sub: 'Safari browser', emoji: '🧭' },
            { id: 'android', label: 'Android', sub: 'Chrome browser', emoji: '🌐' },
          ] as const).map(tab => (
            <button
              key={tab.id}
              onClick={() => setOs(tab.id)}
              className={`flex-1 py-3 px-4 rounded-2xl border-2 text-left transition-all
                ${os === tab.id
                  ? 'border-[#9A88FD] bg-[#EDE9FF]'
                  : 'border-transparent bg-white'
                }`}
            >
              <div className="text-xl mb-0.5">{tab.emoji}</div>
              <div className={`text-sm font-bold ${os === tab.id ? 'text-[#6B4FE8]' : 'text-[#1A1A2E]'}`}>
                {tab.label}
              </div>
              <div className={`text-xs ${os === tab.id ? 'text-[#9A88FD]' : 'text-gray-400'}`}>
                {tab.sub}
              </div>
            </button>
          ))}
        </div>

        {/* Steps */}
        <AnimatePresence mode="wait">
          <motion.div
            key={os}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.2 }}
          >
            {steps.map((step, i) => (
              <div
                key={i}
                className="bg-white rounded-2xl p-4 mb-3 border border-[#EEECFF]"
              >
                <div className="flex gap-3 items-start mb-1">
                  <div className="w-8 h-8 rounded-full bg-[#9A88FD] text-white text-sm
                    font-extrabold flex items-center justify-center flex-shrink-0 mt-0.5">
                    {i + 1}
                  </div>
                  <div>
                    <div className="text-[15px] font-bold text-[#1A1A2E]">{step.title}</div>
                    <div className="text-[13px] text-gray-500 mt-0.5 leading-relaxed">
                      {step.desc}
                    </div>
                  </div>
                </div>
                <StepVisual type={step.visual} />
              </div>
            ))}

            {/* Done card */}
            <div className="bg-[#9A88FD] rounded-2xl p-6 text-center mb-4">
              <div className="w-12 h-12 rounded-full bg-white/20 mx-auto mb-3
                flex items-center justify-center">
                <Check size={24} color="white" strokeWidth={2.5} />
              </div>
              <div className="text-xl font-extrabold text-white mb-1"
                style={{ fontFamily: 'Poppins, sans-serif' }}>
                You&apos;re all set!
              </div>
              <div className="text-sm text-white/75 leading-relaxed">
                Snagify is now on your home screen.<br />
                Tap the icon anytime to open it — no browser needed.
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
