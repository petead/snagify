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
    .select("id, type, property_id, properties(building_name, unit_number)")
    .eq("id", id)
    .single();

  if (inspErr || !inspection) notFound();

  const prop = Array.isArray(inspection.properties)
    ? inspection.properties[0]
    : inspection.properties;

  const { data: rooms } = await supabase
    .from("rooms")
    .select(
      "id, name, order_index, overall_condition, room_items(id)"
    )
    .eq("inspection_id", id)
    .order("order_index", { ascending: true });

  const roomsWithMeta = (rooms ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    order_index: r.order_index,
    overall_condition: r.overall_condition,
    item_count: (r.room_items as { id: string }[] | null)?.length ?? 0,
  }));

  return (
    <InspectionClient
      inspectionId={id}
      inspectionType={inspection.type ?? "check-in"}
      buildingName={prop?.building_name ?? "Property"}
      unitNumber={prop?.unit_number ?? ""}
      rooms={roomsWithMeta}
    />
  );
}
