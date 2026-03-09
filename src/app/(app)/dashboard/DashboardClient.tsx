"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  PenLine,
  Calendar,
  Search,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { getTenancyStatus, getTenancyDaysLeft } from "@/lib/tenancy";

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
};

type TenancyRow = {
  id: string;
  tenant_name: string | null;
  contract_from: string | null;
  contract_to: string | null;
  actual_end_date?: string | null;
};

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  address: string | null;
  property_type: string | null;
  created_at: string | null;
  tenancies?: TenancyRow[] | null;
  inspections?: InspectionRow[] | null;
};

function getPropertyTenancyStatus(prop: PropertyRow): {
  label: string;
  emoji: string;
  sub?: string;
 } {
  const tenancies = prop.tenancies ?? [];
  if (!tenancies.length) {
    return { label: "Vacant", emoji: "⬜" };
  }
  const statusOrder = ["active", "expiring_soon", "upcoming", "expired", "terminated_early"];
  const sorted = [...tenancies].sort((a, b) => {
    const sa = getTenancyStatus(a);
    const sb = getTenancyStatus(b);
    return statusOrder.indexOf(sa) - statusOrder.indexOf(sb);
  });
  const t = sorted[0];
  const status = getTenancyStatus(t);
  const name = t.tenant_name?.trim().split(/\s+/)[0] ?? "Tenant";
  if (status === "active") {
    return { label: `Active — ${name}`, emoji: "🟢" };
  }
  if (status === "expiring_soon") {
    const days = getTenancyDaysLeft(t);
    return {
      label: days != null && days >= 0 ? `Expiring in ${days} days` : "Expiring Soon",
      emoji: "⚠️",
    };
  }
  if (status === "terminated_early") {
    return { label: "Terminated", emoji: "🔴" };
  }
  if (status === "expired") {
    return { label: "Expired", emoji: "⬜" };
  }
  if (status === "upcoming") {
    return { label: `Upcoming — ${name}`, emoji: "⬜" };
  }
  return { label: "Vacant", emoji: "⬜" };
}

export type AlertItem = {
  type: string;
  color: string;
  icon: string;
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
};

interface DashboardClientProps {
  displayName: string;
  properties: PropertyRow[];
  alerts?: AlertItem[];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
}

function propertyEmoji(type: string | null): string {
  if (!type) return "🏢";
  const t = type.toLowerCase();
  if (t.includes("villa")) return "🏠";
  if (t.includes("studio")) return "🛏️";
  if (t.includes("townhouse")) return "🏬";
  return "🏢";
}

function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
    });
  } catch {
    return "";
  }
}

function normalizeProperties(rows: PropertyRow[]): PropertyRow[] {
  return (rows ?? []).map((p) => ({
    ...p,
    inspections: Array.isArray(p.inspections) ? p.inspections : [],
  }));
}

