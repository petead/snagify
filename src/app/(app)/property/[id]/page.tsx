import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PropertyClient } from "./PropertyClient";

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: property, error } = await supabase
    .from("properties")
    .select("*")
    .eq("id", id)
    .single();

  if (error || !property) notFound();

  const { data: inspections } = await supabase
    .from("inspections")
    .select("id, type, status, created_at, completed_at, landlord_name, tenant_name, ejari_ref, contract_from, contract_to")
    .eq("property_id", id)
    .order("created_at", { ascending: false });

  // Get room counts per inspection
  const inspIds = (inspections ?? []).map((i) => i.id);
  let roomCounts: Record<string, number> = {};
  if (inspIds.length > 0) {
    const { data: rooms } = await supabase
      .from("rooms")
      .select("inspection_id")
      .in("inspection_id", inspIds);
    for (const r of rooms ?? []) {
      roomCounts[r.inspection_id] = (roomCounts[r.inspection_id] ?? 0) + 1;
    }
  }

  const inspectionsWithRooms = (inspections ?? []).map((i) => ({
    id: i.id as string,
    type: i.type as string | null,
    status: i.status as string | null,
    created_at: i.created_at as string | null,
    completed_at: i.completed_at as string | null,
    landlord_name: i.landlord_name as string | null,
    tenant_name: i.tenant_name as string | null,
    ejari_ref: i.ejari_ref as string | null,
    contract_from: i.contract_from as string | null,
    contract_to: i.contract_to as string | null,
    room_count: roomCounts[i.id] ?? 0,
  }));

  return (
    <PropertyClient
      property={{
        id: property.id,
        building_name: property.building_name,
        unit_number: property.unit_number,
        address: property.address,
        property_type: property.property_type,
      }}
      inspections={inspectionsWithRooms}
    />
  );
}
