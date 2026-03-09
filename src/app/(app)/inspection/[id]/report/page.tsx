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
    .select(
      `
      *,
      properties (building_name, unit_number, property_type, address),
      tenancies (
        tenant_name, tenant_email, tenant_phone,
        landlord_name, landlord_email, landlord_phone,
        contract_from, contract_to, annual_rent,
        ejari_ref, tenancy_type
      ),
      rooms (
        id, name, overall_condition, order_index,
        room_items (id, name, condition, notes, ai_description)
      ),
      signatures (signer_type, otp_verified, signed_at)
    `
    )
    .eq("id", id)
    .single();

  if (error || !inspection) notFound();

  let profile: { full_name: string | null; agency_name: string | null } | null = null;
  if (inspection.agent_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, agency_name")
      .eq("id", inspection.agent_id)
      .single();
    profile = data;
  }

  return (
    <ReportClient
      inspection={inspection as InspectionWithRelations}
      profile={profile}
    />
  );
}

// Type for the nested inspection shape from Supabase
export type RoomItem = {
  id: string;
  name: string | null;
  condition: string | null;
  notes: string | null;
  ai_description: string | null;
};

export type Room = {
  id: string;
  name: string | null;
  overall_condition: string | null;
  order_index: number | null;
  room_items?: RoomItem[] | null;
};

export type Signature = {
  signer_type: string | null;
  otp_verified: boolean | null;
  signed_at: string | null;
};

export type PropertyRelation = {
  building_name: string | null;
  unit_number: string | null;
  property_type: string | null;
  address: string | null;
};

export type TenancyRelation = {
  tenant_name: string | null;
  tenant_email: string | null;
  tenant_phone: string | null;
  landlord_name: string | null;
  landlord_email: string | null;
  landlord_phone: string | null;
  contract_from: string | null;
  contract_to: string | null;
  annual_rent: number | null;
  ejari_ref: string | null;
  tenancy_type: string | null;
};

export type InspectionWithRelations = {
  id: string;
  type: string | null;
  status: string | null;
  report_url: string | null;
  completed_at: string | null;
  document_hash: string | null;
  agent_id: string | null;
  property_id: string | null;
  tenancy_id: string | null;
  report_data?: {
    executive_summary?: string;
    dispute_risk_score?: number;
  } | null;
  properties?: PropertyRelation | PropertyRelation[] | null;
  tenancies?: TenancyRelation | TenancyRelation[] | null;
  rooms?: Room[] | null;
  signatures?: Signature[] | null;
};
