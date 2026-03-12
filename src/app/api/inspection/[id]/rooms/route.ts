import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: inspectionId } = await params;
  const supabase = await createClient();

  const { data: rooms, error: roomsErr } = await supabase
    .from("rooms")
    .select("id, name, order_index, condition")
    .eq("inspection_id", inspectionId)
    .order("order_index", { ascending: true });

  if (roomsErr) {
    return NextResponse.json({ error: roomsErr.message }, { status: 500 });
  }

  const roomIds = (rooms ?? []).map((r) => r.id);
  const photosRes = await (roomIds.length
    ? supabase.from("photos").select("room_id").in("room_id", roomIds)
    : { data: [] as { room_id: string }[] });

  const photoCountByRoom: Record<string, number> = {};
  roomIds.forEach((rid) => {
    photoCountByRoom[rid] = 0;
  });
  (photosRes.data ?? []).forEach((r) => {
    photoCountByRoom[r.room_id] = (photoCountByRoom[r.room_id] ?? 0) + 1;
  });

  const roomsWithMeta = (rooms ?? []).map((r) => ({
    ...r,
    photo_count: photoCountByRoom[r.id] ?? 0,
  }));

  return NextResponse.json({ rooms: roomsWithMeta });
}
