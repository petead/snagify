/* eslint-disable jsx-a11y/alt-text */
import {
  Document,
  Page,
  Text,
  View,
  Image,
  StyleSheet,
  pdf,
  renderToBuffer,
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
    borderColor: "#B5A8FE",
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
    borderColor: "#C4B8FE",
    borderStyle: "solid",
  },
  coverHeroGeoRect: {
    position: "absolute",
    bottom: -20,
    left: 20,
    width: 70,
    height: 70,
    borderRadius: 14,
    borderWidth: 14,
    borderColor: "#C0B5FE",
    borderStyle: "solid",
    transform: "rotate(15deg)",
  },
  coverLogoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 24,
  },
  coverLogoLeft: { flexDirection: "row", alignItems: "center" },
  coverLogoIconBox: {
    width: 28,
    height: 28,
    borderRadius: 7,
    backgroundColor: "#A49AFD",
    alignItems: "center",
    justifyContent: "center",
  },
  coverLogoText: {
    fontSize: 16,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  coverLogoSub: {
    fontSize: 6,
    color: "rgba(255,255,255,0.65)",
    marginTop: 2,
    letterSpacing: 0.5,
  },
  coverTypeBadge: {
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: "#8070F0",
    backgroundColor: "#A99CFD",
  },
  coverTypeBadgeText: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: 1,
  },
  coverAddressMain: {
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    lineHeight: 1.25,
  },
  coverAddressSub: {
    fontSize: 8,
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
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    color: "#9B9BA8",
    marginBottom: 2,
  },
  metaValue: {
    fontSize: 8,
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
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    marginBottom: 3,
  },
  partyName: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  partyEmail: { fontSize: 7, color: "#9B9BA8", marginTop: 1 },
  summaryCard: {
    borderRadius: 8,
    padding: 12,
  },
  summaryLabelRow: { flexDirection: "row", alignItems: "center", marginBottom: 5 },
  summaryDot: { width: 6, height: 6, borderRadius: 3, marginRight: 6 },
  summaryLabel: {
    fontSize: 7,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },
  summaryTextNew: { fontSize: 7.5, color: "#374151", lineHeight: 1.65 },
  pdfFooter: {
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

  /* Page 2 overview redesign */
  overviewHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 28,
    paddingVertical: 14,
  },
  overviewTitleNew: { fontSize: 13, fontFamily: "Helvetica-Bold", color: "#FFFFFF" },
  overviewSub: { fontSize: 7, color: "rgba(255,255,255,0.65)", marginTop: 2 },
  overviewHeaderIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    backgroundColor: "#A99CFD",
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
  statNum: { fontSize: 22, fontFamily: "Helvetica-Bold", lineHeight: 1 },
  statLbl: {
    fontSize: 6,
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
  sectionHdText: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginRight: 8 },
  sectionHdLine: { flex: 1, height: 0.5, backgroundColor: "#EEECFF" },
  roomTable: { marginHorizontal: 28, borderRadius: 8, overflow: "hidden", borderWidth: 0.5, borderColor: "#EEECFF" },
  roomThead: { flexDirection: "row", paddingHorizontal: 10, paddingVertical: 7 },
  roomTheadCell: {
    fontSize: 6,
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
  roomCell: { fontSize: 7, color: "#374151" },
  roomCellBold: { fontSize: 7, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },
  condBadgeNew: { borderRadius: 10, paddingHorizontal: 7, paddingVertical: 2 },
  condBadgeTextNew: { fontSize: 6, fontFamily: "Helvetica-Bold" },
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
  keyLabel: { fontSize: 6.5, color: "#9B9BA8", textAlign: "center" },
  keyQty: { fontSize: 10, fontFamily: "Helvetica-Bold", color: "#1A1A2E" },

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
    borderColor: "#B8ABFE",
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
    borderColor: "#C9BFFE",
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
    fontSize: 20,
    fontFamily: "Helvetica-Bold",
    color: "#FFFFFF",
    letterSpacing: -0.5,
  },
  roomDate: {
    fontSize: 7,
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
  roomStatText: { fontSize: 7, color: "rgba(255,255,255,0.65)" },

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
    fontSize: 5.5,
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
    fontSize: 5.5,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 3,
  },
  photoAiText: { fontSize: 6.5, color: "#6B7280", lineHeight: 1.55 },

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
    borderColor: "#BDB0FE",
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
    backgroundColor: "#A99CFD",
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
  sigVerifiedText: { fontSize: 6.5, fontFamily: "Helvetica-Bold", color: "#FFFFFF", letterSpacing: 0.3 },
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
  },
  qrImage: { width: 48, height: 48 },
  qrTextWrap: { flex: 1 },
  qrTextTitle: { fontSize: 8, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 4 },
  qrTextBody: { fontSize: 7, color: "#6B7280", lineHeight: 1.6 },

  sigPartiesRow: { flexDirection: "row", marginBottom: 10 },
  sigPartyCard: {
    flex: 1,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: "#EEECFF",
    padding: 11,
  },
  sigPartyRole: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigPartyName: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 8 },
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
  sigInspectorLeft: { flex: 1 },
  sigInspectorRole: {
    fontSize: 6,
    textTransform: "uppercase",
    letterSpacing: 0.7,
    fontFamily: "Helvetica-Bold",
    marginBottom: 4,
  },
  sigInspectorName: { fontSize: 8.5, fontFamily: "Helvetica-Bold", color: "#1A1A2E", marginBottom: 2 },
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
  },
  hashValue: { fontSize: 6.5, color: "#374151", fontFamily: "Courier", lineHeight: 1.4 },

  disclaimer: {
    fontSize: 6,
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
  const agencyLogoUrl = meta.agent?.company_logo_url || null;
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
  };
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
          <View style={s.coverHeroGeoCircle} />
          <View style={s.coverHeroGeoCircle2} />
          <View style={s.coverHeroGeoRect} />

          <View style={s.coverLogoRow}>
            <View style={s.coverLogoLeft}>
              <View style={[s.coverLogoIconBox, { marginRight: 8 }]}>
                {agencyLogoUrl ? (
                  <Image src={agencyLogoUrl} style={{ width: 20, height: 20 }} />
                ) : (
                  <View style={{ width: 14, height: 14, backgroundColor: "rgba(255,255,255,0.7)", borderRadius: 3 }} />
                )}
              </View>
              <View>
                <Text style={s.coverLogoText}>{agencyName}</Text>
                <Text style={s.coverLogoSub}>PROPERTY INSPECTION REPORT</Text>
              </View>
            </View>
            <View style={s.coverTypeBadge}>
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
          <View style={s.metaStrip}>
            {[
              { label: "Date of inspection", value: formatDate(inspection.created_at) },
              {
                label: "Contract period",
                value: `${formatDate(tenancy.contract_from)} – ${formatDate(tenancy.contract_to)}`,
              },
              {
                label: "Property type",
                value: capitalise(property.property_type || "Apartment"),
              },
            ].map((item, i) => (
              <View key={i} style={[s.metaCell, ...(i < 2 ? [s.metaCellBorder] : [])]}>
                <View style={[s.metaIconBox, { backgroundColor: tokens.primaryUltraLight, marginRight: 8 }]} />
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

          <View style={[s.summaryCard, { backgroundColor: tokens.primaryUltraLight }]}>
            <View style={s.summaryLabelRow}>
              <View style={[s.summaryDot, { backgroundColor: tokens.primary }]} />
              <Text style={[s.summaryLabel, { color: tokens.primary }]}>Executive Summary</Text>
            </View>
            <Text style={s.summaryTextNew}>{report.executive_summary}</Text>
          </View>
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primaryDark }]} fixed>
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
          <View style={s.overviewHeaderIcon}>
            <View style={{ width: 16, height: 16, backgroundColor: "rgba(255,255,255,0.6)", borderRadius: 3 }} />
          </View>
        </View>

        <View style={s.statRow}>
          {[
            { num: roomStats.length, label: "Rooms inspected" },
            { num: totalPhotos, label: "Photos captured" },
            { num: totalIssues, label: "Issues flagged" },
          ].map((stat, i) => (
            <View key={i} style={[s.statCard, ...(i < 2 ? [{ marginRight: 10 }] : [])]}>
              <View style={[s.statIconBox, { backgroundColor: tokens.primaryUltraLight }]}>
                <View
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: tokens.primaryLight,
                    borderRadius: 3,
                  }}
                />
              </View>
              <Text style={[s.statNum, { color: tokens.primary }]}>{stat.num}</Text>
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
                      <View
                        style={{
                          width: 14,
                          height: 14,
                          backgroundColor: tokens.primaryLight,
                          borderRadius: 3,
                        }}
                      />
                    </View>
                    <Text style={s.keyLabel}>{item.item || item.label || item.name}</Text>
                    <Text style={s.keyQty}>×{item.qty ?? item.quantity ?? 1}</Text>
                  </View>
                ))}
              </View>
            );
          })()}
        </View>

        <View style={[s.pdfFooter, { backgroundColor: tokens.primaryDark }]} fixed>
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
              <View style={s.roomHeroDecoOuter} />
              <View style={s.roomHeroDecoInner} />
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

            <View style={[s.pdfFooter, { backgroundColor: tokens.primaryDark }]}>
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
          <View style={s.sigHeroDeco} />
          <View style={s.sigHeroTop}>
            <View>
              <Text style={s.sigLogoText}>{agencyName}</Text>
              <Text style={s.sigLogoSub}>PROPERTY INSPECTION REPORT</Text>
            </View>
            <View style={s.sigVerifiedBadge}>
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
                <View
                  style={{
                    width: 8,
                    height: 8,
                    backgroundColor: tokens.primaryLight,
                    borderRadius: 2,
                  }}
                />
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

        <View style={[s.pdfFooter, { backgroundColor: tokens.primaryDark }]} fixed>
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
  const reportUrl =
    meta.inspection.report_url ??
    `https://snagify.vercel.app/report/${meta.inspection.id}`;
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
