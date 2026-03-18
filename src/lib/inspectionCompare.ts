/**
 * Comparison helpers for check-out vs check-in inspections
 */

export type RoomPhoto = {
  id: string
  url: string
  damage_tags?: string[] | null
  width?: number | null
  height?: number | null
}

export type RoomData = {
  id: string
  name: string
  condition?: string | null
  photos?: RoomPhoto[]
}

export type KeyItem = {
  item: string
  qty: number
}

export type KeyDelta = {
  item: string
  given: number
  returned: number
  missing: number
  ok: boolean
}

export type ComparisonStats = {
  ciPhotos: number
  coPhotos: number
  ciIssues: number
  coIssues: number
  ciRooms: number
  coRooms: number
  photoDelta: number
  issueDelta: number
}

export type RoomVerdict = {
  label: 'Better' | 'Worse' | 'Same'
  color: string
  bg: string
}

/**
 * Match checkout room to checkin room by name (case-insensitive)
 */
export function findCheckinRoom(
  checkinRooms: RoomData[] | undefined | null,
  checkoutRoomName: string
): RoomData | undefined {
  return checkinRooms?.find(
    r => r.name.toLowerCase() === checkoutRoomName.toLowerCase()
  )
}

/**
 * Count photos with damage tags
 */
export function countIssues(photos: RoomPhoto[] | undefined | null): number {
  return photos?.filter(p => p.damage_tags && p.damage_tags.length > 0).length ?? 0
}

/**
 * Room verdict based on issue delta
 */
export function getRoomVerdict(
  checkinIssues: number,
  checkoutIssues: number
): RoomVerdict {
  if (checkoutIssues < checkinIssues)
    return { label: 'Better', color: '#16A34A', bg: '#DCFCE7' }
  if (checkoutIssues > checkinIssues)
    return { label: 'Worse', color: '#DC2626', bg: '#FEE2E2' }
  return { label: 'Same', color: '#6B7280', bg: '#F3F3F8' }
}

/**
 * Key return comparison: what was given at check-in vs returned at check-out
 */
export function getKeyDelta(
  checkinKeys: KeyItem[],
  checkoutKeys: KeyItem[]
): KeyDelta[] {
  return checkinKeys.map(ck => {
    const returned = checkoutKeys.find(
      k => k.item.toLowerCase() === ck.item.toLowerCase()
    )?.qty ?? 0
    return {
      item: ck.item,
      given: ck.qty,
      returned,
      missing: Math.max(0, ck.qty - returned),
      ok: returned >= ck.qty,
    }
  })
}

/**
 * Overall comparison stats between check-in and check-out
 */
export function getComparisonStats(
  checkin: { rooms?: RoomData[] } | null | undefined,
  checkout: { rooms?: RoomData[] } | null | undefined
): ComparisonStats {
  const ciPhotos = checkin?.rooms?.reduce(
    (acc, r) => acc + (r.photos?.length ?? 0), 0
  ) ?? 0
  const coPhotos = checkout?.rooms?.reduce(
    (acc, r) => acc + (r.photos?.length ?? 0), 0
  ) ?? 0
  const ciIssues = checkin?.rooms?.reduce(
    (acc, r) => acc + countIssues(r.photos), 0
  ) ?? 0
  const coIssues = checkout?.rooms?.reduce(
    (acc, r) => acc + countIssues(r.photos), 0
  ) ?? 0

  return {
    ciPhotos,
    coPhotos,
    ciIssues,
    coIssues,
    ciRooms: checkin?.rooms?.length ?? 0,
    coRooms: checkout?.rooms?.length ?? 0,
    photoDelta: coPhotos - ciPhotos,
    issueDelta: coIssues - ciIssues,
  }
}
