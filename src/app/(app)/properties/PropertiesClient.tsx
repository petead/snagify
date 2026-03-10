"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  ChevronRight,
  Building2,
  House,
  BedDouble,
  User,
} from "lucide-react";
import { getTenancyStatus } from "@/lib/tenancy";
import ContractProgress from "@/components/inspection/ContractProgress";

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
};

type TenancyRow = {
  id: string;
  tenant_name: string | null;
  status?: string | null;
  contract_from?: string | null;
  contract_to?: string | null;
  annual_rent?: number | null;
  inspections?: InspectionRow[] | InspectionRow | null;
};

type PropertyRow = {
  id: string;
  building_name: string | null;
  unit_number: string | null;
  address: string | null;
  property_type: string | null;
  created_at: string | null;
  tenancies?: TenancyRow[] | TenancyRow | null;
};

function first<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

function normalizeTenancies(t: TenancyRow[] | TenancyRow | null | undefined): TenancyRow[] {
  if (!t) return [];
  const arr = Array.isArray(t) ? t : [t];
  return arr.map((row) => ({
    ...row,
    inspections: Array.isArray(row.inspections)
      ? row.inspections
      : row.inspections
        ? [row.inspections as InspectionRow]
        : [],
  }));
}

function getPropertyStatus(property: PropertyRow): {
  status: "active" | "expiring_soon" | "upcoming" | "vacant";
  tenancy: TenancyRow | null;
} {
  const tenancies = normalizeTenancies(property.tenancies);
  for (const t of tenancies) {
    const status = (t.status as string) || getTenancyStatus(t);
    if (status === "active") return { status: "active", tenancy: t };
  }
  for (const t of tenancies) {
    const status = (t.status as string) || getTenancyStatus(t);
    if (status === "expiring_soon") return { status: "expiring_soon", tenancy: t };
  }
  for (const t of tenancies) {
    const status = (t.status as string) || getTenancyStatus(t);
    if (status === "upcoming") return { status: "upcoming", tenancy: t };
  }
  return { status: "vacant", tenancy: null };
}

const groupConfig: Record<
  "expiring_soon" | "active" | "upcoming" | "vacant",
  { label: string; color: string }
> = {
  expiring_soon: { label: "Expiring Soon", color: "#F59E0B" },
  active: { label: "Active", color: "#16a34a" },
  upcoming: { label: "Upcoming", color: "#9A88FD" },
  vacant: { label: "Vacant", color: "#9CA3AF" },
};

const GROUP_ORDER: ("expiring_soon" | "active" | "upcoming" | "vacant")[] = [
  "expiring_soon",
  "active",
  "upcoming",
  "vacant",
];

function propertyIcon(type: string | null) {
  if (!type) return Building2;
  const t = type.toLowerCase();
  if (t.includes("villa")) return House;
  if (t.includes("studio")) return BedDouble;
  if (t.includes("townhouse")) return House;
  return Building2;
}

