import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateInspectionPDFBuffer,
  type ReportData,
  type InspectionMeta,
} from "@/lib/generatePDF";
import { createClient as createServerClient } from "@/lib/supabase/server";

export const maxDuration = 60;

/** Build ReportData from rooms + photos (damage_tags → items) */
function buildReportDataFromInspection(inspection: InspectionRow): ReportData {
  const rooms = (inspection.rooms ?? [])
    .sort(
      (a, b) => (a.order_index ?? 0) - (b.order_index ?? 0)
    )
    .map((room) => {
      const photos = room.photos ?? [];
      const items: { name: string; condition: string; notes: string }[] = [];
      for (const p of photos) {
        const tags = Array.isArray(p.damage_tags) ? p.damage_tags : [];
        for (const tag of tags) {
          items.push({
            name: tag,
            condition: "Poor",
            notes: (p.notes ?? p.ai_analysis ?? "").trim(),
          });
        }
      }
      return {
        name: room.name ?? "Room",
        condition: (room.overall_condition ?? "Good").trim() || "Good",
        summary: "",
        items,
        recommendations: [] as string[],
      };
    });

  const overallCondition =
    rooms.length > 0 ? rooms[0].condition : "Good";

  return {
    executive_summary: "Inspection report generated from inspection data.",
    overall_condition: overallCondition,
    dispute_risk_score: 0,
    dispute_risk_reasons: [],
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
  overall_condition?: string | null;
  photos?: { id: string; url: string; ai_analysis?: string | null; damage_tags?: string[]; notes?: string | null; taken_at?: string | null }[];
};

export async function POST(request: NextRequest) {
  try {
    const { inspectionId } = (await request.json()) as { inspectionId?: string };
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    const supabase = await createServerClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select(
        `
        id,
        type,
        status,
        report_url,
        completed_at,
        created_at,
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
          overall_condition,
          photos (
            id,
            url,
            ai_analysis,
            damage_tags,
            notes,
            taken_at
          )
        ),
        signatures (
          id,
          signer_type,
          otp_verified,
          signed_at,
          signature_data
        )
      `
      )
      .eq("id", inspectionId)
      .single();

    if (inspErr || !inspection) {
      return NextResponse.json(
        { error: inspErr?.message || "Not found" },
        { status: 404 }
      );
    }

    const row = inspection as InspectionRow;
    const reportData = buildReportDataFromInspection(row);

    const prop = Array.isArray(row.properties) ? row.properties[0] : row.properties;
    const tenancy = Array.isArray(row.tenancies) ? row.tenancies[0] : row.tenancies;

    const agentId = row.agent_id ?? (inspection as { agent_id?: string }).agent_id;
    const { data: agentData } = agentId
      ? await supabase
          .from("profiles")
          .select("full_name, agency_name")
          .eq("id", agentId)
          .single()
      : { data: null };

    const meta: InspectionMeta = {
      inspection: {
        id: row.id,
        type: row.type ?? undefined,
        created_at: row.created_at ?? undefined,
        landlord_name: tenancy?.landlord_name ?? undefined,
        landlord_email: tenancy?.landlord_email ?? undefined,
        tenant_name: tenancy?.tenant_name ?? undefined,
        tenant_email: tenancy?.tenant_email ?? undefined,
        ejari_ref: tenancy?.ejari_ref ?? undefined,
        contract_from: tenancy?.contract_from != null ? String(tenancy.contract_from) : undefined,
        contract_to: tenancy?.contract_to != null ? String(tenancy.contract_to) : undefined,
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
          }
        : null,
      rooms: (row.rooms ?? [])
        .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
        .map((room) => {
          const sortedPhotos = [...(room.photos ?? [])].sort(
            (a, b) => (a.damage_tags?.length ?? 0) - (b.damage_tags?.length ?? 0)
          );
          return {
            name: room.name,
            photos: sortedPhotos.map((p) => ({
              id: p.id,
              url: p.url,
              notes: p.notes ?? undefined,
              damage_tags: p.damage_tags ?? [],
              taken_at: p.taken_at ?? undefined,
            })),
          };
        }),
    };

    const pdfBuffer = await generateInspectionPDFBuffer(reportData, meta);

    const fileName = `report_${inspectionId}_${Date.now()}.pdf`;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const storageClient =
      supabaseUrl && serviceRoleKey
        ? createClient(supabaseUrl, serviceRoleKey)
        : supabase;

    const { error: uploadError } = await storageClient.storage
      .from("reports")
      .upload(fileName, pdfBuffer, {
        contentType: "application/pdf",
        upsert: true,
      });

    if (!uploadError) {
      const {
        data: { publicUrl },
      } = storageClient.storage.from("reports").getPublicUrl(fileName);
      await storageClient
        .from("inspections")
        .update({ report_url: publicUrl })
        .eq("id", inspectionId);
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
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
