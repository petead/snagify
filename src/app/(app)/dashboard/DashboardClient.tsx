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

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  tenant_name: string | null;
  landlord_name: string | null;
};

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  location: string | null;
  address: string | null;
  property_type: string | null;
  created_at: string | null;
  inspections?: InspectionRow[] | null;
};

interface DashboardClientProps {
  displayName: string;
  properties: PropertyRow[];
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
}: DashboardClientProps) {
  const [properties] = useState(() => normalizeProperties(initialProperties));
  const [search, setSearch] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const touchStartY = useRef(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Flatten all inspections for stats
  const allInspections = properties.flatMap((p) => p.inspections);
  const totalProperties = properties.length;
  const totalInspections = allInspections.length;
  const pendingSigCount = allInspections.filter(
    (i) => i.status === "completed"
  ).length;
  const now = new Date();
  const thisMonthCount = allInspections.filter((i) => {
    if (!i.created_at) return false;
    const d = new Date(i.created_at);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  // Search filter
  const filtered = search.trim()
    ? properties.filter((p) => {
        const q = search.toLowerCase();
        const building = (p.building_name ?? "").toLowerCase();
        const unit = (p.unit_number ?? "").toLowerCase();
        const loc = (p.location ?? "").toLowerCase();
        const addr = (p.address ?? "").toLowerCase();
        const tenant = (p.inspections?.[0]?.tenant_name ?? "").toLowerCase();
        return building.includes(q) || unit.includes(q) || loc.includes(q) || addr.includes(q) || tenant.includes(q);
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

        <h2 className="font-heading font-bold text-lg mt-8 mb-3 px-4" style={{ color: "#111827" }}>
          My Properties
        </h2>

        {properties.length > 0 && (
          <div className="relative mb-4 px-4">
            <Search
              size={18}
              className="absolute left-7 top-1/2 pointer-events-none"
              style={{ color: "#9ca3af", transform: "translateY(-50%)" }}
            />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by address, unit, or tenant..."
              className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white font-body text-sm focus:outline-none"
              style={{ color: "#111827" }}
            />
          </div>
        )}

        {filtered.length > 0 ? (
          <div className="px-0">
            {filtered.map((prop) => {
              const inspCount = prop.inspections.length;
              const sorted = [...prop.inspections].sort(
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
                          {prop.building_name && prop.unit_number
                            ? `${prop.building_name} — Unit ${prop.unit_number}`
                            : prop.address ?? "Untitled Property"}
                        </p>
                        {prop.location && (
                          <p className="font-body text-xs mt-0 mb-0" style={{ color: "#6b7280" }}>
                            {prop.location}
                          </p>
                        )}
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
        ) : properties.length > 0 ? (
          <div className="mx-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-3 min-h-[160px]">
            <Search size={32} style={{ color: "#d1d5db" }} />
            <p className="font-heading font-semibold mt-0 mb-0" style={{ color: "#111827" }}>
              No results
            </p>
            <p className="font-body text-sm text-center mt-0 mb-0" style={{ color: "#6b7280" }}>
              No properties match &ldquo;{search}&rdquo;
            </p>
          </div>
        ) : (
          <div className="mx-4 rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[240px]">
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
