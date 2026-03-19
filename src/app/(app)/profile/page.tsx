import { createClient } from "@/lib/supabase/server";
import { normalizeAccountTier, normalizeProfileRole } from "@/lib/profileLabels";
import { redirect } from "next/navigation";
import { Suspense } from "react";
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

  // One-time fix: set onboarding_completed = true for existing accounts
  if (profile && (profile as { onboarding_completed?: boolean }).onboarding_completed === false) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
  }

  const company = Array.isArray(profile?.company) ? profile?.company?.[0] : profile?.company;

  const [
    { count: propertiesCount },
    { count: inspectionsCount },
    { count: reportsCount },
  ] = await Promise.all([
    supabase.from("properties").select("id", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase.from("inspections").select("*", { count: "exact", head: true }).eq("agent_id", user.id),
    supabase
      .from("inspections")
      .select("*", { count: "exact", head: true })
      .eq("agent_id", user.id)
      .in("status", ["completed", "signed"]),
  ]);

  const accountType = normalizeAccountTier(
    (profile as { account_type?: string } | null)?.account_type
  );
  const role = normalizeProfileRole((profile as { role?: string } | null)?.role);
  const companyData = company ? {
    id: (company as { id?: string }).id ?? "",
    plan: (company as { plan?: string }).plan ?? "free",
    credits_balance: (company as { credits_balance?: number }).credits_balance ?? 0,
    max_users: (company as { max_users?: number }).max_users ?? 1,
    name: (company as { name?: string }).name ?? "",
    stripe_subscription_id: (company as { stripe_subscription_id?: string | null }).stripe_subscription_id ?? null,
  } : null;

  return (
    <main className="min-h-screen" style={{ background: "#F8F7F4" }}>
      <Suspense fallback={<div style={{ padding: 24 }}>Loading...</div>}>
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
            receive_signed_report_email:
              (profile as { receive_signed_report_email?: boolean | null } | null)
                ?.receive_signed_report_email !== false,
          }}
          stats={{
            properties: propertiesCount ?? 0,
            inspections: inspectionsCount ?? 0,
            reports: reportsCount ?? 0,
          }}
          accountType={accountType}
          role={role}
          company={companyData}
        />
      </Suspense>
    </main>
  );
}
