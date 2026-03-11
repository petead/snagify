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
  agentSigBox: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 8,
    padding: 16,
    alignItems: "center",
    width: 250,
    minHeight: 100,
    marginBottom: 24,
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
  if (c === "Good") return { bg: GREEN, text: DARK };
  if (c === "Fair") return { bg: YELLOW, text: DARK };
  return { bg: RED, text: "#991B1B" };
}

function riskColor(score: number) {
  if (score <= 3) return GREEN;
  if (score <= 6) return YELLOW;
  return "#EF4444";
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
  overall_condition: string;
  dispute_risk_score: number;
  dispute_risk_reasons: string[];
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

interface InspectionMeta {
  inspection: {
    id: string;
    type?: string;
    created_at?: string;
    landlord_name?: string;
    landlord_email?: string;
    tenant_name?: string;
    tenant_email?: string;
    ejari_ref?: string;
    contract_from?: string;
    contract_to?: string;
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
  } | null;
  rooms: {
    name: string;
    photos: {
      id: string;
      url?: string;
      notes?: string;
      damage_tags?: string[];
      taken_at?: string;
    }[];
  }[];
}

function InspectionReport({
  report,
  meta,
  documentHash,
}: {
  report: ReportData;
  meta: InspectionMeta;
  documentHash: string;
}) {
  const cond = conditionColor(report.overall_condition);
  const riskPct = (report.dispute_risk_score / 10) * 100;
  const inspType = (meta.inspection.type ?? "check-in").toUpperCase();

  return (
    <Document>
      {/* PAGE 1 — COVER */}
      <Page size="A4" style={s.page}>
        <View style={s.coverHeader}>
          <Text style={s.coverTitle}>Snagify</Text>
          <Text style={s.coverSubtitle}>Property Inspection Report</Text>
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
            </View>
          )}

          <View style={s.divider} />

          <View style={s.summaryBox}>
            <Text style={s.summaryTitle}>Executive Summary</Text>
            <Text style={s.summaryText}>{report.executive_summary}</Text>
          </View>

          <View style={[s.condBadge, { backgroundColor: cond.bg }]}>
            <Text style={[s.condBadgeText, { color: cond.text }]}>
              Overall: {report.overall_condition}
            </Text>
          </View>

          <View style={s.riskRow}>
            <Text style={s.riskLabel}>Dispute Risk: {report.dispute_risk_score}/10</Text>
          </View>
          <View style={{ alignItems: "center" }}>
            <View style={[s.riskBarBg, { width: 220 }]}>
              <View
                style={[
                  s.riskBarFill,
                  {
                    width: `${riskPct}%`,
                    backgroundColor: riskColor(report.dispute_risk_score),
                  },
                ]}
              />
            </View>
          </View>
          {report.dispute_risk_reasons.length > 0 && (
            <View style={{ marginTop: 8 }}>
              {report.dispute_risk_reasons.map((reason, i) => (
                <Text key={i} style={{ fontSize: 9, color: "#666", marginBottom: 2 }}>
                  • {reason}
                </Text>
              ))}
            </View>
          )}
        </View>

        <View style={s.footer}>
          <Text style={s.footerText}>Generated by Snagify — snagify.net</Text>
        </View>
      </Page>

      {/* ROOM PAGES */}
      {report.rooms.map((room, ri) => {
        const rc = conditionColor(room.condition);
        const matchingMeta = meta.rooms.find(
          (mr) => mr.name.toLowerCase() === room.name.toLowerCase()
        );
        const photos = matchingMeta?.photos ?? [];

        return (
          <Page key={ri} size="A4" style={s.page}>
            <View style={s.roomHeader}>
              <Text style={s.roomName}>{room.name}</Text>
              <View style={[s.roomCondBadge, { backgroundColor: rc.bg }]}>
                <Text style={[s.roomCondText, { color: rc.text }]}>{room.condition}</Text>
              </View>
            </View>

            <Text style={s.roomSummary}>{room.summary}</Text>

            {photos.filter((p) => p.url && p.url.startsWith("https://")).length > 0 && (
              <View style={{ marginTop: 14 }}>
                <Text style={{
                  fontSize: 10, fontFamily: "Helvetica-Bold",
                  marginBottom: 8, color: DARK,
                }}>
                  Photos
                </Text>
                {/* 2-column grid */}
                {chunkArray(
                  photos.filter((p) => p.url && p.url.startsWith("https://")),
                  2
                ).map((pair, rowIdx) => (
                  <View key={rowIdx} style={{
                    flexDirection: "row", gap: 10, marginBottom: 12,
                  }}>
                    {pair.map((photo) => (
                      <View key={photo.id} style={{ flex: 1 }}>
                        {/* Photo */}
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
                        {/* Damage tags */}
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
                        {/* Notes */}
                        <Text style={{
                          fontSize: 8,
                          color: photo.notes ? "#444" : "#9ca3af",
                          lineHeight: 1.4,
                          fontStyle: photo.notes ? "normal" : "italic",
                        }}>
                          {photo.notes || "General view"}
                        </Text>
                        {/* Date */}
                        {photo.taken_at && (
                          <Text style={{ fontSize: 7, color: "#bbb", marginTop: 3 }}>
                            {new Date(photo.taken_at).toLocaleDateString("en-GB")}
                          </Text>
                        )}
                      </View>
                    ))}
                    {/* Fill empty slot if odd number of photos */}
                    {pair.length === 1 && <View style={{ flex: 1 }} />}
                  </View>
                ))}
              </View>
            )}

            {room.recommendations.length > 0 && (
              <View style={s.recsBox}>
                <Text style={s.recsTitle}>Recommendations</Text>
                {room.recommendations.map((rec, ri2) => (
                  <Text key={ri2} style={s.recItem}>• {rec}</Text>
                ))}
              </View>
            )}

            <View style={s.footer}>
              <Text style={s.footerText}>Generated by Snagify — snagify.net</Text>
            </View>
          </Page>
        );
      })}

      {/* LEGAL + RECOMMENDATIONS + SIGNATURES PAGE */}
      <Page size="A4" style={s.page}>
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
            <View style={s.sigBox}>
              <Text style={s.sigRole}>Landlord</Text>
              <Text style={s.sigName}>{meta.inspection.landlord_name || "—"}</Text>
              <Text style={s.sigPending}>Pending Signature</Text>
            </View>
            <View style={s.sigBox}>
              <Text style={s.sigRole}>Tenant</Text>
              <Text style={s.sigName}>{meta.inspection.tenant_name || "—"}</Text>
              <Text style={s.sigPending}>Pending Signature</Text>
            </View>
          </View>

          <View style={s.agentSigBox}>
            <Text style={s.sigRole}>Inspector / Agent</Text>
            <Text style={s.sigName}>{meta.agent?.full_name || "—"}</Text>
            <Text style={s.sigPending}>Pending Signature</Text>
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
          <Text style={[s.footerText, { marginTop: 4 }]}>Generated by Snagify — snagify.net</Text>
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

async function computeHash(data: string): Promise<string> {
  const encoder = new TextEncoder();
  const buffer = await crypto.subtle.digest("SHA-256", encoder.encode(data));
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function generateInspectionPDF(
  report: ReportData,
  meta: InspectionMeta
): Promise<Blob> {
  const documentHash = await computeHash(JSON.stringify({ report, meta }));

  const doc = <InspectionReport report={report} meta={meta} documentHash={documentHash} />;
  const blob = await pdf(doc).toBlob();
  return blob;
}

/** Server-side: render PDF to Buffer for upload/storage */
export async function generateInspectionPDFBuffer(
  report: ReportData,
  meta: InspectionMeta
): Promise<Buffer> {
  const documentHash = await computeHash(JSON.stringify({ report, meta }));
  const doc = <InspectionReport report={report} meta={meta} documentHash={documentHash} />;
  return renderToBuffer(doc);
}

export type { ReportData, InspectionMeta };
