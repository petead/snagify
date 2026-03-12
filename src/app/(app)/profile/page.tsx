import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ProfileClient } from "./ProfileClient";

export default async function ProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "full_name, agency_name, phone, created_at, avatar_url, job_title, whatsapp_number, rera_number, company_logo_url, company_website, company_address, company_trade_license, signature_image_url, company_primary_color"
    )
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
        userId={user.id}
        userEmail={user.email ?? null}
        profile={{
          full_name: profile?.full_name ?? null,
          agency_name: profile?.agency_name ?? null,
          phone: profile?.phone ?? null,
          memberSince: profile?.created_at ?? null,
          avatar_url: profile?.avatar_url ?? null,
          job_title: profile?.job_title ?? null,
          whatsapp_number: profile?.whatsapp_number ?? null,
          rera_number: profile?.rera_number ?? null,
          company_logo_url: profile?.company_logo_url ?? null,
          company_website: profile?.company_website ?? null,
          company_address: profile?.company_address ?? null,
          company_trade_license: profile?.company_trade_license ?? null,
          signature_image_url: profile?.signature_image_url ?? null,
          company_primary_color: profile?.company_primary_color ?? null,
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
