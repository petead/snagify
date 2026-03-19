import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  generateInspectionPDFBuffer,
  type ReportData,
  type InspectionMeta,
} from "@/lib/generatePDF";
import {
  renderCheckoutPDFToBuffer,
  type CheckoutPDFProps,
} from "@/lib/generateCheckoutPDF";
import { getBrandTokens } from "@/lib/pdf/brandTokens";
import { createClient as createServerClient } from "@/lib/supabase/server";
import {
  compressCheckoutRoomPhotos,
  compressSimpleRoomPhotos,
} from "@/lib/compressImageForPdf";

export const maxDuration = 60;

function getRoomCondition(photos: { damage_tags?: string[] }[]): string {
  const photosWithIssues = photos.filter(
    (p) => (p.damage_tags?.length ?? 0) > 0
  ).length;

  // No damage at all -> Excellent
  if (photosWithIssues === 0) return "Excellent";

  // Any severe tag -> always Needs Attention
  const SEVERE_TAGS = ["BROKEN", "HOLE", "WATER_DAMAGE", "MOLD", "LEAK", "CRACK", "DAMP"];
  const hasSevere = photos.some((p) =>
    (p.damage_tags ?? []).some((t) =>
      SEVERE_TAGS.includes(String(t).toUpperCase())
    )
  );
  if (hasSevere) return "Needs Attention";

  // ANY damage tag present (scratch, stain, mark, wear...)
  // -> at minimum "Needs Attention" for single issue, "Fair" for multiple
  // Previous logic: "Good" even with 1 scratch - too permissive
  if (photosWithIssues === 1 && photos.length >= 3) return "Fair";
  // More than 1 photo with issues OR any issue in small room
  return "Needs Attention";
}

function fallbackExecutiveSummary(row: InspectionRow): string {
  const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
  const propertyName = prop?.building_name ?? prop?.location ?? "Property";
  const unitNumber = prop?.unit_number ?? "";
  const dateStr = row.completed_at ?? row.created_at
    ? new Date((row.completed_at ?? row.created_at) as string).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
  const rooms = row.rooms ?? [];
  let totalPhotos = 0;
  let photosWithIssues = 0;
  for (const r of rooms) {
    const photos = r.photos ?? [];
    for (const p of photos) {
      if (p.url?.startsWith("https://")) totalPhotos += 1;
      if (Array.isArray(p.damage_tags) && p.damage_tags.length > 0) photosWithIssues += 1;
    }
  }
  return `Inspection of ${propertyName}${unitNumber ? `, Unit ${unitNumber}` : ""} completed on ${dateStr}. ${rooms.length} room(s) inspected with ${totalPhotos} photo(s) captured. ${photosWithIssues} issue(s) identified across the property.`;
}

function buildReportDataFromInspection(
  inspection: InspectionRow,
  executiveSummary: string
): ReportData {
  const rooms = (inspection.rooms ?? [])
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((room) => {
      const photos = room.photos ?? [];
      const items: { name: string; condition: string; notes: string }[] = [];
      const condition = room.condition?.trim() || getRoomCondition(photos);
      return {
        name: room.name ?? "Room",
        condition,
        summary: "",
        items,
        recommendations: [] as string[],
      };
    });

  return {
    executive_summary: executiveSummary,
    rooms,
    legal_notes: "",
    recommendations: [],
  };
}

type InspectionRow = {
  id: string;
  agent_id?: string | null;
  type?: string | null;
  status?: string | null;
  report_url?: string | null;
  completed_at?: string | null;
  created_at?: string | null;
  executive_summary?: string | null;
  document_hash?: string | null;
  key_handover?: { item: string; qty: number }[] | null;
  checkin_key_handover?: { item: string; qty: number }[] | null;
  property_id?: string | null;
  tenancy_id?: string | null;
  inspection_type?: string | null;
  properties?: PropRow | PropRow[] | null;
  tenancies?: TenancyRow | TenancyRow[] | null;
  rooms?: RoomRow[] | null;
  signatures?: unknown[] | null;
};

