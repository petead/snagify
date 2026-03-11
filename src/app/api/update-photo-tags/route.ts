import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
  try {
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

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed" },
      { status: 500 }
    );
  }
}
