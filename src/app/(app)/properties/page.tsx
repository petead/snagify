import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PropertiesClient } from "./PropertiesClient";

export default async function PropertiesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id")
    .eq("id", user.id)
    .single();

  const fullName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
  const isOwner = (profile as { role?: string } | null)?.role === "owner";
  const companyId = (profile as { company_id?: string } | null)?.company_id ?? null;

  const { data: properties, error } = await supabase
    .from("properties")
    .select(`
      id, building_name, unit_number, location, property_type, created_at,
      tenancies (id, tenant_name, status, contract_from, contract_to, annual_rent,
        inspections (id, type, status)
      )
    `)
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  // Team data — owner only
  let teamMembers: { id: string; full_name: string | null }[] = [];
  let teamProperties: NonNullable<typeof properties> = [];

  if (isOwner && companyId) {
    const { data: members } = await supabase
      .from("profiles")
      .select("id, full_name")
      .eq("company_id", companyId)
      .eq("role", "inspector");

    teamMembers = (members ?? []).map((m: { id: string; full_name?: string | null }) => ({
      id: m.id,
      full_name: m.full_name ?? null,
    }));

    if (teamMembers.length > 0) {
      const { data: memberProps } = await supabase
        .from("properties")
        .select(`
          id, building_name, unit_number, location, property_type, created_at, agent_id,
          tenancies (id, tenant_name, status, contract_from, contract_to, annual_rent,
            inspections (id, type, status)
          )
        `)
        .in("agent_id", teamMembers.map(m => m.id))
        .order("created_at", { ascending: false });

      const nameMap = new Map(teamMembers.map(m => [m.id, m.full_name]));
      teamProperties = (memberProps ?? []).map((p: { agent_id?: string } & Record<string, unknown>) => ({
        ...p,
        agent_name: nameMap.get(p.agent_id ?? "") ?? null,
      })) as unknown as NonNullable<typeof properties>;
    }
  }

  return (
    <main style={{ height: "calc(100dvh - 4rem)", maxHeight: "calc(100dvh - 4rem)", overflow: "hidden", background: "#F8F7F4" }}>
      <PropertiesClient
        properties={error ? [] : (properties ?? [])}
        fullName={fullName}
        userEmail={user.email ?? null}
        isOwner={isOwner}
        teamMembers={teamMembers}
        teamProperties={teamProperties}
      />
    </main>
  );
}
