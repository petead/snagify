import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PropertyClient } from "./PropertyClient";
import {
  getTenancyStatus,
  canStartCheckIn,
  canStartCheckOut,
} from "@/lib/tenancy";

type InspectionSignature = {
  signer_type: string;
  otp_verified: boolean;
  signed_at: string | null;
};

type InspectionWithRooms = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  tenancy_id?: string | null;
  report_url?: string | null;
  signed_at?: string | null;
  rooms?: { id: string }[] | null;
  signatures?: InspectionSignature[] | null;
};

type TenancyRow = {
  id: string;
  tenant_name: string | null;
  contract_from: string | null;
  contract_to: string | null;
  actual_end_date?: string | null;
  annual_rent: number | null;
  ejari_ref: string | null;
  inspections?: {
    id: string;
    type: string | null;
    status: string | null;
    tenancy_id?: string | null;
    created_at: string | null;
    completed_at: string | null;
    report_url?: string | null;
    signed_at?: string | null;
    rooms?: { id: string }[];
    signatures?: InspectionSignature[] | null;
  }[];
};

type TenancyGroup = {
  tenancyId: string | null;
  key: string;
  status: string;
  tenantName: string | null;
  ejariRef: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  annualRent: number | null;
  canStartCheckIn: { allowed: boolean; reason: string | null };
  canStartCheckOut: { allowed: boolean; reason: string | null };
  inspections: {
    id: string;
    type: string | null;
    status: string | null;
    created_at: string | null;
    completed_at: string | null;
    report_url: string | null;
    signed_at: string | null;
    room_count: number;
    signatures: InspectionSignature[];
  }[];
};

export default async function PropertyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: propertyId } = await params;
  const supabase = await createClient();

  // Try fetch with tenancies first
  const { data: propertyWithTenancies, error: tenancyErr } = await supabase
    .from("properties")
    .select(
      `
      id,
      building_name,
      unit_number,
      address,
      property_type,
      tenancies (
        id,
        tenant_name,
        contract_from,
        contract_to,
        actual_end_date,
        annual_rent,
        ejari_ref,
        property_size,
        inspections (
          id, type, status, created_at, completed_at, tenancy_id, report_url, signed_at,
          rooms (id),
          signatures (signer_type, otp_verified, signed_at)
        )
      )
    `
    )
    .eq("id", propertyId)
    .single();

  if (!tenancyErr && propertyWithTenancies?.tenancies?.length) {
    const tenancies = (propertyWithTenancies.tenancies ?? []) as TenancyRow[];
    const statusOrder: Record<string, number> = {
      active: 0,
      expiring_soon: 1,
      upcoming: 2,
      expired: 3,
      terminated_early: 4,
    };
    tenancies.sort((a, b) => {
      const statusA = getTenancyStatus(a);
      const statusB = getTenancyStatus(b);
      const orderA = statusOrder[statusA] ?? 5;
      const orderB = statusOrder[statusB] ?? 5;
      if (orderA !== orderB) return orderA - orderB;
      const dateA = new Date(a.contract_from ?? 0).getTime();
      const dateB = new Date(b.contract_from ?? 0).getTime();
      return dateB - dateA;
    });

    const tenancyGroups: TenancyGroup[] = tenancies.map((t) => {
      const inspections = (t.inspections ?? []).map((i) => ({
        id: i.id,
        type: i.type,
        status: i.status,
        created_at: i.created_at,
        completed_at: i.completed_at,
        report_url: i.report_url ?? null,
        signed_at: i.signed_at ?? null,
        room_count: Array.isArray(i.rooms) ? i.rooms.length : 0,
        signatures: (i.signatures ?? []) as InspectionSignature[],
      }));
      const inspectionsWithTenancyId = (t.inspections ?? []).map((i) => ({
        ...i,
        tenancy_id: t.id,
      }));
      const canCheckIn = canStartCheckIn(
        { id: t.id },
        inspectionsWithTenancyId
      );
      const canCheckOut = canStartCheckOut(
        { id: t.id },
        inspectionsWithTenancyId
      );
      return {
        tenancyId: t.id,
        key: t.id,
        status: getTenancyStatus(t),
        tenantName: t.tenant_name,
        ejariRef: t.ejari_ref,
        contractFrom: t.contract_from,
        contractTo: t.contract_to,
        annualRent: t.annual_rent,
        canStartCheckIn: canCheckIn,
        canStartCheckOut: canCheckOut,
        inspections,
      };
    });

    const totalInspections = tenancyGroups.reduce(
      (sum, g) => sum + g.inspections.length,
      0
    );
    const withSize = tenancies.find(
      (t) => (t as { property_size?: number }).property_size != null
    );
    const sizeM2 =
      withSize != null
        ? (withSize as { property_size?: number }).property_size ?? null
        : null;

    return (
      <PropertyClient
        property={{
          id: propertyWithTenancies.id,
          building_name: propertyWithTenancies.building_name,
          unit_number: propertyWithTenancies.unit_number,
          address: propertyWithTenancies.address,
          property_type: propertyWithTenancies.property_type,
          property_size: sizeM2,
        }}
        tenancyGroups={tenancyGroups}
        totalInspections={totalInspections}
      />
    );
  }

  // Fallback: fetch property with inspections only (no tenancies table or empty; contract data lives in tenancies)
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
        id, type, status, created_at, completed_at, report_url, signed_at,
        rooms (id),
        signatures (signer_type, otp_verified, signed_at)
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
      report_url: i.report_url ?? null,
      signed_at: i.signed_at ?? null,
      room_count: Array.isArray(i.rooms) ? i.rooms.length : 0,
      signatures: (i.signatures ?? []) as InspectionSignature[],
    }));

  const groupedByContract = inspections.reduce<
    Record<string, { id: string; type: string | null; status: string | null; created_at: string | null; completed_at: string | null; report_url: string | null; signed_at: string | null; room_count: number; signatures: InspectionSignature[] }[]>
  >((groups, inspection) => {
    const key = inspection.id;
    if (!groups[key]) groups[key] = [];
    groups[key].push({
        id: inspection.id,
        type: inspection.type,
        status: inspection.status,
        created_at: inspection.created_at,
        completed_at: inspection.completed_at,
        report_url: inspection.report_url,
        signed_at: inspection.signed_at,
        room_count: inspection.room_count,
        signatures: inspection.signatures,
      });
    return groups;
  }, {});

  const contractGroups: TenancyGroup[] = Object.entries(groupedByContract).map(
    ([key, inspList]) => ({
      tenancyId: null,
      key,
      status: "active",
      tenantName: null,
      ejariRef: null,
      contractFrom: null,
      contractTo: null,
      annualRent: null,
      canStartCheckIn: { allowed: true, reason: null },
      canStartCheckOut: { allowed: true, reason: null },
      inspections: inspList,
    })
  );

  contractGroups.sort((a, b) => {
    const aLatest = a.inspections[0]?.created_at ?? "";
    const bLatest = b.inspections[0]?.created_at ?? "";
    return new Date(bLatest).getTime() - new Date(aLatest).getTime();
  });

  const sizeM2: number | null = null;

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
      tenancyGroups={contractGroups}
      totalInspections={inspections.length}
    />
  );
}
