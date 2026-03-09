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

  const { data: properties, error } = await supabase
    .from("properties")
    .select(
      `
      *,
      tenancies (
        id, tenant_name, status, contract_from, contract_to,
        annual_rent,
        inspections (id, type, status)
      )
    `
    )
    .eq("agent_id", user.id)
    .order("created_at", { ascending: false });

  const list = error ? [] : (properties ?? []);

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user.email ?? null} />
      </header>
      <PropertiesClient properties={list} />
    </main>
  );
}
