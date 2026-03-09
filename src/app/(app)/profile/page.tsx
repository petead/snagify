import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, agency_name, phone")
    .eq("id", user.id)
    .single();

  const [{ count: propertiesCount }, { count: inspectionsCount }] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase.from("inspections").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
  ]);

  const { count: reportsCount } = await supabase
    .from("inspections")
    .select("id", { count: "exact", head: true })
    .eq("agent_id", user.id)
    .in("status", ["completed", "signed"]);

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader
          fullName={profile?.full_name ?? null}
          userEmail={user.email ?? null}
        />
      </header>
      <ProfileClient
        profile={{
          full_name: profile?.full_name ?? null,
          agency_name: profile?.agency_name ?? null,
          phone: profile?.phone ?? null,
          email: user.email ?? null,
        }}
        stats={{
          properties: propertiesCount ?? 0,
          inspections: inspectionsCount ?? 0,
          reports: reportsCount ?? 0,
        }}
      />
    </main>
  );
}
