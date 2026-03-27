/* eslint-disable jsx-a11y/alt-text */

import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  renderToBuffer,
  Svg,
  Path,
  Circle,
  Rect,
  G,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getBrandTokens, type BrandTokens } from "@/lib/pdf/brandTokens";
import {
  isFullySigned,
  resolveCreatorPdfRole,
  type CreatorPdfRole,
  type PdfSignatureEmbeds,
} from "@/lib/pdf/inspectionSignatureEmbeds";

const AMBER = "#D97706";
const AMBER_LIGHT = "#FEF3C7";

/** Usable content width (A4 595pt − 30×2 margins) */
const PAGE_W = 535;
const COL_W = 262; // (PAGE_W - 10 gap) / 2
const PAIR_MAX_H = 270; // (702pt − 14 gap) / 2 − ~70pt text ≈ 274 → 270
/** @deprecated for room photo rows — new damage uses COL_W + PAIR_MAX_H; kept for CHECKOUT_PDF_LAYOUT export */
const NEW_MAX_H = 400;
const PAIR_GAP = 8; // vertical gap between two pairs on same page
/** Layout reserve (tags + AI under photos), ~65pt — for future pagination tuning */
const TEXT_AREA = 65;

function calcPhotoSize(
  photo: { width?: number | null; height?: number | null } | null | undefined,
  maxWidth: number,
  maxHeight: number
): { w: number; h: number } {
  const srcW = photo?.width || 1200;
  const srcH = photo?.height || 900;
  const ratio = srcH / srcW; // height / width

  // Ceiling comes only from maxWidth / maxHeight (e.g. PAIR_MAX_H) — no secondary cap
  let displayW = maxWidth;
  let displayH = displayW * ratio;

  if (displayH > maxHeight) {
    displayH = maxHeight;
    displayW = displayH / ratio;
  }
  if (displayW > maxWidth) {
    displayW = maxWidth;
    displayH = displayW * ratio;
  }

  return { w: Math.round(displayW), h: Math.round(displayH) };
}

/** Exported layout constants (TEXT_AREA documented for pagination tuning) */
export const CHECKOUT_PDF_LAYOUT = {
  PAGE_W,
  COL_W,
  PAIR_MAX_H,
  NEW_MAX_H,
  PAIR_GAP,
  TEXT_AREA,
} as const;

function isHttpsImageUrl(url: string | null | undefined): boolean {
  // Accept both https:// URLs and data: URLs (compressed images)
  return !!url && (url.startsWith("https://") || url.startsWith("data:"));
}

interface CheckoutPhoto {
  id: string;
  url: string;
  taken_at?: string | null;
  created_at?: string | null;
  damage_tags?: string[] | null;
  ai_analysis?: string | null;
  width?: number | null;
  height?: number | null;
  checkin_photo_id?: string | null;
  is_additional?: boolean;
  checkin_photo?: {
    id?: string;
    url: string;
    taken_at?: string | null;
    created_at?: string | null;
    damage_tags?: string[] | null;
    ai_analysis?: string | null;
    width?: number | null;
    height?: number | null;
  } | null;
}

interface CheckoutRoom {
  id: string;
  name: string;
  order_index?: number;
  condition?: string;
  checkin_condition?: string;
  photos: CheckoutPhoto[];
}

/** Check-in room + photos for PDF pairing (optional; enables “not photographed at checkout” rows) */
export type CheckinRoomPdf = {
  id: string;
  name: string;
  photos?: Array<{
    id: string;
    url: string;
    taken_at?: string | null;
    created_at?: string | null;
    damage_tags?: string[] | null;
    ai_analysis?: string | null;
    width?: number | null;
    height?: number | null;
  }>;
};

interface KeyHandoverItem {
  label?: string;
  name?: string;
  item?: string;
  quantity?: number;
  qty?: number;
}

export interface CheckoutPDFProps {
  inspection: {
    id: string;
    type: string;
    created_at: string;
    completed_at?: string;
    executive_summary?: string;
    document_hash?: string;
    key_handover?: KeyHandoverItem[];
    checkin_key_handover?: KeyHandoverItem[];
  };
  checkinInspection?: {
    id: string;
    created_at: string;
    document_hash?: string;
  } | null;
  property: {
    location: string;
    building_name?: string;
    unit_number?: string;
    property_type?: string;
  };
  tenancy: {
    contract_from?: string;
    contract_to?: string;
    actual_end_date?: string;
    tenant_name: string;
    tenant_email?: string;
    landlord_name?: string;
    landlord_email?: string;
    annual_rent?: number;
    security_deposit?: number;
    ejari_ref?: string;
    tenancy_type?: string;
    property_size?: number;
    status?: string;
  };
  rooms: CheckoutRoom[];
  /** When set, full check-in room photos are used for matching + unreferenced check-in photos */
  checkinRooms?: CheckinRoomPdf[] | null;
  signatures?: {
    signer_type: string;
    signer_name?: string;
    signature_data?: string;
    signed_at?: string | null;
    refused_at?: string | null;
    refused_reason?: string | null;
  }[];
  /** Base64 data URLs for @react-pdf — built server-side from fresh signatures rows */
  signatureEmbeds?: PdfSignatureEmbeds;
  profile?: {
    full_name?: string;
    rera_number?: string;
    signature_image_url?: string;
    account_type?: string;
    individual_role?: string | null;
  };
  creatorPdfRole?: CreatorPdfRole;
  agencyName: string;
  agencyWebsite: string;
  agencyLogoUrl?: string | null;
  tokens: BrandTokens;
  qrCodeDataUrl?: string;
  inventorySnapshots?: {
    id: string
    name: string
    category: string
    quantity: number
    condition_checkin?: string | null
    photo_url?: string | null
    status_checkout?: string | null
    notes?: string | null
    quantity_checkout?: number | null
    is_tenant_item?: boolean | null
  }[]
}

/* ─────────────────────────────────────────────────────────────────────────────
   Helper Functions
   ───────────────────────────────────────────────────────────────────────────── */

function formatDate(dateStr?: string | null, withTime = false): string {
  if (!dateStr) return "—";
  try {
    const d = new Date(dateStr);
    if (Number.isNaN(d.getTime())) return String(dateStr);
    const datePart = d.toLocaleDateString("en-AE", {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Asia/Dubai",
    });
    if (!withTime) return datePart;
    const timeStr = d.toLocaleTimeString("en-AE", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Asia/Dubai",
    });
    return `${datePart} at ${timeStr}`;
  } catch {
    return String(dateStr);
  }
}

/** Timestamp badge on room photos — check-in / check-out aligned */
const PHOTO_TIMESTAMP_BADGE = {
  position: "absolute" as const,
  bottom: 6,
  right: 6,
  backgroundColor: "rgba(0,0,0,0.45)",
  borderRadius: 3,
  paddingHorizontal: 5,
  paddingVertical: 2,
};

const PHOTO_TIMESTAMP_TEXT = {
  fontSize: 6.5,
  color: "#FFFFFF",
  fontFamily: "Helvetica",
};

/** Photo taken_at → row created_at → inspection-level fallback (Dubai via formatDate). */
function photoTimestampLabel(
  photo: { taken_at?: string | null; created_at?: string | null } | null | undefined,
  inspectionFallbackIso: string | null | undefined
): string | null {
  const raw = photo?.taken_at ?? photo?.created_at ?? inspectionFallbackIso ?? null;
  if (!raw) return null;
  const formatted = formatDate(raw, true);
  return formatted === "—" ? null : formatted;
}

function capitalise(str?: string | null): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function countIssues(photos: CheckoutPhoto[]): number {
  return photos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;
}

function getRoomCondition(photos: { damage_tags?: string[] | null }[]): string {
  const photosWithIssues = photos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;
  if (photosWithIssues === 0) return "Excellent";
  const severeTags = ["BROKEN", "HOLE", "WATER_DAMAGE", "MOLD"];
  const hasSevere = photos.some((p) =>
    (p.damage_tags ?? []).some((t) => severeTags.includes(String(t).toUpperCase()))
  );
  if (hasSevere) return "Needs Attention";
  if (photos.length > 0 && photosWithIssues / photos.length >= 0.5) return "Fair";
  return "Good";
}

function getRoomVerdict(
  ciIssues: number,
  coIssues: number,
  brand: BrandTokens
): { label: string; color: string; bg: string } {
  if (coIssues < ciIssues) {
    return {
      label: "Better",
      color: brand.primary,
      bg: `${brand.primary}25`,
    };
  }
  if (coIssues > ciIssues) {
    return { label: "Worse", color: "#DC2626", bg: "#FEE2E2" };
  }
  return { label: "Same", color: "#6B7280", bg: "#F3F3F8" };
}

type CiPdfPhoto = NonNullable<CheckinRoomPdf["photos"]>[number];

type RoomPdfPair =
  | { type: "match"; ciPhoto: CiPdfPhoto | null; coPhoto: CheckoutPhoto | null }
  | { type: "new"; coPhoto: CheckoutPhoto };

function findCheckinRoomPdf(
  checkinRooms: CheckinRoomPdf[] | null | undefined,
  roomName: string
): CheckinRoomPdf | undefined {
  return checkinRooms?.find((r) => r.name.toLowerCase() === roomName.toLowerCase());
}

