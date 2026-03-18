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

  // iOS: Share button step
  if (type === 'share-button') {
    return (
      <div className="py-3">
        {/* iPhone screenshot mockup */}
        <div className="bg-black rounded-[28px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-white rounded-[22px] overflow-hidden">
            {/* iOS status bar */}
            <div className="bg-white px-4 pt-2 pb-1 flex justify-between items-center">
              <span className="text-[9px] font-semibold text-black">9:41</span>
              <div className="flex gap-1 items-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><rect x="0" y="3" width="1.5" height="5" rx="0.5"/><rect x="2.5" y="2" width="1.5" height="6" rx="0.5"/><rect x="5" y="1" width="1.5" height="7" rx="0.5"/><rect x="7.5" y="0" width="1.5" height="8" rx="0.5"/></svg>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><path d="M5 1.5C3.2 1.5 1.7 2.2.7 3.3L0 2.6C1.2 1.2 3 .3 5 .3s3.8.9 5 2.3l-.7.7C8.3 2.2 6.8 1.5 5 1.5zM5 4.5c-.8 0-1.5.3-2 .8L2.3 4.6C3 3.9 3.9 3.5 5 3.5s2 .4 2.7 1.1l-.7.7c-.5-.5-1.2-.8-2-.8zM5 7.5c-.4 0-.8-.2-1.1-.4L5 5.5l1.1 1.6c-.3.2-.7.4-1.1.4z"/></svg>
                <svg width="16" height="8" viewBox="0 0 16 8" fill="black"><rect x="0" y="1" width="13" height="6" rx="1.5" stroke="black" strokeWidth="0.8" fill="none"/><rect x="1" y="2" width="9" height="4" rx="0.8" fill="black"/><rect x="14" y="2.5" width="1.5" height="3" rx="0.75" fill="black"/></svg>
              </div>
            </div>
            {/* Safari URL bar */}
            <div className="bg-[#F2F2F7] mx-2 rounded-xl px-3 py-1.5 mb-1 flex items-center gap-1">
              <svg width="8" height="8" viewBox="0 0 16 16" fill="#9B9BA8"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zm0 12.5a5.5 5.5 0 110-11 5.5 5.5 0 010 11z"/><path d="M7 5h2v5H7zM7 11h2v1H7z"/></svg>
              <span className="text-[9px] text-[#3C3C43] flex-1 text-center">app.snagify.net</span>
              <svg width="8" height="8" viewBox="0 0 16 16" fill="#9B9BA8"><path d="M5 2l6 6-6 6" stroke="#9B9BA8" strokeWidth="1.5" fill="none" strokeLinecap="round"/></svg>
            </div>
            {/* Page content */}
            <div className="bg-[#F8F7F4] h-12 flex items-center justify-center">
              <div className="text-[9px] text-gray-400">Snagify</div>
            </div>
            {/* Safari bottom toolbar */}
            <div className="bg-[#F2F2F7] border-t border-gray-200 px-3 py-1.5 flex justify-between items-center">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round"><path d="M15 6H9M20 12H4"/></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8" strokeLinecap="round"><path d="M9 6h6M4 12h16"/></svg>
              {/* Share button — highlighted */}
              <div className="bg-[#9A88FD] rounded-lg p-1">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="5" y="9" width="14" height="12" rx="2"/>
                  <path d="M12 4v10M9 7l3-3 3 3"/>
                </svg>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8"><rect x="3" y="6" width="18" height="3" rx="1"/><rect x="3" y="11" width="18" height="3" rx="1"/><rect x="3" y="16" width="18" height="3" rx="1"/></svg>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8E8E93" strokeWidth="1.8"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap the highlighted Share button
        </p>
      </div>
    )
  }

  // iOS: Add to Home Screen menu
  if (type === 'add-to-home') {
    return (
      <div className="py-3">
        <div className="bg-black rounded-[28px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-white rounded-[22px] overflow-hidden">
            <div className="bg-white px-4 pt-2 pb-1 flex justify-between items-center">
              <span className="text-[9px] font-semibold text-black">9:41</span>
              <div className="flex gap-1 items-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><rect x="0" y="3" width="1.5" height="5" rx="0.5"/><rect x="2.5" y="2" width="1.5" height="6" rx="0.5"/><rect x="5" y="1" width="1.5" height="7" rx="0.5"/><rect x="7.5" y="0" width="1.5" height="8" rx="0.5"/></svg>
                <svg width="16" height="8" viewBox="0 0 16 8" fill="black"><rect x="0" y="1" width="13" height="6" rx="1.5" stroke="black" strokeWidth="0.8" fill="none"/><rect x="1" y="2" width="9" height="4" rx="0.8" fill="black"/><rect x="14" y="2.5" width="1.5" height="3" rx="0.75" fill="black"/></svg>
              </div>
            </div>
            {/* Share sheet */}
            <div className="bg-[#F2F2F7] border-t border-gray-200">
              {/* App row */}
              <div className="flex gap-2 px-2 py-2 overflow-hidden border-b border-gray-200">
                {[
                  { label: 'Message', color: '#4CD964' },
                  { label: 'Mail', color: '#147EFB' },
                  { label: 'Copy', color: '#8E8E93' },
                  { label: 'More', color: '#8E8E93' },
                ].map(app => (
                  <div key={app.label} className="flex flex-col items-center gap-0.5 flex-shrink-0">
                    <div className="w-8 h-8 rounded-xl" style={{ background: app.color }} />
                    <span className="text-[7px] text-[#3C3C43]">{app.label}</span>
                  </div>
                ))}
              </div>
              {/* Action rows */}
              {[
                { label: 'Copy Link' },
                { label: 'Add Bookmark' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-white">
                  <div className="w-6 h-6 bg-[#F2F2F7] rounded-lg" />
                  <span className="text-[10px] text-[#3C3C43]">{item.label}</span>
                </div>
              ))}
              {/* HIGHLIGHTED ROW */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-200 bg-[#EDE9FF]">
                <div className="w-6 h-6 bg-[#9A88FD] rounded-lg flex items-center justify-center">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" fill="white"/>
                    <path d="M12 8v8M8 12h8" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-[10px] font-bold text-[#6B4FE8]">Add to Home Screen</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-white">
                <div className="w-6 h-6 bg-[#F2F2F7] rounded-lg" />
                <span className="text-[10px] text-[#3C3C43]">Find on Page</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Scroll and tap the purple option
        </p>
      </div>
    )
  }

  // iOS: Confirm Add
  if (type === 'confirm-add') {
    return (
      <div className="py-3">
        <div className="bg-black rounded-[28px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-[#F2F2F7] rounded-[22px] overflow-hidden">
            <div className="bg-[#F2F2F7] px-4 pt-2 pb-1 flex justify-between items-center">
              <span className="text-[9px] font-semibold text-black">9:41</span>
              <div className="flex gap-1 items-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><rect x="0" y="3" width="1.5" height="5" rx="0.5"/><rect x="2.5" y="2" width="1.5" height="6" rx="0.5"/><rect x="5" y="1" width="1.5" height="7" rx="0.5"/><rect x="7.5" y="0" width="1.5" height="8" rx="0.5"/></svg>
                <svg width="16" height="8" viewBox="0 0 16 8" fill="black"><rect x="0" y="1" width="13" height="6" rx="1.5" stroke="black" strokeWidth="0.8" fill="none"/><rect x="1" y="2" width="9" height="4" rx="0.8" fill="black"/><rect x="14" y="2.5" width="1.5" height="3" rx="0.75" fill="black"/></svg>
              </div>
            </div>
            {/* Add to Home Screen dialog */}
            <div className="bg-white mx-2 rounded-xl overflow-hidden mb-2">
              <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
                <span className="text-[10px] text-[#007AFF]">Cancel</span>
                <span className="text-[9px] font-semibold text-black">Add to Home Screen</span>
                {/* Highlighted Add button */}
                <span className="text-[10px] font-bold text-[#9A88FD] bg-[#EDE9FF] px-2 py-0.5 rounded-md">Add</span>
              </div>
              <div className="p-3 flex items-center gap-2">
                <div className="w-10 h-10 bg-[#9A88FD] rounded-xl flex items-center justify-center flex-shrink-0">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path d="M3 9.5L12 3l9 6.5V20H3V9.5z" fill="white"/>
                    <path d="M9 20v-6h6v6" fill="#9A88FD"/>
                  </svg>
                </div>
                <div>
                  <div className="text-[10px] font-semibold text-black">Snagify</div>
                  <div className="text-[8px] text-gray-400">app.snagify.net</div>
                </div>
              </div>
              <div className="px-3 pb-3">
                <div className="text-[8px] text-gray-400 mb-1 uppercase tracking-wide">Name</div>
                <div className="border border-[#007AFF] rounded-lg px-2 py-1.5">
                  <span className="text-[10px] text-black">Snagify</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap &quot;Add&quot; — highlighted in purple
        </p>
      </div>
    )
  }

  // Android: 3-dot menu
  if (type === 'three-dots') {
    return (
      <div className="py-3">
        <div className="bg-[#1A1A2E] rounded-[20px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-white rounded-[16px] overflow-hidden">
            {/* Android status bar */}
            <div className="bg-white px-3 pt-1.5 pb-1 flex justify-between items-center">
              <span className="text-[8px] font-semibold text-black">9:41</span>
              <div className="flex gap-1 items-center">
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><rect x="0" y="3" width="1.5" height="5" rx="0.5"/><rect x="2.5" y="2" width="1.5" height="6" rx="0.5"/><rect x="5" y="1" width="1.5" height="7" rx="0.5"/><rect x="7.5" y="0" width="1.5" height="8" rx="0.5"/></svg>
                <svg width="10" height="8" viewBox="0 0 10 8" fill="black"><path d="M5 1.5C3.2 1.5 1.7 2.2.7 3.3L0 2.6C1.2 1.2 3 .3 5 .3s3.8.9 5 2.3l-.7.7C8.3 2.2 6.8 1.5 5 1.5zM5 4.5c-.8 0-1.5.3-2 .8L2.3 4.6C3 3.9 3.9 3.5 5 3.5s2 .4 2.7 1.1l-.7.7c-.5-.5-1.2-.8-2-.8zM5 7.5c-.4 0-.8-.2-1.1-.4L5 5.5l1.1 1.6c-.3.2-.7.4-1.1.4z"/></svg>
                <svg width="14" height="8" viewBox="0 0 14 8" fill="black"><rect x="0" y="1" width="11" height="6" rx="1.5" stroke="black" strokeWidth="0.8" fill="none"/><rect x="1" y="2" width="8" height="4" rx="0.8" fill="black"/><rect x="12" y="2.5" width="1.5" height="3" rx="0.75" fill="black"/></svg>
              </div>
            </div>
            {/* Chrome URL bar */}
            <div className="bg-white px-2 py-1 flex items-center gap-1 border-b border-gray-100">
              <div className="flex-1 bg-[#F1F3F4] rounded-full px-2 py-1 flex items-center gap-1">
                <svg width="8" height="8" viewBox="0 0 16 16" fill="#5F6368"><path d="M8 1a7 7 0 100 14A7 7 0 008 1z"/></svg>
                <span className="text-[8px] text-[#3C4043] flex-1">app.snagify.net</span>
              </div>
              {/* 3 dots HIGHLIGHTED */}
              <div className="w-6 h-6 bg-[#9A88FD] rounded-full flex items-center justify-center">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
                  <circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/>
                </svg>
              </div>
            </div>
            <div className="bg-[#F8F7F4] h-14 flex items-center justify-center">
              <span className="text-[9px] text-gray-400">Snagify</span>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap the highlighted menu button
        </p>
      </div>
    )
  }

  // Android: Add to Home screen menu
  if (type === 'android-menu') {
    return (
      <div className="py-3">
        <div className="bg-[#1A1A2E] rounded-[20px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-white rounded-[16px] overflow-hidden">
            <div className="bg-white px-3 pt-1.5 pb-1 flex justify-between items-center">
              <span className="text-[8px] font-semibold text-black">9:41</span>
            </div>
            {/* Chrome dropdown menu */}
            <div className="bg-white border border-gray-100 mx-1 rounded-xl overflow-hidden shadow-sm">
              {[
                { label: 'New tab', icon: '+' },
                { label: 'New incognito tab', icon: 'i' },
                { label: 'Bookmarks', icon: '*' },
                { label: 'Recent tabs', icon: 'r' },
              ].map(item => (
                <div key={item.label} className="flex items-center gap-2 px-3 py-2 border-b border-gray-100">
                  <div className="w-5 h-5 bg-[#F1F3F4] rounded flex items-center justify-center">
                    <span className="text-[8px] text-[#5F6368]">{item.icon}</span>
                  </div>
                  <span className="text-[9px] text-[#3C4043]">{item.label}</span>
                </div>
              ))}
              {/* HIGHLIGHTED */}
              <div className="flex items-center gap-2 px-3 py-2 border-b border-gray-100 bg-[#EDE9FF]">
                <div className="w-5 h-5 bg-[#9A88FD] rounded flex items-center justify-center">
                  <svg width="9" height="9" viewBox="0 0 24 24" fill="none">
                    <rect x="3" y="3" width="18" height="18" rx="3" fill="white"/>
                    <path d="M12 8v8M8 12h8" stroke="#9A88FD" strokeWidth="2.5" strokeLinecap="round"/>
                  </svg>
                </div>
                <span className="text-[9px] font-bold text-[#6B4FE8]">Add to Home screen</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2">
                <div className="w-5 h-5 bg-[#F1F3F4] rounded" />
                <span className="text-[9px] text-[#3C4043]">Settings</span>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap the highlighted option
        </p>
      </div>
    )
  }

  // Android: Confirm
  if (type === 'android-confirm') {
    return (
      <div className="py-3">
        <div className="bg-[#1A1A2E] rounded-[20px] p-1.5 w-[180px] mx-auto shadow-lg">
          <div className="bg-[#F1F3F4] rounded-[16px] overflow-hidden">
            <div className="bg-[#F1F3F4] px-3 pt-1.5 pb-1 flex justify-between items-center">
              <span className="text-[8px] font-semibold text-black">9:41</span>
            </div>
            {/* Material dialog */}
            <div className="bg-white mx-2 mb-2 rounded-2xl overflow-hidden shadow">
              <div className="p-3 border-b border-gray-100">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 bg-[#9A88FD] rounded-lg flex items-center justify-center">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                      <path d="M3 9.5L12 3l9 6.5V20H3V9.5z" fill="white"/>
                    </svg>
                  </div>
                  <div>
                    <div className="text-[10px] font-semibold text-black">Add to Home screen</div>
                    <div className="text-[8px] text-gray-500">app.snagify.net</div>
                  </div>
                </div>
                <div className="bg-[#F1F3F4] rounded-lg px-2 py-1.5 flex items-center justify-between">
                  <span className="text-[9px] text-black">Snagify</span>
                  <div className="w-2 h-3 border-b border-[#1A73E8]" />
                </div>
              </div>
              <div className="flex justify-end gap-1 px-2 py-1.5">
                <div className="px-3 py-1 rounded-full">
                  <span className="text-[9px] text-[#5F6368] font-medium">Cancel</span>
                </div>
                <div className="px-3 py-1 rounded-full bg-[#9A88FD]">
                  <span className="text-[9px] text-white font-bold">Add</span>
                </div>
              </div>
            </div>
          </div>
        </div>
        <p className="text-center text-[11px] text-[#9A88FD] font-semibold mt-2">
          Tap &quot;Add&quot; to confirm
        </p>
      </div>
    )
  }

  // Safari/Chrome tip (step 1)
  if (type === 'safari-tip' || type === 'chrome-tip') {
    const isSafari = type === 'safari-tip'
    return (
      <div className="flex items-center justify-center gap-3 py-4">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center
          ${isSafari ? 'bg-gradient-to-b from-[#1BBCFE] to-[#0065D3]'
                     : 'bg-gradient-to-b from-[#FBBC04] to-[#EA4335]'}`}>
          {isSafari ? (
            // Safari compass icon
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <circle cx="15" cy="15" r="12" stroke="white" strokeWidth="1.5"/>
              <path d="M15 5v2M15 23v2M5 15h2M23 15h2" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <path d="M19 11l-4 4-4 4M19 11l-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="15" cy="15" r="2" fill="white"/>
            </svg>
          ) : (
            // Chrome icon
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="14" r="7" fill="white"/>
              <circle cx="14" cy="14" r="4" fill="#4285F4"/>
              <path d="M14 7h13M7.3 11.5L.8 0M20.7 11.5L27.2 0" stroke="white" strokeWidth="3" strokeLinecap="round"/>
              <path d="M14 7h13" stroke="#EA4335" strokeWidth="3" strokeLinecap="round"/>
              <path d="M7.3 11.5L.8 0" stroke="#34A853" strokeWidth="3" strokeLinecap="round"/>
              <path d="M20.7 11.5L27.2 0" stroke="#FBBC04" strokeWidth="3" strokeLinecap="round"/>
            </svg>
          )}
        </div>
        <div>
          <div className="text-sm font-bold text-[#1A1A2E]">
            {isSafari ? 'Open Safari' : 'Open Chrome'}
          </div>
          <div className="text-xs text-gray-500 mt-0.5">
            {isSafari ? 'The blue compass app' : 'The colorful circle app'}
          </div>
          <div className="text-xs text-[#9A88FD] font-medium mt-0.5">
            Then go to app.snagify.net
          </div>
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
            { id: 'ios', label: 'iPhone', sub: 'Safari browser' },
            { id: 'android', label: 'Android', sub: 'Chrome browser' },
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
              <div className="mb-1">
                {tab.id === 'ios' ? (
                  <svg width="22" height="22" viewBox="0 0 814 1000" fill="currentColor"
                    className={os === 'ios' ? 'text-[#6B4FE8]' : 'text-[#1A1A2E]'}>
                    <path d="M788.1 340.9c-5.8 4.5-108.2 62.2-108.2 190.5 0 148.4 130.3 200.9 134.2 202.2-.6 3.2-20.7 71.9-68.7 141.9-42.8 61.6-87.5 123.1-155.5 123.1s-85.5-39.5-164-39.5c-76 0-103.7 40.8-165.9 40.8s-105-57.8-155.5-127.4C46 376.6 0 279.4 0 186.8 0 83.1 67.9 27.4 136.3 27.4c67.9 0 117.5 44.1 160.3 44.1 41 0 98.1-46.4 173.2-46.4 67.9 0 136.3 32.1 180.8 86.6zM549 33.2c-25.7 30.4-69.5 54.4-112.3 54.4-5.8 0-11.6-.6-17.4-1.9C419.9 43.8 466.9 0 509.7 0c24.5.1 44.1 13.5 39.3 33.2z"/>
                  </svg>
                ) : (
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor"
                    className={os === 'android' ? 'text-[#6B4FE8]' : 'text-[#1A1A2E]'}>
                    <path d="M17.523 15.341a5.23 5.23 0 01-5.23 5.23 5.23 5.23 0 01-5.23-5.23V9.824h10.46v5.517zm-8.246-9.65L7.62 3.44a.4.4 0 00-.552.576L8.78 5.73a6.607 6.607 0 00-2.507 5.147h11.455a6.607 6.607 0 00-2.507-5.147l1.712-1.714a.4.4 0 00-.552-.576l-1.657 1.252A6.54 6.54 0 0012 4.5a6.54 6.54 0 00-2.723.591zM9.75 8.5a.75.75 0 110-1.5.75.75 0 010 1.5zm4.5 0a.75.75 0 110-1.5.75.75 0 010 1.5z"/>
                  </svg>
                )}
              </div>
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
