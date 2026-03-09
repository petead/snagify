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
    .select("id, type, status, report_url, completed_at, landlord_name, tenant_name, property_id, document_hash")
    .eq("id", id)
    .single();

  if (error || !inspection) notFound();

  const { data: property } = await supabase
    .from("properties")
    .select("address, unit_number, property_type, ejari_ref")
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

  return (
    <ReportClient
      inspectionId={id}
      inspection={{
        type: inspection.type ?? "check-in",
        status: inspection.status ?? "completed",
        completedAt: inspection.completed_at,
        reportUrl: inspection.report_url,
        documentHash: inspection.document_hash,
      }}
      property={{
        address: property?.address ?? "Property",
        unitNumber: property?.unit_number,
        type: property?.property_type,
      }}
      overallCondition={overallCondition}
      roomCount={rooms?.length ?? 0}
    />
  );
}