type PropRow = {
  building_name?: string | null;
  unit_number?: string | null;
  property_type?: string | null;
  location?: string | null;
};

type TenancyRow = {
  tenant_name?: string | null;
  tenant_email?: string | null;
  tenant_phone?: string | null;
  landlord_name?: string | null;
  landlord_email?: string | null;
  landlord_phone?: string | null;
  ejari_ref?: string | null;
  contract_from?: string | null;
  contract_to?: string | null;
  actual_end_date?: string | null;
  annual_rent?: number | null;
  security_deposit?: number | null;
  property_size?: number | null;
  tenancy_type?: string | null;
  status?: string | null;
};

type RoomRow = {
  id: string;
  name: string;
  order_index?: number | null;
  condition?: string | null;
  photos?: {
    id: string;
    url: string;
    width?: number | null;
    height?: number | null;
    ai_analysis?: string | null;
    damage_tags?: string[];
    notes?: string | null;
    taken_at?: string | null;
    checkin_photo_id?: string | null;
    is_additional?: boolean;
  }[];
};

const INSPECTION_SELECT = `
  id,
  type,
  status,
  report_url,
  document_hash,
  completed_at,
  created_at,
  executive_summary,
  key_handover,
  checkin_key_handover,
  agent_id,
  property_id,
  tenancy_id,
  properties (
    building_name,
    unit_number,
    property_type,
    location
  ),
  tenancies (
    tenant_name,
    tenant_email,
    tenant_phone,
    landlord_name,
    landlord_email,
    landlord_phone,
    ejari_ref,
    contract_from,
    contract_to,
    actual_end_date,
    annual_rent,
    security_deposit,
    property_size,
    tenancy_type,
    status
  ),
  rooms (
    id,
    name,
    order_index,
    condition,
    photos (
      id,
      url,
      width,
      height,
      ai_analysis,
      damage_tags,
      notes,
      taken_at,
      checkin_photo_id,
      is_additional
    )
  ),
  signatures (
    id,
    signer_type,
    otp_verified,
    signed_at,
    signature_data
  )
`;

