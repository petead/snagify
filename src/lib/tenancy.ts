/**
 * Tenancy business rules and status.
 * Requires: tenancies table, inspections.tenancy_id (FK to tenancies).
 */

// Auto-calculate tenancy status
export function getTenancyStatus(tenancy: {
  contract_from?: string | null;
  contract_to?: string | null;
  actual_end_date?: string | null;
}) {
  if (!tenancy.contract_from || !tenancy.contract_to) return "active";

  const today = new Date();
  const dubaiOffset = 4 * 60;
  const utcNow = today.getTime() + today.getTimezoneOffset() * 60000;
  const dubaiNow = new Date(utcNow + dubaiOffset * 60000);

  const end = new Date(tenancy.actual_end_date || tenancy.contract_to);
  const start = new Date(tenancy.contract_from);
  const daysLeft = Math.ceil(
    (end.getTime() - dubaiNow.getTime()) / (1000 * 60 * 60 * 24)
  );

  if (tenancy.actual_end_date && end < dubaiNow) return "terminated_early";
  if (end < dubaiNow) return "expired";
  if (daysLeft <= 30) return "expiring_soon";
  if (start > dubaiNow) return "upcoming";
  return "active";
}

export function getTenancyDaysLeft(tenancy: {
  contract_to?: string | null;
  actual_end_date?: string | null;
}): number | null {
  if (!tenancy.contract_to && !tenancy.actual_end_date) return null;
  const today = new Date();
  const dubaiOffset = 4 * 60;
  const utcNow = today.getTime() + today.getTimezoneOffset() * 60000;
  const dubaiNow = new Date(utcNow + dubaiOffset * 60000);
  const end = new Date(tenancy.actual_end_date || tenancy.contract_to!);
  return Math.ceil(
    (end.getTime() - dubaiNow.getTime()) / (1000 * 60 * 60 * 24)
  );
}

// Status display config
export const TENANCY_STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; text: string; dot: string }
> = {
  active: { label: "Active", bg: "#cafe87", text: "#1A1A1A", dot: "#16a34a" },
  expiring_soon: {
    label: "Expiring Soon",
    bg: "#FEDE80",
    text: "#1A1A1A",
    dot: "#d97706",
  },
  upcoming: { label: "Upcoming", bg: "#F0EDFF", text: "#9A88FD", dot: "#9A88FD" },
  expired: { label: "Expired", bg: "#F3F4F6", text: "#6B7280", dot: "#9CA3AF" },
  terminated_early: {
    label: "Terminated",
    bg: "#FEE2E2",
    text: "#DC2626",
    dot: "#DC2626",
  },
};

// Business rules
export function canStartCheckOut(
  tenancy: { id: string },
  inspections: { tenancy_id?: string | null; type?: string | null; status?: string | null }[]
) {
  const checkIn = inspections.find(
    (i) => i.tenancy_id === tenancy.id && (i.type === "check-in" || (i.type ?? "").toLowerCase().includes("check-in"))
  );
  if (!checkIn)
    return { allowed: false, reason: "Complete a check-in first" };
  if (checkIn.status === "draft")
    return { allowed: false, reason: "Finish the check-in report first" };
  if (checkIn.status === "in_progress")
    return { allowed: false, reason: "Complete the check-in report first" };

  const checkOut = inspections.find(
    (i) => i.tenancy_id === tenancy.id && (i.type === "check-out" || (i.type ?? "").toLowerCase().includes("check-out"))
  );
  if (checkOut)
    return { allowed: false, reason: "Check-out already exists" };

  return { allowed: true, reason: null };
}

export function canStartCheckIn(
  tenancy: { id: string },
  inspections: { tenancy_id?: string | null; type?: string | null }[]
) {
  const checkIn = inspections.find(
    (i) => i.tenancy_id === tenancy.id && (i.type === "check-in" || (i.type ?? "").toLowerCase().includes("check-in"))
  );
  if (checkIn) return { allowed: false, reason: "Check-in already exists" };
  return { allowed: true, reason: null };
}

export async function hasOverlapWarning(
  propertyId: string | null,
  _newTenancyFrom: string,
  supabase: { from: (t: string) => unknown }
): Promise<string | null> {
  if (!propertyId) return null;

  const { data: activeTenancies } = await (supabase as any)
    .from("tenancies")
    .select("*, inspections(id, type, status)")
    .eq("property_id", propertyId)
    .in("status", ["active", "expiring_soon", "upcoming"]);

  const list = (activeTenancies ?? []) as {
    tenant_name?: string;
    inspections?: { type?: string; status?: string }[];
  }[];
  if (!list.length) return null;

  const withoutCheckout = list.filter((t) => {
    const checkOut = t.inspections?.find(
      (i) => (i.type === "check-out" || (i.type ?? "").toLowerCase().includes("check-out")) && i.status === "completed"
    );
    return !checkOut;
  });

  if (withoutCheckout.length > 0) {
    const name = withoutCheckout[0].tenant_name ?? "A tenant";
    return `${name} has an active tenancy without a completed check-out.`;
  }
  return null;
}
