import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./ProfileClient";

export default async function DashboardProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name, created_at")
    .eq("id", user.id)
    .single();

  const [
    { count: propertiesCount },
    { count: inspectionsCount },
    { count: reportsCount },
  ] = await Promise.all([
    supabase.from("properties").select("*", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase.from("inspections").select("*", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase
      .from("inspections")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .in("status", ["completed", "signed"]),
  ]);

  return (
    <main className="min-h-screen" style={{ background: "#F8F7F4" }}>
      <ProfileClient
        fullName={profile?.full_name ?? null}
        userEmail={user.email ?? null}
        agencyName={profile?.agency_name ?? null}
        memberSince={profile?.created_at ?? null}
        stats={{
          properties: propertiesCount ?? 0,
          inspections: inspectionsCount ?? 0,
          reports: reportsCount ?? 0,
        }}
      />
    </main>
  );
}
