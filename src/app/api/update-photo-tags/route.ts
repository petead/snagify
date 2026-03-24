import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    // ── Auth guard ──
    const supabaseAuth = await createServerClient();
    const {
      data: { user },
    } = await supabaseAuth.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { photoId, damage_tags, notes } = (await request.json()) as {
      photoId: string;
      damage_tags?: string[];
      notes?: string;
    };

    if (!photoId) {
      return NextResponse.json({ error: "Missing photoId" }, { status: 400 });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // ── Ownership guard: verify photo belongs to an inspection owned by user ──
    const { data: photoCheck } = await supabase
      .from("photos")
      .select("room_id, rooms(inspection_id, inspections(agent_id))")
      .eq("id", photoId)
      .single();

    const agentId = (photoCheck?.rooms as any)?.inspections?.agent_id;
    if (!agentId || agentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const updateData: Record<string, unknown> = {};
    if (damage_tags !== undefined) updateData.damage_tags = damage_tags;
    if (notes !== undefined) updateData.notes = notes;

    const { error } = await supabase
      .from("photos")
      .update(updateData)
      .eq("id", photoId);

    if (error) {
      console.error("update-photo-tags error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Invalidate cached report so it gets regenerated on next Generate Report / Download PDF
    const { data: photoRow } = await supabase
      .from("photos")
      .select("room_id")
      .eq("id", photoId)
      .single();
    if (photoRow?.room_id) {
      await supabase
        .from("rooms")
        .update({ condition: null })
        .eq("id", photoRow.room_id);
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
