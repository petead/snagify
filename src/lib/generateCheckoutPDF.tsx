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
} from "@react-pdf/renderer";
import type { BrandTokens } from "@/lib/pdf/brandTokens";
import { getPdfImageHeight } from "@/lib/photos/getImageDimensions";

interface CheckoutPhoto {
  id: string;
  url: string;
  damage_tags?: string[] | null;
  ai_analysis?: string | null;
  width?: number | null;
  height?: number | null;
  checkin_photo_id?: string | null;
  is_additional?: boolean;
  checkin_photo?: {
    url: string;
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

interface KeyHandoverItem {
  label?: string;
  name?: string;
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
    address: string;
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
  };
  rooms: CheckoutRoom[];
  signatures?: {
    signer_type: string;
    signer_name?: string;
    signature_data?: string;
  }[];
  profile?: {
    full_name?: string;
    rera_number?: string;
    signature_image_url?: string;
  };
  agencyName: string;
  agencyWebsite: string;
  agencyLogoUrl?: string | null;
  tokens: BrandTokens;
  qrCodeDataUrl?: string;
}

function formatDate(dateStr?: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function capitalise(str?: string | null): string {
  if (!str) return "—";
  return str.charAt(0).toUpperCase() + str.slice(1);
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

function getConditionDelta(
  checkinCond?: string | null,
  checkoutCond?: string | null
): "improved" | "unchanged" | "degraded" {
  const rank: Record<string, number> = {
    good: 0,
    needs_attention: 1,
    critical: 2,
  };
  const a = rank[checkinCond || "good"] ?? 0;
  const b = rank[checkoutCond || "good"] ?? 0;
  if (b < a) return "improved";
  if (b > a) return "degraded";
  return "unchanged";
}

function compareKeyHandover(
  checkin: KeyHandoverItem[],
  checkout: KeyHandoverItem[]
): Array<{
  label: string;
  checkinQty: number;
  checkoutQty: number;
  status: "returned" | "missing" | "extra";
  delta: number;
}> {
  const allLabels = Array.from(
    new Set([
      ...checkin.map((i) => i.label || i.name || ""),
      ...checkout.map((i) => i.label || i.name || ""),
    ])
  ).filter(Boolean);

  return allLabels.map((label) => {
    const ci = checkin.find((i) => (i.label || i.name) === label);
    const co = checkout.find((i) => (i.label || i.name) === label);
    const checkinQty = ci?.quantity ?? ci?.qty ?? 0;
    const checkoutQty = co?.quantity ?? co?.qty ?? 0;
    const delta = checkoutQty - checkinQty;
    const status = delta === 0 ? "returned" : delta < 0 ? "missing" : "extra";
    return { label, checkinQty, checkoutQty, status, delta };
  });
}

function countNewTags(photo: CheckoutPhoto): number {
  if (!photo.checkin_photo) return photo.damage_tags?.length ?? 0;
  const checkinTags = new Set(photo.checkin_photo.damage_tags ?? []);
  return (photo.damage_tags ?? []).filter((t) => !checkinTags.has(t)).length;
}

const s = StyleSheet.create({
  page: { backgroundColor: "#FFFFFF", fontFamily: "Helvetica" },
  hero: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 22,
    position: "relative",
    overflow: "hidden",
  },
  heroDeco1: {
    position: "absolute",
    right: -24,
    bottom: -24,
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 18,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.09)",
  },
  heroDeco2: {
    position: "absolute",
    right: 0,
    bottom: 0,
    width: 68,
    height: 68,
    borderRadius: 34,
    borderWidth: 11,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.05)",
  },
  heroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  heroLogoText: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  heroLogoSub: { fontSize: 6, color: "rgba(255,255,255,0.55)", marginTop: 2, letterSpacing: 0.4 },
  heroTypeBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    backgroundColor: "rgba(255,255,255,0.9)",
  },
  heroTypeBadgeText: { fontSize: 7, fontFamily: "Helvetica-Bold", letterSpacing: 1 },
  heroAddress: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.4,
    lineHeight: 1.25,
    marginTop: 16,
  },
  heroSub: { fontSize: 7.5, color: "rgba(255,255,255,0.6)", marginTop: 4 },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 7,
  },
  footerLeft: { flexDirection: "row", alignItems: "center" },
  footerAgency: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "rgba(255,255,255,0.8)" },
  footerDivider: {
    width: 1,
    height: 8,
    backgroundColor: "rgba(255,255,255,0.3)",
    marginHorizontal: 6,
  },
  footerUrl: { fontSize: 6, color: "rgba(255,255,255,0.5)" },
  footerRight: { fontSize: 6, color: "rgba(255,255,255,0.5)" },
  coverBody: { paddingHorizontal: 26, paddingVertical: 18 },
  overviewBody: { paddingHorizontal: 22, paddingTop: 14 },
  roomBody: { paddingHorizontal: 18, paddingTop: 12, paddingBottom: 8 },
  metaStrip: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    overflow: "hidden",
    marginBottom: 13,
  },
  metaCell: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 10,
  },
  metaCellBorder: { borderRightWidth: 0.5, borderRightColor: "#EEECFF" },
  metaIconBox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 8,
    marginTop: 1,
  },
  metaLabel: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#9B9BA8",
    marginBottom: 2,
  },
  metaValue: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  partiesRow: { flexDirection: "row", marginBottom: 13 },
  partyCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 10,
  },
  partyCardMargin: { marginRight: 8 },
  partyAvatar: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 9,
  },
  partyAvatarText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  partyRole: { fontSize: 6, textTransform: "uppercase", letterSpacing: 0.7, marginBottom: 3 },
  partyName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  partyEmail: { fontSize: 7, color: "#9B9BA8", marginTop: 1 },
  summaryCard: { borderRadius: 8, padding: 12, marginBottom: 13 },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  summaryDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  summaryLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryText: { fontSize: 7.5, color: "#374151", lineHeight: 1.65 },
  refCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 10,
  },
  refIconBox: {
    width: 26,
    height: 26,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
    marginRight: 10,
  },
  refLabel: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  refTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 2 },
  refHash: { fontSize: 6.5, color: "#9B9BA8" },
  ovHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 26,
    paddingVertical: 13,
  },
  ovTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  ovSub: { fontSize: 7, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  ovHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  statRow: { flexDirection: "row", marginBottom: 14 },
  statCard: {
    flex: 1,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 10,
    alignItems: "center",
    backgroundColor: "#FFFFFF",
  },
  statCardMargin: { marginRight: 8 },
  statIconBox: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },
  statNum: { fontSize: 20, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  statLbl: {
    fontSize: 5.5,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#9B9BA8",
    marginTop: 3,
  },
  sectionHd: { flexDirection: "row", alignItems: "center", marginBottom: 8 },
  sectionHdText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginRight: 8 },
  sectionHdLine: { flex: 1, height: 0.5, backgroundColor: "#EEECFF" },
  sectionHdMargin: { marginTop: 14 },
  cmpTable: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    marginBottom: 14,
  },
  cmpThead: { flexDirection: "row", paddingHorizontal: 9, paddingVertical: 7 },
  cmpTheadCell: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
  cmpRow: {
    flexDirection: "row",
    paddingHorizontal: 9,
    paddingVertical: 7,
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#F3F3F8",
  },
  cmpRowAlt: { backgroundColor: "#FAFBFF" },
  cmpCell: { fontSize: 7, color: "#374151" },
  cmpCellBold: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  deltaBadge: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  deltaBadgeText: { fontSize: 5.5, fontFamily: "Helvetica-Bold" },
  deltaUnchanged: { backgroundColor: "#F1F5F9" },
  deltaDegraded: { backgroundColor: "#FEE2E2" },
  deltaImproved: { backgroundColor: "#DCFCE7" },
  deltaUnchangedText: { color: "#475569" },
  deltaDegradedText: { color: "#DC2626" },
  deltaImprovedText: { color: "#15803D" },
  condBadgeGood: {
    backgroundColor: "#DCFCE7",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  condBadgeWarn: {
    backgroundColor: "#FEF9C3",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  condBadgeCrit: {
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  condTextGood: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#15803D" },
  condTextWarn: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#A16207" },
  condTextCrit: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#DC2626" },
  keyTable: {
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
  },
  keyThead: { flexDirection: "row", paddingHorizontal: 9, paddingVertical: 7 },
  keyTheadCell: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    color: "#FFFFFF",
  },
  keyRow: {
    flexDirection: "row",
    paddingHorizontal: 9,
    paddingVertical: 8,
    alignItems: "center",
    borderTopWidth: 0.5,
    borderTopColor: "#F3F3F8",
  },
  keyRowAlt: { backgroundColor: "#FAFBFF" },
  keyIconBox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 7,
    flexShrink: 0,
  },
  keyLabel: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  keyQtyOk: { fontSize: 7.5, color: "#374151" },
  keyQtyMiss: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#DC2626" },
  keyQtyExtra: { fontSize: 7.5, fontFamily: "Helvetica-Bold", color: "#15803D" },
  keyStatusOk: {
    backgroundColor: "#DCFCE7",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  keyStatusMiss: {
    backgroundColor: "#FEE2E2",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  keyStatusExtra: {
    backgroundColor: "#EDE9FF",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  keyStatusTextOk: { fontSize: 6, fontFamily: "Helvetica-Bold", color: "#15803D" },
  keyStatusTextMiss: { fontSize: 6, fontFamily: "Helvetica-Bold", color: "#DC2626" },
  keyStatusTextExtra: { fontSize: 6, fontFamily: "Helvetica-Bold", color: "#6D28D9" },
  roomHero: {
    paddingHorizontal: 26,
    paddingTop: 18,
    paddingBottom: 20,
    position: "relative",
    overflow: "hidden",
  },
  roomHeroDeco: {
    position: "absolute",
    right: -20,
    bottom: -20,
    width: 95,
    height: 95,
    borderRadius: 48,
    borderWidth: 16,
    borderStyle: "solid",
    borderColor: "rgba(255,255,255,0.09)",
  },
  roomHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  roomNumber: {
    fontSize: 6.5,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  roomTitle: {
    fontSize: 18,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  roomDate: { fontSize: 7, color: "rgba(255,255,255,0.6)", marginTop: 3 },
  roomStatsRow: { flexDirection: "row", marginTop: 12 },
  roomStatItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  roomStatDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.45)",
    marginRight: 5,
  },
  roomStatText: { fontSize: 7, color: "rgba(255,255,255,0.65)" },
  colLabelRow: { flexDirection: "row", marginBottom: 5 },
  colLabel: {
    flex: 1,
    borderRadius: 5,
    paddingVertical: 3,
    paddingHorizontal: 8,
    fontSize: 6,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    textAlign: "center",
  },
  colLabelCheckin: { backgroundColor: "#F1F5F9", color: "#475569" },
  colLabelCheckout: { backgroundColor: "#EDE9FF", color: "#6D28D9" },
  colLabelMargin: { marginRight: 8 },
  photoCmpRow: { flexDirection: "row", marginBottom: 6 },
  photoCmpCard: {
    flex: 1,
    borderRadius: 7,
    overflow: "hidden",
    borderWidth: 0.5,
    borderColor: "#EEECFF",
  },
  photoCmpCardDegraded: { borderColor: "#FECACA", borderWidth: 1 },
  photoCmpCardMargin: { marginRight: 8 },
  photoTagsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    padding: 6,
    paddingBottom: 4,
  },
  photoTag: {
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 1.5,
    marginRight: 3,
    marginBottom: 2,
  },
  photoTagText: {
    fontSize: 5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  photoTagRed: { backgroundColor: "#FEE2E2" },
  photoTagOrange: { backgroundColor: "#FEF3C7" },
  photoTagBlue: { backgroundColor: "#DBEAFE" },
  photoTagGray: { backgroundColor: "#F1F5F9" },
  photoTagTextRed: { color: "#DC2626" },
  photoTagTextOrange: { color: "#B45309" },
  photoTagTextBlue: { color: "#1D4ED8" },
  photoTagTextGray: { color: "#475569" },
  photoAiDivider: { height: 0.5, backgroundColor: "#F3F3F8" },
  photoAiWrap: { padding: 6 },
  photoAiLabel: {
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 2,
  },
  photoAiText: { fontSize: 6.5, color: "#6B7280", lineHeight: 1.55 },
  changeBadgeRow: {
    flexDirection: "row",
    justifyContent: "center",
    marginBottom: 10,
    marginTop: 2,
  },
  changeBadge: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  changeDot: { width: 5, height: 5, borderRadius: 2.5, marginRight: 5 },
  changeBadgeText: { fontSize: 6, fontFamily: "Helvetica-Bold" },
  changeDegraded: { backgroundColor: "#FEE2E2" },
  changeUnchanged: { backgroundColor: "#F1F5F9" },
  changeImproved: { backgroundColor: "#DCFCE7" },
  changeDegradedText: { color: "#DC2626" },
  changeUnchangedText: { color: "#475569" },
  changeImprovedText: { color: "#15803D" },
  additionalLabel: {
    fontSize: 6,
    color: "#9B9BA8",
    fontFamily: "Helvetica-Oblique",
    textAlign: "center",
    marginBottom: 4,
  },
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
    borderColor: "rgba(255,255,255,0.08)",
  },
  sigHeroTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
  },
  sigLogoText: {
    fontSize: 15,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.4,
  },
  sigLogoSub: { fontSize: 6.5, color: "rgba(255,255,255,0.55)", marginTop: 2 },
  sigVerifiedBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  sigVerifiedDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4ADE80",
    marginRight: 5,
  },
  sigVerifiedText: {
    fontSize: 6.5,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 0.3,
  },
  sigTitle: {
    fontSize: 13,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    lineHeight: 1.35,
  },
  sigSubtitle: { fontSize: 7.5, color: "rgba(255,255,255,0.6)", marginTop: 4 },
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
    marginRight: 14,
  },
  qrImage: { width: 48, height: 48 },
  qrTextTitle: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#1A1A2E",
    marginBottom: 4,
  },
  qrTextBody: { fontSize: 7, color: "#6B7280", lineHeight: 1.6 },
  sigPartiesRow: { flexDirection: "row", marginBottom: 10 },
  sigPartyCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 11,
  },
  sigPartyCardMargin: { marginRight: 8 },
  sigPartyRole: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigPartyName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A1A2E",
    marginBottom: 8,
  },
  sigSignArea: {
    height: 38,
    borderRadius: 5,
    borderWidth: 0.5,
    borderStyle: "dashed",
    borderColor: "#CCCCDD",
    alignItems: "center",
    justifyContent: "center",
  },
  sigSignPending: { fontSize: 6.5, color: "#9B9BA8", fontFamily: "Helvetica-Oblique" },
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
  sigInspectorLeft: { flex: 1, marginRight: 12 },
  sigInspectorRole: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigInspectorName: {
    fontSize: 8.5,
    fontFamily: "Helvetica-Bold",
    color: "#1A1A2E",
    marginBottom: 2,
  },
  sigInspectorAgency: { fontSize: 7, color: "#6B7280" },
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
    fontSize: 5.5,
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
    marginRight: 6,
  },
  hashValue: {
    fontSize: 6.5,
    color: "#374151",
    fontFamily: "Courier",
    lineHeight: 1.4,
  },
  disclaimer: {
    fontSize: 6,
    color: "#9B9BA8",
    lineHeight: 1.65,
    textAlign: "center",
    paddingHorizontal: 10,
    marginBottom: 8,
  },
});

