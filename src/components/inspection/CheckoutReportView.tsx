'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import {
  findCheckinRoom,
  countIssues,
  getRoomVerdict,
  getComparisonStats,
  type RoomData,
  type KeyItem,
} from '@/lib/inspectionCompare'

interface Props {
  inspection: {
    id: string
    type?: string | null
    status?: string | null
    signed_at?: string | null
    created_at?: string | null
    executive_summary?: string | null
    key_handover?: KeyItem[] | null
    property?: {
      address?: string | null
      building_name?: string | null
      unit_number?: string | null
      property_type?: string | null
    } | null
    rooms?: RoomData[]
  }
  checkinData: {
    id: string
    created_at?: string | null
    executive_summary?: string | null
    key_handover?: KeyItem[] | null
    rooms?: RoomData[]
  } | null
  tenancy?: {
    landlord_name?: string | null
    tenant_name?: string | null
  } | null
  signatures?: Array<{
    signer_type: string
    signed_at?: string | null
  }>
}

export function CheckoutReportView({
  inspection,
  checkinData,
  tenancy,
  signatures,
}: Props) {
  const hasCheckinData = checkinData !== null

  const stats = useMemo(
    () => hasCheckinData ? getComparisonStats(checkinData, inspection) : null,
    [checkinData, inspection, hasCheckinData]
  )


  function formatDate(d?: string | null) {
    if (!d) return '—'
    return new Date(d).toLocaleDateString('en-AE', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  }

  function DeltaBadge({ delta, invert = false }: { delta: number; invert?: boolean }) {
    if (delta === 0) {
      return (
        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#F3F3F8] text-[#6B7280]">
          Same
        </span>
      )
    }
    const isPositive = invert ? delta < 0 : delta > 0
    return (
      <span
        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
          isPositive ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#DC2626]'
        }`}
      >
        {delta > 0 ? '+' : ''}
        {delta}
      </span>
    )
  }


  const isSigned = inspection.signed_at || inspection.status === 'signed'
  const property = inspection.property

  return (
    <div
      className="min-h-screen bg-[#F3F2EF]"
      style={{ paddingBottom: 'calc(64px + env(safe-area-inset-bottom) + 150px)' }}
    >
      {/* ── HERO — identical structure to check-in ── */}
      <div className="mx-4 mt-4 rounded-3xl bg-[#1A1A2E] px-5 pt-5 pb-7 relative overflow-hidden">
        {/* Deco circles — same as check-in */}
        <div className="absolute -right-8 -top-8 w-32 h-32 rounded-full border-[24px] border-white/5 pointer-events-none" />
        <div className="absolute right-8 -bottom-10 w-20 h-20 rounded-full border-[16px] border-white/[0.04] pointer-events-none" />

        {/* CHECK-OUT REPORT badge — amber, same position as check-in badge */}
        <div className="inline-flex items-center gap-1.5 bg-[#D97706]/20 border border-[#D97706]/30 rounded-full px-3 py-1.5 mb-4">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="#D97706"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wider">
            Check-out Report
          </span>
        </div>

        {/* Property name */}
        <h1
          className="text-[26px] font-extrabold text-white mb-1"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {property?.building_name || property?.address || 'Property'}
        </h1>

        {/* Unit + date */}
        <p className="text-[14px] text-white/50 mb-4">
          {property?.unit_number ? `Unit ${property.unit_number}` : ''}
          {property?.unit_number ? ' · ' : ''}
          {formatDate(inspection.created_at)}
        </p>

        {/* Status pill */}
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
            isSigned
              ? 'bg-[#16A34A]/20 border border-[#16A34A]/30'
              : 'bg-[#FEF9C3] border border-[#D97706]/20'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isSigned ? 'bg-green-400' : 'bg-[#D97706]'}`} />
          <span className={`text-[12px] font-bold ${isSigned ? 'text-green-300' : 'text-[#B45309]'}`}>
            {isSigned ? '✓ Fully Signed' : 'Awaiting Signatures'}
          </span>
        </div>
      </div>

      {/* ── 4 STAT CARDS — identical to check-in ── */}
      <div className="mx-4 mt-3">
        <div className="grid grid-cols-4 gap-2">
          {[
            {
              value: property?.property_type || 'Apartment',
              label: 'Type',
              bold: true,
            },
            {
              value: new Date(inspection.created_at || '').toLocaleDateString('en-AE', {
                day: 'numeric',
                month: 'short',
              }),
              label: 'Date',
            },
            {
              value: inspection.rooms?.length ?? 0,
              label: 'Rooms',
            },
            {
              value: inspection.rooms?.reduce(
                (acc: number, r: RoomData) => acc + (r.photos?.length ?? 0),
                0
              ) ?? 0,
              label: 'Photos',
            },
          ].map((stat, i) => (
            <div
              key={i}
              className="bg-white rounded-2xl p-3 flex flex-col justify-between min-h-[72px] border border-[#EEECFF]/60"
            >
              <div
                className={`text-[14px] leading-tight text-[#1A1A2E] ${
                  stat.bold ? 'font-bold' : 'font-extrabold'
                }`}
              >
                {stat.value}
              </div>
              <div className="text-[11px] text-[#9B9BA8] mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="pt-4">
        {/* ── COMPARISON SUMMARY ── */}
        <div className="bg-white rounded-2xl border border-[#EEECFF] mx-4 mb-3">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#F3F3F8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                stroke="#9A88FD"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[14px] font-bold text-[#1A1A2E]">Check-in vs Check-out</span>
          </div>

          {!hasCheckinData ? (
            /* Skeleton loader when checkinData is not available */
            <div className="animate-pulse p-4">
              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-[#F8F7F4] rounded-xl p-3">
                  <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                    <div className="h-3 bg-gray-200 rounded w-full" />
                  </div>
                </div>
                <div className="bg-[#EDE9FF]/30 rounded-xl p-3 border border-[#EDE9FF]">
                  <div className="h-3 bg-[#EDE9FF] rounded w-16 mb-3" />
                  <div className="space-y-2">
                    <div className="h-3 bg-[#EDE9FF] rounded w-full" />
                    <div className="h-3 bg-[#EDE9FF] rounded w-full" />
                    <div className="h-3 bg-[#EDE9FF] rounded w-full" />
                  </div>
                </div>
              </div>
              <div className="bg-[#FEF3C7] rounded-xl p-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <path d="M12 9v4M12 17h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
                    stroke="#D97706" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-[12px] text-[#92400E] font-medium">
                  No check-in report found for this property
                </span>
              </div>
            </div>
          ) : stats && (
            <div className="p-4">
              {/* Two column cards */}
              <div className="grid grid-cols-2 gap-2 mb-3">
                {/* Check-in */}
                <div className="bg-[#F8F7F4] rounded-xl p-3">
                  <div className="text-[10px] font-bold text-[#9B9BA8] uppercase tracking-wide mb-2">
                    Check-in
                  </div>
                  {[
                    { label: 'Photos', val: stats.ciPhotos },
                    { label: 'Issues', val: stats.ciIssues },
                    { label: 'Rooms', val: stats.ciRooms },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center mb-1">
                      <span className="text-[12px] text-[#6B7280]">{row.label}</span>
                      <span className="text-[12px] font-bold text-[#1A1A2E]">{row.val}</span>
                    </div>
                  ))}
                </div>

                {/* Check-out */}
                <div className="bg-[#EDE9FF]/30 rounded-xl p-3 border border-[#EDE9FF]">
                  <div className="text-[10px] font-bold text-[#9A88FD] uppercase tracking-wide mb-2">
                    Check-out
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-[#6B7280]">Photos</span>
                    <div className="flex items-center gap-1">
                      <span className="text-[12px] font-bold text-[#1A1A2E]">{stats.coPhotos}</span>
                      <DeltaBadge delta={stats.photoDelta} />
                    </div>
                  </div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[12px] text-[#6B7280]">Issues</span>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[12px] font-bold ${
                          stats.issueDelta > 0 ? 'text-red-600' : 'text-[#1A1A2E]'
                        }`}
                      >
                        {stats.coIssues}
                      </span>
                      <DeltaBadge delta={stats.issueDelta} invert />
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[12px] text-[#6B7280]">Rooms</span>
                    <span className="text-[12px] font-bold text-[#16A34A]">{stats.coRooms}</span>
                  </div>
                </div>
              </div>

              {/* AI delta summary */}
              {inspection.executive_summary && (
                <div className="bg-[#F8F7F4] rounded-xl p-3 flex gap-2">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0 mt-0.5">
                    <path
                      d="M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707M12 21v-1M6.343 17.657l-.707.707M17.657 17.657l.707.707M9.663 17h4.673"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                    />
                  </svg>
                  <p className="text-[12px] text-[#6B7280] leading-relaxed">
                    {inspection.executive_summary}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── ROOM BY ROOM DELTA ── */}
        <div className="bg-white rounded-2xl border border-[#EEECFF] mx-4 mb-3">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#F3F3F8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 9.5L12 3l9 6.5V20H3z"
                stroke="#9A88FD"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M9 20v-6h6v6" stroke="#9A88FD" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] font-bold text-[#1A1A2E]">
              {hasCheckinData ? 'Room Comparison' : 'Rooms'}
            </span>
          </div>

          <div className="p-4">
          {inspection.rooms?.map(room => {
            const ciRoom = hasCheckinData ? findCheckinRoom(checkinData?.rooms, room.name) : null
            const ciPhotos = ciRoom?.photos?.length ?? 0
            const coPhotos = room.photos?.length ?? 0
            const ciIssues = countIssues(ciRoom?.photos ?? [])
            const coIssues = countIssues(room.photos ?? [])
            const verdict = hasCheckinData ? getRoomVerdict(ciIssues, coIssues) : { label: '—', color: '#6B7280', bg: '#F3F3F8' }

            const ciPhoto = ciRoom?.photos?.[0]
            const coPhoto = room.photos?.[0]

            return (
              <div key={room.id} className="flex gap-3 py-3 border-b border-[#F3F3F8] last:border-b-0">
                {/* Verdict dot */}
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                  style={{ background: verdict.color }}
                />

                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[14px] font-bold text-[#1A1A2E]">{room.name}</span>
                    {hasCheckinData && (
                      <span
                        className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                        style={{ background: verdict.bg, color: verdict.color }}
                      >
                        {verdict.label}
                      </span>
                    )}
                  </div>

                  {/* Stats chips */}
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-[#F3F3F8] rounded-lg px-2 py-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#6B7280" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="3" stroke="#6B7280" strokeWidth="1.8" />
                      </svg>
                      <span className="text-[11px] text-[#6B7280] font-medium">
                        {hasCheckinData ? `${ciPhotos} → ${coPhotos} photos` : `${coPhotos} photos`}
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 ${
                        hasCheckinData
                          ? coIssues > ciIssues
                            ? 'bg-[#FEE2E2]'
                            : coIssues < ciIssues
                              ? 'bg-[#DCFCE7]'
                              : 'bg-[#F3F3F8]'
                          : coIssues > 0
                            ? 'bg-[#FEE2E2]'
                            : 'bg-[#DCFCE7]'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium ${
                          hasCheckinData
                            ? coIssues > ciIssues
                              ? 'text-[#DC2626]'
                              : coIssues < ciIssues
                                ? 'text-[#16A34A]'
                                : 'text-[#6B7280]'
                            : coIssues > 0
                              ? 'text-[#DC2626]'
                              : 'text-[#16A34A]'
                        }`}
                      >
                        {hasCheckinData
                          ? `${coIssues > ciIssues ? '⚠' : coIssues < ciIssues ? '✓' : '='} Issues: ${ciIssues} → ${coIssues}`
                          : `${coIssues > 0 ? '⚠' : '✓'} ${coIssues} issues`}
                      </span>
                    </div>
                  </div>

                  {/* Photo side-by-side (only show comparison if checkin data exists) */}
                  {hasCheckinData && (ciPhoto || coPhoto) && (
                    <div className="flex items-center gap-2">
                      <div className="text-[9px] text-[#9B9BA8] w-8">Entry</div>
                      {ciPhoto ? (
                        <Image
                          src={ciPhoto.url}
                          alt="check-in"
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-lg object-cover border-2 border-gray-300 opacity-70"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                          <span className="text-[8px] text-gray-400">N/A</span>
                        </div>
                      )}
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12h14M13 6l6 6-6 6"
                          stroke="#C4C4C4"
                          strokeWidth="1.8"
                          strokeLinecap="round"
                        />
                      </svg>
                      {coPhoto ? (
                        <Image
                          src={coPhoto.url}
                          alt="check-out"
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded-lg object-cover border-2 border-[#9A88FD]"
                        />
                      ) : (
                        <div className="w-11 h-11 rounded-lg bg-[#EDE9FF] border-2 border-dashed border-[#9A88FD] flex items-center justify-center">
                          <span className="text-[8px] text-[#9A88FD]">N/A</span>
                        </div>
                      )}
                      <span className="text-[9px] font-medium ml-1" style={{ color: verdict.color }}>
                        {verdict.label === 'Better'
                          ? 'Improved'
                          : verdict.label === 'Worse'
                            ? 'New damage'
                            : 'No change'}
                      </span>
                    </div>
                  )}

                  {/* Show just checkout photo if no checkin data */}
                  {!hasCheckinData && coPhoto && (
                    <div className="flex items-center gap-2">
                      <Image
                        src={coPhoto.url}
                        alt="check-out"
                        width={44}
                        height={44}
                        className="w-11 h-11 rounded-lg object-cover border-2 border-[#9A88FD]"
                      />
                      <span className="text-[9px] text-[#9B9BA8]">Check-out photo</span>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          </div>
        </div>

        {/* ── HANDOVER KEYS — 2x2 grid with given/returned comparison ── */}
        {(() => {
          const checkinKeys = (checkinData?.key_handover as Array<{ item: string; qty: number }>) ?? []
          const checkoutKeys = (inspection.key_handover as Array<{ item: string; qty: number }>) ?? []

          if (checkinKeys.length === 0 && checkoutKeys.length === 0) return null

          // Build comparison: for each check-in key, find returned qty
          const keyItems = checkinKeys.map((ck) => {
            const returned = checkoutKeys.find(
              (k) => k.item?.toLowerCase() === ck.item?.toLowerCase()
            )?.qty ?? 0
            return {
              item: ck.item,
              given: ck.qty,
              returned,
              ok: returned >= ck.qty,
              missing: Math.max(0, ck.qty - returned),
            }
          })

          const allOk = keyItems.every(k => k.ok)

          return (
            <div className="bg-white rounded-2xl border border-[#EEECFF] mx-4 mb-3">

              {/* Section header — same as check-in */}
              <div className="flex items-center gap-2 px-4 py-4 border-b border-[#F3F3F8]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <circle cx="7.5" cy="15.5" r="4.5"
                    stroke="#9A88FD" strokeWidth="1.8"/>
                  <path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
                    stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-[15px] font-bold text-[#1A1A2E]">
                  Handover Keys
                </span>
              </div>

              {/* SAME 2x2 grid as check-in */}
              <div className="p-4 grid grid-cols-2 gap-2">
                {keyItems.map((k, i) => (
                  <div
                    key={i}
                    className={`rounded-2xl p-3 flex items-center justify-between ${
                      k.ok ? 'bg-[#F8F7F4]' : 'bg-[#FEF2F2]'
                    }`}
                  >
                    <span className={`text-[13px] font-medium ${
                      k.ok ? 'text-[#6B7280]' : 'text-[#DC2626]'
                    }`}>
                      {k.item}
                    </span>

                    {/* Given / Returned — same style as check-in qty badge */}
                    <div className="flex items-center gap-1.5">
                      {/* Gray "given" number */}
                      <span className="text-[13px] font-bold text-[#C4C4C4]">
                        ×{k.given}
                      </span>
                      <span className="text-[10px] text-[#C4C4C4]">→</span>
                      {/* Returned number — green if ok, red if missing */}
                      <span className={`text-[15px] font-extrabold ${
                        k.ok ? 'text-[#1A1A2E]' : 'text-[#DC2626]'
                      }`}>
                        ×{k.returned}
                      </span>
                      {/* Status dot */}
                      <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        k.ok ? 'bg-[#16A34A]' : 'bg-[#EF4444]'
                      }`} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Summary line — only if missing */}
              {!allOk && (
                <div className="mx-4 mb-4 bg-[#FEF2F2] rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10"
                      stroke="#EF4444" strokeWidth="1.8"/>
                    <path d="M12 8v4M12 16h.01"
                      stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[12px] font-semibold text-[#DC2626]">
                    {keyItems.filter(k => !k.ok).map(k =>
                      `${k.item} ×${k.missing} missing`
                    ).join(' · ')}
                  </span>
                </div>
              )}

              {/* All good line */}
              {allOk && (
                <div className="mx-4 mb-4 bg-[#DCFCE7] rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                    <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      stroke="#16A34A" strokeWidth="1.8" strokeLinecap="round"/>
                  </svg>
                  <span className="text-[12px] font-semibold text-[#16A34A]">
                    All keys returned ✓
                  </span>
                </div>
              )}

            </div>
          )
        })()}

        {/* ── SIGNATURES — matching check-in style ── */}
        <div className="bg-white rounded-2xl border border-[#EEECFF] mx-4 mb-3">
          <div className="flex items-center gap-2 px-4 pt-4 pb-3 border-b border-[#F3F3F8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                stroke="#9A88FD"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="text-[14px] font-bold text-[#1A1A2E]">Signatures</span>
          </div>

          <div className="divide-y divide-[#F3F3F8]">
            {[
              {
                label: 'Landlord',
                name: tenancy?.landlord_name,
                sig: signatures?.find((s) => s.signer_type === 'landlord'),
              },
              {
                label: 'Tenant',
                name: tenancy?.tenant_name,
                sig: signatures?.find((s) => s.signer_type === 'tenant'),
              },
            ].map(({ label, name, sig }) => {
              const isSigned = !!sig?.signed_at
              const initials = name?.split(' ').map((n: string) => n[0])
                .slice(0, 2).join('') || label.slice(0,2).toUpperCase()

              return (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                  {/* Avatar */}
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                    isSigned ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#EDE9FF] text-[#9A88FD]'
                  }`}>
                    {isSigned ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path
                          d="M20 6L9 17l-5-5"
                          stroke="#16A34A"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    ) : initials}
                  </div>

                  {/* Name + date/pending */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
                      {name || label}
                    </div>
                    <div className="text-[11px] text-[#9B9BA8] mt-0.5">
                      {isSigned && sig?.signed_at
                        ? `Signed on ${new Date(sig.signed_at).toLocaleDateString('en-AE', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}`
                        : 'Pending signature'
                      }
                    </div>
                  </div>

                  {/* Badge */}
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                    isSigned
                      ? 'bg-[#DCFCE7] text-[#16A34A]'
                      : 'bg-[#F3F3F8] text-[#9B9BA8]'
                  }`}>
                    {isSigned ? 'Signed' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
