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

  const { data: inspection, error } = await supabase
    .from("inspections")
    .select(
      `
      *,
      properties (building_name, unit_number),
      tenancies (tenant_name, landlord_name),
      rooms (
        id, name, order_index,
        photos (id, url, ai_analysis, damage_tags, notes)
      )
    `
    )
    .eq("id", id)
    .single();

  if (error || !inspection) notFound();

  const prop = Array.isArray(inspection.properties)
    ? inspection.properties[0]
    : inspection.properties;

  const rawRooms = (inspection.rooms ?? []) as {
    id: string;
    name: string;
    order_index: number | null;
    photos: { id: string; url: string; ai_analysis: string | null; damage_tags: string[]; notes: string | null }[] | null;
  }[];

  const rooms = rawRooms
    .sort((a, b) => (a.order_index ?? 0) - (b.order_index ?? 0))
    .map((r) => ({
      id: r.id,
      name: r.name,
      order_index: r.order_index,
      existingPhotos: (r.photos ?? []).map((p) => ({
        id: p.id,
        url: p.url,
        ai_analysis: p.ai_analysis,
        damage_tags: Array.isArray(p.damage_tags) ? p.damage_tags : [],
        notes: p.notes,
      })),
    }));

  return (
    <InspectionClient
      inspectionId={id}
      inspectionType={inspection.type ?? "check-in"}
      buildingName={prop?.building_name ?? "Property"}
      unitNumber={prop?.unit_number ?? ""}
      rooms={rooms}
    />
  );
}
