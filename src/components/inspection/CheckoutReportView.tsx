'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import {
  findCheckinRoom,
  countIssues,
  getRoomVerdict,
  getComparisonStats,
  type RoomData,
  type RoomPhoto,
  type KeyItem,
} from '@/lib/inspectionCompare'
import DeleteInspectionButton from '@/components/inspection/DeleteInspectionButton'

interface Props {
  inspection: {
    id: string
    type?: string | null
    status?: string | null
    signed_at?: string | null
    created_at?: string | null
    executive_summary?: string | null
    document_hash?: string | null
    key_handover?: KeyItem[] | null
    property_id?: string | null
    property?: {
      location?: string | null
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
    refused_at?: string | null
    refused_reason?: string | null
  }>
  inventorySnapshots?: Array<{
    id: string
    name: string
    category: string
    quantity: number
    condition?: string | null
    checkin_condition?: string | null
    photo_url?: string | null
    notes?: string | null
    inspection_type?: string | null
    is_tenant_item?: boolean | null
  }>
}

export function CheckoutReportView({
  inspection,
  checkinData,
  tenancy,
  signatures,
  inventorySnapshots = [],
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
  const isDisputed = inspection.status === 'disputed'
  const isExpired = inspection.status === 'expired'
  const isClosed = isSigned || isDisputed || isExpired
  const property = inspection.property

  return (
    <div
      className="min-h-screen bg-[#F8F7F4]"
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
          {property?.building_name || property?.location || 'Property'}
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
              : isDisputed || isExpired
                ? 'bg-white/10 border border-white/20'
                : 'bg-[#FEF9C3] border border-[#D97706]/20'
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              isSigned ? 'bg-green-400' : isDisputed || isExpired ? 'bg-white/50' : 'bg-[#D97706]'
            }`}
          />
          <span
            className={`text-[12px] font-bold ${
              isSigned
                ? 'text-green-300'
                : isDisputed
                  ? 'text-white/70'
                  : isExpired
                    ? 'text-white/50'
                    : 'text-[#B45309]'
            }`}
          >
            {isSigned
              ? '✓ Fully Signed'
              : isDisputed
                ? '⚠ Disputed'
                : isExpired
                  ? '🔒 Expired'
                  : 'Awaiting Signatures'}
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
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '40px 0',
              }}
            >
              <svg
                style={{ animation: 'spin 0.7s linear infinite' }}
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#9A88FD"
                strokeWidth="2.5"
                strokeLinecap="round"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
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
          {inspection.rooms?.map((room: RoomData) => {
            const ciRoom = hasCheckinData ? findCheckinRoom(checkinData?.rooms, room.name) : null
            const ciPhotos = ciRoom?.photos ?? []
            const coPhotos = room.photos ?? []
            const ciIssuesCount = countIssues(ciPhotos)
            const coIssuesCount = countIssues(coPhotos)
            const verdict = hasCheckinData ? getRoomVerdict(ciIssuesCount, coIssuesCount) : { label: '—', color: '#6B7280', bg: '#F3F3F8' }

            // Build ALL photo pairs for this room
            const matchedPairs: Array<{
              ciPhoto: RoomPhoto | null
              coPhoto: RoomPhoto | null
              isNew: boolean
            }> = []

            // First pass: matched photos (have checkin_photo_id) + new photos
            for (const coPhoto of coPhotos) {
              if (coPhoto.checkin_photo_id) {
                const ciPhoto = ciPhotos.find(
                  (p) => p.id === coPhoto.checkin_photo_id
                ) ?? null
                matchedPairs.push({ ciPhoto, coPhoto, isNew: false })
              } else {
                matchedPairs.push({ ciPhoto: null, coPhoto, isNew: true })
              }
            }

            // Second pass: check-in photos NOT referenced by any checkout photo
            const referencedCiIds = new Set(
              coPhotos
                .filter((p) => p.checkin_photo_id)
                .map((p) => p.checkin_photo_id as string)
            )
            const unreferencedCiPhotos = ciPhotos.filter(
              (p) => !referencedCiIds.has(p.id)
            )
            for (const ciPhoto of unreferencedCiPhotos) {
              matchedPairs.push({ ciPhoto, coPhoto: null, isNew: false })
            }

            return (
              <div key={room.id} className="py-3 border-b border-[#F3F3F8] last:border-b-0">

                {/* Room header row */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ background: verdict.color }} />
                    <span className="text-[14px] font-bold text-[#1A1A2E]">
                      {room.name}
                    </span>
                  </div>
                  {hasCheckinData && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: verdict.bg, color: verdict.color }}>
                      {verdict.label}
                    </span>
                  )}
                </div>

                {/* Stats chips */}
                <div className="flex gap-2 mb-3">
                  <div className="flex items-center gap-1 bg-[#F3F3F8] rounded-lg px-2 py-1">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                      <rect x="3" y="3" width="18" height="18" rx="2"
                        stroke="#6B7280" strokeWidth="1.8"/>
                      <circle cx="12" cy="12" r="3"
                        stroke="#6B7280" strokeWidth="1.8"/>
                    </svg>
                    <span className="text-[11px] text-[#6B7280] font-medium">
                      {hasCheckinData ? `${ciPhotos.length} → ${coPhotos.length} photos` : `${coPhotos.length} photos`}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1 rounded-lg px-2 py-1 ${
                    hasCheckinData
                      ? coIssuesCount > ciIssuesCount ? 'bg-[#FEE2E2]'
                        : coIssuesCount < ciIssuesCount ? 'bg-[#DCFCE7]'
                        : 'bg-[#F3F3F8]'
                      : coIssuesCount > 0 ? 'bg-[#FEE2E2]' : 'bg-[#DCFCE7]'
                  }`}>
                    <span className={`text-[11px] font-medium ${
                      hasCheckinData
                        ? coIssuesCount > ciIssuesCount ? 'text-[#DC2626]'
                          : coIssuesCount < ciIssuesCount ? 'text-[#16A34A]'
                          : 'text-[#6B7280]'
                        : coIssuesCount > 0 ? 'text-[#DC2626]' : 'text-[#16A34A]'
                    }`}>
                      {hasCheckinData
                        ? `${coIssuesCount > ciIssuesCount ? '⚠' : coIssuesCount < ciIssuesCount ? '✓' : '='} Issues: ${ciIssuesCount} → ${coIssuesCount}`
                        : `${coIssuesCount > 0 ? '⚠' : '✓'} ${coIssuesCount} issues`}
                    </span>
                  </div>
                </div>

                {/* ALL photo pairs */}
                {hasCheckinData && matchedPairs.length > 0 && (
                  <div className="space-y-2">
                    {matchedPairs.map((pair, pairIdx) => (
                      <div key={pairIdx}
                        className={`rounded-xl overflow-hidden ${
                          pair.isNew ? 'border border-[#D97706]/30' : ''
                        }`}>

                        {pair.isNew && pair.coPhoto ? (
                          /* ── NEW DAMAGE: single photo + amber badge ── */
                          <div>
                            <div className="flex items-center gap-1.5 bg-[#FEF3C7] px-2.5 py-1.5 rounded-t-xl">
                              <div className="w-1.5 h-1.5 rounded-full bg-[#D97706]" />
                              <span className="text-[10px] font-bold text-[#D97706] uppercase tracking-wide">
                                New — not present at check-in
                              </span>
                            </div>
                            <div className="flex items-center gap-2 px-2 py-2 bg-[#FFFBEB]">
                              <div className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#D97706]/40 flex-shrink-0">
                                <Image
                                  src={pair.coPhoto.url}
                                  alt="new damage"
                                  width={56}
                                  height={56}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                              <div>
                                {pair.coPhoto.damage_tags && pair.coPhoto.damage_tags.length > 0 && (
                                  <div className="flex flex-wrap gap-1">
                                    {pair.coPhoto.damage_tags.slice(0, 3).map((tag: string, ti: number) => (
                                      <span key={ti}
                                        className="text-[9px] font-bold uppercase bg-[#FEE2E2] text-[#DC2626] px-1.5 py-0.5 rounded-full">
                                        {tag}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ) : (
                          /* ── MATCHED PAIR: check-in LEFT / check-out RIGHT ── */
                          <div className="flex items-start gap-2">

                            {/* Check-in photo */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-[9px] text-[#9B9BA8] font-medium self-start">
                                Check-in
                              </span>
                              {pair.ciPhoto ? (
                                <div className="w-full aspect-square rounded-lg overflow-hidden border border-gray-200 opacity-70">
                                  <Image
                                    src={pair.ciPhoto.url}
                                    alt="check-in"
                                    width={112}
                                    height={112}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-full aspect-square rounded-lg bg-[#F3F3F8] border border-dashed border-gray-300 flex items-center justify-center">
                                  <span className="text-[9px] text-gray-400">
                                    No photo
                                  </span>
                                </div>
                              )}
                              {pair.ciPhoto?.damage_tags && pair.ciPhoto.damage_tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 self-start">
                                  {pair.ciPhoto.damage_tags.slice(0, 2).map((tag: string, ti: number) => (
                                    <span key={ti}
                                      className="text-[8px] font-bold uppercase bg-gray-100 text-gray-500 px-1 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                            {/* Arrow */}
                            <div className="flex items-center pt-6 flex-shrink-0">
                              <svg width="12" height="12" viewBox="0 0 24 24" fill="none">
                                <path d="M5 12h14M13 6l6 6-6 6"
                                  stroke="#C4C4C4" strokeWidth="1.8"
                                  strokeLinecap="round"/>
                              </svg>
                            </div>

                            {/* Check-out photo */}
                            <div className="flex flex-col items-center gap-1 flex-1">
                              <span className="text-[9px] text-[#9A88FD] font-medium self-start">
                                Check-out
                              </span>
                              {pair.coPhoto ? (
                                <div className="w-full aspect-square rounded-lg overflow-hidden border-2 border-[#9A88FD]/40">
                                  <Image
                                    src={pair.coPhoto.url}
                                    alt="check-out"
                                    width={112}
                                    height={112}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              ) : (
                                <div className="w-full aspect-square rounded-lg bg-[#EDE9FF]/30 border border-dashed border-[#9A88FD]/30 flex items-center justify-center">
                                  <span className="text-[9px] text-[#9A88FD]">
                                    Not taken
                                  </span>
                                </div>
                              )}
                              {pair.coPhoto?.damage_tags && pair.coPhoto.damage_tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 self-start">
                                  {pair.coPhoto.damage_tags.slice(0, 2).map((tag: string, ti: number) => (
                                    <span key={ti}
                                      className="text-[8px] font-bold uppercase bg-[#FEE2E2] text-[#DC2626] px-1 py-0.5 rounded">
                                      {tag}
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>

                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Show checkout photos only if no checkin data */}
                {!hasCheckinData && coPhotos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {coPhotos.slice(0, 4).map((photo, i) => (
                      <div key={i} className="w-14 h-14 rounded-lg overflow-hidden border-2 border-[#9A88FD]/40 flex-shrink-0">
                        <Image
                          src={photo.url}
                          alt="check-out"
                          width={56}
                          height={56}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ))}
                    {coPhotos.length > 4 && (
                      <div className="w-14 h-14 rounded-lg bg-[#EDE9FF] flex items-center justify-center flex-shrink-0">
                        <span className="text-[11px] font-bold text-[#9A88FD]">+{coPhotos.length - 4}</span>
                      </div>
                    )}
                  </div>
                )}

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

        {/* ── INVENTORY COMPARISON ── */}
        {inventorySnapshots && inventorySnapshots.filter(s => !s.is_tenant_item).length > 0 && (() => {
          const items = inventorySnapshots.filter(s => !s.is_tenant_item)
          const goodCount = items.filter(i => i.condition === 'good').length
          const fairCount = items.filter(i => i.condition === 'fair').length
          const poorCount = items.filter(i => i.condition === 'poor').length
          const missingCount = items.filter(i => i.condition === 'missing').length

          return (
            <div className="bg-white rounded-2xl border border-[#EEECFF] mx-4 mb-3">

              {/* Header */}
              <div className="flex items-center gap-2 px-4 py-4 border-b border-[#F3F3F8]">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                  <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"
                    stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round"/>
                  <rect x="9" y="3" width="6" height="4" rx="1"
                    stroke="#9A88FD" strokeWidth="1.8"/>
                  <path d="M9 12h6M9 16h4"
                    stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                <span className="text-[15px] font-bold text-[#1A1A2E]">
                  Inventory
                </span>
                <span className="ml-auto text-[12px] font-semibold text-[#9A88FD] bg-[#EDE9FF] px-2.5 py-0.5 rounded-full">
                  {items.length} items
                </span>
              </div>

              {/* Summary pills */}
              <div className="flex gap-2 px-4 pt-3 pb-2">
                <div className="flex-1 bg-[#EEFAD5] rounded-xl p-2.5 text-center">
                  <p className="text-[18px] font-extrabold text-[#3A7A00]">{goodCount}</p>
                  <p className="text-[10px] font-semibold text-[#3A7A00]">Good</p>
                </div>
                <div className="flex-1 bg-[#FFF8DC] rounded-xl p-2.5 text-center">
                  <p className="text-[18px] font-extrabold text-[#8A6000]">{fairCount}</p>
                  <p className="text-[10px] font-semibold text-[#8A6000]">Fair</p>
                </div>
                <div className="flex-1 bg-[#FEE2E2] rounded-xl p-2.5 text-center">
                  <p className="text-[18px] font-extrabold text-[#7A0000]">{poorCount}</p>
                  <p className="text-[10px] font-semibold text-[#7A0000]">Poor</p>
                </div>
                <div className="flex-1 bg-[#F3F1EB] rounded-xl p-2.5 text-center">
                  <p className="text-[18px] font-extrabold text-[#374151]">{missingCount}</p>
                  <p className="text-[10px] font-semibold text-[#374151]">Missing</p>
                </div>
              </div>

              {/* Item rows */}
              <div className="px-4 pb-4 flex flex-col gap-2 mt-1">
                {items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background:
                        item.condition === 'missing' ? '#FEF2F2' :
                        item.condition === 'poor' ? '#FFFBEB' :
                        item.condition === 'fair' ? '#FFFBF0' : '#F8F7F4',
                    }}
                  >
                    {/* Photo — checkout first, fallback to checkin */}
                    {item.photo_url ? (
                      <img
                        src={item.photo_url}
                        alt={item.name}
                        className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-11 h-11 rounded-lg bg-[#EEEDE9] flex-shrink-0 flex items-center justify-center">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ccc" strokeWidth="2" strokeLinecap="round">
                          <rect x="3" y="3" width="18" height="18" rx="2"/>
                          <circle cx="8.5" cy="8.5" r="1.5"/>
                          <polyline points="21 15 16 10 5 21"/>
                        </svg>
                      </div>
                    )}

                    {/* Name + notes */}
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-semibold text-[#1A1A1A] truncate">
                        {item.name}
                        {(item.quantity ?? 1) > 1 && (
                          <span className="text-[11px] text-[#999] ml-1.5">×{item.quantity}</span>
                        )}
                      </p>
                      {/* Check-in condition */}
                      {item.checkin_condition && (
                        <p className="text-[11px] text-[#9ca3af]">
                          Check-in: {item.checkin_condition}
                        </p>
                      )}
                      {item.notes && (
                        <p className="text-[11px] text-[#888] truncate">{item.notes}</p>
                      )}
                    </div>

                    {/* Status badge */}
                    <div
                      className="flex-shrink-0 px-2.5 py-1 rounded-full"
                      style={{
                        background:
                          item.condition === 'good'    ? '#EEFAD5' :
                          item.condition === 'fair'    ? '#FFF8DC' :
                          item.condition === 'poor'    ? '#FEE2E2' :
                          item.condition === 'missing' ? '#F3F1EB' : '#F3F1EB',
                      }}
                    >
                      <span
                        className="text-[11px] font-bold"
                        style={{
                          color:
                            item.condition === 'good'    ? '#3A7A00' :
                            item.condition === 'fair'    ? '#8A6000' :
                            item.condition === 'poor'    ? '#7A0000' :
                            item.condition === 'missing' ? '#374151' : '#9ca3af',
                        }}
                      >
                        {item.condition === 'good'    ? 'Good' :
                         item.condition === 'fair'    ? 'Fair' :
                         item.condition === 'poor'    ? 'Poor' :
                         item.condition === 'missing' ? '✗ Missing' : '—'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>

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
              const isRefused = !!sig?.refused_at
              const refusedReason = sig?.refused_reason
              const refusedAt = sig?.refused_at
              const initials = name?.split(' ').map((n: string) => n[0])
                .slice(0, 2).join('') || label.slice(0,2).toUpperCase()

              return (
                <div key={label} className="flex items-center gap-3 px-4 py-3.5">
                  {/* Avatar */}
                  <div
                    className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                      isSigned
                        ? 'bg-[#DCFCE7] text-[#16A34A]'
                        : isRefused
                          ? 'bg-[#FEF2F2] text-[#EF4444]'
                          : 'bg-[#EDE9FF] text-[#9A88FD]'
                    }`}
                  >
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
                    ) : isRefused ? (
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="2" />
                        <path
                          d="M15 9l-6 6M9 9l6 6"
                          stroke="#EF4444"
                          strokeWidth="2"
                          strokeLinecap="round"
                        />
                      </svg>
                    ) : (
                      initials
                    )}
                  </div>

                  {/* Name + date/pending */}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
                      {name || label}
                    </div>
                    <div
                      className={`text-[11px] mt-0.5 ${isRefused ? 'text-[#EF4444]' : 'text-[#9B9BA8]'}`}
                    >
                      {isSigned && sig?.signed_at
                        ? `Signed on ${new Date(sig.signed_at).toLocaleDateString('en-AE', {
                            day: 'numeric', month: 'long', year: 'numeric'
                          })}`
                        : isRefused
                          ? `Refused to sign${refusedReason ? ` — "${refusedReason}"` : ''}${
                              refusedAt
                                ? ` · ${new Date(refusedAt).toLocaleDateString('en-AE', {
                                    day: 'numeric',
                                    month: 'short',
                                    year: 'numeric',
                                  })}`
                                : ''
                            }`
                          : 'Pending signature'}
                    </div>
                  </div>

                  {/* Badge */}
                  <span
                    className={`text-[10px] font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${
                      isSigned
                        ? 'bg-[#DCFCE7] text-[#16A34A]'
                        : isRefused
                          ? 'bg-[#FEF2F2] text-[#EF4444]'
                          : 'bg-[#F3F3F8] text-[#9B9BA8]'
                    }`}
                  >
                    {isSigned ? 'Signed' : isRefused ? 'Refused' : 'Pending'}
                  </span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── SHA-256 HASH — identical to check-in ── */}
        {inspection.document_hash && (
          <div className="mx-4 mb-3 text-center">
            <p className="text-[11px] text-[#CCC] font-mono">
              SHA-256: {inspection.document_hash.slice(0, 16)}...{inspection.document_hash.slice(-8)}
            </p>
          </div>
        )}

        {/* ── DELETE INSPECTION — identical to check-in ── */}
        <div className="mx-4 mb-3">
          <DeleteInspectionButton
            inspectionId={inspection.id}
            inspectionType={(inspection.type ?? 'check-out') as 'check-in' | 'check-out'}
            status={inspection.status ?? null}
            signatures={
              (signatures ?? []) as {
                signer_type: string
                otp_verified: boolean
                signed_at?: string | null
              }[]
            }
            redirectTo={
              inspection.property_id
                ? `/property/${inspection.property_id}`
                : '/dashboard'
            }
            variant="button"
          />
        </div>
      </div>
    </div>
  )
}