export function DashboardClient({
  displayName,
  properties: initialProperties,
  alerts = [],
}: DashboardClientProps) {
  const [properties] = useState(() => normalizeProperties(initialProperties));
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Flatten all inspections for stats
  const allInspections = properties?.flatMap((p) => p.inspections ?? []) ?? [];
  const totalProperties = properties.length;
  const totalInspections = allInspections?.length ?? 0;
  const pendingSigCount = allInspections?.filter(
    (i) => i?.status === "completed"
  )?.length ?? 0;
  const now = new Date();
  const thisMonthCount = allInspections?.filter((i) => {
    if (!i?.created_at) return false;
    const d = new Date(i.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  })?.length ?? 0;

  // Search filter
  const filtered = search.trim()
    ? properties.filter((p) => {
        const q = search.toLowerCase();
        const building = (p.building_name ?? "").toLowerCase();
        const unit = (p.unit_number ?? "").toLowerCase();
        const addr = (p.address ?? "").toLowerCase();
        const tenant = (p.tenancies?.[0]?.tenant_name ?? "").toLowerCase();
        return building.includes(q) || unit.includes(q) || addr.includes(q) || tenant.includes(q);
      })
    : properties;

  // Pull to refresh
  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    router.refresh();
    await new Promise((r) => setTimeout(r, 800));
    setRefreshing(false);
  }, [router]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      const diff = e.changedTouches[0].clientY - touchStartY.current;
      const el = scrollRef.current;
      if (diff > 80 && el && el.scrollTop <= 0 && !refreshing) {
        handleRefresh();
      }
    },
    [handleRefresh, refreshing]
  );

  const [greetingText, setGreetingText] = useState(getGreeting());
  useEffect(() => {
    setGreetingText(getGreeting());
  }, []);

  const renderChip = (insp: InspectionRow | undefined, emptyLabel: string) => {
    if (!insp) {
      return (
        <span
          className="rounded-full text-xs px-2.5 py-1 border border-dashed font-body"
          style={{ borderColor: "#d1d5db", color: "#9ca3af" }}
        >
          {emptyLabel}
        </span>
      );
    }
    if (insp.status === "signed") {
      return (
        <span
          className="rounded-full text-xs px-2.5 py-1 font-heading font-medium"
          style={{ backgroundColor: "#9A88FD", color: "white" }}
        >
          {(insp.type ?? "check-in").toUpperCase().replace("-", "‑")}
        </span>
      );
    }
    if (insp.status === "completed") {
      return (
        <span
          className="rounded-full text-xs px-2.5 py-1 font-heading font-medium"
          style={{ backgroundColor: "#cafe87", color: "#111827" }}
        >
          {(insp.type ?? "check-in").toUpperCase().replace("-", "‑")}
        </span>
      );
    }
    return (
      <span
        className="rounded-full text-xs px-2.5 py-1 font-heading font-medium"
        style={{ backgroundColor: "#f3f4f6", color: "#4b5563" }}
      >
        {(insp.type ?? "check-in").toUpperCase().replace("-", "‑")}
      </span>
    );
  };

  return (
    <>
      <div
        ref={scrollRef}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {refreshing && (
          <div className="flex justify-center py-3 px-4">
            <Loader2 size={22} className="animate-spin" style={{ color: "#7B65FC" }} />
          </div>
        )}

        <div
          className="m-4 rounded-2xl p-5 flex flex-col gap-4"
          style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
        >
          <div>
            <h1 className="font-heading font-bold text-2xl mt-0 mb-0" style={{ color: "white" }}>
              {greetingText}, {displayName} 👋
            </h1>
            <p className="font-body text-sm mt-1 mb-0" style={{ color: "white", opacity: 0.8 }}>
              Dubai Property Inspections
            </p>
          </div>
          <Link
            href="/inspection/new"
            className="font-semibold px-4 py-2 rounded-xl text-sm whitespace-nowrap"
            style={{ backgroundColor: "#cafe87", color: "#111827" }}
          >
            + New Inspection
          </Link>
        </div>

        {alerts.length > 0 && (
          <div className="mx-4 mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-2 h-2 rounded-full bg-red-400 animate-pulse" aria-hidden />
              <span className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Action Required
              </span>
              <span
                className="ml-auto bg-red-400 text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center"
                aria-label={`${alerts.length} alerts`}
              >
                {alerts.length}
              </span>
            </div>
            {alerts.map((alert, i) => (
              <div
                key={`${alert.type}-${i}`}
                role="button"
                tabIndex={0}
                onClick={() => router.push(alert.href)}
                onKeyDown={(e) => e.key === "Enter" && router.push(alert.href)}
                className="flex items-center gap-3 p-3 rounded-xl mb-2 cursor-pointer active:scale-[0.98] transition-transform border border-gray-100 bg-white"
                style={{
                  borderLeft: `4px solid ${alert.color === "#FEDE80" ? "#F59E0B" : "#9A88FD"}`,
                }}
              >
                <span className="text-xl flex-shrink-0">{alert.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{alert.title}</p>
                  <p className="text-xs text-gray-400 truncate">{alert.subtitle}</p>
                </div>
                <span className="text-xs font-semibold text-[#9A88FD] flex-shrink-0">
                  {alert.actionLabel}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mx-4 mb-4">
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div style={{ color: "#7B65FC" }}>
              <Building2 size={22} strokeWidth={2} />
            </div>
            <p className="font-body text-2xl font-semibold mt-2 mb-0" style={{ color: "#111827" }}>
              {totalProperties}
            </p>
            <p className="font-body text-sm mt-0.5 mb-0" style={{ color: "#6b7280" }}>
              Total Properties
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div style={{ color: "#22c55e" }}>
              <ClipboardList size={22} strokeWidth={2} />
            </div>
            <p className="font-body text-2xl font-semibold mt-2 mb-0" style={{ color: "#111827" }}>
              {totalInspections}
            </p>
            <p className="font-body text-sm mt-0.5 mb-0" style={{ color: "#6b7280" }}>
              Total Inspections
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div style={{ color: "#facc15" }}>
              <PenLine size={22} strokeWidth={2} />
            </div>
            <p className="font-body text-2xl font-semibold mt-2 mb-0" style={{ color: "#111827" }}>
              {pendingSigCount}
            </p>
            <p className="font-body text-sm mt-0.5 mb-0" style={{ color: "#6b7280" }}>
              Pending Signature
            </p>
          </div>
          <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100">
            <div style={{ color: "#7B65FC" }}>
              <Calendar size={22} strokeWidth={2} />
            </div>
            <p className="font-body text-2xl font-semibold mt-2 mb-0" style={{ color: "#111827" }}>
              {thisMonthCount}
            </p>
            <p className="font-body text-sm mt-0.5 mb-0" style={{ color: "#6b7280" }}>
              This Month
            </p>
          </div>
        </div>

        <div className="flex items-center justify-between mt-8 mb-3 px-4">
          <h2 className="font-heading font-bold text-lg m-0" style={{ color: "#111827" }}>
            Recent Activity
          </h2>
          {properties.length > 0 && (
            <Link
              href="/properties"
              className="text-sm font-semibold"
              style={{ color: "#9A88FD" }}
            >
              View all →
            </Link>
          )}
        </div>

        {filtered.length > 0 ? (
          <div className="px-0">
            {filtered.slice(0, 3).map((prop) => {
              const inspections = prop.inspections ?? [];
              const inspCount = inspections.length;
              const sorted = [...inspections].sort(
                (a, b) =>
                  new Date(b.created_at ?? 0).getTime() -
                  new Date(a.created_at ?? 0).getTime()
              );
              const latest = sorted[0] ?? null;
              const checkIn = sorted.find(
                (i) =>
                  (i.type ?? "").toLowerCase().includes("check-in") ||
                  (i.type ?? "").toLowerCase() === "check_in"
              );
              const checkOut = sorted.find(
                (i) =>
                  (i.type ?? "").toLowerCase().includes("check-out") ||
                  (i.type ?? "").toLowerCase() === "check_out"
              );

              return (
                <Link
                  key={prop.id}
                  href={`/property/${prop.id}`}
                  className="bg-white mx-4 mb-3 rounded-2xl p-4 shadow-sm border border-gray-100 block"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div
                        className="w-11 h-11 rounded-xl flex items-center justify-center text-xl flex-shrink-0"
                        style={{ backgroundColor: "#f3e8ff" }}
                      >
                        {propertyEmoji(prop.property_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-heading font-bold text-sm truncate mt-0 mb-0" style={{ color: "#111827" }}>
                          {prop.address ?? (prop.building_name && prop.unit_number
                            ? `${prop.building_name}, Unit ${prop.unit_number}`
                            : "Untitled Property")}
                        </p>
                        <p className="font-body text-xs mt-0.5 truncate" style={{ color: "#6b7280" }}>
                          {getPropertyTenancyStatus(prop).emoji} {getPropertyTenancyStatus(prop).label}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0">
                      <span
                        className="rounded-full px-2.5 py-0.5 font-heading font-medium text-xs"
                        style={{ backgroundColor: "#f3e8ff", color: "#7B65FC" }}
                      >
                        {inspCount} inspection{inspCount !== 1 ? "s" : ""}
                      </span>
                      {latest && (
                        <span className="font-body text-xs" style={{ color: "#9ca3af" }}>
                          Last: {formatDateShort(latest.created_at)}
                        </span>
                      )}
                      <ChevronRight size={16} className="flex-shrink-0" style={{ color: "#9ca3af" }} />
                    </div>
                  </div>
                  <div className="border-t border-gray-100 mt-3 pt-2.5 flex gap-2 flex-wrap" style={{ borderTopWidth: "1px" }}>
                    {renderChip(checkIn ?? undefined, "No check‑in yet")}
                    {renderChip(checkOut ?? undefined, "No check‑out yet")}
                  </div>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="mx-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
            <span className="text-5xl" role="img" aria-hidden>
              🏙️
            </span>
            <p className="font-heading font-semibold mt-0 mb-0" style={{ color: "#111827" }}>
              No properties yet
            </p>
            <p className="font-body text-sm text-center mt-0 mb-0" style={{ color: "#6b7280" }}>
              Start your first inspection to add a property
            </p>
            <Link
              href="/inspection/new"
              className="font-heading font-bold px-6 py-3 rounded-xl inline-block"
              style={{ backgroundColor: "#9A88FD", color: "white" }}
            >
              + New Inspection
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