/** Build ordered pairs for room PDF pages (matched, new damage, then unreferenced check-in photos). */
function buildRoomPdfPairs(room: CheckoutRoom, checkinRooms: CheckinRoomPdf[] | null | undefined): RoomPdfPair[] {
  const ciRoom = findCheckinRoomPdf(checkinRooms, room.name);
  const ciPhotos = ciRoom?.photos ?? [];
  const coPhotos = room.photos ?? [];
  const pairs: RoomPdfPair[] = [];

  for (const coPhoto of coPhotos) {
    if (coPhoto.checkin_photo_id) {
      const fromRoom = ciPhotos.find((p) => p.id === coPhoto.checkin_photo_id) ?? null;
      const embedded = coPhoto.checkin_photo;
      const ciPhoto: CiPdfPhoto | null = fromRoom
        ? fromRoom
        : embedded
          ? {
              id: embedded.id ?? coPhoto.checkin_photo_id,
              url: embedded.url,
              taken_at: embedded.taken_at ?? null,
              damage_tags: embedded.damage_tags,
              ai_analysis: embedded.ai_analysis,
              width: embedded.width,
              height: embedded.height,
            }
          : null;
      pairs.push({ type: "match", ciPhoto, coPhoto });
    } else {
      pairs.push({ type: "new", coPhoto });
    }
  }

  const referencedCiIds = new Set(
    coPhotos.map((p) => p.checkin_photo_id).filter(Boolean) as string[]
  );
  for (const ciPhoto of ciPhotos) {
    if (!referencedCiIds.has(ciPhoto.id)) {
      pairs.push({ type: "match", ciPhoto, coPhoto: null });
    }
  }

  return pairs;
}

function chunkByTwo<T>(items: T[]): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += 2) {
    chunks.push(items.slice(i, i + 2));
  }
  return chunks.length > 0 ? chunks : [[]];
}

function getKeyLabel(item: KeyHandoverItem): string {
  return item.label || item.name || item.item || "Key";
}

function getKeyQty(item: KeyHandoverItem): number {
  return item.quantity ?? item.qty ?? 0;
}

function compareKeyHandover(
  checkin: KeyHandoverItem[],
  checkout: KeyHandoverItem[]
): Array<{
  item: string;
  given: number;
  returned: number;
  missing: number;
  ok: boolean;
}> {
  return checkin.map((ck) => {
    const label = getKeyLabel(ck);
    const given = getKeyQty(ck);
    const coItem = checkout.find(
      (k) => getKeyLabel(k).toLowerCase() === label.toLowerCase()
    );
    const returned = coItem ? getKeyQty(coItem) : 0;
    return {
      item: label,
      given,
      returned,
      missing: Math.max(0, given - returned),
      ok: returned >= given,
    };
  });
}

/* ─────────────────────────────────────────────────────────────────────────────
   SVG Icon Components for PDF
   ───────────────────────────────────────────────────────────────────────────── */

const PdfIcon = ({ size, color, children }: { size: number; color: string; children: React.ReactNode }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <G fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
      {children}
    </G>
  </Svg>
);

const IconCalendar = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Rect x="3" y="4" width="18" height="18" rx="2" />
    <Path d="M16 2v4M8 2v4M3 10h18" />
  </PdfIcon>
);

const IconContract = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    <Path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </PdfIcon>
);

const IconHouse = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" />
    <Path d="M9 21V12h6v9" />
  </PdfIcon>
);

const IconCamera = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z" />
    <Circle cx="12" cy="13" r="4" />
  </PdfIcon>
);

const IconWarning = ({ size = 14, color = "#DC2626" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <Path d="M12 9v4M12 17h.01" />
  </PdfIcon>
);

const IconKey = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Circle cx="7.5" cy="15.5" r="4.5" />
    <Path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2" />
  </PdfIcon>
);

const IconCard = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Rect x="1" y="4" width="22" height="16" rx="2" />
    <Path d="M1 10h22" />
  </PdfIcon>
);

const IconMailbox = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Path d="M22 6l-10 7L2 6" />
  </PdfIcon>
);

const IconLock = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Rect x="3" y="11" width="18" height="11" rx="2" />
    <Path d="M7 11V7a5 5 0 0110 0v4" />
  </PdfIcon>
);

const IconShield = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </PdfIcon>
);

const IconLogout = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" />
  </PdfIcon>
);

function getKeyIcon(itemName: string, color: string) {
  const name = (itemName || "").toLowerCase();
  // Door Keys → classic key
  if (name.includes("door") || name.includes("key")) {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Circle cx="7.5" cy="15.5" r="4.5" fill="none" stroke={color} strokeWidth={1.8} />
        <Path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  // Parking Card → credit card (not vehicle)
  if (name.includes("parking")) {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path
          d="M2 5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v2H2V5zm0 4h20v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9zm3 3a1 1 0 0 0 0 2h3a1 1 0 0 0 0-2H5z"
          fill={color}
        />
      </Svg>
    );
  }

  // Access Card / Fob → ID badge (distinct from parking card)
  if (name.includes("access") || name.includes("fob") || name.includes("badge")) {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path
          d="M4 4a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H4zm8 3a2 2 0 1 1 0 4 2 2 0 0 1 0-4zm-4 8c0-2.21 1.79-4 4-4s4 1.79 4 4H8z"
          fill={color}
        />
      </Svg>
    );
  }

  // Remote Control → rectangle + button dots
  if (name.includes("remote") || name.includes("control")) {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Rect x="5" y="5" width="14" height="14" rx="2" fill="none" stroke={color} strokeWidth={1.8} />
        <Circle cx="9" cy="10" r="1.4" fill={color} />
        <Circle cx="12" cy="10" r="1.4" fill={color} />
        <Circle cx="15" cy="10" r="1.4" fill={color} />
        <Circle cx="9" cy="14" r="1.4" fill={color} />
        <Circle cx="12" cy="14" r="1.4" fill={color} />
        <Circle cx="15" cy="14" r="1.4" fill={color} />
      </Svg>
    );
  }

  // Mailbox
  if (name.includes("mailbox") || name.includes("mail")) {
    return (
      <Svg width={13} height={13} viewBox="0 0 24 24">
        <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
        <Path d="M22 6l-10 7L2 6" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
      </Svg>
    );
  }

  // Default → key
  return (
    <Svg width={13} height={13} viewBox="0 0 24 24">
      <Circle cx="7.5" cy="15.5" r="4.5" fill="none" stroke={color} strokeWidth={1.8} />
      <Path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2" fill="none" stroke={color} strokeWidth={1.8} strokeLinecap="round" />
    </Svg>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Styles (mirroring check-in PDF structure)
   ───────────────────────────────────────────────────────────────────────────── */

const s = StyleSheet.create({
  page: { padding: 0, fontFamily: "Helvetica", fontSize: 10, color: "#1A1A1A" },

  /* Cover hero */
  coverHero: {
    padding: 32,
    paddingBottom: 28,
    position: "relative",
  },
  coverHeroGeoCircle: {
    position: "absolute",
    top: -40,
    right: -40,
    width: 130,
    height: 130,
    borderRadius: 65,
    borderWidth: 20,
    borderStyle: "solid",
  },
  coverHeroGeoCircle2: {
    position: "absolute",
    top: -15,
    right: -15,
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 12,
    borderStyle: "solid",
  },
  coverLogoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 28,
  },
  coverLogoLeft: { flexDirection: "row", alignItems: "center" },
  coverLogoText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  coverLogoSub: {
    fontSize: 8,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  coverTypeBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
  },
  coverTypeBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    letterSpacing: 1,
  },
  coverAddressMain: {
    fontSize: 26,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 1.25,
  },
  coverAddressSub: {
    fontSize: 9,
    color: "rgba(255,255,255,0.65)",
    marginTop: 4,
  },

  /* Cover body */
  coverBodyNew: { paddingHorizontal: 28, paddingVertical: 20 },
  metaStrip: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    overflow: "hidden",
    marginBottom: 14,
  },
  metaCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
  },
  metaCellBorder: {
    borderRightWidth: 0.5,
    borderRightColor: "#EEECFF",
  },
  metaIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  metaLabel: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#9B9BA8",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#1A1A2E",
  },
  partiesRow: { flexDirection: "row", marginBottom: 14 },
  partyCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 10,
  },
  partyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  partyAvatarText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  partyRole: {
    fontSize: 7.5,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  partyName: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  partyEmail: { fontSize: 8.5, color: "#9B9BA8", marginTop: 1 },

  /* Summary card */
  summaryCard: {
    borderRadius: 8,
    padding: 12,
  },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  summaryDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  summaryLabel: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryTextNew: { fontSize: 9, color: "#374151", lineHeight: 1.65 },

  /* Footer */
  pdfFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 7,
  },
  footerLeft: { flexDirection: "row", alignItems: "center" },
  footerAgency: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.8)" },
  footerDivider: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 6,
  },
  footerUrl: { fontSize: 7.5, color: "rgba(255,255,255,0.5)" },
  footerRight: { fontSize: 7.5, color: "rgba(255,255,255,0.5)" },

  /* Page 2 overview */
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  overviewTitleNew: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  overviewSub: { fontSize: 8.5, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  statRow: { flexDirection: "row", paddingHorizontal: 28, marginTop: 16 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 12,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  statIconBox: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  statNum: { fontSize: 26, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  statLbl: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#9B9BA8",
    marginTop: 4,
  },
  statDelta: {
    fontSize: 8,
    marginTop: 2,
  },
  sectionHd: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHdText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginRight: 8 },
  sectionHdLine: { flex: 1, height: 0.5, backgroundColor: "#EEECFF" },

  /* Room table */
  roomTable: { marginHorizontal: 28, borderRadius: 8, overflow: "hidden", borderWidth: 0.5, borderColor: "#EEECFF" },
  roomThead: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 7 },
  roomTheadCell: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    color: "#FFFFFF",
  },
  roomRow: {
    flexDirection: "row",
    paddingHorizontal: 10,
    paddingVertical: 7,
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#F3F3F8",
  },
  roomRowAlt: { backgroundColor: "#FAFBFF" },
  roomCell: { fontSize: 9, color: "#374151" },
  roomCellBold: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  verdictBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  verdictBadgeText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },

  /* Key return */
  keysCard: {
    marginHorizontal: 28,
    backgroundColor: "#FAFBFF",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 12,
  },
  keyItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: 0.5,
    borderBottomColor: "#F3F3F8",
  },
  keyItemLast: { borderBottomWidth: 0 },
  keyIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  keyLabel: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  keySubLabel: { fontSize: 7, color: "#9B9BA8" },
  keyStatus: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  keyStatusText: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  missingAlert: {
    backgroundColor: "#FEE2E2",
    borderRadius: 6,
    padding: 8,
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
  },

  /* Room hero (pages 3–N) — compact header (~1.5x shorter vertically) */
  roomHero: {
    paddingHorizontal: 28,
    paddingTop: 13,
    paddingBottom: 15,
    position: "relative",
    overflow: "hidden",
  },
  roomHeroDecoOuter: {
    position: "absolute",
    right: -24,
    bottom: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 18,
    borderStyle: "solid",
  },
  roomHeroDecoInner: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 11,
    borderStyle: "solid",
  },
  roomHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roomNumber: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  roomTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  roomDate: {
    fontSize: 7,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
  },
  roomStatsRow: { flexDirection: "row", marginTop: 7 },
  roomStatItem: { flexDirection: "row", alignItems: "center" },
  roomStatDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  roomStatText: { fontSize: 8.5, color: "rgba(255,255,255,0.65)" },

  /* Room body (pages 3–N) */
  roomBody: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8 },
  photosGrid: { flexDirection: "row", marginBottom: 8 },
  photoCard: {
    flex: 1,
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
  },
  photoCardFull: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    marginBottom: 8,
  },
  photoTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 6,
    paddingBottom: 4,
  },
  photoTag: {
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  photoTagText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  photoAiDivider: { height: 0.5, backgroundColor: "#F3F3F8" },
  photoAiWrap: { padding: 7, paddingTop: 6 },
  photoAiLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  photoAiText: { fontSize: 8.5, color: "#6B7280", lineHeight: 1.55 },

  /* Signature page */
  sigHero: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 22,
    position: "relative",
    overflow: "hidden",
  },
  sigHeroDeco: {
    position: "absolute",
    right: -20,
    top: -20,
    width: 90,
    height: 90,
    borderRadius: 18,
    borderWidth: 16,
    borderStyle: "solid",
  },
  sigHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sigLogoText: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  sigLogoSub: { fontSize: 8, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  sigVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sigVerifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  sigVerifiedText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#FFFFFF", letterSpacing: 0.3 },
  sigTitle: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1.35,
  },
  sigSubtitle: { fontSize: 9, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  sigBody: { paddingHorizontal: 22, paddingTop: 14 },
  qrRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FAFBFF",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 12,
    marginBottom: 12,
  },
  qrBox: {
    width: 56,
    height: 56,
    borderRadius: 6,
    backgroundColor: "#FFFFFF",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    flexShrink: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  qrImage: { width: 48, height: 48 },
  qrTextWrap: { flex: 1 },
  qrTextTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 4 },
  qrTextBody: { fontSize: 9, color: "#6B7280", lineHeight: 1.6 },
  sigPartiesRow: { flexDirection: "row", marginBottom: 10 },
  sigPartyCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 11,
  },
  sigPartyRole: {
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigPartyName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 8 },
  sigSignArea: {
    height: 38,
    borderRadius: 5,
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: "#CCCCDD",
    alignItems: "center",
    justifyContent: "center",
  },
  sigSignPending: { fontSize: 8.5, color: "#9B9BA8", fontFamily: "Helvetica-Oblique" },
  sigSignImage: { width: 80, height: 32, objectFit: "contain" },
  sigInspectorCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 11,
    marginBottom: 10,
  },
  sigInspectorLeft: { flex: 1 },
  sigInspectorRole: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigInspectorName: { fontSize: 11, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 2 },
  sigInspectorAgency: { fontSize: 9, color: "#6B7280" },
  sigInspectorRight: { width: 80 },
  sigInspectorSignBox: {
    height: 38,
    borderRadius: 5,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 3,
  },
  sigInspectorSignLabel: { fontSize: 5.5, color: "#9B9BA8", textAlign: "center" },
  hashCard: {
    backgroundColor: "#F8F8FC",
    borderRadius: 6,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 9,
    marginBottom: 10,
  },
  hashLabel: {
    fontSize: 7,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#9B9BA8",
    marginBottom: 4,
  },
  hashRow: { flexDirection: "row", alignItems: "center" },
  hashIconBox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  hashValue: { fontSize: 8.5, color: "#374151", fontFamily: "Courier", lineHeight: 1.4 },
  disclaimer: {
    fontSize: 7.5,
    color: "#9B9BA8",
    lineHeight: 1.65,
    textAlign: "center",
    paddingHorizontal: 10,
    marginBottom: 8,
  },

  /* Tenancy details card */
  tenancyCard: {
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 14,
    marginBottom: 14,
    backgroundColor: "#FFFFFF",
  },
  tenancyTitle: {
    fontSize: 7.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  tenancyGrid: { flexDirection: "row", flexWrap: "wrap" },
  tenancyField: { width: "50%", marginBottom: 8 },
  tenancyFieldLabel: {
    fontSize: 7,
    color: "#9B9BA8",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  tenancyFieldValue: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
});

