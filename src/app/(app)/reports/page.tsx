import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { ReportsClient } from "./ReportsClient";

/** Pull-to-refresh is implemented in `ReportsClient` (hook + indicator). */

export default async function ReportsPage() {
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

  const { data: reportsData } = await supabase
    .from("inspections")
    .select(
      `
      id, type, status, created_at, report_url,
      properties (building_name, unit_number),
      tenancies (tenant_name),
      signatures (signer_type, otp_verified, signed_at),
      rooms (id, photos (id))
    `
    )
    .eq("agent_id", user.id)
    .in("status", ["completed", "signed", "in_progress"])
    .order("created_at", { ascending: false });

  return (
    <main
      style={{
        height: "calc(100dvh - 4rem)",
        maxHeight: "calc(100dvh - 4rem)",
        overflow: "hidden",
        background: "#F8F7F4",
      }}
    >
      <ReportsClient
        initialReports={(reportsData ?? []) as Parameters<typeof ReportsClient>[0]["initialReports"]}
        fullName={fullName}
        userEmail={user.email ?? null}
      />
    </main>
  );
}
