import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHash } from "node:crypto";
import {
  generateInspectionPDFBuffer,
  type ReportData,
  type InspectionMeta,
} from "@/lib/generatePDF";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

function getRoomCondition(photos: { damage_tags?: string[] }[]): string {
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

function fallbackExecutiveSummary(row: InspectionRow): string {
  const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
  const propertyName = prop?.building_name ?? prop?.address ?? "Property";
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
  properties?: PropRow | PropRow[] | null;
  tenancies?: TenancyRow | TenancyRow[] | null;
  rooms?: RoomRow[] | null;
  signatures?: unknown[] | null;
};

type PropRow = {
  building_name?: string | null;
  unit_number?: string | null;
  property_type?: string | null;
  address?: string | null;
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
  annual_rent?: number | null;
  security_deposit?: number | null;
};

type RoomRow = {
  id: string;
  name: string;
  order_index?: number | null;
  condition?: string | null;
  photos?: {
    id: string;
    url: string;
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
    address
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
    annual_rent,
    security_deposit
  ),
  rooms (
    id,
    name,
    order_index,
    condition,
    photos (
      id,
      url,
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
  const supabase = await createServerClient();

  const { data: inspection, error: inspErr } = await supabase
    .from("inspections")
    .select(INSPECTION_SELECT)
    .eq("id", inspectionId)
    .single();

  if (inspErr || !inspection) {
    throw new Error(inspErr?.message || "Inspection not found");
  }

  const row = inspection as InspectionRow;
  const executiveSummary = row.executive_summary?.trim() || fallbackExecutiveSummary(row);
  const reportData = buildReportDataFromInspection(row, executiveSummary);

  let checkinPhotoMap: Record<string, { id: string; url: string; damage_tags?: string[]; ai_analysis?: string | null }> = {};
  let checkinRooms: { name: string; photos: { id: string; url?: string; damage_tags?: string[]; ai_analysis?: string | null }[] }[] = [];
  const isCheckout = (row.type ?? "").toLowerCase().includes("check-out");
  if (isCheckout && row.property_id) {
    const { data: checkinInspection } = await supabase
      .from("inspections")
      .select("id")
      .eq("property_id", row.property_id)
      .eq("type", "check-in")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (checkinInspection) {
      const { data: checkinRoomsData } = await supabase
        .from("rooms")
        .select("id, name, order_index, photos (id, url, damage_tags, ai_analysis)")
        .eq("inspection_id", checkinInspection.id);
      (checkinRoomsData ?? []).forEach((room: { name: string; photos?: { id: string; url?: string; damage_tags?: string[]; ai_analysis?: string | null }[] }) => {
        if (room.photos?.length) {
          checkinRooms.push({ name: room.name, photos: room.photos });
          room.photos.forEach((p: { id: string; url?: string; damage_tags?: string[]; ai_analysis?: string | null }) => {
            if (p.url) checkinPhotoMap[p.id] = { id: p.id, url: p.url, damage_tags: p.damage_tags, ai_analysis: p.ai_analysis };
          });
        }
      });
    }
  }

  const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
  const tenancy = Array.isArray(row.tenancies) ? row.tenancies[0] : row.tenancies;

  const agentId = row.agent_id ?? (inspection as { agent_id?: string }).agent_id;
  const { data: agentData } = agentId
    ? await supabase
        .from("profiles")
        .select("full_name, agency_name, company_logo_url, company_primary_color, rera_number, signature_image_url")
        .eq("id", agentId)
        .single()
    : { data: null };

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
      key_handover: Array.isArray(row.key_handover) ? row.key_handover : undefined,
      checkin_key_handover: Array.isArray(row.checkin_key_handover) ? row.checkin_key_handover : undefined,
    },
    property: prop
      ? {
          building_name: prop.building_name ?? undefined,
          unit_number: prop.unit_number ?? undefined,
          address: prop.address ?? undefined,
          property_type: prop.property_type ?? undefined,
        }
      : null,
    agent: agentData
      ? {
          full_name: agentData.full_name ?? undefined,
          agency_name: agentData.agency_name ?? undefined,
          company_logo_url: (agentData as { company_logo_url?: string }).company_logo_url ?? undefined,
          company_primary_color: (agentData as { company_primary_color?: string }).company_primary_color ?? undefined,
          rera_number: (agentData as { rera_number?: string }).rera_number ?? undefined,
          signature_image_url: (agentData as { signature_image_url?: string }).signature_image_url ?? undefined,
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
            notes: p.notes ?? undefined,
            damage_tags: p.damage_tags ?? [],
            taken_at: p.taken_at ?? undefined,
            checkin_photo_id: p.checkin_photo_id ?? undefined,
            is_additional: p.is_additional ?? false,
            ai_analysis: p.ai_analysis ?? undefined,
          })),
        };
      }),
    checkinPhotoMap: isCheckout ? checkinPhotoMap : undefined,
    checkinRooms: isCheckout ? checkinRooms : undefined,
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

  const pdfBuffer = await generateInspectionPDFBuffer(reportData, meta, documentHash);

  const filePath = `${inspectionId}/${inspectionId}.pdf`;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const storageClient =
    supabaseUrl && serviceRoleKey ? createClient(supabaseUrl, serviceRoleKey) : supabase;

  const { error: uploadError } = await storageClient.storage
    .from("reports")
    .upload(filePath, pdfBuffer, {
      contentType: "application/pdf",
      upsert: true,
    });

  let reportUrl: string | null = null;
  if (uploadError) {
    console.error("PDF upload to storage FAILED:", uploadError.message);
  } else {
    const { data: urlData } = storageClient.storage.from("reports").getPublicUrl(filePath);
    reportUrl = urlData.publicUrl;
    const { error: updateErr } = await storageClient
      .from("inspections")
      .update({ report_url: reportUrl })
      .eq("id", inspectionId);
    if (updateErr) {
      console.error("Failed to save report_url:", updateErr.message);
    }
  }

  return { report_url: reportUrl, buffer: new Uint8Array(pdfBuffer) };
}

export async function POST(request: NextRequest) {
  try {
    const { inspectionId } = (await request.json()) as { inspectionId?: string };
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    const { report_url: _reportUrl, buffer } = await buildPdfAndUpload(inspectionId);

    return new NextResponse(Buffer.from(buffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="Snagify_Report_${inspectionId}.pdf"`,
      },
    });
  } catch (err) {
    console.error("generate-pdf error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "PDF generation failed" },
      { status: 500 }
    );
  }
}
