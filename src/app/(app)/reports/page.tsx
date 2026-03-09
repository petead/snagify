import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
import { ReportsClient } from "./ReportsClient";

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

  const { data: reports } = await supabase
    .from("inspections")
    .select(
      `
      id, type, status, completed_at, created_at,
      properties(building_name, unit_number),
      tenancies(tenant_name, ejari_ref)
    `
    )
    .eq("agent_id", user.id)
    .in("status", ["completed", "signed"])
    .order("completed_at", { ascending: false });

  const inspectionIds = (reports ?? []).map((r: { id: string }) => r.id);
  let signedSet = new Set<string>();
  if (inspectionIds.length > 0) {
    const { data: sigs } = await supabase
      .from("signatures")
      .select("inspection_id")
      .in("inspection_id", inspectionIds)
      .not("signed_at", "is", null);
    (sigs ?? []).forEach((s: { inspection_id: string }) => signedSet.add(s.inspection_id));
  }

  const first = (x: unknown): Record<string, unknown> | null => {
    if (x == null) return null;
    return Array.isArray(x) ? (x[0] as Record<string, unknown>) ?? null : (x as Record<string, unknown>);
  };

  const reportsWithSigned = (reports ?? []).map(
    (r: {
      id: string;
      type: string | null;
      status: string | null;
      completed_at: string | null;
      created_at: string | null;
      properties?: unknown;
      tenancies?: unknown;
    }) => {
      const prop = first(r.properties);
      const ten = first(r.tenancies);
      return {
        id: r.id,
        type: r.type,
        status: r.status,
        completed_at: r.completed_at,
        created_at: r.created_at,
        building_name: (prop?.building_name as string | null) ?? null,
        unit_number: (prop?.unit_number as string | null) ?? null,
        tenant_name: (ten?.tenant_name as string | null) ?? null,
        ejari_ref: (ten?.ejari_ref as string | null) ?? null,
        isSigned: r.status === "signed" || signedSet.has(r.id),
      };
    }
  );

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user.email ?? null} />
      </header>
      <ReportsClient reports={reportsWithSigned} />
    </main>
  );
}