function tagStyle(tag: string): { bg: object; text: object } {
  const t = tag.toLowerCase();
  if (["scratch", "crack", "broken", "missing"].includes(t))
    return { bg: s.photoTagRed, text: s.photoTagTextRed };
  if (["stain", "damp", "burn", "discoloration"].includes(t))
    return { bg: s.photoTagOrange, text: s.photoTagTextOrange };
  if (["mark", "wear"].includes(t)) return { bg: s.photoTagBlue, text: s.photoTagTextBlue };
  return { bg: s.photoTagGray, text: s.photoTagTextGray };
}

export function CheckoutPDFDocument({
  inspection,
  checkinInspection,
  property,
  tenancy,
  rooms,
  signatures,
  profile,
  agencyName,
  agencyWebsite,
  agencyLogoUrl: _agencyLogoUrl,
  tokens,
  qrCodeDataUrl,
}: CheckoutPDFProps) {
  const totalPages = rooms.length + 3;
  const keyComparison = compareKeyHandover(
    inspection.checkin_key_handover ?? [],
    inspection.key_handover ?? []
  );
  const newIssuesCount = rooms.filter(
    (r) => getConditionDelta(r.checkin_condition, r.condition) === "degraded"
  ).length;
  const unchangedCount = rooms.filter(
    (r) => getConditionDelta(r.checkin_condition, r.condition) === "unchanged"
  ).length;
  const totalPhotos = rooms.reduce((sum, r) => sum + r.photos.length, 0);
  const _missingKeys = keyComparison.filter((k) => k.status === "missing").length;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <View style={[s.hero, { backgroundColor: tokens.primary }]}>
          <View style={s.heroDeco1} />
          <View style={s.heroDeco2} />
          <View style={s.heroTop}>
            <View>
              <Text style={s.heroLogoText}>{agencyName}</Text>
              <Text style={s.heroLogoSub}>PROPERTY INSPECTION REPORT</Text>
            </View>
            <View style={s.heroTypeBadge}>
              <Text style={[s.heroTypeBadgeText, { color: tokens.primary }]}>CHECK-OUT</Text>
            </View>
          </View>
          <Text style={s.heroAddress}>{property.address}</Text>
          <Text style={s.heroSub}>
            {[property.building_name, property.unit_number, capitalise(property.property_type)]
              .filter(Boolean)
              .join(" · ")}
          </Text>
        </View>

        <View style={s.coverBody}>
          <View style={s.metaStrip}>
            {[
              {
                label: "Move-out date",
                value: formatDate(inspection.completed_at || inspection.created_at),
              },
              {
                label: "Tenancy duration",
                value: (() => {
                  if (!tenancy.contract_from || !tenancy.contract_to) return "—";
                  const months = Math.round(
                    (new Date(tenancy.contract_to).getTime() -
                      new Date(tenancy.contract_from).getTime()) /
                      (1000 * 60 * 60 * 24 * 30.44)
                  );
                  return `${months} month${months !== 1 ? "s" : ""}`;
                })(),
              },
              { label: "Check-in ref", value: formatDate(checkinInspection?.created_at) },
            ].map((item, i) => (
              <View key={i} style={[s.metaCell, ...(i < 2 ? [s.metaCellBorder] : [])]}>
                <View style={[s.metaIconBox, { backgroundColor: tokens.primaryUltraLight }]} />
                <View>
                  <Text style={[s.metaLabel, { color: tokens.primary }]}>{item.label}</Text>
                  <Text style={s.metaValue}>{item.value}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={s.partiesRow}>
            {[
              {
                role: "Landlord",
                name: tenancy.landlord_name,
                email: tenancy.landlord_email,
              },
              {
                role: "Tenant",
                name: tenancy.tenant_name,
                email: tenancy.tenant_email,
              },
            ].map((p, i) => (
              <View key={i} style={[s.partyCard, ...(i === 0 ? [s.partyCardMargin] : [])]}>
                <View style={[s.partyAvatar, { backgroundColor: tokens.primaryUltraLight }]}>
                  <Text style={[s.partyAvatarText, { color: tokens.primary }]}>
                    {getInitials(p.name)}
                  </Text>
                </View>
                <View>
                  <Text style={[s.partyRole, { color: tokens.primary }]}>
                    {p.role.toUpperCase()}
                  </Text>
                  <Text style={s.partyName}>{p.name}</Text>
                  <Text style={s.partyEmail}>{p.email}</Text>
                </View>
              </View>
            ))}
          </View>

          <View style={[s.summaryCard, { backgroundColor: tokens.primaryUltraLight }]}>
            <View style={s.summaryLabelRow}>
              <View style={[s.summaryDot, { backgroundColor: tokens.primary }]} />
              <Text style={[s.summaryLabel, { color: tokens.primary }]}>Executive Summary</Text>
            </View>
            <Text style={s.summaryText}>{inspection.executive_summary}</Text>
          </View>

          {checkinInspection && (
            <View style={s.refCard}>
              <View style={[s.refIconBox, { backgroundColor: tokens.primaryUltraLight }]}>
                <View
                  style={{
                    width: 10,
                    height: 10,
                    backgroundColor: tokens.primaryLight,
                    borderRadius: 2,
                  }}
                />
              </View>
              <View>
                <Text style={[s.refLabel, { color: tokens.primary }]}>Linked Check-In Report</Text>
                <Text style={s.refTitle}>
                  {property.address} · {formatDate(checkinInspection.created_at)}
                </Text>
                <Text style={s.refHash}>
                  SHA-256: {checkinInspection.document_hash?.slice(0, 16)}…
                  {checkinInspection.document_hash?.slice(-16)}
                </Text>
              </View>
            </View>
          )}
        </View>

        <View style={[s.footer, { backgroundColor: tokens.primaryDark }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>
            SHA-256: {inspection.document_hash?.slice(0, 8)}…{inspection.document_hash?.slice(-8)} ·
            Page 1 of {totalPages}
          </Text>
        </View>
      </Page>

      <Page size="A4" style={s.page}>
        <View style={[s.ovHeader, { backgroundColor: tokens.primary }]}>
          <View>
            <Text style={s.ovTitle}>Inspection Overview</Text>
            <Text style={s.ovSub}>
              Check-out · {property.address} · {formatDate(inspection.created_at)}
            </Text>
          </View>
          <View style={s.ovHeaderIcon}>
            <View
              style={{
                width: 14,
                height: 14,
                backgroundColor: "rgba(255,255,255,0.6)",
                borderRadius: 3,
              }}
            />
          </View>
        </View>

        <View style={s.overviewBody}>
          <View style={s.statRow}>
            {[
              {
                num: rooms.length,
                label: "Rooms",
                color: tokens.primary,
                bg: tokens.primaryUltraLight,
              },
              {
                num: totalPhotos,
                label: "Photos",
                color: tokens.primary,
                bg: tokens.primaryUltraLight,
              },
              {
                num: newIssuesCount,
                label: "New issues",
                color: newIssuesCount > 0 ? "#DC2626" : "#15803D",
                bg: newIssuesCount > 0 ? "#FEE2E2" : "#DCFCE7",
              },
              {
                num: unchangedCount,
                label: "Unchanged",
                color: "#15803D",
                bg: "#DCFCE7",
              },
            ].map((stat, i) => (
              <View key={i} style={[s.statCard, ...(i < 3 ? [s.statCardMargin] : [])]}>
                <View style={[s.statIconBox, { backgroundColor: stat.bg }]}>
                  <View
                    style={{
                      width: 12,
                      height: 12,
                      backgroundColor: stat.color,
                      borderRadius: 3,
                      opacity: 0.5,
                    }}
                  />
                </View>
                <Text style={[s.statNum, { color: stat.color }]}>{stat.num}</Text>
                <Text style={s.statLbl}>{stat.label}</Text>
              </View>
            ))}
          </View>

          <View style={s.sectionHd}>
            <Text style={s.sectionHdText}>Room comparison</Text>
            <View style={s.sectionHdLine} />
          </View>
          <View style={s.cmpTable}>
            <View style={[s.cmpThead, { backgroundColor: tokens.primary }]}>
              <Text style={[s.cmpTheadCell, { flex: 1.8 }]}>Room</Text>
              <Text style={[s.cmpTheadCell, { flex: 1.2 }]}>Check-in</Text>
              <Text style={[s.cmpTheadCell, { flex: 1.2 }]}>Check-out</Text>
              <Text style={[s.cmpTheadCell, { flex: 1.2 }]}>Delta</Text>
              <Text style={[s.cmpTheadCell, { flex: 2 }]}>New findings</Text>
            </View>
            {rooms.map((room, i) => {
              const delta = getConditionDelta(room.checkin_condition, room.condition);
              const deltaStyle =
                delta === "degraded"
                  ? s.deltaDegraded
                  : delta === "improved"
                    ? s.deltaImproved
                    : s.deltaUnchanged;
              const deltaTextStyle =
                delta === "degraded"
                  ? s.deltaDegradedText
                  : delta === "improved"
                    ? s.deltaImprovedText
                    : s.deltaUnchangedText;
              const deltaLabel =
                delta === "degraded"
                  ? "Degraded"
                  : delta === "improved"
                    ? "Improved"
                    : "Unchanged";

              const newTags = room.photos.flatMap((p) => {
                const checkinSet = new Set(p.checkin_photo?.damage_tags ?? []);
                return (p.damage_tags ?? []).filter((t) => !checkinSet.has(t));
              });
              const uniqueNewTags = Array.from(new Set(newTags)).slice(0, 3).join(", ");

              const condLabel =
                room.condition === "good"
                  ? "Good"
                  : room.condition === "needs_attention"
                    ? "Needs Attention"
                    : "Critical";
              const ciCondLabel =
                room.checkin_condition === "good"
                  ? "Good"
                  : room.checkin_condition === "needs_attention"
                    ? "Needs Attention"
                    : "Critical";
              const condBadge =
                room.condition === "good"
                  ? s.condBadgeGood
                  : room.condition === "needs_attention"
                    ? s.condBadgeWarn
                    : s.condBadgeCrit;
              const condText =
                room.condition === "good"
                  ? s.condTextGood
                  : room.condition === "needs_attention"
                    ? s.condTextWarn
                    : s.condTextCrit;
              const ciCondBadge =
                room.checkin_condition === "good"
                  ? s.condBadgeGood
                  : room.checkin_condition === "needs_attention"
                    ? s.condBadgeWarn
                    : s.condBadgeCrit;
              const ciCondText =
                room.checkin_condition === "good"
                  ? s.condTextGood
                  : room.checkin_condition === "needs_attention"
                    ? s.condTextWarn
                    : s.condTextCrit;

              return (
                <View key={room.id} style={[s.cmpRow, ...(i % 2 === 1 ? [s.cmpRowAlt] : [])]}>
                  <Text style={[s.cmpCellBold, { flex: 1.8 }]}>{room.name}</Text>
                  <View style={{ flex: 1.2 }}>
                    <View style={ciCondBadge}>
                      <Text style={ciCondText}>{ciCondLabel}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <View style={condBadge}>
                      <Text style={condText}>{condLabel}</Text>
                    </View>
                  </View>
                  <View style={{ flex: 1.2 }}>
                    <View style={[s.deltaBadge, deltaStyle]}>
                      <Text style={[s.deltaBadgeText, deltaTextStyle]}>{deltaLabel}</Text>
                    </View>
                  </View>
                  <Text
                    style={[
                      s.cmpCell,
                      {
                        flex: 2,
                        fontSize: 6.5,
                        color: uniqueNewTags ? "#DC2626" : "#9B9BA8",
                      },
                    ]}
                  >
                    {uniqueNewTags || "—"}
                  </Text>
                </View>
              );
            })}
          </View>

          <View style={[s.sectionHd, s.sectionHdMargin]}>
            <Text style={s.sectionHdText}>Key handover comparison</Text>
            <View style={s.sectionHdLine} />
          </View>
          <View style={s.keyTable}>
            <View style={[s.keyThead, { backgroundColor: tokens.primary }]}>
              <Text style={[s.keyTheadCell, { flex: 2 }]}>Item</Text>
              <Text style={[s.keyTheadCell, { flex: 1 }]}>Check-in qty</Text>
              <Text style={[s.keyTheadCell, { flex: 1 }]}>Check-out qty</Text>
              <Text style={[s.keyTheadCell, { flex: 1.5 }]}>Status</Text>
            </View>
            {keyComparison.map((item, i) => (
              <View key={i} style={[s.keyRow, ...(i % 2 === 1 ? [s.keyRowAlt] : [])]}>
                <View style={{ flex: 2, flexDirection: "row", alignItems: "center" }}>
                  <View style={[s.keyIconBox, { backgroundColor: tokens.primaryUltraLight }]}>
                    <View
                      style={{
                        width: 8,
                        height: 8,
                        backgroundColor: tokens.primaryLight,
                        borderRadius: 2,
                      }}
                    />
                  </View>
                  <Text style={s.keyLabel}>{item.label}</Text>
                </View>
                <Text style={[s.keyQtyOk, { flex: 1 }]}>×{item.checkinQty}</Text>
                <Text
                  style={[
                    item.status === "missing"
                      ? s.keyQtyMiss
                      : item.status === "extra"
                        ? s.keyQtyExtra
                        : s.keyQtyOk,
                    { flex: 1 },
                  ]}
                >
                  ×{item.checkoutQty}
                </Text>
                <View style={{ flex: 1.5 }}>
                  <View
                    style={
                      item.status === "missing"
                        ? s.keyStatusMiss
                        : item.status === "extra"
                          ? s.keyStatusExtra
                          : s.keyStatusOk
                    }
                  >
                    <Text
                      style={
                        item.status === "missing"
                          ? s.keyStatusTextMiss
                          : item.status === "extra"
                            ? s.keyStatusTextExtra
                            : s.keyStatusTextOk
                      }
                    >
                      {item.status === "missing"
                        ? `Missing ×${Math.abs(item.delta)}`
                        : item.status === "extra"
                          ? `Extra ×${item.delta}`
                          : "All returned"}
                    </Text>
                  </View>
                </View>
              </View>
            ))}
          </View>
        </View>

        <View style={[s.footer, { backgroundColor: tokens.primaryDark }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>
            SHA-256: {inspection.document_hash?.slice(0, 8)}…{inspection.document_hash?.slice(-8)}{" "}
            · Page 2 of {totalPages}
          </Text>
        </View>
      </Page>

      {rooms.map((room, roomIndex) => {
        const condBadge =
          room.condition === "good"
            ? s.condBadgeGood
            : room.condition === "needs_attention"
              ? s.condBadgeWarn
              : s.condBadgeCrit;
        const condText =
          room.condition === "good"
            ? s.condTextGood
            : room.condition === "needs_attention"
              ? s.condTextWarn
              : s.condTextCrit;
        const condLabel =
          room.condition === "good"
            ? "Good"
            : room.condition === "needs_attention"
              ? "Needs Attention"
              : "Critical";

        const newIssuesInRoom = room.photos.flatMap((p) => {
          const checkinSet = new Set(p.checkin_photo?.damage_tags ?? []);
          return (p.damage_tags ?? []).filter((t) => !checkinSet.has(t));
        }).length;

        const linkedPhotos = room.photos.filter(
          (p) => p.checkin_photo_id && p.checkin_photo
        );
        const additionalPhotos = room.photos.filter(
          (p) => !p.checkin_photo_id || !p.checkin_photo
        );

        const COL_W = 275;

        return (
          <Page key={room.id} size="A4" style={s.page}>
            <View style={[s.roomHero, { backgroundColor: tokens.primary }]}>
              <View style={s.roomHeroDeco} />
              <View style={s.roomHeroTop}>
                <View>
                  <Text style={s.roomNumber}>
                    Room {String(roomIndex + 1).padStart(2, "0")} of{" "}
                    {String(rooms.length).padStart(2, "0")}
                  </Text>
                  <Text style={s.roomTitle}>{room.name}</Text>
                  <Text style={s.roomDate}>
                    Check-out: {formatDate(inspection.created_at)}
                    {checkinInspection
                      ? `  ·  Check-in ref: ${formatDate(checkinInspection.created_at)}`
                      : ""}
                  </Text>
                </View>
                <View style={condBadge}>
                  <Text style={condText}>{condLabel}</Text>
                </View>
              </View>
              <View style={s.roomStatsRow}>
                <View style={s.roomStatItem}>
                  <View style={s.roomStatDot} />
                  <Text style={s.roomStatText}>
                    {room.photos.length} photo{room.photos.length !== 1 ? "s" : ""} captured
                  </Text>
                </View>
                <View style={s.roomStatItem}>
                  <View
                    style={[
                      s.roomStatDot,
                      {
                        backgroundColor:
                          newIssuesInRoom > 0 ? "#FCA5A5" : "rgba(255,255,255,0.45)",
                      },
                    ]}
                  />
                  <Text style={s.roomStatText}>
                    {newIssuesInRoom > 0
                      ? `${newIssuesInRoom} new issue${newIssuesInRoom !== 1 ? "s" : ""} vs check-in`
                      : "No new issues vs check-in"}
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.roomBody}>
              {linkedPhotos.length > 0 && (
                <>
                  <View style={s.colLabelRow}>
                    <View style={[s.colLabel, s.colLabelCheckin, s.colLabelMargin]}>
                      <Text>Check-in · {formatDate(checkinInspection?.created_at)}</Text>
                    </View>
                    <View
                      style={[
                        s.colLabel,
                        s.colLabelCheckout,
                        { backgroundColor: tokens.primaryUltraLight },
                      ]}
                    >
                      <Text style={{ color: tokens.primary }}>
                        Check-out · {formatDate(inspection.created_at)}
                      </Text>
                    </View>
                  </View>

                  {linkedPhotos.map((photo) => {
                    const photoDelta = getConditionDelta(
                      photo.checkin_photo?.damage_tags?.length
                        ? "needs_attention"
                        : "good",
                      photo.damage_tags?.length ? "needs_attention" : "good"
                    );
                    const newTags = (photo.damage_tags ?? []).filter(
                      (t) => !new Set(photo.checkin_photo?.damage_tags ?? []).has(t)
                    );
                    const ciH = getPdfImageHeight(
                      COL_W,
                      photo.checkin_photo?.width,
                      photo.checkin_photo?.height
                    );
                    const coH = getPdfImageHeight(COL_W, photo.width, photo.height);
                    const rowH = Math.max(ciH, coH);

                    return (
                      <View key={photo.id}>
                        <View style={s.photoCmpRow}>
                          <View style={[s.photoCmpCard, s.photoCmpCardMargin]}>
                            {photo.checkin_photo ? (
                              <Image
                                src={photo.checkin_photo.url}
                                style={{
                                  width: "100%",
                                  height: rowH,
                                  objectFit: "contain",
                                  backgroundColor: "#F8F8FC",
                                }}
                              />
                            ) : (
                              <View
                                style={{
                                  width: "100%",
                                  height: rowH,
                                  backgroundColor: "#F8F8FC",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <Text style={{ fontSize: 7, color: "#9B9BA8" }}>
                                  No check-in photo
                                </Text>
                              </View>
                            )}
                            {photo.checkin_photo?.damage_tags &&
                              photo.checkin_photo.damage_tags.length > 0 && (
                                <View style={s.photoTagsRow}>
                                  {photo.checkin_photo.damage_tags.map((tag, ti) => {
                                    const ts = tagStyle(tag);
                                    return (
                                      <View key={ti} style={[s.photoTag, ts.bg]}>
                                        <Text style={[s.photoTagText, ts.text]}>{tag}</Text>
                                      </View>
                                    );
                                  })}
                                </View>
                              )}
                            {photo.checkin_photo?.ai_analysis && (
                              <>
                                <View style={s.photoAiDivider} />
                                <View style={s.photoAiWrap}>
                                  <Text
                                    style={[s.photoAiLabel, { color: "#6B7280" }]}
                                  >
                                    AI Analysis
                                  </Text>
                                  <Text style={s.photoAiText}>
                                    {photo.checkin_photo.ai_analysis}
                                  </Text>
                                </View>
                              </>
                            )}
                          </View>

                          <View
                            style={[
                              s.photoCmpCard,
                              ...(newTags.length > 0 ? [s.photoCmpCardDegraded] : []),
                            ]}
                          >
                            <Image
                              src={photo.url}
                              style={{
                                width: "100%",
                                height: rowH,
                                objectFit: "contain",
                                backgroundColor:
                                  newTags.length > 0 ? "#FFF8F8" : "#F8F8FC",
                              }}
                            />
                            {photo.damage_tags && photo.damage_tags.length > 0 && (
                              <View style={s.photoTagsRow}>
                                {photo.damage_tags.map((tag, ti) => {
                                  const ts = tagStyle(tag);
                                  const isNew = !new Set(
                                    photo.checkin_photo?.damage_tags ?? []
                                  ).has(tag);
                                  return (
                                    <View
                                      key={ti}
                                      style={[s.photoTag, isNew ? s.photoTagRed : ts.bg]}
                                    >
                                      <Text
                                        style={[
                                          s.photoTagText,
                                          isNew ? s.photoTagTextRed : ts.text,
                                        ]}
                                      >
                                        {isNew ? `★ ${tag}` : tag}
                                      </Text>
                                    </View>
                                  );
                                })}
                              </View>
                            )}
                            {photo.ai_analysis && (
                              <>
                                <View style={s.photoAiDivider} />
                                <View style={s.photoAiWrap}>
                                  <Text
                                    style={[s.photoAiLabel, { color: tokens.primary }]}
                                  >
                                    AI Analysis
                                  </Text>
                                  <Text style={s.photoAiText}>{photo.ai_analysis}</Text>
                                </View>
                              </>
                            )}
                          </View>
                        </View>

                        <View style={s.changeBadgeRow}>
                          <View
                            style={[
                              s.changeBadge,
                              photoDelta === "degraded"
                                ? s.changeDegraded
                                : photoDelta === "improved"
                                  ? s.changeImproved
                                  : s.changeUnchanged,
                            ]}
                          >
                            <View
                              style={[
                                s.changeDot,
                                {
                                  backgroundColor:
                                    photoDelta === "degraded"
                                      ? "#DC2626"
                                      : photoDelta === "improved"
                                        ? "#15803D"
                                        : "#94A3B8",
                                },
                              ]}
                            />
                            <Text
                              style={[
                                s.changeBadgeText,
                                photoDelta === "degraded"
                                  ? s.changeDegradedText
                                  : photoDelta === "improved"
                                    ? s.changeImprovedText
                                    : s.changeUnchangedText,
                              ]}
                            >
                              {photoDelta === "degraded"
                                ? `Condition degraded — ${newTags.length} new tag${newTags.length !== 1 ? "s" : ""} vs check-in`
                                : photoDelta === "improved"
                                  ? "Condition improved vs check-in"
                                  : "Condition unchanged vs check-in"}
                            </Text>
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </>
              )}

              {additionalPhotos.length > 0 && (
                <>
                  <Text style={s.additionalLabel}>
                    Additional photos — no check-in counterpart
                  </Text>
                  {(() => {
                    const pairs: CheckoutPhoto[][] = [];
                    for (let i = 0; i < additionalPhotos.length; i += 2) {
                      pairs.push(additionalPhotos.slice(i, i + 2));
                    }
                    return pairs.map((pair, pIdx) => (
                      <View key={pIdx} style={s.photoCmpRow}>
                        {pair.map((photo, pi) => {
                          const h = getPdfImageHeight(
                            COL_W,
                            photo.width,
                            photo.height
                          );
                          return (
                            <View
                              key={photo.id}
                              style={[
                                s.photoCmpCard,
                                ...(pi === 0 && pair.length > 1
                                  ? [s.photoCmpCardMargin]
                                  : []),
                              ]}
                            >
                              <Image
                                src={photo.url}
                                style={{
                                  width: "100%",
                                  height: h,
                                  objectFit: "contain",
                                  backgroundColor: "#F8F8FC",
                                }}
                              />
                              {photo.damage_tags &&
                                photo.damage_tags.length > 0 && (
                                  <View style={s.photoTagsRow}>
                                    {photo.damage_tags.map((tag, ti) => {
                                      const ts = tagStyle(tag);
                                      return (
                                        <View
                                          key={ti}
                                          style={[s.photoTag, ts.bg]}
                                        >
                                          <Text
                                            style={[s.photoTagText, ts.text]}
                                          >
                                            {tag}
                                          </Text>
                                        </View>
                                      );
                                    })}
                                  </View>
                                )}
                              {photo.ai_analysis && (
                                <>
                                  <View style={s.photoAiDivider} />
                                  <View style={s.photoAiWrap}>
                                    <Text
                                      style={[s.photoAiLabel, { color: tokens.primary }]}
                                    >
                                      AI Analysis
                                    </Text>
                                    <Text style={s.photoAiText}>{photo.ai_analysis}</Text>
                                  </View>
                                </>
                              )}
                            </View>
                          );
                        })}
                      </View>
                    ));
                  })()}
                </>
              )}
            </View>

            <View style={[s.footer, { backgroundColor: tokens.primaryDark }]} fixed>
              <View style={s.footerLeft}>
                <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
                <View style={s.footerDivider} />
                <Text style={s.footerUrl}>{agencyWebsite}</Text>
              </View>
              <Text style={s.footerRight}>
                SHA-256: {inspection.document_hash?.slice(0, 8)}…
                {inspection.document_hash?.slice(-8)} · Page {roomIndex + 3} of {totalPages}
              </Text>
            </View>
          </Page>
        );
      })}

      <Page size="A4" style={s.page}>
        <View style={[s.sigHero, { backgroundColor: tokens.primary }]}>
          <View style={s.sigHeroDeco} />
          <View style={s.sigHeroTop}>
            <View>
              <Text style={s.sigLogoText}>{agencyName}</Text>
              <Text style={s.sigLogoSub}>PROPERTY INSPECTION REPORT</Text>
            </View>
            <View style={s.sigVerifiedBadge}>
              <View style={s.sigVerifiedDot} />
              <Text style={s.sigVerifiedText}>Verified Document</Text>
            </View>
          </View>
          <Text style={s.sigTitle}>
            This report has been reviewed{"\n"}and agreed upon by all parties.
          </Text>
          <Text style={s.sigSubtitle}>
            {property.address} · {formatDate(inspection.created_at)}
          </Text>
        </View>

        <View style={s.sigBody}>
          {qrCodeDataUrl && (
            <View style={s.qrRow}>
              <View style={s.qrBox}>
                <Image src={qrCodeDataUrl} style={s.qrImage} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.qrTextTitle}>Scan to verify this report</Text>
                <Text style={s.qrTextBody}>
                  View the online version, verify document authenticity, and access the full digital
                  record. This QR links directly to the inspection report on {agencyWebsite}.
                </Text>
              </View>
            </View>
          )}

          <View style={s.sigPartiesRow}>
            {[
              { role: "Landlord", name: tenancy.landlord_name, sigType: "landlord" },
              { role: "Tenant", name: tenancy.tenant_name, sigType: "tenant" },
            ].map((party, i) => {
              const sig = signatures?.find((s) => s.signer_type === party.sigType);
              return (
                <View
                  key={i}
                  style={[s.sigPartyCard, ...(i === 0 ? [s.sigPartyCardMargin] : [])]}
                >
                  <Text style={[s.sigPartyRole, { color: tokens.primary }]}>
                    {party.role.toUpperCase()}
                  </Text>
                  <Text style={s.sigPartyName}>{party.name}</Text>
                  <View style={s.sigSignArea}>
                    {sig?.signature_data ? (
                      <Image src={sig.signature_data} style={s.sigSignImage} />
                    ) : (
                      <Text style={s.sigSignPending}>Pending Signature</Text>
                    )}
                  </View>
                </View>
              );
            })}
          </View>

          {(() => {
            const inspectorSig = signatures?.find(
              (s) => s.signer_type === "inspector" || s.signer_type === "agent"
            );
            return (
              <View style={s.sigInspectorCard}>
                <View style={s.sigInspectorLeft}>
                  <Text style={[s.sigInspectorRole, { color: tokens.primary }]}>
                    INSPECTOR
                  </Text>
                  <Text style={s.sigInspectorName}>{profile?.full_name}</Text>
                  <Text style={s.sigInspectorAgency}>
                    {agencyName}
                    {profile?.rera_number ? ` · RERA #${profile.rera_number}` : ""}
                  </Text>
                </View>
                <View style={s.sigInspectorRight}>
                  <View style={s.sigInspectorSignBox}>
                    {inspectorSig?.signature_data ? (
                      <Image src={inspectorSig.signature_data} style={s.sigSignImage} />
                    ) : profile?.signature_image_url ? (
                      <Image src={profile.signature_image_url} style={s.sigSignImage} />
                    ) : (
                      <Text style={s.sigSignPending}>—</Text>
                    )}
                  </View>
                  <Text style={s.sigInspectorSignLabel}>Inspector signature</Text>
                </View>
              </View>
            );
          })()}

          <View style={s.hashCard}>
            <Text style={s.hashLabel}>Document integrity — SHA-256 hash</Text>
            <View style={s.hashRow}>
              <View
                style={[s.hashIconBox, { backgroundColor: tokens.primaryUltraLight }]}
              >
                <View
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: tokens.primaryLight,
                    borderRadius: 2,
                  }}
                />
              </View>
              <Text style={s.hashValue}>{inspection.document_hash}</Text>
            </View>
          </View>

          <Text style={s.disclaimer}>
            This report documents the condition of the property as observed at the time of
            inspection. It is based on a visual assessment only and does not constitute a structural,
            electrical, or plumbing survey. All parties are advised to review this report carefully.
            By signing, each party acknowledges the findings recorded herein. This document is
            generated electronically and verified by SHA-256 hash.
          </Text>
        </View>

        <View style={[s.footer, { backgroundColor: tokens.primaryDark }]} fixed>
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

export async function renderCheckoutPDFToBuffer(
  props: CheckoutPDFProps
): Promise<Buffer> {
  const doc = <CheckoutPDFDocument {...props} />;
  return renderToBuffer(doc);
}
