import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsClient } from "./ReportsClient";

export default async function ReportsPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, role, company_id, account_type")
    .eq("id", user.id)
    .single();

  const fullName = (profile as { full_name?: string | null } | null)?.full_name ?? null;
  const isOwner =
    (profile as { role?: string } | null)?.role === "owner" &&
    (profile as { account_type?: string } | null)?.account_type === "pro";
  const companyId = (profile as { company_id?: string } | null)?.company_id ?? null;

  const { data: reportsData } = await supabase
    .from("inspections")
    .select(`
      id, type, status, created_at, report_url,
      properties (building_name, unit_number),
      tenancies (tenant_name),
      signatures (signer_type, otp_verified, signed_at),
      rooms (id, photos (id))
    `)
    .eq("agent_id", user.id)
    .in("status", ["completed", "signed", "in_progress", "disputed", "expired"])
    .order("created_at", { ascending: false });

  // Team data — owner only
  let teamMembers: { id: string; full_name: string | null }[] = [];
  let teamReports: NonNullable<typeof reportsData> = [];

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
      const { data: memberReports } = await supabase
        .from("inspections")
        .select(`
          id, type, status, created_at, report_url, agent_id,
          properties (building_name, unit_number),
          tenancies (tenant_name),
          signatures (signer_type, otp_verified, signed_at),
          rooms (id, photos (id))
        `)
        .in("agent_id", teamMembers.map(m => m.id))
        .in("status", ["completed", "signed", "in_progress", "disputed", "expired"])
        .order("created_at", { ascending: false });

      const nameMap = new Map(teamMembers.map(m => [m.id, m.full_name]));
      teamReports = (memberReports ?? []).map((r: { agent_id?: string } & Record<string, unknown>) => ({
        ...r,
        agent_name: nameMap.get(r.agent_id ?? "") ?? null,
      })) as unknown as NonNullable<typeof reportsData>;
    }
  }

  return (
    <main style={{ height: "calc(100dvh - 4rem)", maxHeight: "calc(100dvh - 4rem)", overflow: "hidden", background: "#F8F7F4" }}>
      <ReportsClient
        initialReports={(reportsData ?? []) as Parameters<typeof ReportsClient>[0]["initialReports"]}
        fullName={fullName}
        userEmail={user.email ?? null}
        isOwner={isOwner}
        teamMembers={teamMembers}
        teamReports={teamReports}
      />
    </main>
  );
}
