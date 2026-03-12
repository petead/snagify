import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";

export const maxDuration = 60;

const EXEC_SUMMARY_SYSTEM = `You are a professional property inspector in Dubai, UAE.
Write a concise executive summary (3-5 sentences) for a property inspection report. Be factual, professional, and specific.

Mention: total rooms inspected, total photos taken, key findings (damage types and which rooms), and the overall condition.
If damages are found, note which rooms need attention.
If no damages, confirm the property is in good order.

Write in flowing prose, NO bullet points.
Do NOT mention "AI" or "automated".
Write as the inspector addressing landlord and tenant.`;

const SEVERE_TAGS = ["BROKEN", "HOLE", "WATER_DAMAGE", "MOLD"];

/** Room condition from photos (damage tags). Same logic as in generatePDF. */
function getRoomCondition(photos: { damage_tags?: string[] }[]): string {
  const photosWithIssues = photos.filter(
    (p) => (p.damage_tags?.length ?? 0) > 0
  ).length;
  if (photosWithIssues === 0) return "Excellent";
  const hasSevere = photos.some((p) =>
    (p.damage_tags ?? []).some((t) =>
      SEVERE_TAGS.includes(String(t).toUpperCase())
    )
  );
  if (hasSevere) return "Needs Attention";
  if (photos.length === 0) return "Good";
  if (photosWithIssues / photos.length >= 0.5) return "Fair";
  return "Good";
}

