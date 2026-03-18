/* eslint-disable jsx-a11y/alt-text */
import React from "react";
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
  renderToBuffer,
  Svg,
  Path,
  Circle,
  Rect,
  G,
} from "@react-pdf/renderer";
import QRCode from "qrcode";
import { getBrandTokens } from "@/lib/pdf/brandTokens";
import { getPdfImageHeight } from "@/lib/photos/getImageDimensions";

const PURPLE = "#9A88FD";
const GREEN = "#cafe87";
const YELLOW = "#FEDE80";
const RED = "#FFD5D5";
const DARK = "#1A1A1A";
const LIGHT_PURPLE = "#F0EDFF";

const s = StyleSheet.create({
  page: { padding: 40, fontFamily: "Helvetica", fontSize: 10, color: DARK },

  /* Cover */
  coverHeader: {
    backgroundColor: PURPLE,
    marginHorizontal: -40,
    marginTop: -40,
    paddingVertical: 50,
    paddingHorizontal: 40,
    alignItems: "center",
  },
  coverTitle: { fontSize: 36, fontFamily: "Helvetica-Bold", color: "#fff" },
  coverSubtitle: { fontSize: 16, color: "#fff", marginTop: 6, opacity: 0.9 },
  typeBadge: {
    backgroundColor: GREEN,
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 16,
    marginTop: 14,
  },
  typeBadgeText: { fontSize: 12, fontFamily: "Helvetica-Bold", color: DARK },
  coverBody: { marginTop: 30 },
  coverAddress: { fontSize: 20, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  coverUnit: { fontSize: 13, color: "#666", marginBottom: 16 },
  coverRow: { flexDirection: "row", marginBottom: 5 },
  coverLabel: { width: 130, fontSize: 10, color: "#888" },
  coverValue: { fontSize: 10, fontFamily: "Helvetica-Bold" },
  twoCol: { flexDirection: "row", marginTop: 16, gap: 20 },
  colHalf: { flex: 1 },
  colTitle: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: PURPLE,
    marginBottom: 4,
    textTransform: "uppercase",
  },
  divider: { height: 2, backgroundColor: PURPLE, marginVertical: 20, borderRadius: 1 },

  /* Hero cover (Page 1 redesign) */
  coverHero: {
    backgroundColor: PURPLE,
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
  coverLogoIconBox: {
    width: 70,
    height: 70,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.15)",
    marginRight: 12,
  },
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
    color: "#FFFFFF",
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

  /* Page 2 overview redesign */
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  overviewTitleNew: { fontSize: 16, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  overviewSub: { fontSize: 8.5, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  overviewHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
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
  sectionHd: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 28,
    marginTop: 16,
    marginBottom: 8,
  },
  sectionHdText: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginRight: 8 },
  sectionHdLine: { flex: 1, height: 0.5, backgroundColor: "#EEECFF" },
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
  condBadgeNew: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  condBadgeTextNew: { fontSize: 7.5, fontFamily: "Helvetica-Bold" },
  keysCard: {
    marginHorizontal: 28,
    backgroundColor: "#FAFBFF",
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 12,
  },
  keysGrid: { flexDirection: "row", justifyContent: "space-around" },
  keyItem: { alignItems: "center" },
  keyIconBox: {
    width: 32,
    height: 32,
    borderRadius: 9,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  keyLabel: { fontSize: 8, color: "#9B9BA8", textAlign: "center" },
  keyQty: { fontSize: 12, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },

  /* Room hero (pages 3–N) */
  roomHero: {
    paddingHorizontal: 28,
    paddingTop: 20,
    paddingBottom: 22,
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
    fontSize: 8,
    textTransform: "uppercase",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.55)",
    marginBottom: 4,
  },
  roomTitle: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  roomDate: {
    fontSize: 9,
    color: "rgba(255,255,255,0.6)",
    marginTop: 3,
  },
  roomCondBadgeGood: {
    backgroundColor: "#DCFCE7",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  roomCondBadgeWarn: {
    backgroundColor: "#FEF9C3",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  roomCondBadgeCritical: {
    backgroundColor: "#FEE2E2",
    borderRadius: 20,
    paddingHorizontal: 11,
    paddingVertical: 5,
  },
  roomCondTextGood: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#15803D" },
  roomCondTextWarn: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#A16207" },
  roomCondTextCritical: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#DC2626" },
  roomStatsRow: { flexDirection: "row", marginTop: 14 },
  roomStatItem: { flexDirection: "row", alignItems: "center" },
  roomStatDot: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: "rgba(255,255,255,0.45)",
  },
  roomStatText: { fontSize: 8.5, color: "rgba(255,255,255,0.65)" },

  /* Room body */
  roomBody: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 8 },
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
  photoImg: {
    width: "100%",
    height: 110,
    objectFit: "cover",
  },
  photoImgFull: {
    width: "100%",
    height: 130,
    objectFit: "cover",
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
  photoTagRed: { backgroundColor: "#FEE2E2" },
  photoTagOrange: { backgroundColor: "#FEF3C7" },
  photoTagBlue: { backgroundColor: "#DBEAFE" },
  photoTagGray: { backgroundColor: "#F1F5F9" },
  photoTagTextRed: { color: "#DC2626" },
  photoTagTextOrange: { color: "#B45309" },
  photoTagTextBlue: { color: "#1D4ED8" },
  photoTagTextGray: { color: "#475569" },
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
    backgroundColor: "#4ADE80",
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

  /* Executive summary */
  summaryBox: {
    backgroundColor: LIGHT_PURPLE,
    padding: 16,
    borderRadius: 8,
    marginBottom: 16,
  },
  summaryTitle: { fontSize: 13, fontFamily: "Helvetica-Bold", color: PURPLE, marginBottom: 6 },
  summaryText: { fontSize: 10, lineHeight: 1.5 },

  /* Condition badge */
  condBadge: { alignSelf: "center", paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20, marginBottom: 10 },
  condBadgeText: { fontSize: 16, fontFamily: "Helvetica-Bold" },

  /* Risk */
  riskRow: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 6, justifyContent: "center" },
  riskLabel: { fontSize: 12, fontFamily: "Helvetica-Bold" },
  riskBarBg: { height: 10, flex: 1, backgroundColor: "#E5E7EB", borderRadius: 5, maxWidth: 200 },
  riskBarFill: { height: 10, borderRadius: 5 },

  /* Room section */
  roomHeader: {
    backgroundColor: PURPLE,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 6,
    marginBottom: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  roomName: { fontSize: 14, fontFamily: "Helvetica-Bold", color: "#fff" },
  roomCondBadge: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 10 },
  roomCondText: { fontSize: 9, fontFamily: "Helvetica-Bold" },
  roomSummary: { fontSize: 10, lineHeight: 1.5, marginBottom: 10 },
  roomMetaLine: { fontSize: 9, color: "#666", marginBottom: 8 },

  /* Recap / overview table */
  overviewTitle: { fontSize: 18, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 12 },
  tableWrap: { borderWidth: 1, borderColor: "#eeeeee", borderRadius: 6, overflow: "hidden" },
  tableHeaderRow: { flexDirection: "row", backgroundColor: "#f5f5f5", borderBottomWidth: 1, borderBottomColor: "#eeeeee" },
  tableHeaderCell: { fontSize: 9, fontFamily: "Helvetica-Bold", color: "#444", paddingVertical: 7, paddingHorizontal: 6 },
  tableRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#f0f0f0" },
  tableCell: { fontSize: 9, color: "#444", paddingVertical: 6, paddingHorizontal: 6 },
  tableSummary: { fontSize: 10, color: "#666", marginTop: 10 },

  /* Photo grid */
  photoRow: { flexDirection: "row", gap: 12, marginTop: 10, marginBottom: 6 },
  photoBlock: { flex: 1 },
  photoPlaceholder: {
    height: 100,
    backgroundColor: "#F0F0F0",
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  photoCaption: { fontSize: 8, color: "#666", marginTop: 3 },

  /* Recommendations box */
  recsBox: { backgroundColor: YELLOW, padding: 12, borderRadius: 8, marginTop: 10 },
  recsTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", marginBottom: 4 },
  recItem: { fontSize: 9, marginBottom: 2 },

  /* Signatures page */
  sigSection: { alignItems: "center", marginTop: 30 },
  sigStatement: { fontSize: 11, textAlign: "center", marginBottom: 24, lineHeight: 1.5 },
  sigGrid: { flexDirection: "row", gap: 30, marginBottom: 30, width: "100%" },
  sigBox: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    minHeight: 120,
  },
  sigRole: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PURPLE, marginBottom: 8, textTransform: "uppercase" },
  sigName: { fontSize: 10, marginBottom: 12 },
  sigPending: { fontSize: 10, color: "#999", fontStyle: "italic" },
  qrWrap: { alignItems: "center", marginBottom: 14 },
  qrLabel: { fontSize: 8, color: "#999", marginTop: 4 },
  disclaimerWrap: {
    width: "100%",
    borderTopWidth: 1,
    borderTopColor: "#eeeeee",
    marginTop: 8,
    paddingTop: 10,
    alignItems: "center",
  },
  disclaimerText: {
    fontSize: 9,
    color: "#999",
    textAlign: "center",
    lineHeight: 1.45,
    maxWidth: "80%",
  },

  /* Footer */
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, alignItems: "center" },
  footerText: { fontSize: 8, color: "#999" },
  hashText: { fontSize: 7, color: "#BBB", marginTop: 4, fontFamily: "Courier" },

  /* Legal notes */
  legalBox: { backgroundColor: LIGHT_PURPLE, padding: 14, borderRadius: 8, marginTop: 12, marginBottom: 12 },
  legalTitle: { fontSize: 10, fontFamily: "Helvetica-Bold", color: PURPLE, marginBottom: 4 },
  legalText: { fontSize: 9, lineHeight: 1.5, color: "#444" },

  sectionGap: { height: 20 },
});

