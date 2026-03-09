import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PropertyClient } from "./PropertyClient";

type InspectionWithRooms = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  ejari_ref: string | null;
  contract_from: string | null;
  contract_to: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
  tenant_email: string | null;
  annual_rent: number | null;
  property_size: number | null;
  rooms: { id: string }[] | null;
};

type ContractGroup = {
  key: string;
  tenantName: string | null;
  ejariRef: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  annualRent: number | null;
  inspections: {
    id: string;
    type: string | null;
    status: string | null;
    created_at: string | null;
    completed_at: string | null;
    room_count: number;
  }[];
};

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = await params;
  const supabase = await createClient();

  const { data: property, error: propError } = await supabase
    .from("properties")
    .select(
      `
      id,
      building_name,
      unit_number,
      address,
      property_type,
      inspections (
        id, type, status, created_at, completed_at,
        ejari_ref, contract_from, contract_to,
        landlord_name, tenant_name, tenant_email,
        annual_rent, property_size,
        rooms (id)
      )
    `
    )
    .eq("id", propertyId)
    .single();

  if (propError || !property) notFound();

  const rawInspections = (property.inspections ?? []) as InspectionWithRooms[];
  const inspections = rawInspections
    .sort(
      (a, b) =>
        new Date(b.created_at ?? 0).getTime() -
        new Date(a.created_at ?? 0).getTime()
    )
    .map((i) => ({
      id: i.id,
      type: i.type,
      status: i.status,
      created_at: i.created_at,
      completed_at: i.completed_at,
      ejari_ref: i.ejari_ref,
      contract_from: i.contract_from,
      contract_to: i.contract_to,
      landlord_name: i.landlord_name,
      tenant_name: i.tenant_name,
      tenant_email: i.tenant_email,
      annual_rent: i.annual_rent,
      room_count: Array.isArray(i.rooms) ? i.rooms.length : 0,
    }));

  const groupedByContract = inspections.reduce<Record<string, ContractGroup["inspections"]>>(
    (groups, inspection) => {
      const key =
        inspection.ejari_ref ||
        inspection.tenant_name ||
        "unknown";
      if (!groups[key]) groups[key] = [];
      groups[key].push({
        id: inspection.id,
        type: inspection.type,
        status: inspection.status,
        created_at: inspection.created_at,
        completed_at: inspection.completed_at,
        room_count: inspection.room_count,
      });
      return groups;
    },
    {}
  );

  const contractGroups: ContractGroup[] = Object.entries(groupedByContract).map(
    ([key, inspList]) => {
      const first = rawInspections.find((i) => i.id === inspList[0]?.id) as InspectionWithRooms | undefined;
      return {
        key,
        tenantName: first?.tenant_name ?? null,
        ejariRef: first?.ejari_ref ?? null,
        contractFrom: first?.contract_from ?? null,
        contractTo: first?.contract_to ?? null,
        annualRent: first?.annual_rent ?? null,
        inspections: inspList,
      };
    }
  );

  // Sort groups by most recent inspection first
  contractGroups.sort((a, b) => {
    const aLatest = a.inspections[0]?.created_at ?? "";
    const bLatest = b.inspections[0]?.created_at ?? "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });

  const withSize = rawInspections.find((i) => i.property_size != null);
  const sizeM2 = withSize?.property_size ?? null;

  return (
    <PropertyClient
      property={{
        id: property.id,
        building_name: property.building_name,
        unit_number: property.unit_number,
        address: property.address,
        property_type: property.property_type,
        property_size: sizeM2,
      }}
      contractGroups={contractGroups}
      totalInspections={inspections.length}
    />
  );
}
