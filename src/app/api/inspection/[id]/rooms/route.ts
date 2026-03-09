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
    .select("id, name, order_index, overall_condition")
    .eq("inspection_id", inspectionId)
    .order("order_index", { ascending: true });

  if (roomsErr) {
    return NextResponse.json({ error: roomsErr.message }, { status: 500 });
  }

  const roomIds = (rooms ?? []).map((r) => r.id);
  const [itemsRes, photosRes] = await Promise.all([
    roomIds.length
      ? supabase.from("room_items").select("room_id").in("room_id", roomIds)
      : { data: [] as { room_id: string }[] },
    roomIds.length
      ? supabase.from("photos").select("room_id").in("room_id", roomIds)
      : { data: [] as { room_id: string }[] },
  ]);

  const itemCountByRoom: Record<string, number> = {};
  const photoCountByRoom: Record<string, number> = {};
  roomIds.forEach((rid) => {
    itemCountByRoom[rid] = 0;
    photoCountByRoom[rid] = 0;
  });
  (itemsRes.data ?? []).forEach((r) => {
    itemCountByRoom[r.room_id] = (itemCountByRoom[r.room_id] ?? 0) + 1;
  });
  (photosRes.data ?? []).forEach((r) => {
    photoCountByRoom[r.room_id] = (photoCountByRoom[r.room_id] ?? 0) + 1;
  });

  const roomsWithMeta = (rooms ?? []).map((r) => ({
    ...r,
    item_count: itemCountByRoom[r.id] ?? 0,
    photo_count: photoCountByRoom[r.id] ?? 0,
  }));

  return NextResponse.json({ rooms: roomsWithMeta });
}
