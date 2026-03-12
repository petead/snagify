"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Loader2,
  Building2,
  ClipboardList,
  CalendarDays,
  PenLine,
  Check,
  FileText,
  Search,
  SquarePen,
  AlertTriangle,
} from "lucide-react";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";

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

export type AlertItem = {
  type: string;
  color: string;
  icon: "alert" | "signature";
  title: string;
  subtitle: string;
  href: string;
  actionLabel: string;
};

type RecentInspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  properties?: unknown;
  tenancies?: unknown;
  signatures?: { signer_type: string; otp_verified: boolean; signed_at?: string | null }[];
};

type ActivityItem = {
  icon: "signed" | "report" | "progress" | "started";
  color: string;
  title: string;
  subtitle: string;
  time: string | null;
  href: string;
};

function first<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

function getActivityItem(inspection: RecentInspectionRow): ActivityItem {
  const prop = first(inspection.properties) as { building_name?: string | null; unit_number?: string | null } | null;
  const ten = first(inspection.tenancies) as { tenant_name?: string | null } | null;
  const property = prop?.building_name != null && prop?.unit_number != null
    ? `${prop.building_name}, Unit ${prop.unit_number}`
    : (prop?.building_name ?? prop?.unit_number ?? "Property");
  const tenant = ten?.tenant_name?.split(" ")[0] ?? "";
  const type = inspection.type === "check-in" ? "Check-in" : "Check-out";

  if (inspection.status === "signed") {
    return {
      icon: "signed",
      color: "#cafe87",
      title: `${type} signed`,
      subtitle: property,
      time: inspection.completed_at || inspection.created_at,
      href: `/inspection/${inspection.id}/report`,
    };
  }
  if (inspection.status === "completed") {
    return {
      icon: "report",
      color: "#9A88FD",
      title: `${type} report generated`,
      subtitle: property,
      time: inspection.completed_at || inspection.created_at,
      href: `/inspection/${inspection.id}/report`,
    };
  }
  if (inspection.status === "in_progress") {
    return {
      icon: "progress",
      color: "#FEDE80",
      title: `${type} in progress`,
      subtitle: tenant ? `${property} — ${tenant}` : property,
      time: inspection.created_at,
      href: `/inspection/${inspection.id}`,
    };
  }
  return {
    icon: "started",
    color: "#E5E7EB",
    title: `${type} started`,
    subtitle: property,
    time: inspection.created_at,
    href: `/inspection/${inspection.id}`,
  };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return "";
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 2) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return "Yesterday";
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

interface DashboardClientProps {
  displayName: string;
  properties: PropertyRow[];
  alerts?: AlertItem[];
  recentInspections?: RecentInspectionRow[];
}

function getGreeting(): string {
  const h = new Date().getHours();
  if (h >= 5 && h < 12) return "Good morning";
  if (h >= 12 && h < 18) return "Good afternoon";
  return "Good evening";
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
  recentInspections: initialRecentInspections = [],
}: DashboardClientProps) {
  const [properties] = useState(() => normalizeProperties(initialProperties));
  const [recentInspections, setRecentInspections] = useState(initialRecentInspections);
  const recentRollbackRef = useRef<RecentInspectionRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  useEffect(() => {
    setRecentInspections(initialRecentInspections);
  }, [initialRecentInspections]);

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const allInspections = properties?.flatMap((p) => p.inspections ?? []) ?? [];
  const totalProperties = properties.length;
  const totalInspections = allInspections?.length ?? 0;
  const pendingSigCount = allInspections?.filter((i) => i?.status === "completed")?.length ?? 0;
  const now = new Date();
  const thisMonthCount =
    allInspections?.filter((i) => {
      if (!i?.created_at) return false;
      const d = new Date(i.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    })?.length ?? 0;

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

  const stats = [
    { value: totalProperties, label: "Properties", icon: Building2, href: "/properties" as string | null },
    { value: totalInspections, label: "Inspections", icon: ClipboardList, href: "/reports" as string | null },
    { value: thisMonthCount, label: "This Month", icon: CalendarDays, href: null },
    { value: pendingSigCount, label: "Pending Sign", icon: PenLine, href: "/reports" as string | null },
  ];

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
              {greetingText}, {displayName}
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
                <span className="text-xl flex-shrink-0">
                  {alert.icon === "alert" ? (
                    <AlertTriangle size={18} color="#F59E0B" />
                  ) : (
                    <PenLine size={18} color="#7B65FC" />
                  )}
                </span>
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

        <div className="flex gap-3 mx-4 mb-4 overflow-x-auto pb-1 no-scrollbar -mx-0">
          {stats.map((stat) => (
            <div
              key={stat.label}
              role={stat.href ? "button" : undefined}
              tabIndex={stat.href ? 0 : undefined}
              onClick={() => stat.href && router.push(stat.href)}
              onKeyDown={(e) => stat.href && e.key === "Enter" && router.push(stat.href)}
              className={`bg-white rounded-2xl p-3 shadow-sm border border-gray-100 flex-shrink-0 flex items-center gap-2 min-w-fit ${
                stat.href ? "cursor-pointer active:scale-[0.98] transition-transform" : ""
              }`}
            >
              <stat.icon size={18} color="#7B65FC" />
              <div>
                <p
                  className="text-lg font-bold text-gray-900 leading-none"
                  style={{ fontFamily: "Poppins, sans-serif" }}
                >
                  {stat.value ?? 0}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">{stat.label}</p>
              </div>
            </div>
          ))}
        </div>

        {recentInspections.length > 0 && (
          <div className="mx-4 mb-6">
            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 mb-3">
              Recent Activity
            </p>
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              {recentInspections.map((inspection, index) => {
                const item = getActivityItem(inspection);
                return (
                  <div
                    key={inspection.id}
                    style={{ position: "relative" }}
                    className={index < recentInspections.length - 1 ? "border-b border-gray-50" : ""}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => router.push(item.href)}
                      onKeyDown={(e) => e.key === "Enter" && router.push(item.href)}
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer active:bg-gray-50 transition-colors pr-12"
                    >
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                        style={{ backgroundColor: item.color + "33" }}
                      >
                        {item.icon === "signed" ? (
                          <Check size={16} color="#5a7a2e" />
                        ) : item.icon === "report" ? (
                          <FileText size={16} color="#7B65FC" />
                        ) : item.icon === "progress" ? (
                          <Search size={16} color="#8a6a00" />
                        ) : (
                          <SquarePen size={16} color="#6B7280" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p
                          className="text-sm font-semibold text-gray-800 truncate"
                          style={{ fontFamily: "Poppins, sans-serif" }}
                        >
                          {item.title}
                        </p>
                        <p className="text-xs text-gray-400 truncate mt-0.5">{item.subtitle}</p>
                      </div>
                      <span className="text-xs text-gray-300 flex-shrink-0 ml-2">
                        {timeAgo(item.time)}
                      </span>
                    </div>
                    <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
                      <DeleteInspectionButton
                        inspectionId={inspection.id}
                        inspectionType={(inspection.type ?? "check-in") as "check-in" | "check-out"}
                        status={inspection.status}
                        signatures={inspection.signatures ?? []}
                        redirectTo="/dashboard"
                        variant="icon"
                        onOptimisticRemove={() => {
                          recentRollbackRef.current = [...recentInspections];
                          setRecentInspections((prev) => prev.filter((i) => i.id !== inspection.id));
                        }}
                        onRollback={() => setRecentInspections(recentRollbackRef.current)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