export function PropertiesClient({ properties: initialProperties }: { properties: PropertyRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const properties = (initialProperties ?? []).map((p) => ({
    ...p,
    tenancies: normalizeTenancies(p.tenancies),
  }));

  const filteredProperties =
    search.trim() === ""
      ? properties
      : properties.filter((p) => {
          const q = search.toLowerCase();
          const activeTenancy = p.tenancies?.find((t) => {
            const s = (t.status as string) || getTenancyStatus(t);
            return ["active", "expiring_soon", "upcoming"].includes(s);
          });
          return (
            p.building_name?.toLowerCase().includes(q) ||
            p.unit_number?.toLowerCase().includes(q) ||
            (p.address ?? "").toLowerCase().includes(q) ||
            activeTenancy?.tenant_name?.toLowerCase().includes(q)
          );
        });

  const grouped = {
    expiring_soon: filteredProperties.filter((p) => getPropertyStatus(p).status === "expiring_soon"),
    active: filteredProperties.filter((p) => getPropertyStatus(p).status === "active"),
    upcoming: filteredProperties.filter((p) => getPropertyStatus(p).status === "upcoming"),
    vacant: filteredProperties.filter((p) => getPropertyStatus(p).status === "vacant"),
  };

  return (
    <div className="pb-24">
      <div className="px-4 pt-4 pb-3">
        <h1 className="font-heading font-bold text-xl mb-3" style={{ color: "#111827" }}>
          My Properties
        </h1>
        {properties.length > 0 && (
          <div className="relative">
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
      </div>

      {properties.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
          <div className="w-16 h-16 rounded-[20px] bg-[#f5f5f5] mb-4 flex items-center justify-center">
            <Building2 size={28} color="#9ca3af" />
          </div>
          <p
            className="font-bold text-gray-800 mb-2"
            style={{ fontFamily: "Poppins, sans-serif" }}
          >
            No properties yet
          </p>
          <p className="text-sm text-gray-400 mb-6">
            Start your first inspection to add a property
          </p>
          <button
            type="button"
            onClick={() => router.push("/inspection/new")}
            className="font-semibold px-6 py-3 rounded-[14px] text-sm"
            style={{ background: "#cafe87", color: "#1A1A1A" }}
          >
            + New Inspection
          </button>
        </div>
      ) : (
        GROUP_ORDER.map((groupKey) => {
          const list = grouped[groupKey];
          if (list.length === 0) return null;
          const config = groupConfig[groupKey];
          return (
            <div key={groupKey}>
              <div className="mx-4 mb-2 mt-5 flex items-center gap-2">
                <span
                  className="text-xs font-semibold uppercase tracking-wider"
                  style={{ color: config.color }}
                >
                  {config.label}
                </span>
                <span className="text-xs text-gray-400">({list.length})</span>
              </div>
              {list.map((property) => {
                const { status: propStatus, tenancy } = getPropertyStatus(property);
                const configForCard = groupConfig[propStatus];
                const inspections: InspectionRow[] = Array.isArray(tenancy?.inspections)
                  ? tenancy.inspections
                  : tenancy?.inspections
                    ? [tenancy.inspections as InspectionRow]
                    : [];

                const Icon = propertyIcon(property.property_type);
                return (
                  <div
                    key={property.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => router.push(`/property/${property.id}`)}
                    onKeyDown={(e) =>
                      e.key === "Enter" && router.push(`/property/${property.id}`)
                    }
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm mx-4 mb-3 overflow-hidden cursor-pointer active:scale-[0.98] transition-transform"
                    style={{ borderLeft: `4px solid ${configForCard.color}` }}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 bg-[#F0EDFF]">
                            <Icon size={16} color="#7B65FC" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p
                              className="font-bold text-sm text-gray-900 truncate"
                              style={{ fontFamily: "Poppins, sans-serif" }}
                            >
                              {property.building_name ?? "Building"}, Unit{" "}
                              {property.unit_number ?? "—"}
                            </p>
                            {tenancy ? (
                              <p className="text-xs text-gray-400 truncate mt-0.5">
                                <User size={12} className="inline mr-1" />{" "}
                                {tenancy.tenant_name?.split(" ").slice(0, 2).join(" ") ?? "Tenant"}
                              </p>
                            ) : (
                              <p className="text-xs text-gray-400 mt-0.5 italic">
                                No active tenant
                              </p>
                            )}
                          </div>
                        </div>
                        <ChevronRight
                          size={16}
                          className="text-gray-300 flex-shrink-0 mt-1"
                          aria-hidden
                        />
                      </div>

                      {tenancy && (
                        <div className="flex items-center gap-2 mt-3">
                          {(() => {
                            const checkIn = inspections.find(
                              (i) => (i.type ?? "").toLowerCase() === "check-in"
                            );
                            return (
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                  checkIn?.status === "completed" || checkIn?.status === "signed"
                                    ? "bg-[#cafe87] text-gray-800"
                                    : checkIn?.status === "in_progress"
                                      ? "bg-[#F0EDFF] text-[#9A88FD]"
                                      : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {checkIn?.status === "completed" || checkIn?.status === "signed"
                                  ? "Check-in"
                                  : checkIn?.status === "in_progress"
                                    ? "⋯ Check-in"
                                    : "○ Check-in"}
                              </span>
                            );
                          })()}
                          {(() => {
                            const checkOut = inspections.find(
                              (i) => (i.type ?? "").toLowerCase() === "check-out"
                            );
                            return (
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                  checkOut?.status === "completed" || checkOut?.status === "signed"
                                    ? "bg-[#FEDE80] text-gray-800"
                                    : checkOut?.status === "in_progress"
                                      ? "bg-[#F0EDFF] text-[#9A88FD]"
                                      : "bg-gray-100 text-gray-400"
                                }`}
                              >
                                {checkOut?.status === "completed" || checkOut?.status === "signed"
                                  ? "Check-out"
                                  : checkOut?.status === "in_progress"
                                    ? "⋯ Check-out"
                                    : "○ Check-out"}
                              </span>
                            );
                          })()}
                        </div>
                      )}

                      {tenancy?.contract_from && tenancy?.contract_to && (
                        <ContractProgress
                          contractFrom={tenancy.contract_from}
                          contractTo={tenancy.contract_to}
                        />
                      )}

                      {!tenancy && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(`/inspection/new?propertyId=${property.id}`);
                          }}
                          className="mt-3 w-full py-2 rounded-xl border border-dashed border-[#9A88FD] text-[#9A88FD] text-xs font-semibold hover:bg-[#F0EDFF] transition-colors"
                        >
                          + Add Tenant
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          );
        })
      )}
    </div>
  );
}
