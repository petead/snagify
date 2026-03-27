import { createClient } from "@/lib/supabase/server";
import { normalizeAccountTier } from "@/lib/profileLabels";
import { DashboardClient } from "./DashboardClient";

/** Pull-to-refresh is implemented in `DashboardClient` (hook + indicator). */

export default async function DashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let fullName: string | null = null;
  let accountType: "pro" | "individual" = "individual";
  let tourCompleted = true;
  let profileLoading = false;
  let profileNeedsOnboardingFix = false;
  let showProUpgradeBanner = false;
  let stripeSubscriptionId: string | null = null;
  let billingStatus: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, onboarding_completed, account_type, company_id, tour_completed")
      .eq("id", user.id)
      .single();
    if (!profile) {
      profileLoading = true;
    } else {
      fullName = profile?.full_name ?? null;
      tourCompleted = Boolean((profile as { tour_completed?: boolean | null }).tour_completed);
      if (profile && (profile as { onboarding_completed?: boolean }).onboarding_completed === false) {
        profileNeedsOnboardingFix = true;
      }
      accountType = normalizeAccountTier((profile as { account_type?: string }).account_type);
      const companyId = (profile as { company_id?: string }).company_id;
      if (accountType === "pro" && companyId) {
        const { data: company } = await supabase
          .from("companies")
          .select("plan, stripe_subscription_id, billing_period, billing_status")
          .eq("id", companyId)
          .single();
        const plan = (company as { plan?: string } | null)?.plan;
        stripeSubscriptionId =
          (company as { stripe_subscription_id?: string | null } | null)
            ?.stripe_subscription_id ?? null;
        billingStatus =
          (company as { billing_status?: string | null } | null)
            ?.billing_status ?? null;
        if (plan === "free" || plan == null) {
          showProUpgradeBanner = true;
        }
      }
    }
  }

  // One-time fix: set onboarding_completed = true for existing accounts
  if (user && profileNeedsOnboardingFix) {
    await supabase
      .from("profiles")
      .update({ onboarding_completed: true })
      .eq("id", user.id);
  }

  const displayName =
    fullName?.trim()
      ? fullName.trim().split(/\s+/)[0] ?? "there"
      : user?.email
        ? user.email.split("@")[0]
        : "there";

  // Team view — only for owners
  let isOwner = false;
  let teamMembers: { id: string; full_name: string | null }[] = [];
  let teamProperties: Array<{
    id: string;
    building_name: string | null;
    unit_number: string | null;
    location: string | null;
    property_type: string | null;
    created_at: string | null;
    agent_id: string;
    agent_name: string | null;
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

  if (user && accountType === "pro") {
    const { data: myProfile } = await supabase
      .from("profiles")
      .select("role, company_id")
      .eq("id", user.id)
      .single();

    if ((myProfile as { role?: string } | null)?.role === "owner") {
      isOwner = true;
      const companyId = (myProfile as { company_id?: string } | null)?.company_id;

      if (companyId) {
        const { data: members } = await supabase
          .from("profiles")
          .select("id, full_name")
          .eq("company_id", companyId)
          .neq("id", user.id)
          .eq("role", "inspector");

        teamMembers = (members ?? []).map((m: { id: string; full_name?: string | null }) => ({
          id: m.id,
          full_name: m.full_name ?? null,
        }));

        if (teamMembers.length > 0) {
          const memberIds = teamMembers.map((m) => m.id);
          const memberNameMap = new Map(teamMembers.map((m) => [m.id, m.full_name]));

          const { data: memberProps } = await supabase
            .from("properties")
            .select(
              `
              id, building_name, unit_number, location, property_type, created_at, agent_id,
              tenancies (id, tenant_name, contract_from, contract_to, actual_end_date),
              inspections (id, type, status, created_at, completed_at)
            `
            )
            .in("agent_id", memberIds)
            .order("created_at", { ascending: false });

          teamProperties = (memberProps ?? []).map(
            (p: {
              id: string;
              building_name: string | null;
              unit_number: string | null;
              location: string | null;
              property_type: string | null;
              created_at: string | null;
              agent_id: string;
              tenancies?: unknown;
              inspections?: unknown;
            }) => ({
              ...p,
              agent_name: memberNameMap.get(p.agent_id) ?? null,
              tenancies: Array.isArray(p.tenancies) ? p.tenancies : [],
              inspections: Array.isArray(p.inspections) ? p.inspections : [],
            })
          );
        }
      }
    }
  }

  // Try fetch with tenancies first (for status on cards)
  let propertiesData: Array<{
    id: string;
    building_name: string | null;
    unit_number: string | null;
    location: string | null;
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
    icon: "alert" | "signature";
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
    // Fetch inspections that have a report but aren't fully signed yet
    const { data: pendingSignature } = await supabase
      .from("inspections")
      .select("id, property_id, property(building_name, unit_number)")
      .eq("agent_id", user.id)
      .not("report_url", "is", null)
      .neq("status", "signed");
    const pendingList = pendingSignature ?? [];
    
    // For alerts, we want inspections where at least one party hasn't signed
    // Fetch all signatures for these inspections to determine truly pending
    const fullySignedInspectionIds = new Set<string>();
    if (pendingList.length > 0) {
      const inspectionIds = pendingList.map((i: { id: string }) => i.id);
      const { data: sigs } = await supabase
        .from("signatures")
        .select("inspection_id, signer_type, signed_at")
        .in("inspection_id", inspectionIds);
      
      // Group signatures by inspection and check if BOTH landlord AND tenant signed
      const sigsByInspection = new Map<string, { landlord?: boolean; tenant?: boolean }>();
      (sigs ?? []).forEach((s: { inspection_id: string; signer_type: string; signed_at: string | null }) => {
        if (!sigsByInspection.has(s.inspection_id)) {
          sigsByInspection.set(s.inspection_id, {});
        }
        const entry = sigsByInspection.get(s.inspection_id)!;
        if (s.signer_type === 'landlord' && s.signed_at) entry.landlord = true;
        if (s.signer_type === 'tenant' && s.signed_at) entry.tenant = true;
      });
      
      // Only mark as fully signed if BOTH parties have signed
      sigsByInspection.forEach((entry, inspId) => {
        if (entry.landlord && entry.tenant) {
          fullySignedInspectionIds.add(inspId);
        }
      });
    }
    const trulyPending = pendingList.filter((i: { id: string }) => !fullySignedInspectionIds.has(i.id));

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
          icon: "alert" as const,
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
          icon: "signature" as const,
          title: "Report waiting for signature",
          subtitle: p?.building_name && p?.unit_number
            ? `${p.building_name}, Unit ${p.unit_number}`
            : (p?.building_name ?? p?.unit_number ?? "Inspection"),
          href: `/inspection/${i.id}/report`,
          actionLabel: "Send →",
        };
      }),
    ];

    // Past due billing alert
    if (billingStatus === "past_due") {
      alerts.push({
        type: "billing",
        icon: "alert",
        color: "#EF4444",
        title: "Payment failed — action required",
        subtitle: "Update your payment method to avoid losing access",
        href: "/profile?section=subscription",
        actionLabel: "Fix now →",
      });
    }
  }

  if (user) {
    const { data: withTenancies, error: tenErr } = await supabase
      .from("properties")
      .select(
        `
        id, building_name, unit_number, location, property_type, created_at,
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
          id, building_name, unit_number, location, property_type, created_at,
          inspections (id, type, status, created_at, completed_at)
        `
        )
        .eq("agent_id", user.id)
        .order("created_at", { ascending: false });
      propertiesData = (fallback ?? []) as typeof propertiesData;
    }
  }

  return (
    <main className="min-h-screen" style={{ background: "#F8F7F4" }}>
      <DashboardClient
        userId={user?.id ?? null}
        displayName={displayName}
        fullName={fullName}
        userEmail={user?.email ?? null}
        accountType={accountType}
        tourCompleted={tourCompleted}
        profileLoading={profileLoading}
        showProUpgradeBanner={showProUpgradeBanner}
        stripeSubscriptionId={stripeSubscriptionId}
        properties={propertiesData}
        alerts={alerts}
        isOwner={isOwner}
        teamMembers={teamMembers}
        teamProperties={teamProperties}
      />
    </main>
  );
}
