import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { PropertiesClient } from "./PropertiesClient";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  let fullName: string | null = null;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();
  fullName = profile?.full_name ?? null;

  type PropertyRow = {
    id: string;
    building_name: string | null;
    unit_number: string | null;
    address: string | null;
    property_type: string | null;
    created_at: string | null;
    tenancies?: Array<{
      id: string;
      tenant_name: string | null;
      contract_from: string | null;
      contract_to: string | null;
      actual_end_date?: string | null;
    }>;
    inspections?: Array<{
      id: string;
      type: string | null;
      status: string | null;
      created_at: string | null;
      completed_at: string | null;
    }>;
  };

  let propertiesData: PropertyRow[] = [];
  const { data: withTenancies, error: tenErr } = await supabase
    .from("properties")
    .select(
      `
      id, building_name, unit_number, address, property_type, created_at,
      tenancies (id, tenant_name, contract_from, contract_to, actual_end_date),
      inspections (id, type, status, created_at, completed_at)
    `
    )
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  if (!tenErr && withTenancies?.length) {
    propertiesData = withTenancies as PropertyRow[];
  } else {
    const { data: fallback } = await supabase
      .from("properties")
      .select(
        `
        id, building_name, unit_number, address, property_type, created_at,
        inspections (id, type, status, created_at, completed_at)
      `
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });
    propertiesData = (fallback ?? []) as PropertyRow[];
  }

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user.email ?? null} />
      </header>
      <PropertiesClient properties={propertiesData} />
    </main>
  );
}
