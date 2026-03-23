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
      properties (building_name, unit_number, property_type, location),
      tenancies (
        tenant_name, tenant_email, tenant_phone,
        landlord_name, landlord_email, landlord_phone,
        contract_from, contract_to, annual_rent,
        ejari_ref, tenancy_type
      ),
      rooms (
        id, name, condition, order_index,
        photos (id, url, ai_analysis, damage_tags, notes, checkin_photo_id)
      ),
      signatures (signer_type, otp_verified, signed_at, signature_data, refused_at, refused_reason)
    `
    )
    .eq("id", id)
    .single();

  if (error || !inspection) notFound();

  let profile: { full_name: string | null; agency_name: string | null } | null = null;
  if (inspection.agent_id) {
    const { data } = await supabase
      .from("profiles")
      .select("full_name, company:companies(name)")
      .eq("id", inspection.agent_id)
      .single();
    const company = data?.company ? (Array.isArray(data.company) ? data.company[0] : data.company) : null;
    profile = data
      ? { full_name: data.full_name, agency_name: (company as { name?: string } | null)?.name ?? (data as { agency_name?: string }).agency_name ?? null }
      : null;
  }

  // Fetch check-in data when viewing a check-out inspection
  let checkinData: CheckinData | null = null;
  const isCheckout = (inspection.type ?? "").toLowerCase().includes("check-out");
  if (isCheckout && inspection.property_id) {
    const { data } = await supabase
      .from("inspections")
      .select(`
        id, created_at, executive_summary, key_handover,
        rooms (
          id, name, condition,
          photos (id, url, damage_tags, width, height)
        )
      `)
      .eq("property_id", inspection.property_id)
      .eq("type", "check-in")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();
    checkinData = data as CheckinData | null;
  }

  return (
    <ReportClient
      inspection={inspection as InspectionWithRelations}
      profile={profile}
      checkinData={checkinData}
    />
  );
}

// Type for the nested inspection shape from Supabase
export type RoomPhoto = {
  id: string;
  url: string | null;
  ai_analysis: string | null;
  damage_tags: string[];
  notes: string | null;
  checkin_photo_id: string | null;
};

export type Room = {
  id: string;
  name: string | null;
  condition: string | null;
  order_index: number | null;
  photos?: RoomPhoto[] | null;
};

export type Signature = {
  signer_type: string | null;
  otp_verified: boolean | null;
  signed_at: string | null;
  signature_data: string | null;
  refused_at?: string | null;
  refused_reason?: string | null;
};

export type PropertyRelation = {
  building_name: string | null;
  unit_number: string | null;
  property_type: string | null;
  location: string | null;
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
  signing_deadline?: string | null;
  report_url: string | null;
  completed_at: string | null;
  signed_at?: string | null;
  document_hash: string | null;
  agent_id: string | null;
  property_id: string | null;
  tenancy_id: string | null;
  key_handover?: { item: string; qty: number }[] | null;
  checkin_key_handover?: { item: string; qty: number }[] | null;
  report_data?: {
    executive_summary?: string;
  } | null;
  executive_summary?: string | null;
  properties?: PropertyRelation | PropertyRelation[] | null;
  tenancies?: TenancyRelation | TenancyRelation[] | null;
  rooms?: Room[] | null;
  signatures?: Signature[] | null;
};

export type CheckinData = {
  id: string;
  created_at: string | null;
  executive_summary: string | null;
  key_handover: { item: string; qty: number }[] | null;
  rooms: Array<{
    id: string;
    name: string;
    condition: string | null;
    photos: Array<{
      id: string;
      url: string;
      damage_tags: string[] | null;
      width: number | null;
      height: number | null;
    }> | null;
  }> | null;
};
