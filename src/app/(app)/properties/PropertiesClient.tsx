"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, ChevronRight } from "lucide-react";
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

function getPropertyTenancyStatus(prop: PropertyRow): { label: string; emoji: string } {
  const tenancies = prop.tenancies ?? [];
  if (!tenancies.length) return { label: "Vacant", emoji: "⬜" };
  const statusOrder = ["active", "expiring_soon", "upcoming", "expired", "terminated_early"];
  const sorted = [...tenancies].sort((a, b) => {
    const sa = getTenancyStatus(a);
    const sb = getTenancyStatus(b);
    return statusOrder.indexOf(sa) - statusOrder.indexOf(sb);
  });
  const t = sorted[0];
  const status = getTenancyStatus(t);
  const name = t.tenant_name?.trim().split(/\s+/)[0] ?? "Tenant";
  if (status === "active") return { label: `Active — ${name}`, emoji: "🟢" };
  if (status === "expiring_soon") {
    const days = getTenancyDaysLeft(t);
    return {
      label: days != null && days >= 0 ? `Expiring in ${days} days` : "Expiring Soon",
      emoji: "⚠️",
    };
  }
  if (status === "terminated_early") return { label: "Terminated", emoji: "🔴" };
  if (status === "expired") return { label: "Expired", emoji: "⬜" };
  if (status === "upcoming") return { label: `Upcoming — ${name}`, emoji: "⬜" };
  return { label: "Vacant", emoji: "⬜" };
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

export function PropertiesClient({ properties: initialProperties }: { properties: PropertyRow[] }) {
  const [properties] = useState(() => normalizeProperties(initialProperties));
  const [search, setSearch] = useState("");

  const filtered =
    search.trim() === ""
      ? properties
      : properties.filter((p) => {
          const q = search.toLowerCase();
          const building = (p.building_name ?? "").toLowerCase();
          const unit = (p.unit_number ?? "").toLowerCase();
          const addr = (p.address ?? "").toLowerCase();
          const tenant = (p.tenancies?.[0]?.tenant_name ?? "").toLowerCase();
          return building.includes(q) || unit.includes(q) || addr.includes(q) || tenant.includes(q);
        });

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
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-xl mb-4" style={{ color: "#111827" }}>
        My Properties
      </h1>

      {properties.length > 0 && (
        <div className="relative mb-4">
          <Search
            size={18}
            className="absolute left-3 top-1/2 pointer-events-none"
            style={{ color: "#9ca3af", transform: "translateY(-50%)" }}
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by address, unit, or tenant..."
            className="w-full h-11 pl-10 pr-4 rounded-xl border border-gray-200 bg-white font-body text-sm focus:outline-none focus:border-[#9A88FD]"
            style={{ color: "#111827" }}
          />
        </div>
      )}

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((prop) => {
            const inspections = prop.inspections ?? [];
            const sorted = [...inspections].sort(
              (a, b) =>
                new Date(b.created_at ?? 0).getTime() - new Date(a.created_at ?? 0).getTime()
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
                className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 block"
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
                        {prop.address ??
                          (prop.building_name && prop.unit_number
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
                      {inspections.length} inspection{inspections.length !== 1 ? "s" : ""}
                    </span>
                    {latest && (
                      <span className="font-body text-xs" style={{ color: "#9ca3af" }}>
                        Last: {formatDateShort(latest.created_at)}
                      </span>
                    )}
                    <ChevronRight size={16} className="flex-shrink-0" style={{ color: "#9ca3af" }} />
                  </div>
                </div>
                <div
                  className="border-t border-gray-100 mt-3 pt-2.5 flex gap-2 flex-wrap"
                  style={{ borderTopWidth: "1px" }}
                >
                  {renderChip(checkIn ?? undefined, "No check‑in yet")}
                  {renderChip(checkOut ?? undefined, "No check‑out yet")}
                </div>
              </Link>
            );
          })}
        </div>
      ) : properties.length > 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-3 min-h-[160px]">
          <Search size={32} style={{ color: "#d1d5db" }} />
          <p className="font-heading font-semibold mt-0 mb-0" style={{ color: "#111827" }}>
            No results
          </p>
          <p className="font-body text-sm text-center mt-0 mb-0" style={{ color: "#6b7280" }}>
            No properties match &ldquo;{search}&rdquo;
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[240px]">
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
  );
}
