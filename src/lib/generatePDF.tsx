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
    rera_number?: string;
    signature_image_url?: string;
  } | null;
  rooms: {
    name: string;
    photos: {
      id: string;
      url?: string;
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
  const accentColor = isValidHex(meta.agent?.company_primary_color)
    ? meta.agent!.company_primary_color!.trim()
    : PURPLE;
  const generatedBy = meta.agent?.agency_name?.trim() || "Snagify";
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
      {/* PAGE 1 — COVER */}
      <Page size="A4" style={s.page}>
        <View style={[s.coverHeader, { backgroundColor: accentColor }]}>
          {meta.agent?.company_logo_url ? (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 8 }}>
              {/* eslint-disable-next-line jsx-a11y/alt-text */}
              <Image
                src={meta.agent.company_logo_url}
                style={{ height: 44, width: "auto", maxWidth: 160, objectFit: "contain" }}
              />
              <View>
                <Text style={s.coverTitle}>{generatedBy}</Text>
                <Text style={s.coverSubtitle}>Property Inspection Report</Text>
              </View>
            </View>
          ) : (
            <>
              <Text style={s.coverTitle}>Snagify</Text>
              <Text style={s.coverSubtitle}>Property Inspection Report</Text>
            </>
          )}
          <View style={s.typeBadge}>
            <Text style={s.typeBadgeText}>{inspType}</Text>
          </View>
        </View>

        <View style={s.coverBody}>
          <Text style={s.coverAddress}>
            {meta.property?.address ?? (meta.property?.building_name && meta.property?.unit_number
              ? `${meta.property.building_name}, Unit ${meta.property.unit_number}`
              : "Property Address")}
          </Text>

          <View style={s.coverRow}>
            <Text style={s.coverLabel}>Date of Inspection</Text>
            <Text style={s.coverValue}>{formatDate(meta.inspection.created_at)}</Text>
          </View>
          {meta.inspection?.ejari_ref && (
            <View style={s.coverRow}>
              <Text style={s.coverLabel}>Ejari Reference</Text>
              <Text style={s.coverValue}>{meta.inspection.ejari_ref}</Text>
            </View>
          )}
          {(meta.inspection?.contract_from || meta.inspection?.contract_to) && (
            <View style={s.coverRow}>
              <Text style={s.coverLabel}>Contract Period</Text>
              <Text style={s.coverValue}>
                {[meta.inspection.contract_from, meta.inspection.contract_to].filter(Boolean).map(formatDate).join(" – ")}
              </Text>
            </View>
          )}
          {meta.property?.property_type && (
            <View style={s.coverRow}>
              <Text style={s.coverLabel}>Property Type</Text>
              <Text style={s.coverValue}>{meta.property.property_type}</Text>
            </View>
          )}

          <View style={s.twoCol}>
            <View style={s.colHalf}>
              <Text style={s.colTitle}>Landlord</Text>
              <Text>{meta.inspection.landlord_name || "—"}</Text>
              <Text style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                {meta.inspection.landlord_email || ""}
              </Text>
            </View>
            <View style={s.colHalf}>
              <Text style={s.colTitle}>Tenant</Text>
              <Text>{meta.inspection.tenant_name || "—"}</Text>
              <Text style={{ fontSize: 9, color: "#666", marginTop: 2 }}>
                {meta.inspection.tenant_email || ""}
              </Text>
            </View>
          </View>

          {meta.agent && (
            <View style={{ marginTop: 12 }}>
              <View style={s.coverRow}>
                <Text style={s.coverLabel}>Inspector</Text>
                <Text style={s.coverValue}>{meta.agent.full_name ?? "—"}</Text>
              </View>
              {meta.agent.agency_name && (
                <View style={s.coverRow}>
                  <Text style={s.coverLabel}>Agency</Text>
                  <Text style={s.coverValue}>{meta.agent.agency_name}</Text>
                </View>
              )}
              {meta.agent.rera_number && (
                <View style={s.coverRow}>
                  <Text style={s.coverLabel}>RERA License</Text>
                  <Text style={s.coverValue}>{meta.agent.rera_number}</Text>
                </View>
              )}
            </View>
          )}

          <View style={[s.divider, { backgroundColor: accentColor }]} />

          <View style={[s.summaryBox, { borderLeftWidth: 4, borderLeftColor: accentColor }]}>
            <Text style={[s.summaryTitle, { color: accentColor }]}>Executive Summary</Text>
            <Text style={s.summaryText}>{report.executive_summary}</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>
            Page 1 of {totalPages} · Generated by {generatedBy} — snagify.net
          </Text>
          <Text style={s.hashText}>SHA-256: {shortHash}</Text>
        </View>
      </Page>

      {/* PAGE 2 — INSPECTION OVERVIEW */}
      <Page size="A4" style={s.page}>
        <Text style={s.overviewTitle}>Inspection Overview</Text>

        <View style={s.tableWrap}>
          <View style={s.tableHeaderRow}>
            <Text style={[s.tableHeaderCell, { width: "24%" }]}>Room</Text>
            <Text style={[s.tableHeaderCell, { width: "11%", textAlign: "center" }]}>Photos</Text>
            <Text style={[s.tableHeaderCell, { width: "11%", textAlign: "center" }]}>Issues</Text>
            <Text style={[s.tableHeaderCell, { width: "18%" }]}>Condition</Text>
            <Text style={[s.tableHeaderCell, { width: "36%" }]}>Key Findings</Text>
          </View>
          {roomStats.map((r, i) => {
            const c = conditionColor(r.roomCondition);
            return (
              <View key={`${r.room.name}-${i}`} style={s.tableRow}>
                <Text style={[s.tableCell, { width: "24%" }]}>{r.room.name}</Text>
                <Text style={[s.tableCell, { width: "11%", textAlign: "center" }]}>{r.validPhotos.length}</Text>
                <Text style={[s.tableCell, { width: "11%", textAlign: "center" }]}>{r.photosWithIssues}</Text>
                <Text style={[s.tableCell, { width: "18%", color: c.bg === "#F44336" ? "#F44336" : c.bg }]}>
                  {r.roomCondition}
                </Text>
                <Text style={[s.tableCell, { width: "36%" }]}>
                  {r.keyFindings.length > 0 ? r.keyFindings.join(", ") : "—"}
                </Text>
              </View>
            );
          })}
        </View>

        <Text style={s.tableSummary}>
          Total: {roomStats.length} rooms · {totalPhotos} photos · {totalIssues} issues
        </Text>

        {(() => {
          const checkoutKeys = meta.inspection.key_handover ?? [];
          const checkinKeys = meta.inspection.checkin_key_handover ?? [];
          const isCheckout = (meta.inspection.type ?? "").toLowerCase().includes("check-out") && checkinKeys.length > 0;

          if (isCheckout) {
            let totalMissing = 0;
            return (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 700, fontFamily: "Helvetica-Bold", marginBottom: 12, color: "#1a1a2e" }}>
                  Key Return
                </Text>
                <View style={s.tableWrap}>
                  <View style={s.tableHeaderRow}>
                    <Text style={[s.tableHeaderCell, { width: "40%" }]}>Item</Text>
                    <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}>Given (Check-in)</Text>
                    <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}>Returned</Text>
                    <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}>Status</Text>
                  </View>
                  {checkinKeys.map((c, i) => {
                    const returnedQty = checkoutKeys.find((k) => k.item === c.item)?.qty ?? 0;
                    const diff = c.qty - returnedQty;
                    totalMissing += Math.max(0, diff);
                    const status = diff === 0 ? "✓ OK" : diff > 0 ? `⚠ -${diff}` : "✓ OK";
                    const statusColor = diff === 0 ? "#2e7d32" : "#e65100";
                    return (
                      <View key={`${c.item}-${i}`} style={s.tableRow}>
                        <Text style={[s.tableCell, { width: "40%" }]}>{c.item}</Text>
                        <Text style={[s.tableCell, { width: "20%", textAlign: "center" }]}>{c.qty}</Text>
                        <Text style={[s.tableCell, { width: "20%", textAlign: "center" }]}>{returnedQty}</Text>
                        <Text style={[s.tableCell, { width: "20%", textAlign: "center", color: statusColor }]}>{status}</Text>
                      </View>
                    );
                  })}
                </View>
                <Text style={{ fontSize: 10, fontFamily: "Helvetica-Bold", marginTop: 8, color: "#1a1a2e" }}>
                  {totalMissing === 0
                    ? "All keys returned ✓"
                    : `⚠ ${totalMissing} key(s) not returned — may be subject to deduction`}
                </Text>
              </View>
            );
          }

          if (meta.inspection.key_handover && meta.inspection.key_handover.length > 0) {
            return (
              <View style={{ marginTop: 20 }}>
                <Text style={{ fontSize: 16, fontWeight: 700, fontFamily: "Helvetica-Bold", marginBottom: 12, color: "#1a1a2e" }}>
                  Key Handover
                </Text>
                <View style={s.tableWrap}>
                  <View style={s.tableHeaderRow}>
                    <Text style={[s.tableHeaderCell, { width: "80%" }]}>Item</Text>
                    <Text style={[s.tableHeaderCell, { width: "20%", textAlign: "center" }]}>Qty</Text>
                  </View>
                  {meta.inspection.key_handover.map((k, i) => (
                    <View key={`${k.item}-${i}`} style={s.tableRow}>
                      <Text style={[s.tableCell, { width: "80%" }]}>{k.item}</Text>
                      <Text style={[s.tableCell, { width: "20%", textAlign: "center" }]}>{k.qty}</Text>
                    </View>
                  ))}
                </View>
              </View>
            );
          }
          return null;
        })()}

        <View style={s.footer}>
          <Text style={s.footerText}>
            Page 2 of {totalPages} · Generated by {generatedBy} — snagify.net
          </Text>
          <Text style={s.hashText}>SHA-256: {shortHash}</Text>
        </View>
      </Page>

      {/* ROOM PAGES */}
      {roomStats.map((r, ri) => {
        const room = r.room;
        const validPhotos = r.validPhotos;
        const roomCondition = r.roomCondition;
        const rc = conditionColor(roomCondition);
        const photosWithIssues = r.photosWithIssues;
        const roomInspectionDate = r.roomInspectionDate;
        const isCheckoutRoom =
          (meta.inspection.type ?? "").toLowerCase().includes("check-out") &&
          meta.checkinPhotoMap &&
          meta.checkinRooms;
        const checkinRoom = meta.checkinRooms?.find(
          (cr) => cr.name.toLowerCase() === room.name.toLowerCase()
        );
        const checkinRoomPhotos = checkinRoom?.photos ?? [];
        const pairedPhotos = validPhotos.filter(
          (p) => (p as { checkin_photo_id?: string | null; is_additional?: boolean }).checkin_photo_id && !(p as { is_additional?: boolean }).is_additional
        );
        const additionalPhotos = validPhotos.filter(
          (p) => (p as { is_additional?: boolean }).is_additional
        );
        const uncoveredCheckinPhotos = checkinRoomPhotos.filter(
          (cp) => !pairedPhotos.some((p) => (p as { checkin_photo_id?: string | null }).checkin_photo_id === cp.id)
        );

        return (
          <Page key={ri} size="A4" style={s.page}>
            <View style={[s.roomHeader, { backgroundColor: accentColor }]}>
              <View>
                <Text style={s.roomName}>{room.name}</Text>
                {roomInspectionDate && (
                  <Text style={{ fontSize: 8, color: "rgba(255,255,255,0.85)", marginTop: 2 }}>
                    Inspected on {formatDate(roomInspectionDate)}
                  </Text>
                )}
              </View>
              <View style={[s.roomCondBadge, { backgroundColor: rc.bg }]}>
                <Text style={[s.roomCondText, { color: rc.text }]}>{roomCondition}</Text>
              </View>
            </View>

            <Text style={s.roomSummary}>{room.summary}</Text>

            {isCheckoutRoom ? (
              <View style={{ marginTop: 14 }}>
                {/* Section 1 — Entry vs Exit paired */}
                {pairedPhotos.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: DARK, marginBottom: 8 }}>
                      Entry vs Exit
                    </Text>
                    {pairedPhotos.map((p) => {
                      const checkinId = (p as { checkin_photo_id?: string | null }).checkin_photo_id;
                      const checkinPhoto = checkinId ? meta.checkinPhotoMap?.[checkinId] : null;
                      return (
                        <View key={p.id} style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                          <View style={{ flex: 1 }}>
                            {checkinPhoto?.url && (
                              <>
                                {/* eslint-disable-next-line jsx-a11y/alt-text */}
                                <Image
                                  src={checkinPhoto.url}
                                  style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, marginBottom: 4 }}
                                />
                                {checkinPhoto.damage_tags && checkinPhoto.damage_tags.length > 0 && (
                                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                                    {checkinPhoto.damage_tags.map((tag) => (
                                      <Text key={tag} style={{ fontSize: 6, color: "#666" }}>{tag}</Text>
                                    ))}
                                  </View>
                                )}
                                <Text style={{ fontSize: 7, color: "#888", marginTop: 2 }}>Entry</Text>
                              </>
                            )}
                          </View>
                          <View style={{ flex: 1 }}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image
                              src={p.url!}
                              style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, marginBottom: 4 }}
                            />
                            {p.damage_tags && p.damage_tags.length > 0 && (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 2 }}>
                                {p.damage_tags.map((tag) => (
                                  <Text key={tag} style={{ fontSize: 6, color: "#ef4444" }}>{tag}</Text>
                                ))}
                              </View>
                            )}
                            <Text style={{ fontSize: 7, color: "#888", marginTop: 2 }}>Exit</Text>
                            {(p as { ai_analysis?: string | null }).ai_analysis && (
                              <Text style={{ fontSize: 7, color: "#444", marginTop: 4, lineHeight: 1.3 }}>
                                {(p as { ai_analysis?: string | null }).ai_analysis}
                              </Text>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
                {/* Section 2 — Entry photos not re-inspected */}
                {uncoveredCheckinPhotos.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <View style={{ backgroundColor: "#E5E7EB", padding: 8, borderRadius: 6, marginBottom: 8 }}>
                      <Text style={{ fontSize: 9, fontFamily: "Helvetica-Bold", color: "#555" }}>
                      ⚠️ {uncoveredCheckinPhotos.length} entry photo(s) not re-documented at check-out
                      </Text>
                    </View>
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {uncoveredCheckinPhotos.map((cp) => (
                        <View key={cp.id} style={{ width: "30%", position: "relative" }}>
                          {cp.url && (
                            <>
                              {/* eslint-disable-next-line jsx-a11y/alt-text */}
                              <Image
                                src={cp.url}
                                style={{ width: "100%", height: 80, objectFit: "cover", borderRadius: 6 }}
                              />
                              <View style={{ position: "absolute", inset: 0, backgroundColor: "rgba(0,0,0,0.3)", borderRadius: 6, alignItems: "center", justifyContent: "center" }}>
                                <Text style={{ fontSize: 14, color: "white", fontFamily: "Helvetica-Bold" }}>⚠️</Text>
                              </View>
                            </>
                          )}
                        </View>
                      ))}
                    </View>
                  </View>
                )}
                {/* Section 3 — New findings */}
                {additionalPhotos.length > 0 && (
                  <View style={{ marginBottom: 16 }}>
                    <Text style={{ fontSize: 11, fontFamily: "Helvetica-Bold", color: "#FF8A65", marginBottom: 8 }}>
                      New findings — no entry reference
                    </Text>
                    {chunkArray(additionalPhotos, 2).map((pair, rowIdx) => (
                      <View key={rowIdx} style={{ flexDirection: "row", gap: 10, marginBottom: 12 }}>
                        {pair.map((photo) => (
                          <View key={photo.id} style={{ flex: 1 }}>
                            {/* eslint-disable-next-line jsx-a11y/alt-text */}
                            <Image
                              src={photo.url!}
                              style={{ width: "100%", height: 100, objectFit: "cover", borderRadius: 6, marginBottom: 4 }}
                            />
                            {photo.damage_tags && photo.damage_tags.length > 0 && (
                              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 3 }}>
                                {photo.damage_tags.map((tag) => (
                                  <Text key={tag} style={{ fontSize: 6, color: "#ef4444", fontFamily: "Helvetica-Bold" }}>{tag}</Text>
                                ))}
                              </View>
                            )}
                            {(photo as { ai_analysis?: string | null }).ai_analysis && (
                              <Text style={{ fontSize: 7, color: "#444", marginTop: 2, lineHeight: 1.3 }}>
                                {(photo as { ai_analysis?: string | null }).ai_analysis}
                              </Text>
                            )}
                          </View>
                        ))}
                        {pair.length === 1 && <View style={{ flex: 1 }} />}
                      </View>
                    ))}
                  </View>
                )}
                {pairedPhotos.length === 0 && uncoveredCheckinPhotos.length === 0 && additionalPhotos.length === 0 && validPhotos.length > 0 && (
                  <Text style={s.roomMetaLine}>No paired or additional photos in this room.</Text>
                )}
              </View>
            ) : validPhotos.length > 0 ? (
              <View style={{ marginTop: 14 }}>
                <Text style={s.roomMetaLine}>
                  {validPhotos.length} photo{validPhotos.length > 1 ? "s" : ""} captured
                  {photosWithIssues > 0
                    ? ` · ${photosWithIssues} issue${photosWithIssues > 1 ? "s" : ""} flagged`
                    : ""}
                </Text>
                {chunkArray(validPhotos, 2).map((pair, rowIdx) => (
                  <View key={rowIdx} style={{
                    flexDirection: "row", gap: 10, marginBottom: 12,
                  }}>
                    {pair.map((photo) => (
                      <View key={photo.id} style={{ flex: 1 }}>
                        {/* eslint-disable-next-line jsx-a11y/alt-text */}
                        <Image
                          src={photo.url!}
                          style={{
                            width: "100%",
                            height: 140,
                            objectFit: "cover",
                            borderRadius: 6,
                            marginBottom: 5,
                          }}
                        />
                        {photo.damage_tags && photo.damage_tags.length > 0 && (
                          <View style={{
                            flexDirection: "row", flexWrap: "wrap", gap: 3, marginBottom: 4,
                          }}>
                            {photo.damage_tags.map((tag) => (
                              <View key={tag} style={{
                                backgroundColor: "#fff0f0",
                                borderRadius: 3,
                                paddingHorizontal: 5,
                                paddingVertical: 2,
                              }}>
                                <Text style={{
                                  fontSize: 7,
                                  color: "#ef4444",
                                  fontFamily: "Helvetica-Bold",
                                }}>
                                  {tag.toUpperCase()}
                                </Text>
                              </View>
                            ))}
                          </View>
                        )}
                        <Text style={{
                          fontSize: 8,
                          color: photoDisplayNote(photo) !== "General view" ? "#444" : "#9ca3af",
                          lineHeight: 1.4,
                          fontStyle: photoDisplayNote(photo) !== "General view" ? "normal" : "italic",
                        }}>
                          {photoDisplayNote(photo)}
                        </Text>
                      </View>
                    ))}
                    {pair.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            ) : null}

            {room.recommendations.length > 0 && (
              <View style={s.recsBox}>
                <Text style={s.recsTitle}>Recommendations</Text>
                {room.recommendations.map((rec, ri2) => (
                  <Text key={ri2} style={s.recItem}>• {rec}</Text>
                ))}
              </View>
            )}

            <View style={s.footer}>
              <Text style={s.footerText}>
                Page {ri + 3} of {totalPages} · Generated by {generatedBy} — snagify.net
              </Text>
              <Text style={s.hashText}>SHA-256: {shortHash}</Text>
            </View>
          </Page>
        );
      })}

      {/* LEGAL + RECOMMENDATIONS + SIGNATURES PAGE */}
      <Page size="A4" style={s.page}>
        {qrDataUrl && (
          <View style={s.qrWrap}>
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={qrDataUrl} style={{ width: 80, height: 80 }} />
            <Text style={s.qrLabel}>Scan to view report online</Text>
          </View>
        )}
        {report.legal_notes && (
          <View style={s.legalBox}>
            <Text style={s.legalTitle}>Legal Notes (RERA / Dubai Law)</Text>
            <Text style={s.legalText}>{report.legal_notes}</Text>
          </View>
        )}

        {report.recommendations.length > 0 && (
          <View style={s.recsBox}>
            <Text style={s.recsTitle}>Overall Recommendations</Text>
            {report.recommendations.map((rec, i) => (
              <Text key={i} style={s.recItem}>• {rec}</Text>
            ))}
          </View>
        )}

        <View style={s.sigSection}>
          <Text style={s.sigStatement}>
            This report has been reviewed and agreed upon by all parties.
          </Text>

          <View style={s.sigGrid}>
            {(["landlord", "tenant"] as const).map((role) => {
              const sig = (meta.signatures ?? []).find((s) => s.signer_type === role);
              const signed = !!(sig?.otp_verified || sig?.signed_at);
              const name = role === "landlord"
                ? (meta.inspection.landlord_name || "—")
                : (meta.inspection.tenant_name || "—");
              return (
                <View key={role} style={s.sigBox}>
                  <Text style={[s.sigRole, { color: accentColor }]}>{role}</Text>
                  <Text style={s.sigName}>{name}</Text>
                  {signed && sig?.signature_data ? (
                    <View style={{ alignItems: "center" }}>
                      {/* eslint-disable-next-line jsx-a11y/alt-text */}
                      <Image
                        src={sig.signature_data}
                        style={{ width: 160, height: 60, objectFit: "contain", marginBottom: 6 }}
                      />
                      <View style={{ width: "100%", height: 1, backgroundColor: "#E5E7EB", marginBottom: 4 }} />
                      {sig.signed_at && (
                        <Text style={{ fontSize: 8, color: "#999" }}>
                          Signed on {formatDate(sig.signed_at)}
                        </Text>
                      )}
                    </View>
                  ) : signed ? (
                    <View style={{ alignItems: "center" }}>
                      <Text style={{ fontSize: 10, color: "#2e7d32", fontFamily: "Helvetica-Bold", marginBottom: 4 }}>
                        ✓ Signed
                      </Text>
                      {sig?.signed_at && (
                        <Text style={{ fontSize: 8, color: "#999" }}>
                          Signed on {formatDate(sig.signed_at)}
                        </Text>
                      )}
                    </View>
                  ) : (
                    <Text style={s.sigPending}>Pending Signature</Text>
                  )}
                </View>
              );
            })}
          </View>

          {meta.agent && (
            <View style={{ marginTop: 20, alignItems: "center" }}>
              <Text style={[s.sigRole, { color: accentColor, marginBottom: 8 }]}>Inspector</Text>
              <Text style={s.sigName}>{meta.agent.full_name ?? "—"}</Text>
              {meta.agent.signature_image_url ? (
                <View style={{ alignItems: "center", marginTop: 8 }}>
                  {/* eslint-disable-next-line jsx-a11y/alt-text */}
                  <Image
                    src={meta.agent.signature_image_url}
                    style={{ width: 160, height: 60, objectFit: "contain", marginBottom: 4 }}
                  />
                  <View style={{ width: "100%", height: 1, backgroundColor: "#E5E7EB" }} />
                </View>
              ) : (
                <Text style={[s.sigPending, { marginTop: 4 }]}>Inspector signature</Text>
              )}
            </View>
          )}

          <View style={s.disclaimerWrap}>
            <Text style={s.disclaimerText}>
              This report documents the condition of the property as observed at the time of inspection.
              It is based on a visual assessment only and does not constitute a structural, electrical,
              or plumbing survey. All parties are advised to review this report carefully. By signing,
              each party acknowledges the findings recorded herein. This document is generated
              electronically and verified by SHA-256 hash.
            </Text>
          </View>

          <View style={s.coverRow}>
            <Text style={s.coverLabel}>Date</Text>
            <Text style={s.coverValue}>{formatDate(new Date().toISOString())}</Text>
          </View>
          <View style={[s.coverRow, { marginTop: 4 }]}>
            <Text style={s.coverLabel}>Timestamp</Text>
            <Text style={s.coverValue}>{new Date().toISOString()}</Text>
          </View>
        </View>

        <View style={s.footer}>
          <Text style={s.hashText}>Document Hash (SHA-256): {documentHash}</Text>
          <Text style={[s.footerText, { marginTop: 4 }]}>
            Page {totalPages} of {totalPages} · Generated by {generatedBy} — snagify.net
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
