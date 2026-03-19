import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { buildPdfAndUpload } from "@/app/api/generate-pdf/route";

export const maxDuration = 60;

const EXEC_SUMMARY_SYSTEM = `You are a senior RERA-certified property inspector in Dubai.
Write a tight, professional executive summary for a property inspection report.

TONE: Expert witness — precise, authoritative, zero fluff.
Like a legal document, not a real estate brochure.

STRUCTURE (strictly 3 sentences, no more, no less):
1. SCOPE — one sentence: inspection type, property, date, rooms + photos count.
2. FINDINGS — one sentence: list damaged rooms + specific damage types. If no damage: state the property was found in good overall condition.
3. STATUS — one sentence: link to contract period if available, or state inspection purpose (baseline / end-of-tenancy record).

RULES:
- No filler: never use "were found to be", "it was noted that", "it is worth mentioning"
- No hedging: never use "appears to", "seems to", "may have"
- Name damage precisely: "scratch to entrance door frame" not "damage in entrance"
- Numbers over words: "3 rooms" not "three rooms", "13 photos" not "thirteen photos"
- No score, rating, risk assessment, or dispute language
- Do NOT mention AI or automated analysis
- English only

EXAMPLE CHECK-IN:
"Check-in inspection of Creek Rise Tower 1, Unit 3301 conducted 19 March 2026 — 10 rooms, 13 photos. Damage recorded in 3 rooms: scratch and stain to entrance surfaces, scratch to living room wall, hole in bedroom 3 wall. Establishes baseline condition for tenancy 10 March 2026 – 9 March 2027."

EXAMPLE CHECK-OUT:
"Check-out inspection of Creek Rise Tower 1, Unit 3301 conducted 19 March 2026 — 10 rooms, 15 photos. New damage vs check-in: stain in bedroom 2 and balcony, 1 door key unreturned; entrance, living room and bedroom 3 defects unchanged from entry. Closes tenancy record 10 March 2026 – 9 March 2027."

EXAMPLE NO DAMAGE:
"Check-in inspection of Al Barsha Heights, Unit 204 conducted 5 April 2026 — 7 rooms, 9 photos. All rooms in good condition — no damage, staining, or defects recorded across any surface or fixture. Establishes baseline condition for tenancy 1 April 2026 – 31 March 2027."`;

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

export async function POST(request: Request) {
  let inspectionId: string | undefined;
  let step = "init";
  try {
    step = "parse body";
    const body = (await request.json()) as { inspectionId?: string };
    inspectionId = body.inspectionId;
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    step = "fetch inspection";
    const supabase = await createClient();

    const { data: inspection, error: inspErr } = await supabase
      .from("inspections")
      .select("id, type, status, created_at, property_id, agent_id, tenancy_id, executive_summary, report_url")
      .eq("id", inspectionId)
      .maybeSingle();

    if (inspErr || !inspection) {
      return NextResponse.json({ error: "Inspection not found" }, { status: 404 });
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;

      step = "fetch tenancy";
      let tenancy: { contract_from?: string | null; contract_to?: string | null } | null = null;
      if (inspection.tenancy_id) {
        const { data: t } = await supabase
          .from("tenancies")
          .select("contract_from, contract_to")
          .eq("id", inspection.tenancy_id)
          .maybeSingle();
        tenancy = t ?? null;
      }

      step = "fetch property";
      const { data: property } = await supabase
        .from("properties")
        .select("building_name, unit_number, location")
        .eq("id", inspection.property_id)
        .maybeSingle();

      step = "fetch rooms";
      const { data: rooms } = await supabase
        .from("rooms")
        .select("id, name, order_index")
        .eq("inspection_id", inspectionId)
        .order("order_index", { ascending: true });

      step = "fetch signatures";
      const { data: signatures } = await supabase
        .from("signatures")
        .select("id")
        .eq("inspection_id", inspectionId);

      step = "fetch room photos";
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

      step = "update room conditions";
      for (const room of rooms ?? []) {
        const photos = roomPhotos[room.id] ?? [];
        const condition = getRoomCondition(photos);
        await supabase.from("rooms").update({ condition }).eq("id", room.id);
      }

      const propertyName = property?.building_name ?? property?.location ?? "Property";
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

      step = "build executive summary";
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

      step = "save executive summary";
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
      step = "buildPdfAndUpload";
      const pdfResult = await buildPdfAndUpload(inspectionId);
      report_url = pdfResult.report_url;
      pdfBuffer = pdfResult.buffer;
    } catch (pdfErr) {
      console.error("[generate-report] PDF build/upload failed:", pdfErr);
      throw pdfErr;
    }

    step = "return response";
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
    console.error(`[generate-report] CRASH at step="${step}":`, message);
    console.error("[generate-report] STACK:", stack);
    return NextResponse.json(
      { error: `Failed at step: ${step} — ${message}` },
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
