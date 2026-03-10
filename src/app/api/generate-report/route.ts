import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import type { ReportData } from "@/lib/generatePDF";

export const maxDuration = 60;

const REPORT_PROMPT = `You are a professional property inspector in Dubai.
Generate a formal property inspection report based on this data.

Return ONLY a JSON object with this exact structure (no other text):
{
  "executive_summary": "2-3 sentences overview of the inspection findings",
  "overall_condition": "Good" | "Fair" | "Poor",
  "dispute_risk_score": <number 1-10, where 10 is highest risk>,
  "dispute_risk_reasons": ["reason 1", "reason 2"],
  "rooms": [
    {
      "name": "Room Name",
      "condition": "Good" | "Fair" | "Poor",
      "summary": "Brief summary of room condition",
      "items": [{ "name": "Item", "condition": "Good|Fair|Poor", "notes": "any notes" }],
      "recommendations": ["recommendation 1"]
    }
  ],
  "legal_notes": "RERA/Dubai law relevant clauses and notes",
  "recommendations": ["overall recommendation 1", "overall recommendation 2"]
}`;

export async function POST(request: Request) {
  try {
    const { inspectionId } = (await request.json()) as { inspectionId: string };
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
    }

    const supabase = await createClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select("id, type, status, created_at, property_id, agent_id, tenancy_id")
      .eq("id", inspectionId)
      .single();
    if (inspErr || !inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    let tenancy: {
      landlord_name?: string | null;
      landlord_email?: string | null;
      tenant_name?: string | null;
      tenant_email?: string | null;
      ejari_ref?: string | null;
      contract_from?: string | null;
      contract_to?: string | null;
      annual_rent?: number | null;
      security_deposit?: number | null;
      property_size?: number | null;
    } | null = null;
    if (inspection.tenancy_id) {
      const { data: t } = await supabase
        .from("tenancies")
        .select("landlord_name, landlord_email, tenant_name, tenant_email, ejari_ref, contract_from, contract_to, annual_rent, security_deposit, property_size")
        .eq("id", inspection.tenancy_id)
        .single();
      tenancy = t ?? null;
    }

    const { data: property } = await supabase
      .from("properties")
      .select("*")
      .eq("id", inspection.property_id)
      .single();

    const { data: agent } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", inspection.agent_id)
      .single();

    const { data: rooms } = await supabase
      .from("rooms")
      .select("*")
      .eq("inspection_id", inspectionId)
      .order("order_index", { ascending: true });

    const roomIds = (rooms ?? []).map((r) => r.id);
    const roomItems: Record<string, { room_id: string; name: string; condition: string | null; notes: string | null }[]> = {};
    const roomPhotos: Record<string, { room_id: string; url: string; ai_analysis: string | null }[]> = {};

    if (roomIds.length > 0) {
      const [itemsRes, photosRes] = await Promise.all([
        supabase.from("room_items").select("*").in("room_id", roomIds),
        supabase.from("photos").select("*").in("room_id", roomIds),
      ]);
      for (const item of itemsRes.data ?? []) {
        (roomItems[item.room_id] ??= []).push(item);
      }
      for (const photo of photosRes.data ?? []) {
        (roomPhotos[photo.room_id] ??= []).push(photo);
      }
    }

    const { data: signatures } = await supabase
      .from("signatures")
      .select("*")
      .eq("inspection_id", inspectionId);

    const inspectionData = {
      inspection: {
        id: inspection.id,
        type: inspection.type,
        status: inspection.status,
        created_at: inspection.created_at,
        landlord_name: tenancy?.landlord_name ?? null,
        landlord_email: tenancy?.landlord_email ?? null,
        tenant_name: tenancy?.tenant_name ?? null,
        tenant_email: tenancy?.tenant_email ?? null,
        ejari_ref: tenancy?.ejari_ref ?? null,
        contract_from: tenancy?.contract_from ?? null,
        contract_to: tenancy?.contract_to ?? null,
        annual_rent: tenancy?.annual_rent ?? null,
        security_deposit: tenancy?.security_deposit ?? null,
        property_size: tenancy?.property_size ?? null,
      },
      property: property
        ? {
            building_name: property.building_name,
            unit_number: property.unit_number,
            address: property.address,
            property_type: property.property_type,
            furnished: property.furnished,
          }
        : null,
      agent: agent
        ? { full_name: agent.full_name, agency_name: agent.agency_name, phone: agent.phone }
        : null,
      rooms: (rooms ?? []).map((r) => ({
        name: r.name,
        overall_condition: r.overall_condition,
        items: (roomItems[r.id] ?? []).map((i) => ({
          name: i.name,
          condition: i.condition,
          notes: i.notes,
        })),
        photos: (roomPhotos[r.id] ?? []).map((p) => ({
          url: p.url,
          ai_analysis: p.ai_analysis,
        })),
      })),
      signatures: signatures ?? [],
    };

    const anthropic = new Anthropic({ apiKey, timeout: 120000 });
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${REPORT_PROMPT}\n\nInspection Data:\n${JSON.stringify(inspectionData, null, 2)}`,
        },
      ],
    });

    const text = response.content
      .filter((block): block is { type: "text"; text: string } => block.type === "text")
      .map((block) => block.text)
      .join("")
      .trim();

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return NextResponse.json({ error: "Failed to parse report from AI" }, { status: 500 });
    }

    const report = JSON.parse(jsonMatch[0]) as Partial<ReportData>;
    const reportData: ReportData = {
      executive_summary: report.executive_summary ?? "",
      overall_condition: report.overall_condition ?? "Good",
      dispute_risk_score: report.dispute_risk_score ?? 0,
      dispute_risk_reasons: report.dispute_risk_reasons ?? [],
      rooms: (report.rooms ?? []).map((r) => ({
        name: r.name ?? "Room",
        condition: r.condition ?? "Good",
        summary: r.summary ?? "",
        items: (r.items ?? []).map((i) => ({
          name: i.name ?? "",
          condition: i.condition ?? "Good",
          notes: i.notes ?? "",
        })),
        recommendations: r.recommendations ?? [],
      })),
      legal_notes: report.legal_notes ?? "",
      recommendations: report.recommendations ?? [],
    };

    await supabase
      .from("inspections")
      .update({
        report_data: reportData,
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", inspectionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("generate-report error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 }
    );
  }
}