export async function POST(request: Request) {
  try {
    const { inspectionId } = (await request.json()) as { inspectionId: string };
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    const supabase = await createClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select("id, type, status, created_at, property_id, agent_id, tenancy_id, executive_summary, overall_condition, dispute_risk, report_url")
      .eq("id", inspectionId)
      .single();
    if (inspErr || !inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const row = inspection as { report_url?: string | null; executive_summary?: string | null };
    if (row.report_url && row.executive_summary) {
      return NextResponse.json({
        success: true,
        report_url: row.report_url,
        cached: true,
      });
    }

    // Only generate summary + condition + risk if not already computed
    if (!inspection.executive_summary) {
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) {
        return NextResponse.json({ error: "ANTHROPIC_API_KEY not configured" }, { status: 500 });
      }

      let tenancy: {
        contract_from?: string | null;
        contract_to?: string | null;
      } | null = null;
      if (inspection.tenancy_id) {
        const { data: t } = await supabase
          .from("tenancies")
          .select("contract_from, contract_to")
          .eq("id", inspection.tenancy_id)
          .single();
        tenancy = t ?? null;
      }

      const { data: property } = await supabase
        .from("properties")
        .select("building_name, unit_number, address")
        .eq("id", inspection.property_id)
        .single();

      const { data: rooms } = await supabase
        .from("rooms")
        .select("id, name, order_index")
        .eq("inspection_id", inspectionId)
        .order("order_index", { ascending: true });

      const roomIds = (rooms ?? []).map((r) => r.id);
      const roomPhotos: Record<string, { damage_tags: string[] }[]> = {};

      if (roomIds.length > 0) {
        const { data: photosData } = await supabase
          .from("photos")
          .select("room_id, damage_tags")
          .in("room_id", roomIds);
        for (const photo of photosData ?? []) {
          const tags = Array.isArray(photo.damage_tags) ? photo.damage_tags : [];
          (roomPhotos[photo.room_id] ??= []).push({ damage_tags: tags });
        }
      }

      const allPhotos = (rooms ?? []).flatMap((r) => (roomPhotos[r.id] ?? []));
      const totalPhotos = allPhotos.length;
      const photosWithIssues = allPhotos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;
      const severeCount = allPhotos.filter((p) =>
        (p.damage_tags ?? []).some((t) => SEVERE_TAGS.includes(String(t).toUpperCase()))
      ).length;

      // Persist room-level condition to rooms.condition
      for (const room of rooms ?? []) {
        const photos = roomPhotos[room.id] ?? [];
        const condition = getRoomCondition(photos);
        await supabase.from("rooms").update({ condition }).eq("id", room.id);
      }

      let overallCondition: string;
      if (photosWithIssues === 0) overallCondition = "Excellent";
      else if (totalPhotos === 0) overallCondition = "Good";
      else if (photosWithIssues / totalPhotos < 0.25) overallCondition = "Good";
      else if (photosWithIssues / totalPhotos < 0.5) overallCondition = "Fair";
      else overallCondition = "Needs Attention";

      const disputeRisk = Math.min(
        10,
        totalPhotos === 0 ? 0 : Math.round((photosWithIssues / totalPhotos) * 6 + severeCount * 2)
      );

      const propertyName = property?.building_name ?? property?.address ?? "Property";
      const unitNumber = property?.unit_number ?? "";
      const inspectionType = (inspection.type ?? "check-in") as string;
      const inspectionDate = inspection.created_at ?? new Date().toISOString();
      const contractFrom = tenancy?.contract_from != null ? String(tenancy.contract_from) : "";
      const contractTo = tenancy?.contract_to != null ? String(tenancy.contract_to) : "";
      const contractPeriod = [contractFrom, contractTo].filter(Boolean).join(" – ") || "—";

      const inspectionContext = {
        propertyName,
        unitNumber,
        inspectionType,
        inspectionDate,
        contractPeriod,
        overallCondition,
        disputeRisk,
        totalPhotos,
        photosWithIssues,
        rooms: (rooms ?? []).map((r) => {
          const photos = roomPhotos[r.id] ?? [];
          return {
            name: r.name,
            photoCount: photos.length,
            damageTags: Array.from(new Set(photos.flatMap((p) => p.damage_tags ?? []))),
            issueCount: photos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length,
          };
        }),
      };

      let aiSummary: string;
      try {
        const anthropic = new Anthropic({ apiKey, timeout: 60000 });
        const response = await anthropic.messages.create({
          model: "claude-sonnet-4-20250514",
          max_tokens: 512,
          system: EXEC_SUMMARY_SYSTEM,
          messages: [{ role: "user", content: JSON.stringify(inspectionContext) }],
        });
        const text = response.content
          .filter((block): block is { type: "text"; text: string } => block.type === "text")
          .map((block) => block.text)
          .join("")
          .trim();
        aiSummary = text || fallbackSummary(inspectionContext);
      } catch (err) {
        console.error("generate-report AI summary failed:", err);
        aiSummary = fallbackSummary(inspectionContext);
      }

      const dateStr = inspectionContext.inspectionDate
        ? new Date(inspectionContext.inspectionDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric",
          })
        : "—";

      const { error: updateErr } = await supabase
        .from("inspections")
        .update({
          executive_summary: aiSummary,
          overall_condition: overallCondition,
          dispute_risk: disputeRisk,
          status: "completed",
          completed_at: new Date().toISOString(),
        })
        .eq("id", inspectionId);

      if (updateErr) {
        console.error("Failed to save executive summary / condition / risk:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

      return NextResponse.json({ success: true });
    }

    // Summary already exists — just ensure status is completed
    const { error: statusErr } = await supabase
      .from("inspections")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
      })
      .eq("id", inspectionId);

    if (statusErr) {
      console.error("Failed to update inspection status:", statusErr);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("generate-report error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Report generation failed" },
      { status: 500 }
    );
  }
}

function fallbackSummary(ctx: {
  propertyName: string;
  unitNumber: string;
  inspectionDate: string;
  rooms: { name: string }[];
  totalPhotos: number;
  photosWithIssues: number;
  overallCondition: string;
}): string {
  const dateStr = ctx.inspectionDate
    ? new Date(ctx.inspectionDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
  return `Inspection of ${ctx.propertyName}, Unit ${ctx.unitNumber} completed on ${dateStr}. ${ctx.rooms.length} room(s) inspected with ${ctx.totalPhotos} photo(s) captured. ${ctx.photosWithIssues} issue(s) identified across the property. Overall condition: ${ctx.overallCondition}.`;
}
