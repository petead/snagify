import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { DashboardBottomNav } from "@/components/layout/DashboardBottomNav";
import { DashboardClient } from "./DashboardClient";

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", user.id)
      .single();
    fullName = profile?.full_name ?? null;
  }

  const displayName =
    fullName?.trim()
      ? fullName.trim().split(/\s+/)[0] ?? "there"
      : user?.email
        ? user.email.split("@")[0]
        : "there";

  // Try fetch with tenancies first (for status on cards)
  let propertiesData: Array<{
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
  }> = [];

  if (user) {
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
      propertiesData = withTenancies as typeof propertiesData;
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
      propertiesData = (fallback ?? []) as typeof propertiesData;
    }
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-24 max-w-lg mx-auto">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user?.email ?? null} />
      </header>
      <DashboardClient
        displayName={displayName}
        properties={propertiesData}
      />
      <DashboardBottomNav />
    </main>
  );
}
