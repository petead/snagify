import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { PropertiesClient } from "./PropertiesClient";

/** Pull-to-refresh is implemented in `PropertiesClient` (hook + indicator). */

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
      id,
      building_name,
      unit_number,
      location,
      property_type,
      created_at,
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
    <main
      style={{
        height: "calc(100dvh - 4rem)",
        maxHeight: "calc(100dvh - 4rem)",
        overflow: "hidden",
        background: "#F8F7F4",
      }}
    >
      <PropertiesClient
        properties={list}
        fullName={fullName}
        userEmail={user.email ?? null}
      />
    </main>
  );
}
