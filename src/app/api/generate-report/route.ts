import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPdfAndUpload } from "@/app/api/generate-pdf/route";

export const maxDuration = 60;

const EXEC_SUMMARY_SYSTEM = `You are a professional property inspector in Dubai, UAE.
Write a concise executive summary (3-5 sentences) for a property inspection report. Be factual, professional, and neutral.

Mention: total rooms inspected, total photos taken, and key findings (damage types and which rooms are affected).
If no damages are found, confirm the property is in good order.

Do NOT assign any overall score, rating, or condition label.
Do NOT mention dispute risk or any risk assessment.
Document the facts - let the reader draw conclusions.

Write in flowing prose, NO bullet points.
Do NOT mention AI or automated.
Write as the inspector addressing landlord and tenant.`;

const SEVERE_TAGS = ["BROKEN", "HOLE", "WATER_DAMAGE", "MOLD"];

function getRoomCondition(photos: { damage_tags?: string[] }[]): string {
  const photosWithIssues = photos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;
  if (photosWithIssues === 0) return "Excellent";

  const hasSevere = photos.some((p) =>
    (p.damage_tags ?? []).some((t) => SEVERE_TAGS.includes(String(t).toUpperCase()))
  );
  if (hasSevere) return "Needs Attention";

  if (photos.length > 0 && photosWithIssues / photos.length >= 0.5) return "Fair";
  return "Good";
}

export async function POST(request: Request) {
  let inspectionId: string | undefined;
  try {
    const body = (await request.json()) as { inspectionId?: string };
    inspectionId = body.inspectionId;
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    console.log("[generate-report] Starting for inspection:", inspectionId);

    const supabase = await createClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select("id, type, status, created_at, property_id, agent_id, tenancy_id, executive_summary, report_url")
      .eq("id", inspectionId)
      .single();

    if (inspErr || !inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

      let tenancy: { contract_from?: string | null; contract_to?: string | null } | null = null;
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

      const allPhotos = (rooms ?? []).flatMap((r) => roomPhotos[r.id] ?? []);
      const totalPhotos = allPhotos.length;
      const photosWithIssues = allPhotos.filter((p) => (p.damage_tags?.length ?? 0) > 0).length;

      for (const room of rooms ?? []) {
        const photos = roomPhotos[room.id] ?? [];
        const condition = getRoomCondition(photos);
        await supabase.from("rooms").update({ condition }).eq("id", room.id);
      }

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
      if (apiKey) {
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
      } else {
        console.warn("[generate-report] ANTHROPIC_API_KEY missing, using fallback summary.");
        aiSummary = fallbackSummary(inspectionContext);
      }

      const updatePayload: Record<string, string> = {
        executive_summary: aiSummary,
        completed_at: new Date().toISOString(),
      };
      if (inspection.status !== "signed") {
        updatePayload.status = "completed";
      }
      const { error: updateErr } = await supabase
        .from("inspections")
        .update(updatePayload)
        .eq("id", inspectionId);

      if (updateErr) {
        console.error("Failed to save executive summary:", updateErr);
        return NextResponse.json({ error: updateErr.message }, { status: 500 });
      }

    let report_url: string | null = null;
    let pdfBuffer: Uint8Array | null = null;
    try {
      const fileName = `report_${inspectionId}.pdf`;
      console.log("[generate-report] Upload path:", fileName);
      const pdfResult = await buildPdfAndUpload(inspectionId);
      report_url = pdfResult.report_url;
      pdfBuffer = pdfResult.buffer;
      console.log("[generate-report] PDF buffer size:", pdfBuffer?.length ?? 0);
      console.log("[generate-report] Public URL:", report_url ?? "null");
    } catch (pdfErr) {
      console.error("[generate-report] PDF build/upload failed:", pdfErr);
      throw pdfErr;
    }

    const wantsPdf = (request.headers.get("Accept") ?? "").includes("application/pdf");
    if (wantsPdf && pdfBuffer) {
      return new NextResponse(Buffer.from(pdfBuffer), {
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="Snagify_Report_${inspectionId}.pdf"`,
          "Cache-Control": "no-store, no-cache, must-revalidate",
        },
      });
    }

    return NextResponse.json({
      success: true,
      report_url: report_url ?? undefined,
      executive_summary: aiSummary,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const stack = err instanceof Error ? err.stack : "";
    console.error("[generate-report] FATAL ERROR:", message);
    console.error("[generate-report] STACK:", stack);
    return NextResponse.json(
      { error: message },
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
}): string {
  const dateStr = ctx.inspectionDate
    ? new Date(ctx.inspectionDate).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      })
    : "—";
  return `Inspection of ${ctx.propertyName}, Unit ${ctx.unitNumber} completed on ${dateStr}. ${ctx.rooms.length} room(s) inspected with ${ctx.totalPhotos} photo(s) captured. ${ctx.photosWithIssues} issue(s) identified across the property.`;
}