function conditionColor(cond?: string) {
  if (!cond) return { bg: "#E5E7EB", text: DARK };
  const c = cond.charAt(0).toUpperCase() + cond.slice(1).toLowerCase();
  if (c === "Excellent") return { bg: "#4CAF50", text: DARK };
  if (c === "Good") return { bg: "#8BC34A", text: DARK };
  if (c === "Fair") return { bg: "#FF9800", text: DARK };
  if (c === "Needs attention") return { bg: "#F44336", text: "#fff" };
  return { bg: "#F44336", text: "#fff" };
}

/** Room condition from photos (damage tags). Used for PDF room badges. */
function getRoomCondition(photos: { damage_tags?: string[] }[]): string {
  const photosWithIssues = photos.filter(
    (p) => (p.damage_tags?.length ?? 0) > 0
  ).length;
  if (photosWithIssues === 0) return "Excellent";

  const severeTags = ["BROKEN", "HOLE", "WATER_DAMAGE", "MOLD"];
  const hasSevere = photos.some((p) =>
    (p.damage_tags ?? []).some((t) => severeTags.includes(String(t).toUpperCase()))
  );
  if (hasSevere) return "Needs Attention";
  if (photos.length === 0) return "Good";
  if (photosWithIssues / photos.length >= 0.5) return "Fair";
  return "Good";
}

