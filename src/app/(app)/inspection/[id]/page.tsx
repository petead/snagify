import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { InspectionClient } from "./InspectionClient";

export default async function InspectionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inspection, error: inspErr } = await supabase
    .from("inspections")
    .select("id, property_id")
    .eq("id", id)
    .single();

  if (inspErr || !inspection) {
    notFound();
  }

  const { data: property } = await supabase
    .from("properties")
    .select("building_name, unit_number, location, address")
    .eq("id", inspection.property_id)
    .single();

  const address = property
    ? (property.building_name && property.unit_number
        ? `${property.building_name} — Unit ${property.unit_number}`
        : property.address ?? "Property")
    : "Property";

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, order_index, overall_condition")
    .eq("inspection_id", id)
    .order("order_index", { ascending: true });

  const roomIds = (rooms ?? []).map((r) => r.id);
  let itemCountByRoom: Record<string, number> = {};
  let photoCountByRoom: Record<string, number> = {};

  if (roomIds.length > 0) {
    const [itemsRes, photosRes] = await Promise.all([
      supabase.from("room_items").select("room_id").in("room_id", roomIds),
      supabase.from("photos").select("room_id").in("room_id", roomIds),
    ]);
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
  }

  const roomsWithMeta = (rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    order_index: r.order_index,
    overall_condition: r.overall_condition,
    item_count: itemCountByRoom[r.id] ?? 0,
    photo_count: photoCountByRoom[r.id] ?? 0,
  }));

  return (
    <InspectionClient
      inspectionId={id}
      address={address}
      rooms={roomsWithMeta}
    />
  );
}
