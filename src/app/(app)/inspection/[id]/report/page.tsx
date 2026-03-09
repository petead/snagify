import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ReportClient } from "./ReportClient";

export default async function ReportPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: inspection, error } = await supabase
    .from("inspections")
    .select("id, type, status, report_url, completed_at, property_id, document_hash, tenancy_id")
    .eq("id", id)
    .single();

  if (error || !inspection) notFound();

  let ejariRef: string | null = null;
  let contractFrom: string | null = null;
  let contractTo: string | null = null;
  let landlordName: string | null = null;
  let landlordPhone: string | null = null;
  let tenantName: string | null = null;
  let tenantPhone: string | null = null;
  if (inspection.tenancy_id) {
    const { data: tenancy } = await supabase
      .from("tenancies")
      .select("ejari_ref, contract_from, contract_to, landlord_name, landlord_phone, tenant_name, tenant_phone")
      .eq("id", inspection.tenancy_id)
      .single();
    if (tenancy) {
      ejariRef = tenancy.ejari_ref ?? null;
      contractFrom = tenancy.contract_from ?? null;
      contractTo = tenancy.contract_to ?? null;
      landlordName = tenancy.landlord_name ?? null;
      landlordPhone = tenancy.landlord_phone ?? null;
      tenantName = tenancy.tenant_name ?? null;
      tenantPhone = tenancy.tenant_phone ?? null;
    }
  }

  const { data: property } = await supabase
    .from("properties")
    .select("building_name, unit_number, address, property_type")
    .eq("id", inspection.property_id)
    .single();

  const { data: rooms } = await supabase
    .from("rooms")
    .select("id, name, overall_condition")
    .eq("inspection_id", id)
    .order("order_index", { ascending: true });

  const roomConditions = (rooms ?? []).map((r) => r.overall_condition).filter(Boolean);
  const poorCount = roomConditions.filter((c) => c === "poor").length;
  const fairCount = roomConditions.filter((c) => c === "fair").length;
  const overallCondition =
    poorCount > 0 ? "Poor" : fairCount > roomConditions.length / 2 ? "Fair" : "Good";

  const propertyTitle =
    property?.address ?? (property?.building_name && property?.unit_number
      ? `${property.building_name}, Unit ${property.unit_number}`
      : "Property");

  return (
    <ReportClient
      inspectionId={id}
      inspection={{
        type: inspection.type ?? "check-in",
        status: inspection.status ?? "completed",
        completedAt: inspection.completed_at,
        reportUrl: inspection.report_url,
        documentHash: inspection.document_hash,
        ejariRef,
        contractFrom,
        contractTo,
      }}
      tenancy={{
        landlordName,
        landlordPhone,
        tenantName,
        tenantPhone,
      }}
      property={{
        address: propertyTitle,
        type: property?.property_type,
      }}
      overallCondition={overallCondition}
      roomCount={rooms?.length ?? 0}
    />
  );
}
