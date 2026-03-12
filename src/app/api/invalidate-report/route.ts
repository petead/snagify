import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** Invalidate cached report and room condition so next Generate Report / Download PDF recomputes. */
export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      inspectionId?: string;
      roomId?: string;
    };
    const { inspectionId, roomId } = body;
    if (!inspectionId) {
      return NextResponse.json({ error: "Missing inspectionId" }, { status: 400 });
    }

    const supabase = await createClient();

    if (roomId) {
      await supabase.from("rooms").update({ condition: null }).eq("id", roomId);
    }

    await supabase
      .from("inspections")
      .update({ report_url: null, executive_summary: null })
      .eq("id", inspectionId);

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("invalidate-report error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