/** Avoid showing notes that contradict damage tags (e.g. "good condition" when tags exist). */
function photoDisplayNote(photo: { notes?: string | null; damage_tags?: string[] }): string {
  const notes = (photo.notes ?? "").trim();
  const tags = photo.damage_tags ?? [];
  const hasContradiction =
    tags.length > 0 &&
    /good condition|no visible defects|no damage|appears clean|no issues/i.test(notes);
  if (hasContradiction) {
    return `Damage noted: ${tags.join(", ").toLowerCase()}. ${notes}`;
  }
  return notes || "General view";
}

function formatDate(dateStr?: string | null) {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

function capitalise(s: string) {
  if (!s) return "";
  return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
}

/* ─────────────────────────────────────────────────────────────────────────────
   SVG Icon Components for PDF
   Using @react-pdf/renderer native Svg support
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
    <Path d="M5 15h3M5 18h2" />
  </PdfIcon>
);

const IconMailbox = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
    <Path d="M22 6l-10 7L2 6" />
  </PdfIcon>
);

const IconRemote = ({ size = 14, color = "#9A88FD" }: { size?: number; color?: string }) => (
  <PdfIcon size={size} color={color}>
    <Rect x="7" y="2" width="10" height="20" rx="3" />
    <Path d="M12 6h.01M12 10h.01M12 14h.01" />
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

function getKeyIcon(itemName: string, color: string) {
  const name = (itemName || "").toLowerCase();
  if (name.includes("door") || name.includes("key")) return <IconKey size={13} color={color} />;
  if (name.includes("parking") || name.includes("car")) return <IconCard size={13} color={color} />;
  if (name.includes("mailbox") || name.includes("mail")) return <IconMailbox size={13} color={color} />;
  if (name.includes("access") || name.includes("fob")) return <IconLock size={13} color={color} />;
  if (name.includes("remote") || name.includes("control")) return <IconRemote size={13} color={color} />;
  return <IconKey size={13} color={color} />;
}

interface ReportData {
  executive_summary: string;
  rooms: {
    name: string;
    condition: string;
    summary: string;
    items: { name: string; condition: string; notes: string }[];
    recommendations: string[];
  }[];
  legal_notes: string;
  recommendations: string[];
}

interface SignatureEntry {
  signer_type: string;
  signed_at?: string | null;
  signature_data?: string | null;
  otp_verified?: boolean;
}

interface InspectionMeta {
  inspection: {
    id: string;
    type?: string;
    created_at?: string;
    report_url?: string;
    landlord_name?: string;
    landlord_email?: string;
    tenant_name?: string;
    tenant_email?: string;
    ejari_ref?: string;
    contract_from?: string;
    contract_to?: string;
    actual_end_date?: string;
    annual_rent?: number;
    security_deposit?: number;
    property_size?: number;
    tenancy_type?: string;
    status?: string;
    key_handover?: { item: string; qty: number }[];
    checkin_key_handover?: { item: string; qty: number }[];
  };
  property: {
    building_name?: string;
    unit_number?: string;
    address?: string;
    property_type?: string;
  } | null;
  agent: {
    full_name?: string;
    agency_name?: string;
    company_logo_url?: string;
    company_primary_color?: string;
    company_website?: string;
    rera_number?: string;
    signature_image_url?: string;
  } | null;
  rooms: {
    name: string;
    photos: {
      id: string;
      url?: string;
      width?: number | null;
      height?: number | null;
      notes?: string;
      damage_tags?: string[];
      taken_at?: string;
      checkin_photo_id?: string | null;
      is_additional?: boolean;
      ai_analysis?: string | null;
    }[];
  }[];
  signatures?: SignatureEntry[];
  checkinPhotoMap?: Record<string, { id: string; url: string; damage_tags?: string[]; ai_analysis?: string | null }>;
  checkinRooms?: { name: string; photos: { id: string; url?: string; damage_tags?: string[]; ai_analysis?: string | null }[] }[];
}

function isValidHex(s: string | undefined): boolean {
  if (!s || typeof s !== "string") return false;
  return /^#[0-9A-Fa-f]{6}$/.test(s.trim());
}

function InspectionReport({
  report,
  meta,
  documentHash,
  qrDataUrl,
}: {
  report: ReportData;
  meta: InspectionMeta;
  documentHash: string;
  qrDataUrl?: string;
}) {
  const inspType = (meta.inspection.type ?? "check-in").toUpperCase();
  const shortHash = `${documentHash.slice(0, 16)}...${documentHash.slice(-16)}`;
  const totalPages = 3 + report.rooms.length;
  const tokens = getBrandTokens(meta.agent?.company_primary_color);
  const accentColor = tokens.primary;
  const agencyName = meta.agent?.agency_name?.trim() || meta.agent?.full_name?.trim() || "MULKEEF";
  const agencyWebsite = meta.agent?.company_website?.trim() || "snagify.net";
  const agencyLogoUrl = meta.agent?.company_logo_url || "https://app.snagify.net/icon-512x512.png";
  const generatedBy = agencyName;
  const property = meta.property ?? {};
  const inspection = meta.inspection;
  const tenancy = {
    landlord_name: meta.inspection.landlord_name,
    landlord_email: meta.inspection.landlord_email,
    tenant_name: meta.inspection.tenant_name,
    tenant_email: meta.inspection.tenant_email,
    contract_from: meta.inspection.contract_from,
    contract_to: meta.inspection.contract_to,
    actual_end_date: meta.inspection.actual_end_date,
    ejari_ref: meta.inspection.ejari_ref,
    annual_rent: meta.inspection.annual_rent,
    security_deposit: meta.inspection.security_deposit,
    tenancy_type: meta.inspection.tenancy_type,
    property_size: meta.inspection.property_size,
    status: meta.inspection.status,
  };

  const tenancyFields: Array<{ label: string; value: string }> = [];
  if (tenancy.ejari_ref) {
    tenancyFields.push({ label: "Ejari Reference", value: tenancy.ejari_ref });
  }
  if (tenancy.annual_rent != null) {
    tenancyFields.push({
      label: "Annual Rent",
      value: `AED ${Number(tenancy.annual_rent).toLocaleString("en-AE")}`,
    });
  }
  if (tenancy.security_deposit != null) {
    tenancyFields.push({
      label: "Security Deposit",
      value: `AED ${Number(tenancy.security_deposit).toLocaleString("en-AE")}`,
    });
  }
  if (tenancy.tenancy_type) {
    tenancyFields.push({
      label: "Tenancy Type",
      value: tenancy.tenancy_type.charAt(0).toUpperCase() + tenancy.tenancy_type.slice(1),
    });
  }
  if (tenancy.property_size != null) {
    tenancyFields.push({
      label: "Property Size",
      value: `${Number(tenancy.property_size).toLocaleString("en-AE")} sqft`,
    });
  }
  if (tenancy.status) {
    tenancyFields.push({
      label: "Contract Status",
      value: tenancy.status.charAt(0).toUpperCase() + tenancy.status.slice(1).replace(/_/g, " "),
    });
  }
  const roomStats = report.rooms.map((room) => {
    const matchingMeta = meta.rooms.find(
      (mr) => mr.name.toLowerCase() === room.name.toLowerCase()
    );
    const photos = matchingMeta?.photos ?? [];
    const validPhotos = photos.filter((p) => p.url && p.url.startsWith("https://"));
    const photosWithIssues = validPhotos.filter(
      (p) => (p.damage_tags?.length ?? 0) > 0
    ).length;
    const roomCondition = room.condition || getRoomCondition(validPhotos);
    const keyFindings = Array.from(
      new Set(validPhotos.flatMap((p) => p.damage_tags ?? []).map((t) => t.toUpperCase()))
    );
    const roomInspectionDate =
      validPhotos.map((p) => p.taken_at).filter(Boolean)[0] ?? meta.inspection.created_at;
    return {
      room,
      validPhotos,
      photosWithIssues,
      roomCondition,
      keyFindings,
      roomInspectionDate,
    };
  });
  const totalPhotos = roomStats.reduce((sum, r) => sum + r.validPhotos.length, 0);
  const totalIssues = roomStats.reduce((sum, r) => sum + r.photosWithIssues, 0);

  return (
    <Document>
      {/* PAGE 1 — COVER (hero + body + footer) */}
      <Page size="A4">
        <View style={[s.coverHero, { backgroundColor: tokens.primary }]}>
          <View style={[s.coverHeroGeoCircle, { borderColor: tokens.primaryDark }]} />
          <View style={[s.coverHeroGeoCircle2, { borderColor: tokens.primaryLight }]} />

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
                  <View style={{
                    width: 36, height: 36,
                    backgroundColor: "rgba(255,255,255,0.5)",
                    borderRadius: 8
                  }} />
                </View>
              )}
              <View>
                <Text style={s.coverLogoText}>{agencyName}</Text>
                <Text style={s.coverLogoSub}>PROPERTY INSPECTION REPORT</Text>
              </View>
            </View>
            <View style={[s.coverTypeBadge, { borderColor: tokens.primaryDark, backgroundColor: tokens.primaryLight }]}>
              <Text style={s.coverTypeBadgeText}>
                {inspection.type === "check-out" ? "CHECK-OUT" : "CHECK-IN"}
              </Text>
            </View>
          </View>

          <Text style={s.coverAddressMain}>
            {property.address ?? (property.building_name && property.unit_number
              ? `${property.building_name}, Unit ${property.unit_number}`
              : "Property Address")}
          </Text>
          <Text style={s.coverAddressSub}>
            {[
              property.unit_number ? `Unit ${property.unit_number}` : null,
              capitalise(property.property_type || ""),
            ].filter(Boolean).join(" · ")}
          </Text>
        </View>

        <View style={s.coverBodyNew}>
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

          <View style={s.partiesRow}>
            {[
              { role: "Landlord", name: tenancy.landlord_name, email: tenancy.landlord_email },
              { role: "Tenant", name: tenancy.tenant_name, email: tenancy.tenant_email },
            ].map((p, i) => {
              const initials =
                p.name
                  ?.split(" ")
                  .map((w) => w[0])
                  .slice(0, 2)
                  .join("") || "?";
              return (
                <View key={i} style={[s.partyCard, ...(i === 0 ? [{ marginRight: 8 }] : [])]}>
                  <View style={[s.partyAvatar, { backgroundColor: tokens.primaryUltraLight, marginRight: 9 }]}>
                    <Text style={[s.partyAvatarText, { color: tokens.primary }]}>{initials}</Text>
                  </View>
                  <View>
                    <Text style={[s.partyRole, { color: tokens.primary }]}>{p.role.toUpperCase()}</Text>
                    <Text style={s.partyName}>{p.name ?? "—"}</Text>
                    <Text style={s.partyEmail}>{p.email ?? ""}</Text>
                  </View>
                </View>
              );
            })}
          </View>

          {/* Tenancy Details Card — only show if there are populated fields */}
          {tenancyFields.length > 0 && (
            <View style={{
              borderRadius: 8,
              borderWidth: 0.5,
              borderColor: "#EEECFF",
              padding: 14,
              marginBottom: 14,
              backgroundColor: "#FFFFFF",
            }}>
              <Text style={{
                fontSize: 7.5,
                fontFamily: "Helvetica-Bold",
                textTransform: "uppercase",
                letterSpacing: 0.8,
                color: tokens.primary,
                marginBottom: 10,
              }}>
                Tenancy Details
              </Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap" }}>
                {tenancyFields.map((field, i) => (
                  <View key={i} style={{
                    width: "50%",
                    paddingRight: i % 2 === 0 ? 10 : 0,
                    marginBottom: 8,
                  }}>
                    <Text style={{
                      fontSize: 7,
                      color: "#9B9BA8",
                      textTransform: "uppercase",
                      letterSpacing: 0.6,
                      marginBottom: 2,
                    }}>
                      {field.label}
                    </Text>
                    <Text style={{
                      fontSize: 9,
                      fontFamily: "Helvetica-Bold",
                      color: "#1A1A2E",
                    }}>
                      {field.value}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          <View style={[s.summaryCard, { backgroundColor: tokens.primaryUltraLight }]}>
            <View style={s.summaryLabelRow}>
              <View style={[s.summaryDot, { backgroundColor: tokens.primary }]} />
              <Text style={[s.summaryLabel, { color: tokens.primary }]}>Executive Summary</Text>
            </View>
            <Text style={s.summaryTextNew}>{report.executive_summary}</Text>
          </View>
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>
            SHA-256: {documentHash.slice(0, 8)}…{documentHash.slice(-8)} · Page 1
          </Text>
        </View>
      </Page>

      {/* PAGE 2 — INSPECTION OVERVIEW */}
      <Page size="A4">
        <View style={[s.overviewHeader, { backgroundColor: tokens.primary }]}>
          <View>
            <Text style={s.overviewTitleNew}>Inspection Overview</Text>
            <Text style={s.overviewSub}>
              {property.address ?? "Property"} · {formatDate(inspection.created_at)}
            </Text>
          </View>
          {agencyLogoUrl ? (
            <Image
              src={agencyLogoUrl}
              style={{
                width: 36,
                height: 36,
                objectFit: "contain",
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.15)",
              }}
            />
          ) : (
            <View style={{
              width: 36, height: 36,
              borderRadius: 8,
              backgroundColor: "rgba(255,255,255,0.15)",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Text style={{ fontSize: 14, fontFamily: "Helvetica-Bold", color: "#FFFFFF" }}>
                {agencyName?.charAt(0) || "S"}
              </Text>
            </View>
          )}
        </View>

        <View style={s.statRow}>
          {[
            { num: roomStats.length, label: "Rooms inspected", icon: <IconHouse size={16} color={tokens.primary} />, isIssue: false },
            { num: totalPhotos, label: "Photos captured", icon: <IconCamera size={16} color={tokens.primary} />, isIssue: false },
            { num: totalIssues, label: "Issues flagged", icon: <IconWarning size={16} color="#DC2626" />, isIssue: true },
          ].map((stat, i) => (
            <View key={i} style={[s.statCard, ...(i < 2 ? [{ marginRight: 10 }] : [])]}>
              <View style={[s.statIconBox, { backgroundColor: stat.isIssue ? "#FEE2E2" : tokens.primaryUltraLight }]}>
                {stat.icon}
              </View>
              <Text style={[s.statNum, { color: stat.isIssue ? "#DC2626" : tokens.primary }]}>{stat.num}</Text>
              <Text style={s.statLbl}>{stat.label}</Text>
            </View>
          ))}
        </View>

        <View style={s.sectionHd}>
          <Text style={s.sectionHdText}>Room breakdown</Text>
          <View style={s.sectionHdLine} />
        </View>

        <View style={s.roomTable}>
          <View style={[s.roomThead, { backgroundColor: tokens.primary }]}>
            <Text style={[s.roomTheadCell, { flex: 2 }]}>Room</Text>
            <Text style={[s.roomTheadCell, { flex: 0.8 }]}>Photos</Text>
            <Text style={[s.roomTheadCell, { flex: 0.8 }]}>Issues</Text>
            <Text style={[s.roomTheadCell, { flex: 1.4 }]}>Condition</Text>
            <Text style={[s.roomTheadCell, { flex: 2 }]}>Key findings</Text>
          </View>
          {roomStats.map((r, i) => {
            const cond = r.roomCondition?.toLowerCase() || "good";
            const condStyle =
              cond === "good" || cond === "excellent"
                ? { bg: "#DCFCE7", text: "#15803D" }
                : cond === "needs attention" || cond === "fair"
                  ? { bg: "#FEF9C3", text: "#A16207" }
                  : { bg: "#FEE2E2", text: "#DC2626" };
            const condLabel =
              cond === "good" || cond === "excellent"
                ? "Good"
                : cond === "needs attention" || cond === "fair"
                  ? "Needs Attention"
                  : "Critical";
            const tags = r.validPhotos.flatMap((p) => p.damage_tags ?? []);
            const uniqueTags = Array.from(new Set(tags)).slice(0, 4).join(", ");
            return (
              <View key={`${r.room.name}-${i}`} style={[s.roomRow, ...(i % 2 === 1 ? [s.roomRowAlt] : [])]}>
                <Text style={[s.roomCellBold, { flex: 2 }]}>{r.room.name}</Text>
                <Text style={[s.roomCell, { flex: 0.8 }]}>{r.validPhotos.length}</Text>
                <Text style={[s.roomCell, { flex: 0.8 }]}>{r.photosWithIssues}</Text>
                <View style={{ flex: 1.4 }}>
                  <View style={[s.condBadgeNew, { backgroundColor: condStyle.bg }]}>
                    <Text style={[s.condBadgeTextNew, { color: condStyle.text }]}>{condLabel}</Text>
                  </View>
                </View>
                <Text style={[s.roomCell, { flex: 2, color: "#9B9BA8", fontSize: 6.5 }]}>
                  {uniqueTags || "—"}
                </Text>
              </View>
            );
          })}
        </View>

        <View style={s.sectionHd}>
          <Text style={s.sectionHdText}>Key handover</Text>
          <View style={s.sectionHdLine} />
        </View>

        <View style={s.keysCard}>
          {(() => {
            const keyItems = (meta.inspection.key_handover as any[] ?? []);
            if (keyItems.length === 0) {
              return (
                <Text style={{ fontSize: 8, color: '#9B9BA8', fontFamily: 'Helvetica-Oblique' }}>
                  No items recorded
                </Text>
              );
            }
            return (
              <View style={s.keysGrid}>
                {keyItems.map((item: any, i: number) => (
                  <View key={i} style={s.keyItem}>
                    <View style={[s.keyIconBox, { backgroundColor: tokens.primaryUltraLight }]}>
                      {getKeyIcon(item.item || item.label || item.name || "", tokens.primary)}
                    </View>
                    <Text style={s.keyLabel}>{item.item || item.label || item.name}</Text>
                    <Text style={s.keyQty}>×{item.qty ?? item.quantity ?? 1}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]} fixed>
          <View style={s.footerLeft}>
            <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
            <View style={s.footerDivider} />
            <Text style={s.footerUrl}>{agencyWebsite}</Text>
          </View>
          <Text style={s.footerRight}>
            SHA-256: {documentHash.slice(0, 8)}…{documentHash.slice(-8)} · Page 2
          </Text>
        </View>
      </Page>

      {/* ROOM PAGES */}
      {roomStats.map((r, roomIndex) => {
        const room = r.room;
        const photos = r.validPhotos;
        const cond = (r.roomCondition || "good").toLowerCase().replace(/\s+/g, "_");
        const condBadgeStyle =
          cond === "good" || cond === "excellent"
            ? s.roomCondBadgeGood
            : cond === "needs_attention" || cond === "fair"
              ? s.roomCondBadgeWarn
              : s.roomCondBadgeCritical;
        const condTextStyle =
          cond === "good" || cond === "excellent"
            ? s.roomCondTextGood
            : cond === "needs_attention" || cond === "fair"
              ? s.roomCondTextWarn
              : s.roomCondTextCritical;
        const condLabel =
          cond === "good" || cond === "excellent"
            ? "Good"
            : cond === "needs_attention" || cond === "fair"
              ? "Needs Attention"
              : "Critical";
        const totalIssuesRoom = photos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;

        const tagStyle = (tag: string) => {
          const t = tag.toLowerCase();
          if (["scratch", "crack", "broken", "missing"].includes(t))
            return { bg: s.photoTagRed, text: s.photoTagTextRed };
          if (["stain", "damp", "burn", "discoloration"].includes(t))
            return { bg: s.photoTagOrange, text: s.photoTagTextOrange };
          if (["mark", "wear"].includes(t)) return { bg: s.photoTagBlue, text: s.photoTagTextBlue };
          return { bg: s.photoTagGray, text: s.photoTagTextGray };
        };

        const photoPairs: (typeof photos)[] = [];
        for (let i = 0; i < photos.length; i += 2) {
          photoPairs.push(photos.slice(i, i + 2));
        }

        return (
          <Page key={roomIndex} size="A4" wrap={false}>
            <View style={[s.roomHero, { backgroundColor: tokens.primary }]}>
              <View style={[s.roomHeroDecoOuter, { borderColor: tokens.primaryDark }]} />
              <View style={[s.roomHeroDecoInner, { borderColor: tokens.primaryLight }]} />
              <View style={s.roomHeroTop}>
                <View>
                  <Text style={s.roomNumber}>
                    Room {String(roomIndex + 1).padStart(2, "0")} of {String(roomStats.length).padStart(2, "0")}
                  </Text>
                  <Text style={s.roomTitle}>{room.name}</Text>
                  <Text style={s.roomDate}>
                    Inspected on {formatDate(inspection.created_at)}
                  </Text>
                </View>
                <View style={condBadgeStyle}>
                  <Text style={condTextStyle}>{condLabel}</Text>
                </View>
              </View>
              <View style={s.roomStatsRow}>
                <View style={[s.roomStatItem, { marginRight: 16 }]}>
                  <View style={[s.roomStatDot, { marginRight: 5 }]} />
                  <Text style={s.roomStatText}>
                    {photos.length} photo{photos.length !== 1 ? "s" : ""} captured
                  </Text>
                </View>
                <View style={s.roomStatItem}>
                  <View style={[s.roomStatDot, { marginRight: 5 }]} />
                  <Text style={s.roomStatText}>
                    {totalIssuesRoom} issue{totalIssuesRoom !== 1 ? "s" : ""} flagged
                  </Text>
                </View>
              </View>
            </View>

            <View style={s.roomBody}>
              {photoPairs.map((pair, pairIdx) => {
                const isSingleAny = pair.length === 1;
                const PAGE_INNER_WIDTH = 515;
                const COL_WIDTH_2 = (PAGE_INNER_WIDTH - 8) / 2;
                const COL_WIDTH_1 = PAGE_INNER_WIDTH;

                return (
                  <View
                    key={pairIdx}
                    style={isSingleAny ? { marginBottom: 8 } : [s.photosGrid, { marginBottom: 8 }]}
                  >
                    {pair.map((photo) => {
                      const useFull = isSingleAny;
                      const colW = useFull ? COL_WIDTH_1 : COL_WIDTH_2;
                      const imgH = getPdfImageHeight(colW, photo.width, photo.height);

                      return (
                        <View
                          key={photo.id}
                          style={useFull ? s.photoCardFull : s.photoCard}
                        >
                          {photo.url && photo.url.startsWith("http") ? (
                            <Image
                              src={photo.url}
                              style={{
                                width: "100%",
                                height: imgH,
                                objectFit: "contain",
                                backgroundColor: "#F8F8FC",
                              }}
                            />
                          ) : null}
                          {photo.damage_tags && photo.damage_tags.length > 0 && (
                            <View style={s.photoTagsRow}>
                              {photo.damage_tags.map((tag, ti) => {
                                const ts = tagStyle(tag);
                                return (
                                  <View key={ti} style={[s.photoTag, ts.bg, { marginRight: 3, marginBottom: 2 }]}>
                                    <Text style={[s.photoTagText, ts.text]}>{tag}</Text>
                                  </View>
                                );
                              })}
                            </View>
                          )}
                          {photo.ai_analysis && (
                            <>
                              <View style={s.photoAiDivider} />
                              <View style={s.photoAiWrap}>
                                <Text style={[s.photoAiLabel, { color: tokens.primary }]}>
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
                );
              })}
            </View>

            <View style={[s.pdfFooter, { backgroundColor: tokens.primary }]}>
              <View style={s.footerLeft}>
                <Text style={s.footerAgency}>{agencyName.toUpperCase()}</Text>
                <View style={s.footerDivider} />
                <Text style={s.footerUrl}>{agencyWebsite}</Text>
              </View>
              <Text style={s.footerRight}>
                SHA-256: {documentHash.slice(0, 8)}…{documentHash.slice(-8)} · Page {roomIndex + 3} of{" "}
                {roomStats.length + 3}
              </Text>
            </View>
          </Page>
        );
      })}

      {/* SIGNATURE PAGE */}
      <Page size="A4">
        <View style={[s.sigHero, { backgroundColor: tokens.primary }]}>
          <View style={[s.sigHeroDeco, { borderColor: tokens.primaryDark }]} />
          <View style={s.sigHeroTop}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {agencyLogoUrl ? (
                <Image
                  src={agencyLogoUrl}
                  style={{
                    width: 40,
                    height: 40,
                    objectFit: "contain",
                    borderRadius: 8,
                    marginRight: 10,
                    backgroundColor: "rgba(255,255,255,0.15)",
                  }}
                />
              ) : null}
              <View>
                <Text style={s.sigLogoText}>{agencyName}</Text>
                <Text style={s.sigLogoSub}>PROPERTY INSPECTION REPORT</Text>
              </View>
            </View>
            <View style={[s.sigVerifiedBadge, { backgroundColor: tokens.primaryLight }]}>
              <View style={[s.sigVerifiedDot, { marginRight: 5 }]} />
              <Text style={s.sigVerifiedText}>Verified Document</Text>
            </View>
          </View>
          <Text style={s.sigTitle}>
            This report has been reviewed{"\n"}and agreed upon by all parties.
          </Text>
          <Text style={s.sigSubtitle}>
            {property.address ?? "Property"} · {formatDate(inspection.created_at)}
          </Text>
        </View>

        <View style={s.sigBody}>
          {qrDataUrl && (
            <View style={s.qrRow}>
              <View style={[s.qrBox, { marginRight: 14 }]}>
                <Image src={qrDataUrl} style={s.qrImage} />
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
            {[
              { role: "Landlord", name: tenancy.landlord_name, sigType: "landlord" },
              { role: "Tenant", name: tenancy.tenant_name, sigType: "tenant" },
            ].map((party, i) => {
              const sig = (meta.signatures ?? []).find((s) => s.signer_type === party.sigType);
              return (
                <View key={i} style={[s.sigPartyCard, ...(i === 0 ? [{ marginRight: 8 }] : [])]}>
                  <Text style={[s.sigPartyRole, { color: tokens.primary }]}>
                    {party.role.toUpperCase()}
                  </Text>
                  <Text style={s.sigPartyName}>{party.name ?? "—"}</Text>
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
            const inspectorSig = (meta.signatures ?? []).find(
              (s) => s.signer_type === "agent" || s.signer_type === "inspector"
            );
            const profile = meta.agent;
            return (
              <View style={s.sigInspectorCard}>
                <View style={[s.sigInspectorLeft, { marginRight: 12 }]}>
                  <Text style={[s.sigInspectorRole, { color: tokens.primary }]}>INSPECTOR</Text>
                  <Text style={s.sigInspectorName}>{profile?.full_name ?? "—"}</Text>
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
            {formatDate(inspection.created_at)} · Page {roomStats.length + 3} of {roomStats.length + 3}
          </Text>
        </View>
      </Page>
    </Document>
  );
}

function chunkArray<T>(arr: T[], size: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

export async function generateInspectionPDF(
  report: ReportData,
  meta: InspectionMeta,
  documentHash: string
): Promise<Blob> {
  const qrDataUrl = await buildReportQrDataUrl(meta);
  const doc = (
    <InspectionReport
      report={report}
      meta={meta}
      documentHash={documentHash}
      qrDataUrl={qrDataUrl}
    />
  );
  const blob = await pdf(doc).toBlob();
  return blob;
}

/** Server-side: render PDF to Buffer for upload/storage */
export async function generateInspectionPDFBuffer(
  report: ReportData,
  meta: InspectionMeta,
  documentHash: string
): Promise<Buffer> {
  const qrDataUrl = await buildReportQrDataUrl(meta);
  const doc = (
    <InspectionReport
      report={report}
      meta={meta}
      documentHash={documentHash}
      qrDataUrl={qrDataUrl}
    />
  );
  return renderToBuffer(doc);
}

async function buildReportQrDataUrl(meta: InspectionMeta): Promise<string | undefined> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.snagify.net";
  const reportUrl =
    meta.inspection.report_url ??
    `${appUrl}/report/${meta.inspection.id}`;
  try {
    return await QRCode.toDataURL(reportUrl, {
      width: 200,
      margin: 1,
      color: { dark: "#1a1a2e", light: "#FFFFFF" },
    });
  } catch {
    return undefined;
  }
}

export type { ReportData, InspectionMeta };
