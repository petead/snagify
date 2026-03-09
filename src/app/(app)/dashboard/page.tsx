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

  const { data: properties } = user
    ? await supabase
        .from("properties")
        .select(
          `
          *,
          inspections (
            id,
            type,
            status,
            created_at,
            completed_at,
            tenant_name,
            landlord_name
          )
        `
        )
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false })
    : { data: null };

  return (
    <main className="min-h-screen bg-gray-50 pb-24 max-w-lg mx-auto">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user?.email ?? null} />
      </header>
      <DashboardClient
        displayName={displayName}
        properties={properties ?? []}
      />
      <DashboardBottomNav />
    </main>
  );
}
