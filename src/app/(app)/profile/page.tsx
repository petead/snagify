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
    .select("*, company:companies(*)")
    .eq("id", user.id)
    .single();

  const company = Array.isArray(profile?.company) ? profile?.company?.[0] : profile?.company;

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
          agency_name: (company as { name?: string } | null)?.name ?? (profile as { agency_name?: string } | null)?.agency_name ?? null,
          phone: profile?.phone ?? null,
          memberSince: profile?.created_at ?? null,
          avatar_url: profile?.avatar_url ?? null,
          job_title: profile?.job_title ?? null,
          whatsapp_number: profile?.whatsapp_number ?? null,
          rera_number: profile?.rera_number ?? null,
          company_logo_url: (company as { logo_url?: string } | null)?.logo_url ?? (profile as { company_logo_url?: string } | null)?.company_logo_url ?? null,
          company_website: (company as { website?: string } | null)?.website ?? (profile as { company_website?: string } | null)?.company_website ?? null,
          company_address: (company as { address?: string } | null)?.address ?? (profile as { company_address?: string } | null)?.company_address ?? null,
          company_trade_license: (company as { trade_license?: string } | null)?.trade_license ?? (profile as { company_trade_license?: string } | null)?.company_trade_license ?? null,
          signature_image_url: profile?.signature_image_url ?? null,
          company_primary_color: (company as { primary_color?: string } | null)?.primary_color ?? (profile as { company_primary_color?: string } | null)?.company_primary_color ?? null,
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
