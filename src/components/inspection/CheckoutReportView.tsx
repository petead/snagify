'use client'

import { useMemo } from 'react'
import Image from 'next/image'
import {
  findCheckinRoom,
  countIssues,
  getRoomVerdict,
  getKeyDelta,
  getComparisonStats,
  type RoomData,
  type KeyItem,
} from '@/lib/inspectionCompare'
import { formatPropertyAddress } from '@/lib/formatPropertyAddress'

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
  const stats = useMemo(
    () => getComparisonStats(checkinData, inspection),
    [checkinData, inspection]
  )

  const keyDelta = useMemo(
    () => getKeyDelta(
      (checkinData?.key_handover as KeyItem[]) ?? [],
      (inspection?.key_handover as KeyItem[]) ?? []
    ),
    [checkinData, inspection]
  )

  const missingKeys = keyDelta.filter(k => !k.ok)

  const landlordSig = signatures?.find(s => s.signer_type === 'landlord')
  const tenantSig = signatures?.find(s => s.signer_type === 'tenant')

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

  function getKeyIcon(name: string) {
    const n = name.toLowerCase()
    if (n.includes('door') || n.includes('key')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <circle cx="7.5" cy="15.5" r="4.5" stroke="#9A88FD" strokeWidth="1.8" />
          <path
            d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
            stroke="#9A88FD"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    }
    if (n.includes('parking') || n.includes('car')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <rect x="1" y="4" width="22" height="16" rx="2" stroke="#9A88FD" strokeWidth="1.8" />
          <path d="M1 10h22" stroke="#9A88FD" strokeWidth="1.8" />
        </svg>
      )
    }
    if (n.includes('mail')) {
      return (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
          <path
            d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
            stroke="#9A88FD"
            strokeWidth="1.8"
          />
          <path d="M22 6l-10 7L2 6" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      )
    }
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
        <rect x="3" y="11" width="18" height="11" rx="2" stroke="#9A88FD" strokeWidth="1.8" />
        <path d="M7 11V7a5 5 0 0110 0v4" stroke="#9A88FD" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    )
  }

  const isSigned = inspection.signed_at || inspection.status === 'signed'

  return (
    <div className="pb-32">
      {/* ── HERO — dark, distinct from check-in ── */}
      <div className="bg-[#1A1A2E] px-5 pt-5 pb-7 relative overflow-hidden">
        {/* Deco circles */}
        <div className="absolute -right-5 -top-5 w-24 h-24 rounded-full border-[20px] border-white/5" />
        <div className="absolute right-10 -bottom-6 w-14 h-14 rounded-full border-[12px] border-white/[0.04]" />

        {/* Badge */}
        <div className="inline-flex items-center gap-1.5 bg-white/[0.08] border border-white/10 rounded-full px-3 py-1.5 mb-3">
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
            <path
              d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"
              stroke="rgba(255,255,255,0.6)"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
          <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">
            Check-out Report
          </span>
        </div>

        <h1
          className="text-[24px] font-extrabold text-white mb-1"
          style={{ fontFamily: 'Poppins, sans-serif' }}
        >
          {inspection.property?.building_name || inspection.property?.address || 'Property'}
        </h1>
        <p className="text-[14px] text-white/50 mb-4">
          {inspection.property?.unit_number ? `Unit ${inspection.property.unit_number} · ` : ''}
          {formatDate(inspection.created_at)}
        </p>

        {/* Status badge */}
        <div
          className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 ${
            isSigned ? 'bg-green-50' : 'bg-[#FEF9C3]'
          }`}
        >
          <div className={`w-1.5 h-1.5 rounded-full ${isSigned ? 'bg-green-600' : 'bg-amber-500'}`} />
          <span className={`text-[12px] font-bold ${isSigned ? 'text-green-700' : 'text-amber-700'}`}>
            {isSigned ? '✓ Fully Signed' : 'Awaiting Signatures'}
          </span>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-3">
        {/* ── COMPARISON SUMMARY ── */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEECFF]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F3F3F8]">
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

        {/* ── ROOM BY ROOM DELTA ── */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEECFF]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F3F3F8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 9.5L12 3l9 6.5V20H3z"
                stroke="#9A88FD"
                strokeWidth="1.8"
                strokeLinejoin="round"
              />
              <path d="M9 20v-6h6v6" stroke="#9A88FD" strokeWidth="1.8" strokeLinejoin="round" />
            </svg>
            <span className="text-[14px] font-bold text-[#1A1A2E]">Room Comparison</span>
          </div>

          {inspection.rooms?.map(room => {
            const ciRoom = findCheckinRoom(checkinData?.rooms, room.name)
            const ciPhotos = ciRoom?.photos?.length ?? 0
            const coPhotos = room.photos?.length ?? 0
            const ciIssues = countIssues(ciRoom?.photos ?? [])
            const coIssues = countIssues(room.photos ?? [])
            const verdict = getRoomVerdict(ciIssues, coIssues)

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
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: verdict.bg, color: verdict.color }}
                    >
                      {verdict.label}
                    </span>
                  </div>

                  {/* Stats chips */}
                  <div className="flex gap-2 mb-2 flex-wrap">
                    <div className="flex items-center gap-1 bg-[#F3F3F8] rounded-lg px-2 py-1">
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none">
                        <rect x="3" y="3" width="18" height="18" rx="2" stroke="#6B7280" strokeWidth="1.8" />
                        <circle cx="12" cy="12" r="3" stroke="#6B7280" strokeWidth="1.8" />
                      </svg>
                      <span className="text-[11px] text-[#6B7280] font-medium">
                        {ciPhotos} → {coPhotos} photos
                      </span>
                    </div>
                    <div
                      className={`flex items-center gap-1 rounded-lg px-2 py-1 ${
                        coIssues > ciIssues
                          ? 'bg-[#FEE2E2]'
                          : coIssues < ciIssues
                            ? 'bg-[#DCFCE7]'
                            : 'bg-[#F3F3F8]'
                      }`}
                    >
                      <span
                        className={`text-[11px] font-medium ${
                          coIssues > ciIssues
                            ? 'text-[#DC2626]'
                            : coIssues < ciIssues
                              ? 'text-[#16A34A]'
                              : 'text-[#6B7280]'
                        }`}
                      >
                        {coIssues > ciIssues ? '⚠' : coIssues < ciIssues ? '✓' : '='} Issues: {ciIssues}{' '}
                        → {coIssues}
                      </span>
                    </div>
                  </div>

                  {/* Photo side-by-side */}
                  {(ciPhoto || coPhoto) && (
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
                </div>
              </div>
            )
          })}
        </div>

        {/* ── KEY RETURN COMPARISON ── */}
        {keyDelta.length > 0 && (
          <div className="bg-white rounded-2xl p-4 border border-[#EEECFF]">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F3F3F8]">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="7.5" cy="15.5" r="4.5" stroke="#9A88FD" strokeWidth="1.8" />
                <path
                  d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
                  stroke="#9A88FD"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                />
              </svg>
              <span className="text-[14px] font-bold text-[#1A1A2E]">Key Return</span>
            </div>

            {keyDelta.map((k, i) => (
              <div key={i} className="flex items-center gap-3 py-2.5 border-b border-[#F3F3F8] last:border-b-0">
                <div className="w-8 h-8 bg-[#EDE9FF] rounded-xl flex items-center justify-center flex-shrink-0">
                  {getKeyIcon(k.item)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">{k.item}</div>
                  <div className="text-[11px] text-[#9B9BA8]">
                    Given ×{k.given} → Returned ×{k.returned}
                  </div>
                </div>
                <span className={`text-[13px] font-bold ${k.ok ? 'text-[#16A34A]' : 'text-[#EF4444]'}`}>
                  ×{k.returned}
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-1 rounded-full flex-shrink-0 ${
                    k.ok ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#FEE2E2] text-[#EF4444]'
                  }`}
                >
                  {k.ok ? '✓ Returned' : `Missing ×${k.missing}`}
                </span>
              </div>
            ))}

            {/* Missing keys alert */}
            {missingKeys.length > 0 && (
              <div className="bg-[#FEF2F2] rounded-xl p-3 mt-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="flex-shrink-0">
                  <circle cx="12" cy="12" r="10" stroke="#EF4444" strokeWidth="1.8" />
                  <path d="M12 8v4M12 16h.01" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
                <span className="text-[12px] text-[#DC2626] font-semibold">
                  {missingKeys.length} item{missingKeys.length > 1 ? 's' : ''} missing:{' '}
                  {missingKeys.map(k => `${k.item} ×${k.missing}`).join(', ')}
                </span>
              </div>
            )}

            {/* All returned success */}
            {missingKeys.length === 0 && keyDelta.length > 0 && (
              <div className="bg-[#DCFCE7] rounded-xl p-3 mt-3 flex items-center gap-2">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    stroke="#16A34A"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[12px] text-[#16A34A] font-semibold">All keys returned ✓</span>
              </div>
            )}
          </div>
        )}

        {/* ── SIGNATURES ── */}
        <div className="bg-white rounded-2xl p-4 border border-[#EEECFF]">
          <div className="flex items-center gap-2 mb-4 pb-3 border-b border-[#F3F3F8]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
              <path
                d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                stroke="#9A88FD"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
            </svg>
            <span className="text-[14px] font-bold text-[#1A1A2E]">Signatures</span>
          </div>

          {[
            { sig: landlordSig, name: tenancy?.landlord_name, role: 'Landlord' },
            { sig: tenantSig, name: tenancy?.tenant_name, role: 'Tenant' },
          ].map(({ sig, name, role }) => (
            <div key={role} className="flex items-center gap-3 py-2.5 border-b border-[#F3F3F8] last:border-b-0">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-[12px] font-bold flex-shrink-0 ${
                  sig?.signed_at ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#EDE9FF] text-[#9A88FD]'
                }`}
              >
                {sig?.signed_at
                  ? '✓'
                  : name
                      ?.split(' ')
                      .map((n: string) => n[0])
                      .slice(0, 2)
                      .join('') || role[0]}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[13px] font-semibold text-[#1A1A2E] truncate">
                  {name || role}
                </div>
                <div className="text-[11px] text-[#9B9BA8]">
                  {sig?.signed_at ? `Signed on ${formatDate(sig.signed_at)}` : 'Pending signature'}
                </div>
              </div>
              <span
                className={`text-[10px] font-bold px-2.5 py-1 rounded-full ${
                  sig?.signed_at ? 'bg-[#DCFCE7] text-[#16A34A]' : 'bg-[#F3F3F8] text-[#9B9BA8]'
                }`}
              >
                {sig?.signed_at ? 'Signed' : 'Pending'}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
