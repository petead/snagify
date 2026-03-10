import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateInspectionPDFBuffer,
  type ReportData,
  type InspectionMeta,
} from "@/lib/generatePDF";
import { createClient as createServerClient } from "@/lib/supabase/server";

type RoomItemRow = {
  room_id: string;
  name: string;
  condition?: string | null;
  notes?: string | null;
  ai_description?: string | null;
};

type RoomPhotoRow = { url: string; ai_analysis?: string | null };

export const maxDuration = 60;

function toReportData(raw: unknown): ReportData {
  const src = (raw ?? {}) as Partial<ReportData> & {
    rooms?: Array<{
      name?: string;
      condition?: string;
      summary?: string;
      items?: Array<{ name?: string; condition?: string; notes?: string }>;
      recommendations?: string[];
    }>;
  };

  return {
    executive_summary: src.executive_summary ?? "",
    overall_condition: src.overall_condition ?? "Good",
    dispute_risk_score: Number(src.dispute_risk_score ?? 0),
    dispute_risk_reasons: Array.isArray(src.dispute_risk_reasons)
      ? src.dispute_risk_reasons.filter((x): x is string => typeof x === "string")
      : [],
    rooms: Array.isArray(src.rooms)
      ? src.rooms.map((room) => ({
          name: room?.name ?? "Room",
          condition: room?.condition ?? "Good",
          summary: room?.summary ?? "",
          items: Array.isArray(room?.items)
            ? room.items.map((i) => ({
                name: i?.name ?? "",
                condition: i?.condition ?? "Good",
                notes: i?.notes ?? "",
              }))
            : [],
          recommendations: Array.isArray(room?.recommendations)
            ? room.recommendations.filter((x): x is string => typeof x === "string")
            : [],
        }))
      : [],
    legal_notes: src.legal_notes ?? "",
    recommendations: Array.isArray(src.recommendations)
      ? src.recommendations.filter((x): x is string => typeof x === "string")
      : [],
  };
}

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
        id, type, created_at, property_id, agent_id, tenancy_id, report_data,
        properties (*),
        tenancies (*),
        rooms (
          id, name, order_index,
          photos (*)
        ),
        signatures (*)
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

    const reportData = toReportData(inspection.report_data);
    if (!reportData) {
      return NextResponse.json(
        { error: "Missing report_data. Generate report content first." },
        { status: 400 }
      );
    }

    const prop = Array.isArray(inspection.properties)
      ? inspection.properties[0]
      : inspection.properties;
    const tenancy = Array.isArray(inspection.tenancies)
      ? inspection.tenancies[0]
      : inspection.tenancies;

    const { data: agent } = await supabase
      .from("profiles")
      .select("full_name, agency_name")
      .eq("id", inspection.agent_id)
      .single();

    const roomIds = (inspection.rooms ?? []).map((r: { id: string }) => r.id);
    const { data: roomItems } =
      roomIds.length > 0
        ? await supabase.from("room_items").select("*").in("room_id", roomIds)
        : { data: [] as RoomItemRow[] };

    const roomItemsByRoom = (roomItems ?? []).reduce(
      (acc: Record<string, RoomItemRow[]>, item: RoomItemRow) => {
        (acc[item.room_id] ??= []).push(item);
        return acc;
      },
      {} as Record<string, RoomItemRow[]>
    );

    const meta: InspectionMeta = {
      inspection: {
        id: inspection.id,
        type: inspection.type ?? undefined,
        created_at: inspection.created_at ?? undefined,
        landlord_name: tenancy?.landlord_name ?? undefined,
        landlord_email: tenancy?.landlord_email ?? undefined,
        tenant_name: tenancy?.tenant_name ?? undefined,
        tenant_email: tenancy?.tenant_email ?? undefined,
        ejari_ref: tenancy?.ejari_ref ?? undefined,
        contract_from: tenancy?.contract_from ?? undefined,
        contract_to: tenancy?.contract_to ?? undefined,
      },
      property: prop
        ? {
            building_name: prop.building_name ?? undefined,
            unit_number: prop.unit_number ?? undefined,
            address: prop.address ?? undefined,
            property_type: prop.property_type ?? undefined,
          }
        : null,
      agent: agent
        ? {
            full_name: agent.full_name ?? undefined,
            agency_name: agent.agency_name ?? undefined,
          }
        : null,
      rooms: (inspection.rooms ?? [])
        .sort(
          (a: { order_index: number | null }, b: { order_index: number | null }) =>
            (a.order_index ?? 0) - (b.order_index ?? 0)
        )
        .map((room: { id: string; name: string; photos?: RoomPhotoRow[] }) => {
          const mergedItems = (roomItemsByRoom[room.id] ?? []).map((i: RoomItemRow) => ({
            name: i.name,
            condition: i.condition ?? "Good",
            notes: i.notes ?? "",
          }));
          const reportRoom = reportData.rooms.find(
            (r: { name: string }) => r.name.toLowerCase() === room.name.toLowerCase()
          );
          if (
            reportRoom &&
            (!Array.isArray(reportRoom.items) || reportRoom.items.length === 0) &&
            mergedItems.length > 0
          ) {
            reportRoom.items = mergedItems;
          }
          return {
            name: room.name,
            photos: (room.photos ?? []).map((p: RoomPhotoRow) => ({
              url: p.url,
              ai_analysis: p.ai_analysis ?? undefined,
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
