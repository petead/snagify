import { createClient } from "@/lib/supabase/server";
import { DashboardHeader } from "@/components/layout/DashboardHeader";
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

  // Try fetch with tenancies first (for status on cards)
  let propertiesData: Array<{
    id: string;
    building_name: string | null;
    unit_number: string | null;
    address: string | null;
    property_type: string | null;
    created_at: string | null;
    tenancies?: Array<{
      id: string;
      tenant_name: string | null;
      contract_from: string | null;
      contract_to: string | null;
      actual_end_date?: string | null;
    }>;
    inspections?: Array<{
      id: string;
      type: string | null;
      status: string | null;
      created_at: string | null;
      completed_at: string | null;
    }>;
  }> = [];

  // Alerts: expiring tenancies + inspections pending signature
  type AlertItem = {
    type: string;
    color: string;
    icon: string;
    title: string;
    subtitle: string;
    href: string;
    actionLabel: string;
  };
  let alerts: AlertItem[] = [];

  if (user) {
    const { data: expiringSoon } = await supabase
      .from("tenancies")
      .select("*, property(building_name, unit_number)")
      .eq("agent_id", user.id);
    const expiringList = (expiringSoon ?? []).filter((t: { contract_to?: string | null }) => {
      if (!t.contract_to) return false;
      const end = new Date(t.contract_to);
      const now = new Date();
      const daysLeft = Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft <= 30 && daysLeft >= 0;
    });
    const { data: pendingSignature } = await supabase
      .from("inspections")
      .select("id, property_id, property(building_name, unit_number)")
      .eq("agent_id", user.id)
      .eq("status", "completed");
    const pendingList = pendingSignature ?? [];
    const signedInspectionIds = new Set<string>();
    if (pendingList.length > 0) {
      const { data: sigs } = await supabase
        .from("signatures")
        .select("inspection_id")
        .not("signed_at", "is", null);
      (sigs ?? []).forEach((s: { inspection_id: string }) => signedInspectionIds.add(s.inspection_id));
    }
    const trulyPending = pendingList.filter((i: { id: string }) => !signedInspectionIds.has(i.id));

    const propObj = (x: unknown): { building_name?: string | null; unit_number?: string | null } | null => {
      if (x == null) return null;
      if (Array.isArray(x)) return (x[0] as { building_name?: string | null; unit_number?: string | null }) ?? null;
      return x as { building_name?: string | null; unit_number?: string | null };
    };
    alerts = [
      ...expiringList.map((t: { tenant_name?: string | null; property_id: string; property?: unknown }) => {
        const p = propObj(t.property);
        return {
          type: "expiring",
          color: "#FEDE80",
          icon: "⚠️",
          title: `${(t.tenant_name ?? "Tenant").split(" ")[0]} — contract expiring soon`,
          subtitle: p?.building_name && p?.unit_number
            ? `${p.building_name}, Unit ${p.unit_number}`
            : (p?.building_name ?? p?.unit_number ?? "Property"),
          href: `/property/${t.property_id}`,
          actionLabel: "View →",
        };
      }),
      ...trulyPending.map((i: { id: string; property?: unknown }) => {
        const p = propObj(i.property);
        return {
          type: "signature",
          color: "#F0EDFF",
          icon: "✍️",
          title: "Report waiting for signature",
          subtitle: p?.building_name && p?.unit_number
            ? `${p.building_name}, Unit ${p.unit_number}`
            : (p?.building_name ?? p?.unit_number ?? "Inspection"),
          href: `/inspection/${i.id}/report`,
          actionLabel: "Send →",
        };
      }),
    ];
  }

  if (user) {
    const { data: withTenancies, error: tenErr } = await supabase
      .from("properties")
      .select(
        `
        id, building_name, unit_number, address, property_type, created_at,
        tenancies (id, tenant_name, contract_from, contract_to, actual_end_date),
        inspections (id, type, status, created_at, completed_at)
      `
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false });

    if (!tenErr && withTenancies?.length) {
      propertiesData = withTenancies as typeof propertiesData;
    } else {
      const { data: fallback } = await supabase
        .from("properties")
        .select(
          `
          id, building_name, unit_number, address, property_type, created_at,
          inspections (id, type, status, created_at, completed_at)
        `
        )
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      propertiesData = (fallback ?? []) as typeof propertiesData;
    }
  }

  // Recent Activity timeline (last 5 inspections)
  type RecentInspection = {
    id: string;
    type: string | null;
    status: string | null;
    created_at: string | null;
    completed_at: string | null;
    properties?: unknown;
    tenancies?: unknown;
    signatures?: { signer_type: string; otp_verified: boolean; signed_at: string | null }[];
  };
  let recentInspections: RecentInspection[] = [];
  if (user) {
    const { data: recent } = await supabase
      .from("inspections")
      .select(
        `
        id, type, status, created_at, completed_at,
        properties (building_name, unit_number),
        tenancies (tenant_name),
        signatures (signer_type, otp_verified, signed_at)
      `
      )
      .eq("agent_id", user.id)
      .order("created_at", { ascending: false })
      .limit(5);
    recentInspections = (recent ?? []) as RecentInspection[];
  }

  return (
    <main className="min-h-screen bg-[#fcfcfc]">
      <header className="bg-white border-b border-gray-100 px-4 h-16 flex items-center justify-between sticky top-0 z-50">
        <DashboardHeader fullName={fullName} userEmail={user?.email ?? null} />
      </header>
      <DashboardClient
        displayName={displayName}
        properties={propertiesData}
        alerts={alerts}
        recentInspections={recentInspections}
      />
    </main>
  );
}