/** Build PDF and upload to storage; always overwrites. Returns report_url and buffer. */
export async function buildPdfAndUpload(
  inspectionId: string
): Promise<{ report_url: string | null; buffer: Uint8Array }> {
  try {
    const supabase = await createServerClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select(INSPECTION_SELECT)
      .eq("id", inspectionId)
      .maybeSingle();

    if (inspErr || !inspection) {
      throw new Error(inspErr?.message || "Inspection not found");
    }

    const row = inspection as InspectionRow;
    const executiveSummary = row.executive_summary?.trim() || fallbackExecutiveSummary(row);
    const reportData = buildReportDataFromInspection(row, executiveSummary);
    const keyHandoverRaw =
      ((inspection as Record<string, unknown>).key_handover as unknown[] | null) ?? [];
    const keyHandoverSafe = keyHandoverRaw
      .filter((k): k is { item: string; qty: number } => {
        const rec = k as Record<string, unknown>;
        return typeof rec.item === "string" && typeof rec.qty === "number";
      });
    const checkinKeyHandoverRaw =
      ((inspection as Record<string, unknown>).checkin_key_handover as unknown[] | null) ?? [];
    const checkinKeyHandoverSafe = checkinKeyHandoverRaw
      .filter((k): k is { item: string; qty: number } => {
        const rec = k as Record<string, unknown>;
        return typeof rec.item === "string" && typeof rec.qty === "number";
      });

    const inspectionType = (
      (row as Record<string, unknown>).inspection_type ??
      (row as Record<string, unknown>).type ??
      ""
    ) as string;
    const isCheckout = inspectionType.toLowerCase().includes("check-out");

    let checkinInspectionForPdf: { id: string; created_at: string; document_hash?: string } | null = null;
    let checkinPhotosById: Map<string, { id: string; url: string; damage_tags?: string[]; ai_analysis?: string | null; width?: number | null; height?: number | null; taken_at?: string | null }> = new Map();
    let checkinRoomConditionsByName: Map<string, string> = new Map();
    let checkinRoomsForPdf: import("@/lib/generateCheckoutPDF").CheckinRoomPdf[] | undefined = undefined;

    if (isCheckout && row.tenancy_id) {
      const { data: checkinInspection } = await supabase
        .from("inspections")
        .select("id, created_at, document_hash")
        .eq("tenancy_id", row.tenancy_id)
        .eq("type", "check-in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (checkinInspection) {
        checkinInspectionForPdf = {
          id: checkinInspection.id,
          created_at: String(checkinInspection.created_at ?? ""),
          document_hash: checkinInspection.document_hash ?? undefined,
        };

        const checkinPhotoIds = (row.rooms ?? [])
          .flatMap((r) => (r.photos ?? []).map((p) => p.checkin_photo_id).filter(Boolean)) as string[];
        if (checkinPhotoIds.length > 0) {
          const { data: checkinPhotos } = await supabase
            .from("photos")
            .select("id, url, damage_tags, ai_analysis, width, height, taken_at")
            .in("id", checkinPhotoIds);
          (checkinPhotos ?? []).forEach((p) => {
            checkinPhotosById.set(p.id, {
              id: p.id,
              url: p.url ?? "",
              taken_at: p.taken_at ?? null,
              damage_tags: p.damage_tags ?? undefined,
              ai_analysis: p.ai_analysis ?? undefined,
              width: p.width ?? undefined,
              height: p.height ?? undefined,
            });
          });
        }

        const { data: checkinRoomsRows } = await supabase
          .from("rooms")
          .select(
            `
            id,
            name,
            condition,
            order_index,
            photos (
              id,
              url,
              damage_tags,
              ai_analysis,
              width,
              height,
              taken_at
            )
          `
          )
          .eq("inspection_id", checkinInspection.id)
          .order("order_index", { ascending: true });
        (checkinRoomsRows ?? []).forEach((r: { name: string; condition?: string | null }) => {
          if (r.name) checkinRoomConditionsByName.set(r.name, r.condition ?? "");
        });
        checkinRoomsForPdf = (checkinRoomsRows ?? [])
          .filter((r: { name?: string | null }) => r.name)
          .map(
            (r: {
              id: string;
              name: string;
              photos?: Array<{
                id: string;
                url: string | null;
                damage_tags?: string[] | null;
                ai_analysis?: string | null;
                width?: number | null;
                height?: number | null;
                taken_at?: string | null;
              }> | null;
            }) => ({
              id: r.id,
              name: r.name,
              photos: (r.photos ?? [])
                .filter((p) => p.url && String(p.url).startsWith("https://"))
                .map((p) => ({
                  id: p.id,
                  url: p.url!,
                  taken_at: p.taken_at ?? null,
                  damage_tags: p.damage_tags ?? [],
                  ai_analysis: p.ai_analysis ?? null,
                  width: p.width ?? null,
                  height: p.height ?? null,
                })),
            })
          );
      }
    }

    const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const tenancy = Array.isArray(row.tenancies) ? row.tenancies[0] : row.tenancies;

    const agentId = row.agent_id ?? (inspection as { agent_id?: string }).agent_id;
    const { data: agentRow } = agentId
      ? await supabase
          .from("profiles")
          .select("full_name, rera_number, signature_image_url, account_type, company:companies(*)")
          .eq("id", agentId)
          .maybeSingle()
      : { data: null };

    const agentCompany = agentRow?.company
      ? (Array.isArray(agentRow.company) ? agentRow.company[0] : agentRow.company)
      : null;
    const agentData = agentRow
      ? {
          full_name: agentRow.full_name,
          agency_name: (agentCompany as { name?: string } | null)?.name ?? (agentRow as { agency_name?: string }).agency_name,
          company_logo_url: (agentCompany as { logo_url?: string } | null)?.logo_url ?? (agentRow as { company_logo_url?: string }).company_logo_url,
          company_primary_color: (agentCompany as { primary_color?: string } | null)?.primary_color ?? (agentRow as { company_primary_color?: string }).company_primary_color,
          company_website: (agentCompany as { website?: string } | null)?.website ?? undefined,
          rera_number: agentRow.rera_number,
          signature_image_url: agentRow.signature_image_url,
          account_type: agentRow.account_type ?? "individual",
        }
      : null;

    const meta: InspectionMeta = {
      inspection: {
        id: row.id,
        type: row.type ?? undefined,
        created_at: row.created_at ?? undefined,
        report_url: row.report_url ?? undefined,
        landlord_name: tenancy?.landlord_name ?? undefined,
        landlord_email: tenancy?.landlord_email ?? undefined,
        tenant_name: tenancy?.tenant_name ?? undefined,
        tenant_email: tenancy?.tenant_email ?? undefined,
        ejari_ref: tenancy?.ejari_ref ?? undefined,
        contract_from: tenancy?.contract_from != null ? String(tenancy.contract_from) : undefined,
        contract_to: tenancy?.contract_to != null ? String(tenancy.contract_to) : undefined,
        actual_end_date: tenancy?.actual_end_date != null ? String(tenancy.actual_end_date) : undefined,
        annual_rent: tenancy?.annual_rent ?? undefined,
        security_deposit: tenancy?.security_deposit ?? undefined,
        property_size: tenancy?.property_size ?? undefined,
        tenancy_type: tenancy?.tenancy_type ?? undefined,
        status: tenancy?.status ?? undefined,
        key_handover: keyHandoverSafe,
        checkin_key_handover: checkinKeyHandoverSafe,
      },
      property: prop
        ? {
            building_name: prop.building_name ?? undefined,
            unit_number: prop.unit_number ?? undefined,
            location: prop.location ?? undefined,
            property_type: prop.property_type ?? undefined,
          }
        : null,
      agent: agentData
        ? {
            full_name: agentData.full_name ?? undefined,
            agency_name: agentData.agency_name ?? undefined,
            company_logo_url: (agentData as { company_logo_url?: string }).company_logo_url ?? undefined,
            company_primary_color: (agentData as { company_primary_color?: string }).company_primary_color ?? undefined,
            company_website: (agentData as { company_website?: string }).company_website ?? undefined,
            rera_number: (agentData as { rera_number?: string }).rera_number ?? undefined,
            signature_image_url: (agentData as { signature_image_url?: string }).signature_image_url ?? undefined,
            account_type: (agentData as { account_type?: string }).account_type ?? "individual",
          }
        : null,
      rooms: (row.rooms ?? [])
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((room) => {
          const sortedPhotos = [...(room.photos ?? [])]
            .filter((p) => p.url && p.url.startsWith("https://"))
            .sort((a, b) => (a.damage_tags?.length ?? 0) - (b.damage_tags?.length ?? 0));
          return {
            name: room.name,
            photos: sortedPhotos.map((p) => ({
              id: p.id,
              url: p.url,
              width: p.width ?? undefined,
              height: p.height ?? undefined,
              notes: p.notes ?? undefined,
              damage_tags: p.damage_tags ?? [],
              taken_at: p.taken_at ?? undefined,
              ai_analysis: p.ai_analysis ?? undefined,
            })),
          };
        }),
      checkinPhotoMap: undefined,
      checkinRooms: undefined,
      signatures: ((row.signatures ?? []) as {
        signer_type?: string;
        signed_at?: string | null;
        signature_data?: string | null;
        otp_verified?: boolean;
      }[]).map((s) => ({
        signer_type: s.signer_type ?? "",
        signed_at: s.signed_at ?? null,
        signature_data: s.signature_data ?? null,
        otp_verified: s.otp_verified ?? false,
      })),
    };

    /** Smaller JPEG data URLs for PDF embedding only — document_hash uses original meta above */
    const metaForPdf: InspectionMeta = {
      ...meta,
      rooms: await compressSimpleRoomPhotos(meta.rooms),
    };

    const dataString = JSON.stringify({
      inspectionId,
      rooms: reportData.rooms,
      photos: meta.rooms,
      keyHandover: meta.inspection.key_handover ?? [],
      generatedAt: new Date().toISOString(),
    });
    const documentHash = createHash("sha256").update(dataString).digest("hex");

    await supabase
      .from("inspections")
      .update({ document_hash: documentHash })
      .eq("id", inspectionId);

    let pdfBuffer: Buffer;
    if (isCheckout) {
      const primaryColor = (agentData as { company_primary_color?: string } | null)?.company_primary_color ?? "#6366F1";
      const tokens = getBrandTokens(primaryColor);
      const sortedRooms = (row.rooms ?? []).sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0));
      const checkinRoomsForPdfCompressed =
        checkinRoomsForPdf && checkinRoomsForPdf.length > 0
          ? await compressSimpleRoomPhotos(checkinRoomsForPdf)
          : checkinRoomsForPdf;

      const roomsWithDelta: CheckoutPDFProps["rooms"] = await Promise.all(
        sortedRooms.map(async (room) => {
          const photosRaw = (room.photos ?? [])
            .filter((p) => p.url && p.url.startsWith("https://"))
            .map((p) => ({
              id: p.id,
              url: p.url!,
              taken_at: p.taken_at ?? null,
              damage_tags: p.damage_tags,
              ai_analysis: p.ai_analysis ?? undefined,
              width: p.width ?? null,
              height: p.height ?? null,
              checkin_photo_id: p.checkin_photo_id ?? null,
              is_additional: p.is_additional ?? false,
              checkin_photo: p.checkin_photo_id ? (checkinPhotosById.get(p.checkin_photo_id) ?? null) : null,
            }));
          const photos = await compressCheckoutRoomPhotos(photosRaw);
          return {
            id: room.id,
            name: room.name ?? "Room",
            order_index: room.order_index ?? 0,
            condition: room.condition ?? undefined,
            checkin_condition: checkinRoomConditionsByName.get(room.name ?? "") ?? undefined,
            photos,
          };
        })
      );

      const keyHandoverForPdf = keyHandoverSafe.map((k) => ({ label: k.item, quantity: k.qty }));
      const checkinKeyHandoverForPdf = checkinKeyHandoverSafe.map((k) => ({ label: k.item, quantity: k.qty }));

      const checkoutProps: CheckoutPDFProps = {
        checkinRooms: checkinRoomsForPdfCompressed,
        inspection: {
          id: row.id,
          type: row.type ?? "check-out",
          created_at: String(row.created_at ?? ""),
          completed_at: row.completed_at != null ? String(row.completed_at) : undefined,
          executive_summary: executiveSummary,
          document_hash: documentHash,
          key_handover: keyHandoverForPdf,
          checkin_key_handover: checkinKeyHandoverForPdf,
        },
        checkinInspection: checkinInspectionForPdf,
        property: {
          location: prop?.location ?? "",
          building_name: prop?.building_name ?? undefined,
          unit_number: prop?.unit_number ?? undefined,
          property_type: prop?.property_type ?? undefined,
        },
        tenancy: {
          contract_from: tenancy?.contract_from != null ? String(tenancy.contract_from) : undefined,
          contract_to: tenancy?.contract_to != null ? String(tenancy.contract_to) : undefined,
          actual_end_date: tenancy?.actual_end_date != null ? String(tenancy.actual_end_date) : undefined,
          tenant_name: tenancy?.tenant_name ?? "",
          tenant_email: tenancy?.tenant_email ?? undefined,
          landlord_name: tenancy?.landlord_name ?? undefined,
          landlord_email: tenancy?.landlord_email ?? undefined,
        },
        rooms: roomsWithDelta,
        signatures: (meta.signatures ?? []).map((s) => ({
          signer_type: s.signer_type,
          signer_name: undefined,
          signature_data: s.signature_data ?? undefined,
          signed_at: s.signed_at ?? null,
        })),
        profile: agentData
          ? {
              full_name: agentData.full_name,
              rera_number: (agentData as { rera_number?: string }).rera_number,
              signature_image_url: (agentData as { signature_image_url?: string }).signature_image_url,
              account_type: (agentData as { account_type?: string }).account_type ?? "individual",
            }
          : undefined,
        agencyName: agentData?.agency_name ?? "Agency",
        agencyWebsite: (agentData as { company_website?: string }).company_website ?? "",
        agencyLogoUrl: (agentData as { company_logo_url?: string }).company_logo_url ?? null,
        tokens,
        qrCodeDataUrl: undefined,
      };

      pdfBuffer = await renderCheckoutPDFToBuffer(checkoutProps);
    } else {
      pdfBuffer = await generateInspectionPDFBuffer(reportData, metaForPdf, documentHash);
    }

    if (!agentId) {
      throw new Error("Inspection has no agent_id; cannot upload report to user path");
    }
    const fileName = `${agentId}/${inspectionId}/report.pdf`;
    const legacyReportPaths = [
      `report_${inspectionId}.pdf`,
      `${inspectionId}/${inspectionId}.pdf`,
    ];

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const storageClient =
      supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;

    const { error: removeErr } = await storageClient.storage
      .from("reports")
      .remove([fileName, ...legacyReportPaths]);
    if (removeErr) {
      console.warn("[generate-pdf] remove old PDF (ok if missing):", removeErr.message);
    }

    const { error: uploadError } = await storageClient.storage
      .from("reports")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    let reportUrl: string | null = null;
    if (uploadError) {
      console.error("[generate-pdf] PDF upload to storage FAILED:", uploadError.message);
    } else {
      const { data: urlData } = storageClient.storage.from("reports").getPublicUrl(fileName);
      const bustUrl = `${urlData.publicUrl}?t=${Date.now()}`;
      const { error: updateErr } = await storageClient
        .from("inspections")
        .update({ report_url: bustUrl })
        .eq("id", inspectionId);
      if (updateErr) {
        console.error("[generate-pdf] Failed to save report_url:", updateErr.message);
      } else {
        reportUrl = bustUrl;
      }
    }

    return { report_url: reportUrl, buffer: new Uint8Array(pdfBuffer) };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[buildPdfAndUpload] CRASH:", msg);
    throw new Error(`buildPdfAndUpload — ${msg}`);
  }
}

export async function POST(request: NextRequest) {
  let step = "init";
  try {
    step = "parse body";
    const { inspectionId } = (await request.json()) as { inspectionId?: string };
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }
    step = "buildPdfAndUpload";
    const { report_url: _reportUrl, buffer } = await buildPdfAndUpload(inspectionId);

    step = "return pdf response";
    return new NextResponse(Buffer.from(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Snagify_Report_${inspectionId}.pdf"`,
        "Cache-Control": "no-store, no-cache, must-revalidate",
        "Content-Length": buffer.length.toString(),
      },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : "";
    console.error(`[generate-pdf] CRASH at step="${step}":`, msg);
    console.error("[generate-pdf] STACK:", stack);
    return NextResponse.json(
      { error: `Failed at step: ${step} — ${msg || "PDF generation failed"}` },
      { status: 500 }
    );
  }
}