function tagStyle(tag: string): { bg: string; text: string } {
  const t = tag.toLowerCase();
  if (["scratch", "crack", "broken", "missing"].includes(t)) return { bg: "#FEE2E2", text: "#DC2626" };
  if (["stain", "damp", "burn", "discoloration"].includes(t)) return { bg: "#FEF3C7", text: "#B45309" };
  if (["mark", "wear"].includes(t)) return { bg: "#DBEAFE", text: "#1D4ED8" };
  return { bg: "#F1F5F9", text: "#475569" };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Main PDF Document Component
   ───────────────────────────────────────────────────────────────────────────── */

export function CheckoutPDFDocument({
  inspection,
  checkinInspection,
  property,
  tenancy,
  rooms,
  checkinRooms,
  signatures,
  signatureEmbeds: sigE,
  creatorPdfRole: creatorPdfRoleProp,
  profile,
  agencyName,
  agencyWebsite,
  agencyLogoUrl,
  tokens: tokensProp,
  qrCodeDataUrl,
  inventorySnapshots,
}: CheckoutPDFProps) {
  /** Same derivation as check-in PDF — agency primary + shades */
  const tokens = getBrandTokens(tokensProp.primary);
  const creatorPdfRole =
    creatorPdfRoleProp ??
    resolveCreatorPdfRole(profile?.account_type, profile?.individual_role);
  const documentHash = inspection.document_hash || "";
  const shortHash = `${documentHash.slice(0, 8)}…${documentHash.slice(-8)}`;

  // Calculate stats
  const checkinKeyItems = inspection.checkin_key_handover ?? [];
  const checkoutKeyItems = inspection.key_handover ?? [];
  const keyComparison = compareKeyHandover(checkinKeyItems, checkoutKeyItems);
  const missingKeys = keyComparison.filter((k) => !k.ok);

  // Room stats with check-in comparison
  const roomStats = rooms.map((room) => {
    const coPhotos = room.photos.length;
    const coIssues = countIssues(room.photos);

    // Find matching check-in room by gathering photos with checkin_photo
    const ciPhotosFromLinked = room.photos.filter((p) => p.checkin_photo).length;
    const ciIssuesFromLinked = room.photos.filter(
      (p) => p.checkin_photo && (p.checkin_photo.damage_tags?.length ?? 0) > 0
    ).length;

    const roomCondition = room.condition || getRoomCondition(room.photos);
    const verdict = getRoomVerdict(ciIssuesFromLinked, coIssues, tokens);

    return {
      room,
      coPhotos,
      coIssues,
      ciPhotos: ciPhotosFromLinked,
      ciIssues: ciIssuesFromLinked,
      roomCondition,
      verdict,
    };
  });

  const totalCiPhotos = roomStats.reduce((sum, r) => sum + r.ciPhotos, 0);
  const totalCoPhotos = roomStats.reduce((sum, r) => sum + r.coPhotos, 0);
  const totalCiIssues = roomStats.reduce((sum, r) => sum + r.ciIssues, 0);
  const totalCoIssues = roomStats.reduce((sum, r) => sum + r.coIssues, 0);

  const photoDelta = totalCoPhotos - totalCiPhotos;
  const issueDelta = totalCoIssues - totalCiIssues;

  const roomPageEntries = rooms.flatMap((room, roomIndex) => {
    const pairs = buildRoomPdfPairs(room, checkinRooms ?? null);
    const chunks = chunkByTwo(pairs);
    const rs = roomStats[roomIndex];
    return chunks.map((chunk, chunkIdx) => ({
      room,
      roomIndex,
      chunk,
      chunkIdx,
      totalRoomPages: chunks.length,
      verdict: rs.verdict,
      coIssues: rs.coIssues,
      coPhotoCount: rs.coPhotos,
    }));
  });

  const totalPages = 3 + roomPageEntries.length;

  // Tenancy fields
  const tenancyFields: Array<{ label: string; value: string }> = [];
  if (tenancy.ejari_ref) tenancyFields.push({ label: "Ejari Reference", value: tenancy.ejari_ref });
  if (tenancy.annual_rent != null) tenancyFields.push({ label: "Annual Rent", value: `AED ${Number(tenancy.annual_rent).toLocaleString("en-AE")}` });
  if (tenancy.security_deposit != null) tenancyFields.push({ label: "Security Deposit", value: `AED ${Number(tenancy.security_deposit).toLocaleString("en-AE")}` });
  if (tenancy.tenancy_type) tenancyFields.push({ label: "Tenancy Type", value: capitalise(tenancy.tenancy_type) });
  if (tenancy.property_size != null) tenancyFields.push({ label: "Property Size", value: `${Number(tenancy.property_size).toLocaleString("en-AE")} sqft` });
  if (tenancy.status) tenancyFields.push({ label: "Contract Status", value: capitalise(tenancy.status.replace(/_/g, " ")) });

  return (
    <Document>
      {/* PAGE 1 — COVER */}
      <Page size="A4" style={s.page} wrap={false}>
        <View style={[s.coverHero, { backgroundColor: tokens.primary }]}>
          <View style={[s.coverHeroGeoCircle, { borderColor: tokens.primaryDark }]} />
          <View style={[s.coverHeroGeoCircle2, { borderColor: tokens.primaryDark }]} />

          <View style={s.coverLogoRow}>
            <View style={s.coverLogoLeft}>
              {agencyLogoUrl ? (
                <Image
                  src={agencyLogoUrl}
                  style={{ width: 70, height: 70, objectFit: "contain", borderRadius: 12, marginRight: 12 }}
                />
              ) : (
                <View style={{
                  width: 70, height: 70, borderRadius: 14,
                  backgroundColor: "rgba(255,255,255,0.2)",
                  alignItems: "center", justifyContent: "center",
                  marginRight: 12,
                }}>
                  <View style={{ width: 36, height: 36, backgroundColor: "rgba(255,255,255,0.5)", borderRadius: 8 }} />
                </View>
              )}
              <View>
                <Text style={s.coverLogoText}>{agencyName}</Text>
                <Text style={s.coverLogoSub}>PROPERTY INSPECTION REPORT</Text>
              </View>
            </View>
            {/* CHECK-OUT badge — amber color */}
            <View style={[s.coverTypeBadge, { borderColor: AMBER, backgroundColor: AMBER_LIGHT }]}>
              <Text style={[s.coverTypeBadgeText, { color: AMBER }]}>CHECK-OUT</Text>
            </View>
          </View>

          <Text style={s.coverAddressMain}>
            {property.building_name ?? property.location ?? "Property"}
          </Text>
          <Text style={s.coverAddressSub}>
            {[
              property.unit_number ? `Unit ${property.unit_number}` : null,
              capitalise(property.property_type || ""),
            ].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={s.coverBodyNew}>
          {/* Meta strip — 4 cells (2×2) */}
          <View style={[s.metaStrip, { flexWrap: "wrap" }]}>
            {[
              { label: "Date of Inspection", value: formatDate(inspection.created_at), icon: <IconCalendar size={13} color={tokens.primary} /> },
              { label: "Property Type", value: capitalise(property.property_type || "Apartment"), icon: <IconHouse size={13} color={tokens.primary} /> },
              { label: "Contract Start", value: formatDate(tenancy.contract_from), icon: <IconCalendar size={13} color={tokens.primary} /> },
              { label: "Contract End", value: formatDate(tenancy.actual_end_date || tenancy.contract_to), icon: <IconContract size={13} color={tokens.primary} /> },
            ].map((item, i) => (
              <View
                key={i}
                style={[
                  s.metaCell,
                  { width: "50%" },
                  i % 2 === 0 ? s.metaCellBorder : {},
                  i < 2 ? { borderBottomWidth: 0.5, borderBottomColor: "#EEECFF" } : {},
                ]}
              >
                <View style={[s.metaIconBox, { backgroundColor: tokens.primaryUltraLight, marginRight: 8 }]}>
                  {item.icon}
                </View>
                <View>
                  <Text style={[s.metaLabel, { color: tokens.primary }]}>{item.label}</Text>
                  <Text style={s.metaValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Parties row */}
          <View style={s.partiesRow}>
            {[
              { role: "Landlord", name: tenancy.landlord_name, email: tenancy.landlord_email },
              { role: "Tenant", name: tenancy.tenant_name, email: tenancy.tenant_email },
            ].map((p, i) => (
              <View key={i} style={[s.partyCard, ...(i === 0 ? [{ marginRight: 8 }] : [])]}>
                <View style={[s.partyAvatar, { backgroundColor: tokens.primaryUltraLight, marginRight: 9 }]}>
                  <Text style={[s.partyAvatarText, { color: tokens.primary }]}>{getInitials(p.name)}</Text>
                </View>
                <View>
                  <Text style={[s.partyRole, { color: tokens.primary }]}>{p.role.toUpperCase()}</Text>
                  <Text style={s.partyName}>{p.name ?? "—"}</Text>
                  <Text style={s.partyEmail}>{p.email ?? ""}</Text>
                </View>
              </View>
            ))}
          </View>

          {/* Tenancy Details Card */}
          {tenancyFields.length > 0 && (
            <View style={s.tenancyCard}>
              <Text style={[s.tenancyTitle, { color: tokens.primary }]}>Tenancy Details</Text>
              <View style={s.tenancyGrid}>
                {tenancyFields.map((field, i) => (
                  <View key={i} style={[s.tenancyField, { paddingRight: i % 2 === 0 ? 10 : 0 }]}>
                    <Text style={s.tenancyFieldLabel}>{field.label}</Text>
                    <Text style={s.tenancyFieldValue}>{field.value}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Executive Summary */}
          <View style={[s.summaryCard, { backgroundColor: tokens.primaryUltraLight }]}>
            <View style={s.summaryLabelRow}>
              <View style={[s.summaryDot, { backgroundColor: tokens.primary }]} />
              <Text style={[s.summaryLabel, { color: tokens.primary }]}>Executive Summary</Text>
            </View>
            <Text style={s.summaryTextNew}>{inspection.executive_summary || "No summary available."}</Text>
          </View>
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>SHA-256: {shortHash} · Page 1</Text>
        </View>
      </Page>

      {/* PAGE 2 — CHECK-OUT COMPARISON */}
      <Page size="A4" style={s.page} wrap={false}>
        <View style={[s.overviewHeader, { backgroundColor: tokens.primary }]}>
          <View>
            <Text style={s.overviewTitleNew}>Check-out Comparison</Text>
            <Text style={s.overviewSub}>
              {property.location ?? "Property"} · {formatDate(inspection.created_at)}
            </Text>
          </View>
          <View style={{
            width: 36, height: 36, borderRadius: 8,
            backgroundColor: "rgba(255,255,255,0.15)",
            alignItems: "center", justifyContent: "center",
          }}>
            <IconLogout size={18} color="#FFFFFF" />
          </View>
        </View>

        {/* Stat cards with deltas */}
        <View style={s.statRow}>
          {[
            {
              num: roomStats.length,
              label: "Rooms inspected",
              icon: <IconHouse size={16} color={tokens.primary} />,
              isIssue: false,
              delta: null,
            },
            {
              num: totalCoPhotos,
              label: "Photos captured",
              icon: <IconCamera size={16} color={tokens.primary} />,
              isIssue: false,
              delta: photoDelta,
            },
            {
              num: totalCoIssues,
              label: "Issues flagged",
              icon: <IconWarning size={16} color="#DC2626" />,
              isIssue: true,
              delta: issueDelta,
            },
          ].map((stat, i) => {
            const deltaColor = stat.delta != null
              ? (stat.isIssue
                  ? (stat.delta > 0 ? "#DC2626" : stat.delta < 0 ? tokens.primary : "#6B7280")
                  : (stat.delta > 0 ? tokens.primary : stat.delta < 0 ? "#DC2626" : "#6B7280"))
              : "#6B7280";
            return (
              <View key={i} style={[s.statCard, ...(i < 2 ? [{ marginRight: 10 }] : [])]}>
                <View style={[s.statIconBox, { backgroundColor: stat.isIssue ? "#FEE2E2" : tokens.primaryUltraLight }]}>
                  {stat.icon}
                </View>
                <Text style={[s.statNum, { color: stat.isIssue ? "#DC2626" : tokens.primary }]}>{stat.num}</Text>
                <Text style={s.statLbl}>{stat.label}</Text>
                {stat.delta != null && (
                  <Text style={[s.statDelta, { color: deltaColor }]}>
                    vs check-in: {stat.delta > 0 ? "+" : ""}{stat.delta}
                  </Text>
                )}
              </View>
            );
          })}
        </View>

        {/* Room comparison table */}
        <View style={{ marginHorizontal: 28, marginBottom: 20 }}>
          <Text style={{
            fontSize: 9, fontFamily: 'Helvetica-Bold',
            color: tokens.primary, textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 8,
          }}>
            Room Comparison
          </Text>

          {/* Table header */}
          <View style={{
            flexDirection: 'row',
            backgroundColor: tokens.primary,
            borderRadius: 4,
            padding: '6 10',
            marginBottom: 2,
          }}>
            {['Room', 'Check-in Photos', 'Check-out Photos', 'Issues (in->out)', 'Verdict'].map((h, i) => (
              <Text key={i} style={{
                flex: i === 0 ? 2 : 1,
                fontSize: 7,
                fontFamily: 'Helvetica-Bold',
                color: 'white',
                textAlign: i === 0 ? 'left' : 'center',
              }}>
                {h}
              </Text>
            ))}
          </View>

          {/* Table rows */}
          {roomStats.map((r, i) => {
            return (
              <View key={r.room.id} style={{
                flexDirection: 'row',
                backgroundColor: i % 2 === 0 ? '#F8F7F4' : 'white',
                borderRadius: 4,
                padding: '8 10',
                marginBottom: 2,
                alignItems: 'center',
              }}>
                <Text style={{
                  flex: 2, fontSize: 8,
                  fontFamily: 'Helvetica-Bold', color: '#1A1A2E',
                }}>
                  {r.room.name}
                </Text>
                <Text style={{ flex: 1, fontSize: 8, color: '#6B7280', textAlign: 'center' }}>
                  {r.ciPhotos}
                </Text>
                <Text style={{ flex: 1, fontSize: 8, color: '#1A1A2E',
                  fontFamily: 'Helvetica-Bold', textAlign: 'center' }}>
                  {r.coPhotos}
                </Text>
                <Text style={{ flex: 1, fontSize: 8, color: '#1A1A2E', textAlign: 'center' }}>
                  {r.ciIssues} {'->'} {r.coIssues}
                </Text>
                <View style={{
                  flex: 1, alignItems: 'center',
                }}>
                  <View style={{
                    backgroundColor: r.verdict.bg,
                    borderRadius: 20, paddingHorizontal: 8, paddingVertical: 2,
                  }}>
                    <Text style={{
                      fontSize: 7, fontFamily: 'Helvetica-Bold',
                      color: r.verdict.color,
                    }}>
                      {r.verdict.label}
                    </Text>
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Key Return section — inline rows */}
        <View style={{ marginHorizontal: 28, marginBottom: 20 }}>
          <Text style={{
            fontSize: 9, fontFamily: 'Helvetica-Bold',
            color: tokens.primary, textTransform: 'uppercase',
            letterSpacing: 1, marginBottom: 10,
          }}>
            Key Return
          </Text>

          {keyComparison.length === 0 ? (
            <Text style={{ fontSize: 8, color: "#9B9BA8", fontFamily: "Helvetica-Oblique" }}>
              No key items recorded
            </Text>
          ) : (
            <>
              {/* Column headers */}
              <View style={{
                flexDirection: 'row', paddingBottom: 4, marginBottom: 4,
                borderBottomWidth: 0.5, borderBottomColor: '#E5E5E5',
              }}>
                <Text style={{ flex: 3, fontSize: 7, color: '#9B9BA8',
                  textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Item
                </Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#9B9BA8',
                  textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Given
                </Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#9B9BA8',
                  textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Returned
                </Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#9B9BA8',
                  textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>
                  Status
                </Text>
              </View>

              {keyComparison.map((k, i) => (
                <View key={i} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 7,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#F3F3F8',
                  backgroundColor: k.ok ? 'transparent' : '#FEF2F2',
                  borderRadius: 4,
                  paddingHorizontal: k.ok ? 0 : 6,
                  marginBottom: k.ok ? 0 : 2,
                }}>
                  {/* Item name */}
                  <Text style={{
                    flex: 3, fontSize: 8,
                    fontFamily: 'Helvetica-Bold', color: '#1A1A2E',
                  }}>
                    {k.item}
                  </Text>

                  {/* Given qty — gray */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 9, fontFamily: 'Helvetica-Bold', color: '#9B9BA8',
                    }}>
                      x{k.given}
                    </Text>
                  </View>

                  {/* Returned qty */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <Text style={{
                      fontSize: 10, fontFamily: 'Helvetica-Bold',
                      color: k.ok ? tokens.primary : '#DC2626',
                    }}>
                      x{k.returned}
                    </Text>
                  </View>

                  {/* Status badge */}
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      backgroundColor: k.ok ? `${tokens.primary}25` : '#FEE2E2',
                      borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2,
                    }}>
                      <Text style={{
                        fontSize: 6.5, fontFamily: 'Helvetica-Bold',
                        color: k.ok ? tokens.primary : '#DC2626',
                      }}>
                        {k.ok ? 'Returned' : `Missing x${k.missing}`}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}

              {/* Summary footer */}
              {(() => {
                const allOk = keyComparison.every((k) => k.ok);
                return (
                  <View style={{
                    marginTop: 8, flexDirection: 'row', alignItems: 'center',
                    backgroundColor: allOk ? `${tokens.primary}25` : '#FEE2E2',
                    borderRadius: 6, padding: '5 10',
                  }}>
                    <View style={{
                      width: 6, height: 6, borderRadius: 3,
                      backgroundColor: allOk ? tokens.primary : '#DC2626',
                      marginRight: 6,
                    }} />
                    <Text style={{
                      fontSize: 7.5, fontFamily: 'Helvetica-Bold',
                      color: allOk ? tokens.primary : '#DC2626',
                    }}>
                      {allOk
                        ? 'All keys returned'
                        : keyComparison
                            .filter((k) => !k.ok)
                            .map((k) => `${k.item}: missing x${k.missing}`)
                            .join(' | ')
                      }
                    </Text>
                  </View>
                );
              })()}
            </>
          )}
        </View>

          {/* ── INVENTORY COMPARISON ── */}
          {inventorySnapshots && inventorySnapshots.length > 0 && (
            <View style={{ marginTop: 20 }}>
              <Text style={{
                fontSize: 9, fontFamily: 'Helvetica-Bold',
                textTransform: 'uppercase', color: '#1A1A2E',
                letterSpacing: 1, marginBottom: 10,
              }}>
                Inventory comparison
              </Text>

              {/* Summary pills */}
              <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12 }}>
                {[
                  { label: 'OK', status: 'ok', bg: '#EEFAD5', color: '#3A7A00' },
                  { label: 'Damaged', status: 'damaged', bg: '#FFF8DC', color: '#8A6000' },
                  { label: 'Missing', status: 'missing', bg: '#FEE2E2', color: '#7A0000' },
                ].map(({ label, status, bg, color }) => (
                  <View key={status} style={{
                    flex: 1, backgroundColor: bg,
                    padding: 8, borderRadius: 8, alignItems: 'center',
                  }}>
                    <Text style={{ fontSize: 14, fontFamily: 'Helvetica-Bold', color }}>
                      {inventorySnapshots.filter(i => i.status_checkout === status).length}
                    </Text>
                    <Text style={{ fontSize: 7, color, marginTop: 2 }}>{label}</Text>
                  </View>
                ))}
              </View>

              {/* Column headers */}
              <View style={{
                flexDirection: 'row', paddingBottom: 4, marginBottom: 4,
                borderBottomWidth: 0.5, borderBottomColor: '#E5E5E5',
              }}>
                <Text style={{ flex: 3, fontSize: 7, color: '#9B9BA8', textTransform: 'uppercase', letterSpacing: 0.5 }}>Item</Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#9B9BA8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>At check-in</Text>
                <Text style={{ flex: 1, fontSize: 7, color: '#9B9BA8', textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5 }}>Status</Text>
              </View>

              {inventorySnapshots.map((item, i) => (
                <View key={i} style={{
                  flexDirection: 'row', alignItems: 'center',
                  paddingVertical: 7,
                  borderBottomWidth: 0.5,
                  borderBottomColor: '#F3F3F8',
                  backgroundColor:
                    item.status_checkout === 'missing' ? '#FEF2F2' :
                    item.status_checkout === 'damaged' ? '#FFFBEB' : 'transparent',
                  borderRadius: 4,
                  paddingHorizontal: item.status_checkout !== 'ok' ? 6 : 0,
                  marginBottom: 2,
                }}>
                  <Text style={{ flex: 3, fontSize: 9, color: '#1A1A2E' }}>
                    {item.name}{(item.quantity ?? 1) > 1 ? ` (x${item.quantity})` : ''}
                  </Text>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      backgroundColor:
                        item.condition_checkin === 'good' ? '#EEFAD5' :
                        item.condition_checkin === 'fair' ? '#FFF8DC' : '#FEE2E2',
                      paddingHorizontal: 5, paddingVertical: 2, borderRadius: 99,
                    }}>
                      <Text style={{
                        fontSize: 7, fontFamily: 'Helvetica-Bold',
                        color:
                          item.condition_checkin === 'good' ? '#3A7A00' :
                          item.condition_checkin === 'fair' ? '#8A6000' : '#7A0000',
                      }}>
                        {item.condition_checkin ?? '—'}
                      </Text>
                    </View>
                  </View>
                  <View style={{ flex: 1, alignItems: 'center' }}>
                    <View style={{
                      backgroundColor:
                        item.status_checkout === 'ok'      ? '#EEFAD5' :
                        item.status_checkout === 'damaged' ? '#FFF8DC' : '#FEE2E2',
                      paddingHorizontal: 6, paddingVertical: 2, borderRadius: 99,
                    }}>
                      <Text style={{
                        fontSize: 8, fontFamily: 'Helvetica-Bold',
                        color:
                          item.status_checkout === 'ok'      ? '#3A7A00' :
                          item.status_checkout === 'damaged' ? '#8A6000' : '#7A0000',
                      }}>
                        {item.status_checkout === 'ok'      ? 'OK' :
                         item.status_checkout === 'damaged' ? 'Damaged' :
                         item.status_checkout === 'missing' ? 'Missing' : '-'}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )}

        <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>SHA-256: {shortHash} · Page 2</Text>
        </View>
      </Page>

      {/* ROOM PAGES — max 2 pairs per page, objectFit contain + aspect from DB */}
      {roomPageEntries.map((entry, globalIdx) => {
        const { room, roomIndex, chunk, chunkIdx, totalRoomPages, verdict, coIssues, coPhotoCount } = entry;

        return (
          <Page key={`${room.id}-${chunkIdx}-${globalIdx}`} size="A4" style={s.page} wrap={false}>
            <View
              style={{
                backgroundColor: tokens.primary,
                paddingTop: 14,
                paddingBottom: 12,
                paddingHorizontal: 30,
                marginBottom: 14,
                position: "relative",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  position: "absolute",
                  right: -20,
                  top: -20,
                  width: 80,
                  height: 80,
                  borderRadius: 40,
                  borderWidth: 16,
                  borderColor: tokens.primaryDark,
                }}
              />
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <View>
                  <Text
                    style={{
                      fontSize: 7,
                      color: "rgba(255,255,255,0.6)",
                      textTransform: "uppercase",
                      letterSpacing: 1,
                      marginBottom: 3,
                    }}
                  >
                    ROOM {String(roomIndex + 1).padStart(2, "0")} OF {String(roomStats.length).padStart(2, "0")}
                    {totalRoomPages > 1 ? ` · Page ${chunkIdx + 1}/${totalRoomPages}` : ""}
                  </Text>
                  <Text
                    style={{
                      fontSize: 18,
                      fontFamily: "Helvetica-Bold",
                      color: "#FFFFFF",
                      marginBottom: 4,
                    }}
                  >
                    {room.name}
                  </Text>
                  <View style={{ flexDirection: "row" }}>
                    <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.6)", marginRight: 14 }}>
                      {coPhotoCount} photos captured
                    </Text>
                    <Text style={{ fontSize: 7, color: "rgba(255,255,255,0.6)" }}>
                      {coIssues} {coIssues === 1 ? "issue" : "issues"} flagged
                    </Text>
                  </View>
                </View>
                {chunkIdx === 0 && (
                  <View
                    style={{
                      backgroundColor: verdict.bg,
                      borderRadius: 20,
                      paddingHorizontal: 10,
                      paddingVertical: 4,
                    }}
                  >
                    <Text style={{ fontSize: 8, fontFamily: "Helvetica-Bold", color: verdict.color }}>
                      {verdict.label}
                    </Text>
                  </View>
                )}
              </View>
            </View>

            <View style={{ paddingHorizontal: 30, flex: 1 }}>
              {chunk.length === 0 && (
                <Text style={{ fontSize: 8, color: "#9B9BA8" }}>No photos in this room.</Text>
              )}
              {chunk.map((pair, pairIdx) => (
                <View
                  key={pairIdx}
                  style={{
                    marginBottom: pairIdx < chunk.length - 1 ? PAIR_GAP : 0,
                    paddingBottom: pairIdx < chunk.length - 1 ? PAIR_GAP : 0,
                    borderBottomWidth: pairIdx < chunk.length - 1 ? 0.5 : 0,
                    borderBottomColor: "#EEECFF",
                  }}
                >
                  {pair.type === "new" ? (
                    <View style={{ flexDirection: "row" }}>
                      <View style={{ width: COL_W, marginRight: 10 }}>
                        <View
                          style={{
                            backgroundColor: "#F3F3F8",
                            borderRadius: 3,
                            paddingHorizontal: 8,
                            paddingVertical: 3,
                            marginBottom: 5,
                            alignSelf: "flex-start",
                          }}
                        >
                          <Text
                            style={{
                              fontSize: 6.5,
                              fontFamily: "Helvetica-Bold",
                              color: "#9B9BA8",
                              textTransform: "uppercase",
                              letterSpacing: 0.5,
                            }}
                          >
                            Check-in
                          </Text>
                        </View>
                        {(() => {
                          const sz = calcPhotoSize(pair.coPhoto, COL_W, PAIR_MAX_H);
                          return (
                            <View
                              style={{
                                width: sz.w,
                                height: sz.h,
                                backgroundColor: "#F8F7F4",
                                borderRadius: 3,
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 5,
                              }}
                            >
                              <Text style={{ fontSize: 7, color: "#C4C4C4" }}>Not photographed</Text>
                              <Text style={{ fontSize: 6, color: "#D1D5DB", marginTop: 3 }}>
                                at check-in
                              </Text>
                            </View>
                          );
                        })()}
                      </View>

                      <View style={{ width: COL_W }}>
                        <View
                          style={{
                            flexDirection: "row",
                            alignItems: "center",
                            marginBottom: 5,
                          }}
                        >
                          <View
                            style={{
                              backgroundColor: "#FEE2E2",
                              borderRadius: 3,
                              paddingHorizontal: 6,
                              paddingVertical: 2,
                              marginRight: 4,
                            }}
                          >
                            <Text
                              style={{
                                fontSize: 6.5,
                                fontFamily: "Helvetica-Bold",
                                color: "#DC2626",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                              }}
                            >
                              New damage
                            </Text>
                          </View>
                        </View>
                        {isHttpsImageUrl(pair.coPhoto.url) &&
                          (() => {
                            const sz = calcPhotoSize(pair.coPhoto, COL_W, PAIR_MAX_H);
                            return (
                              <View style={{ marginBottom: 5, position: "relative" }}>
                                <Image
                                  src={pair.coPhoto.url}
                                  style={{
                                    width: sz.w,
                                    height: sz.h,
                                    objectFit: "contain",
                                    backgroundColor: "#F8F7F4",
                                    borderRadius: 3,
                                    borderWidth: 1.5,
                                    borderColor: "#DC2626",
                                  }}
                                />
                                {pair.coPhoto.taken_at && (
                                  <View
                                    style={{
                                      position: "absolute",
                                      bottom: 4,
                                      right: 4,
                                      backgroundColor: "rgba(0,0,0,0.45)",
                                      borderRadius: 3,
                                      paddingHorizontal: 4,
                                      paddingVertical: 2,
                                    }}
                                  >
                                    <Text style={{ fontSize: 6, color: "#FFFFFF", fontFamily: "Helvetica" }}>
                                      {formatDate(pair.coPhoto.taken_at, true)}
                                    </Text>
                                  </View>
                                )}
                              </View>
                            );
                          })()}

                        {pair.coPhoto.damage_tags && pair.coPhoto.damage_tags.length > 0 && (
                          <View
                            style={{
                              flexDirection: "row",
                              flexWrap: "wrap",
                              marginTop: 4,
                              marginBottom: 4,
                            }}
                          >
                            {pair.coPhoto.damage_tags.map((tag: string, ti: number) => (
                              <View
                                key={ti}
                                style={{
                                  backgroundColor: "#FEE2E2",
                                  borderRadius: 20,
                                  paddingHorizontal: 5,
                                  paddingVertical: 1.5,
                                  marginRight: 3,
                                  marginBottom: 3,
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 6,
                                    fontFamily: "Helvetica-Bold",
                                    color: "#DC2626",
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {tag}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}

                        {pair.coPhoto.ai_analysis && (
                          <View>
                            <Text
                              style={{
                                fontSize: 6,
                                fontFamily: "Helvetica-Bold",
                                color: "#DC2626",
                                textTransform: "uppercase",
                                letterSpacing: 0.5,
                                marginBottom: 2,
                              }}
                            >
                              CHECK-IN → CHECK-OUT
                            </Text>
                            <Text style={{ fontSize: 7, color: "#4B4B4B", lineHeight: 1.4 }}>
                              {pair.coPhoto.ai_analysis}
                            </Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: "row" }}>
                      {(() => {
                        const coHasUrl =
                          pair.coPhoto != null && isHttpsImageUrl(pair.coPhoto.url);
                        const ciHasUrl =
                          pair.ciPhoto != null && isHttpsImageUrl(pair.ciPhoto.url);
                        const fallbackSz = calcPhotoSize(
                          { width: 1200, height: 900 },
                          COL_W,
                          PAIR_MAX_H
                        );
                        const coSz =
                          coHasUrl && pair.coPhoto
                            ? calcPhotoSize(pair.coPhoto, COL_W, PAIR_MAX_H)
                            : null;
                        const ciSz =
                          ciHasUrl && pair.ciPhoto
                            ? calcPhotoSize(pair.ciPhoto, COL_W, PAIR_MAX_H)
                            : null;
                        const noCiBox = coSz ?? fallbackSz;
                        const noCoBox = ciSz ?? fallbackSz;

                        return (
                          <>
                            <View style={{ width: COL_W, marginRight: 10 }}>
                              <View
                                style={{
                                  backgroundColor: "#F3F3F8",
                                  borderRadius: 3,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  marginBottom: 5,
                                  alignSelf: "flex-start",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 6.5,
                                    fontFamily: "Helvetica-Bold",
                                    color: "#6B7280",
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Check-in
                                </Text>
                              </View>

                              {ciHasUrl && pair.ciPhoto ? (
                                (() => {
                                  const sz = calcPhotoSize(pair.ciPhoto, COL_W, PAIR_MAX_H);
                                  const ciTs = photoTimestampLabel(
                                    pair.ciPhoto,
                                    checkinInspection?.created_at
                                  );
                                  return (
                                    <View style={{ marginBottom: 5, position: "relative" }}>
                                      <Image
                                        src={pair.ciPhoto.url}
                                        style={{
                                          width: sz.w,
                                          height: sz.h,
                                          objectFit: "contain",
                                          backgroundColor: "#F8F7F4",
                                          borderRadius: 3,
                                          opacity: 0.88,
                                        }}
                                      />
                                      {ciTs ? (
                                        <View style={PHOTO_TIMESTAMP_BADGE}>
                                          <Text style={PHOTO_TIMESTAMP_TEXT}>{ciTs}</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  );
                                })()
                              ) : (
                                <View
                                  style={{
                                    width: noCiBox.w,
                                    height: noCiBox.h,
                                    backgroundColor: "#F3F3F8",
                                    borderRadius: 3,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 5,
                                  }}
                                >
                                  <Text style={{ fontSize: 7, color: "#C4C4C4" }}>No photo</Text>
                                </View>
                              )}

                              {pair.ciPhoto?.damage_tags && pair.ciPhoto.damage_tags.length > 0 && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    marginBottom: 4,
                                  }}
                                >
                                  {pair.ciPhoto.damage_tags.map((tag, ti) => (
                                    <View
                                      key={ti}
                                      style={{
                                        backgroundColor: "#F3F3F8",
                                        borderRadius: 20,
                                        paddingHorizontal: 5,
                                        paddingVertical: 1.5,
                                        marginRight: 3,
                                        marginBottom: 2,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 6,
                                          fontFamily: "Helvetica-Bold",
                                          color: "#6B7280",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {tag}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                              {pair.ciPhoto?.ai_analysis && (
                                <View>
                                  <Text
                                    style={{
                                      fontSize: 6,
                                      fontFamily: "Helvetica-Bold",
                                      color: "#9B9BA8",
                                      textTransform: "uppercase",
                                      letterSpacing: 0.5,
                                      marginBottom: 2,
                                    }}
                                  >
                                    Check-in note
                                  </Text>
                                  <Text style={{ fontSize: 7, color: "#9B9BA8", lineHeight: 1.4 }}>
                                    {pair.ciPhoto.ai_analysis}
                                  </Text>
                                </View>
                              )}
                            </View>

                            <View style={{ width: COL_W }}>
                              <View
                                style={{
                                  backgroundColor: tokens.primaryUltraLight || "#EDE9FF",
                                  borderRadius: 3,
                                  paddingHorizontal: 6,
                                  paddingVertical: 2,
                                  marginBottom: 5,
                                  alignSelf: "flex-start",
                                }}
                              >
                                <Text
                                  style={{
                                    fontSize: 6.5,
                                    fontFamily: "Helvetica-Bold",
                                    color: tokens.primary,
                                    textTransform: "uppercase",
                                    letterSpacing: 0.5,
                                  }}
                                >
                                  Check-out
                                </Text>
                              </View>

                              {coHasUrl && pair.coPhoto ? (
                                (() => {
                                  const sz = calcPhotoSize(pair.coPhoto, COL_W, PAIR_MAX_H);
                                  const coTs = photoTimestampLabel(pair.coPhoto, inspection.created_at);
                                  return (
                                    <View style={{ marginBottom: 5, position: "relative" }}>
                                      <Image
                                        src={pair.coPhoto.url}
                                        style={{
                                          width: sz.w,
                                          height: sz.h,
                                          objectFit: "contain",
                                          backgroundColor: "#F8F7F4",
                                          borderRadius: 3,
                                          borderWidth: 1.5,
                                          borderColor: tokens.primary,
                                        }}
                                      />
                                      {coTs ? (
                                        <View style={PHOTO_TIMESTAMP_BADGE}>
                                          <Text style={PHOTO_TIMESTAMP_TEXT}>{coTs}</Text>
                                        </View>
                                      ) : null}
                                    </View>
                                  );
                                })()
                              ) : (
                                <View
                                  style={{
                                    width: noCoBox.w,
                                    height: noCoBox.h,
                                    backgroundColor: "#EDE9FF",
                                    borderRadius: 3,
                                    alignItems: "center",
                                    justifyContent: "center",
                                    marginBottom: 5,
                                  }}
                                >
                                  <Text style={{ fontSize: 7, color: tokens.primary }}>
                                    Not photographed
                                  </Text>
                                </View>
                              )}

                              {pair.coPhoto?.damage_tags && pair.coPhoto.damage_tags.length > 0 && (
                                <View
                                  style={{
                                    flexDirection: "row",
                                    flexWrap: "wrap",
                                    marginBottom: 4,
                                  }}
                                >
                                  {pair.coPhoto.damage_tags.map((tag, ti) => (
                                    <View
                                      key={ti}
                                      style={{
                                        backgroundColor: "#FEE2E2",
                                        borderRadius: 20,
                                        paddingHorizontal: 5,
                                        paddingVertical: 1.5,
                                        marginRight: 3,
                                        marginBottom: 2,
                                      }}
                                    >
                                      <Text
                                        style={{
                                          fontSize: 6,
                                          fontFamily: "Helvetica-Bold",
                                          color: "#DC2626",
                                          textTransform: "uppercase",
                                        }}
                                      >
                                        {tag}
                                      </Text>
                                    </View>
                                  ))}
                                </View>
                              )}

                              {pair.coPhoto?.ai_analysis && (
                                <View>
                                  <Text
                                    style={{
                                      fontSize: 6,
                                      fontFamily: "Helvetica-Bold",
                                      color: tokens.primary,
                                      textTransform: "uppercase",
                                      letterSpacing: 0.5,
                                      marginBottom: 2,
                                    }}
                                  >
                                    CHECK-IN → CHECK-OUT
                                  </Text>
                                  <Text style={{ fontSize: 7, color: "#4B4B4B", lineHeight: 1.4 }}>
                                    {pair.coPhoto.ai_analysis}
                                  </Text>
                                </View>
                              )}
                            </View>
                          </>
                        );
                      })()}
                    </View>
                  )}
                </View>
              ))}
            </View>

            <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]}>
              <View style={s.footerLeft}>
                <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
                <View style={s.footerDivider} />
                <Text style={s.footerUrl}>{agencyWebsite}</Text>
              </View>
              <Text style={s.footerRight}>
                SHA-256: {shortHash} · Page {3 + globalIdx} of {totalPages}
              </Text>
            </View>
          </Page>
        );
      })}

      {/* SIGNATURE PAGE */}
      <Page size="A4" style={s.page} wrap={false}>
        <View style={[s.sigHero, { backgroundColor: tokens.primary }]}>
          <View style={[s.sigHeroDeco, { borderColor: tokens.primaryDark }]} />
          <View style={s.sigHeroTop}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {agencyLogoUrl ? (
                <Image
                  src={agencyLogoUrl}
                  style={{
                    width: 40, height: 40, objectFit: "contain", borderRadius: 8,
                    marginRight: 10, backgroundColor: "rgba(255,255,255,0.15)",
                  }}
                />
              ) : null}
              <View>
                <Text style={s.sigLogoText}>{agencyName}</Text>
                <Text style={s.sigLogoSub}>PROPERTY INSPECTION REPORT</Text>
              </View>
            </View>
            <View
              style={[
                s.sigVerifiedBadge,
                {
                  backgroundColor:
                    sigE && isFullySigned(sigE, creatorPdfRole)
                      ? tokens.primaryLight
                      : "#F3F4F6",
                },
              ]}
            >
              <View
                style={[
                  s.sigVerifiedDot,
                  {
                    marginRight: 5,
                    backgroundColor:
                      sigE && isFullySigned(sigE, creatorPdfRole)
                        ? tokens.primary
                        : "#9CA3AF",
                  },
                ]}
              />
              <Text
                style={[
                  s.sigVerifiedText,
                  {
                    color:
                      sigE && isFullySigned(sigE, creatorPdfRole)
                        ? undefined
                        : "#6B7280",
                  },
                ]}
              >
                {sigE && isFullySigned(sigE, creatorPdfRole)
                  ? "Verified Document"
                  : "Pending Signatures"}
              </Text>
            </View>
          </View>
          <Text style={s.sigTitle}>
            This report has been reviewed{"\n"}and agreed upon by all parties.
          </Text>
          <Text style={s.sigSubtitle}>
            {property.building_name ?? property.location ?? "Property"} · {formatDate(inspection.created_at)}
          </Text>
        </View>

        <View style={s.sigBody}>
          {qrCodeDataUrl && (
            <View style={s.qrRow}>
              <View style={[s.qrBox, { marginRight: 14 }]}>
                <Image src={qrCodeDataUrl} style={s.qrImage} />
              </View>
              <View style={s.qrTextWrap}>
                <Text style={s.qrTextTitle}>Scan to verify this report</Text>
                <Text style={s.qrTextBody}>
                  View the original online version, verify document authenticity, and access the full digital record.
                  This QR code links directly to the inspection report on {agencyWebsite}.
                </Text>
              </View>
            </View>
          )}

          <View style={s.sigPartiesRow}>
            {(() => {
              const landlordSig = (signatures ?? []).find((s) => s.signer_type === "landlord");
              const tenantSig = (signatures ?? []).find((s) => s.signer_type === "tenant");
              const landlordImg =
                sigE?.landlord.data ?? landlordSig?.signature_data ?? null;
              const tenantImg = sigE?.tenant.data ?? tenantSig?.signature_data ?? null;
              const landlordSignedAt = sigE?.landlord.signedAt ?? landlordSig?.signed_at ?? null;
              const tenantSignedAt = sigE?.tenant.signedAt ?? tenantSig?.signed_at ?? null;
              const landlordRefusedAt = landlordSig?.refused_at ?? null;
              const tenantRefusedAt = tenantSig?.refused_at ?? null;
              const sigBoxStyle = {
                borderWidth: 1,
                borderStyle: "solid" as const,
                borderColor: "#E5E7EB",
                borderRadius: 4,
                height: 76,
                alignItems: "center" as const,
                justifyContent: "center" as const,
                backgroundColor: "#FAFAFA",
                marginBottom: 6,
              };
              const refusedSigBoxStyle = {
                borderWidth: 1,
                borderStyle: "solid" as const,
                borderColor: "#EF4444",
                borderRadius: 6,
                padding: 8,
                backgroundColor: "#FEF2F2",
                marginBottom: 6,
                alignItems: "flex-start" as const,
                justifyContent: "flex-start" as const,
              };
              return (
                <>
                  <View style={{ flex: 1, marginRight: 10 }}>
                    <Text
                      style={{
                        fontSize: 7,
                        color: tokens.primary,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        fontFamily: "Helvetica-Bold",
                        marginBottom: 4,
                      }}
                    >
                      Landlord
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Helvetica-Bold",
                        color: "#1A1A2E",
                        marginBottom: 8,
                      }}
                    >
                      {tenancy.landlord_name ?? "—"}
                    </Text>
                    <View style={landlordRefusedAt ? refusedSigBoxStyle : sigBoxStyle}>
                      {landlordRefusedAt ? (
                        <>
                          <Text style={{ fontSize: 8, fontWeight: "bold", color: "#EF4444" }}>
                            REFUSED TO SIGN
                          </Text>
                          {landlordSig?.refused_reason ? (
                            <Text
                              style={{
                                fontSize: 7,
                                color: "#DC2626",
                                marginTop: 3,
                                fontStyle: "italic",
                              }}
                            >
                              &quot;{landlordSig.refused_reason}&quot;
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 7, color: "#9B9BA8", marginTop: 3 }}>
                            {landlordRefusedAt
                              ? new Date(landlordRefusedAt).toLocaleDateString("en-AE", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </Text>
                        </>
                      ) : landlordImg ? (
                        <Image
                          src={landlordImg}
                          style={{ width: 160, height: 70, objectFit: "contain" }}
                        />
                      ) : (
                        <Text style={{ fontSize: 10, color: "#9CA3AF" }}>Pending Signature</Text>
                      )}
                    </View>
                    {landlordRefusedAt ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: "#EF4444",
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: "#EF4444", fontFamily: "Helvetica-Bold" }}>
                          Refused to sign
                        </Text>
                      </View>
                    ) : landlordSignedAt ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: tokens.primary,
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: tokens.primary, fontFamily: "Helvetica-Bold" }}>
                          Signed on {formatDate(landlordSignedAt, true)}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: "#E5E7EB",
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: "#9CA3AF" }}>Awaiting signature</Text>
                      </View>
                    )}
                  </View>

                  <View style={{ flex: 1, marginLeft: 10 }}>
                    <Text
                      style={{
                        fontSize: 7,
                        color: tokens.primary,
                        textTransform: "uppercase",
                        letterSpacing: 0.8,
                        fontFamily: "Helvetica-Bold",
                        marginBottom: 4,
                      }}
                    >
                      Tenant
                    </Text>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Helvetica-Bold",
                        color: "#1A1A2E",
                        marginBottom: 8,
                      }}
                    >
                      {tenancy.tenant_name ?? "—"}
                    </Text>
                    <View style={tenantRefusedAt ? refusedSigBoxStyle : sigBoxStyle}>
                      {tenantRefusedAt ? (
                        <>
                          <Text style={{ fontSize: 8, fontWeight: "bold", color: "#EF4444" }}>
                            REFUSED TO SIGN
                          </Text>
                          {tenantSig?.refused_reason ? (
                            <Text
                              style={{
                                fontSize: 7,
                                color: "#DC2626",
                                marginTop: 3,
                                fontStyle: "italic",
                              }}
                            >
                              &quot;{tenantSig.refused_reason}&quot;
                            </Text>
                          ) : null}
                          <Text style={{ fontSize: 7, color: "#9B9BA8", marginTop: 3 }}>
                            {tenantRefusedAt
                              ? new Date(tenantRefusedAt).toLocaleDateString("en-AE", {
                                  day: "numeric",
                                  month: "short",
                                  year: "numeric",
                                })
                              : ""}
                          </Text>
                        </>
                      ) : tenantImg ? (
                        <Image
                          src={tenantImg}
                          style={{ width: 160, height: 70, objectFit: "contain" }}
                        />
                      ) : (
                        <Text style={{ fontSize: 10, color: "#9CA3AF" }}>Pending Signature</Text>
                      )}
                    </View>
                    {tenantRefusedAt ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: "#EF4444",
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: "#EF4444", fontFamily: "Helvetica-Bold" }}>
                          Refused to sign
                        </Text>
                      </View>
                    ) : tenantSignedAt ? (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: tokens.primary,
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: tokens.primary, fontFamily: "Helvetica-Bold" }}>
                          Signed on {formatDate(tenantSignedAt, true)}
                        </Text>
                      </View>
                    ) : (
                      <View style={{ flexDirection: "row", alignItems: "center" }}>
                        <View
                          style={{
                            width: 5,
                            height: 5,
                            borderRadius: 2.5,
                            backgroundColor: "#E5E7EB",
                            marginRight: 4,
                          }}
                        />
                        <Text style={{ fontSize: 8, color: "#9CA3AF" }}>Awaiting signature</Text>
                      </View>
                    )}
                  </View>
                </>
              );
            })()}
          </View>

          {creatorPdfRole === "inspector" &&
            (() => {
            const inspectorName =
              sigE?.inspector.name ?? profile?.full_name ?? "—";

            const inspectorImg = sigE?.inspector.data ?? null;

            const inspectorSignedAtEmbed = sigE?.inspector.signedAt ?? null;
            const inspectorSignedAtLegacy = inspection.created_at ?? null;
            const inspectorSignedAt = inspectorSignedAtEmbed ?? inspectorSignedAtLegacy;
            return (
              <View
                style={{
                  borderTopWidth: 0.5,
                  borderTopColor: "#E5E7EB",
                  paddingTop: 14,
                  marginTop: 14,
                }}
              >
                <Text
                  style={{
                    fontSize: 7,
                    color: tokens.primary,
                    textTransform: "uppercase",
                    letterSpacing: 0.8,
                    fontFamily: "Helvetica-Bold",
                    marginBottom: 4,
                  }}
                >
                  Inspector
                </Text>

                <View style={{ flexDirection: "row", alignItems: "flex-start" }}>
                  <View style={{ flex: 1, marginRight: 20 }}>
                    <Text
                      style={{
                        fontSize: 9,
                        fontFamily: "Helvetica-Bold",
                        color: "#1A1A2E",
                        marginBottom: 2,
                      }}
                    >
                      {inspectorName}
                    </Text>
                    <Text style={{ fontSize: 8, color: "#6B7280", marginBottom: 6 }}>
                      {agencyName}
                      {profile?.rera_number ? ` · RERA #${profile.rera_number}` : ""}
                    </Text>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                      <View
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: 2.5,
                          backgroundColor: tokens.primary,
                          marginRight: 4,
                        }}
                      />
                      <Text style={{ fontSize: 7, color: tokens.primary, fontFamily: "Helvetica-Bold" }}>
                        {inspectorImg
                          ? `Signed on ${formatDate(inspectorSignedAt ?? inspection.created_at, true)}`
                          : `Report generated on ${formatDate(inspection.created_at, true)}`}
                      </Text>
                    </View>
                  </View>

                  <View style={{ width: 170 }}>
                    <View
                      style={{
                        borderWidth: 1,
                        borderStyle: "solid",
                        borderColor: "#E5E7EB",
                        borderRadius: 4,
                        height: 76,
                        alignItems: "center",
                        justifyContent: "center",
                        backgroundColor: "#FAFAFA",
                        marginBottom: 4,
                      }}
                    >
                      {inspectorImg ? (
                        <Image
                          src={inspectorImg}
                          style={{ width: 160, height: 70, objectFit: "contain" }}
                        />
                      ) : (
                        <Text style={{ fontSize: 10, color: "#9CA3AF" }}>Pending Signature</Text>
                      )}
                    </View>
                  </View>
                </View>
              </View>
            );
          })()}

          <View style={s.hashCard}>
            <Text style={s.hashLabel}>Document integrity — SHA-256 hash</Text>
            <View style={s.hashRow}>
              <View style={[s.hashIconBox, { backgroundColor: tokens.primaryUltraLight, marginRight: 6 }]}>
                <IconShield size={10} color={tokens.primary} />
              </View>
              <Text style={s.hashValue}>{documentHash}</Text>
            </View>
          </View>

          <Text style={s.disclaimer}>
            This report documents the condition of the property as observed at the time of inspection. It is based on
            a visual assessment only and does not constitute a structural, electrical, or plumbing survey. All parties
            are advised to review this report carefully. By signing, each party acknowledges the findings recorded
            herein. This document is generated electronically and verified by SHA-256 hash.
          </Text>
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>
            {formatDate(inspection.created_at)} · Page {totalPages} of {totalPages}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

/* ─────────────────────────────────────────────────────────────────────────────
   Export Functions
   ───────────────────────────────────────────────────────────────────────────── */

export async function renderCheckoutPDFToBuffer(props: CheckoutPDFProps): Promise<Buffer> {
  // Generate QR code if not provided
  let qrCodeDataUrl = props.qrCodeDataUrl;
  if (!qrCodeDataUrl) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.snagify.net";
    const reportUrl = `${appUrl}/verify/${props.inspection.id}`;
    try {
      qrCodeDataUrl = await QRCode.toDataURL(reportUrl, {
        width: 200,
        margin: 1,
        color: { dark: "#1a1a2e", light: "#FFFFFF" },
      });
    } catch {
      qrCodeDataUrl = undefined;
    }
  }

  const doc = <CheckoutPDFDocument {...props} qrCodeDataUrl={qrCodeDataUrl} />;
  return renderToBuffer(doc);
}
