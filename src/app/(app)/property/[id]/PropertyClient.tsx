"use client";

import Link from "next/link";
import { ArrowLeft, Plus } from "lucide-react";

type InspectionInGroup = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  room_count: number;
};

type ContractGroup = {
  key: string;
  tenantName: string | null;
  ejariRef: string | null;
  contractFrom: string | null;
  contractTo: string | null;
  annualRent: number | null;
  inspections: InspectionInGroup[];
};

interface PropertyClientProps {
  property: {
    id: string;
    building_name: string | null;
    unit_number: string | null;
    address: string | null;
    property_type: string | null;
    property_size: number | null;
  };
  contractGroups: ContractGroup[];
  totalInspections: number;
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
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function formatContractPeriod(from: string | null, to: string | null): string {
  const a = formatDateShort(from);
  const b = formatDateShort(to);
  if (!a && !b) return "";
  if (!a) return b;
  if (!b) return a;
  return `${a} → ${b}`;
}

function formatAnnualRent(rent: number | null): string {
  if (rent == null) return "";
  return `AED ${rent.toLocaleString("en-AE")}/yr`;
}

function statusBadge(status: string | null) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-[#F0EDFF] text-[#9A88FD] font-medium text-xs" };
    case "signed":
      return { label: "Signed ✓", className: "bg-[#cafe87] text-[#1A1A1A] font-medium text-xs" };
    default:
      return { label: "Draft", className: "bg-gray-100 text-gray-600 font-medium text-xs" };
  }
}

function getNewInspectionParams(
  contractGroups: ContractGroup[]
): { type: "check-in" | "check-out" } {
  if (contractGroups.length === 0) return { type: "check-in" };
  const current = contractGroups[0];
  const checkIn = current.inspections.find(
    (i) => (i.type ?? "").toLowerCase().includes("check-in") || (i.type ?? "").toLowerCase() === "check_in"
  );
  const checkOut = current.inspections.find(
    (i) => (i.type ?? "").toLowerCase().includes("check-out") || (i.type ?? "").toLowerCase() === "check_out"
  );
  if (!checkIn) return { type: "check-in" };
  if (!checkOut) return { type: "check-out" };
  return { type: "check-in" };
}

export function PropertyClient({
  property,
  contractGroups,
  totalInspections,
}: PropertyClientProps) {
  const title =
    property.address ??
    (property.building_name && property.unit_number
      ? `${property.building_name}, Unit ${property.unit_number}`
      : "Property");
  const truncTitle = title.length > 26 ? title.slice(0, 23) + "…" : title;
  const newInspectionType = getNewInspectionParams(contractGroups);
  const newInspectionHref = `/inspection/new?propertyId=${property.id}&type=${newInspectionType.type}`;

  return (
    <div className="min-h-screen bg-[#fcfcfc] max-w-lg mx-auto pb-24">
      <header className="sticky top-0 z-40 bg-white border-b border-gray-100">
        <div className="flex items-center justify-between h-14 px-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft size={24} />
          </Link>
          <span className="font-heading font-bold text-sm text-[#1A1A1A] truncate max-w-[180px]">
            {truncTitle}
          </span>
          <Link
            href={newInspectionHref}
            className="rounded-xl px-3 py-2 font-heading font-bold text-xs text-[#1A1A1A] flex items-center gap-1"
            style={{ backgroundColor: "#cafe87" }}
          >
            <Plus size={14} />
            Inspection
          </Link>
        </div>
      </header>

      <div className="px-4 py-5 space-y-6">
        {/* Property header card — property-level only */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0 bg-[#F0EDFF]">
              {propertyEmoji(property.property_type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-xl text-[#1A1A1A]">
                {title}
              </p>
              {property.property_type && (
                <p className="font-body text-sm text-[#9A88FD] capitalize mt-0.5">
                  {property.property_type}
                </p>
              )}
              {property.property_size != null && (
                <p className="font-body text-sm text-gray-500 mt-1">
                  {Number(property.property_size).toLocaleString("en-GB", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}{" "}
                  m²
                </p>
              )}
              <p className="font-body text-xs text-gray-400 mt-2">
                {totalInspections} inspection{totalInspections !== 1 ? "s" : ""} total
              </p>
            </div>
          </div>
        </div>

        {/* Tenancy History */}
        <div>
          <h2 className="font-heading font-bold text-lg text-[#1A1A1A] mb-4">
            Tenancy History
          </h2>

          {contractGroups.length === 0 ? (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              <span className="text-4xl" role="img" aria-hidden>
                🏠
              </span>
              <p className="font-heading font-semibold text-[#1A1A1A]">
                No inspections yet
              </p>
              <p className="font-body text-sm text-gray-500">
                Start with a Check-In inspection
              </p>
              <Link
                href={`/inspection/new?propertyId=${property.id}&type=check-in`}
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-heading font-bold text-white transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#9A88FD" }}
              >
                + New Inspection
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {contractGroups.map((group) => {
                const checkIn = group.inspections.find(
                  (i) =>
                    (i.type ?? "").toLowerCase().includes("check-in") ||
                    (i.type ?? "").toLowerCase() === "check_in"
                );
                const checkOut = group.inspections.find(
                  (i) =>
                    (i.type ?? "").toLowerCase().includes("check-out") ||
                    (i.type ?? "").toLowerCase() === "check_out"
                );
                const bothComplete =
                  checkIn &&
                  checkOut &&
                  (checkIn.status === "completed" || checkIn.status === "signed") &&
                  (checkOut.status === "completed" || checkOut.status === "signed");

                return (
                  <div
                    key={group.key}
                    className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden mb-4"
                  >
                    {/* Card header */}
                    <div
                      className="p-4 rounded-t-2xl"
                      style={{ backgroundColor: "#F0EDFF" }}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-heading font-bold text-base text-[#1A1A1A]">
                            {group.tenantName ?? "Unknown tenant"}
                          </p>
                          {group.ejariRef && (
                            <p className="font-body text-xs text-[#9A88FD] mt-0.5">
                              {group.ejariRef}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {group.contractFrom != null && (
                            <p className="font-body text-xs text-gray-500">
                              {formatContractPeriod(
                                group.contractFrom,
                                group.contractTo
                              )}
                            </p>
                          )}
                          {group.annualRent != null && (
                            <p className="font-body text-xs text-gray-600 font-medium mt-0.5">
                              {formatAnnualRent(group.annualRent)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Card body — check-in / check-out rows */}
                    <div className="p-4">
                      {/* CHECK-IN row */}
                      {checkIn ? (
                        <Link
                          href={
                            checkIn.status === "completed" || checkIn.status === "signed"
                              ? `/inspection/${checkIn.id}/report`
                              : `/inspection/${checkIn.id}`
                          }
                          className="flex items-center justify-between py-2 border-b border-gray-50 active:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="bg-[#F0EDFF] text-[#9A88FD] text-xs font-semibold px-3 py-1 rounded-full">
                              CHECK-IN
                            </span>
                            <div>
                              <p className="font-body text-sm font-medium text-gray-800">
                                {formatDate(checkIn.created_at)}
                              </p>
                              <p className="font-body text-xs text-gray-400">
                                {checkIn.room_count} room
                                {checkIn.room_count !== 1 ? "s" : ""} inspected
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 ${statusBadge(checkIn.status).className}`}
                            >
                              {statusBadge(checkIn.status).label}
                            </span>
                            {(checkIn.status === "completed" ||
                              checkIn.status === "signed") && (
                              <span className="font-body text-xs text-[#9A88FD] font-medium">
                                View →
                              </span>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 opacity-60">
                          <span className="bg-gray-100 text-gray-400 text-xs px-3 py-1 rounded-full font-body">
                            CHECK-IN
                          </span>
                          <span className="font-body text-xs text-gray-400 italic">
                            Not done yet
                          </span>
                        </div>
                      )}

                      {/* CHECK-OUT row */}
                      {checkOut ? (
                        <Link
                          href={
                            checkOut.status === "completed" || checkOut.status === "signed"
                              ? `/inspection/${checkOut.id}/report`
                              : `/inspection/${checkOut.id}`
                          }
                          className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 active:bg-gray-50/50 transition-colors"
                        >
                          <div className="flex items-center gap-3">
                            <span className="bg-[#FEDE80]/80 text-[#1A1A1A] text-xs font-semibold px-3 py-1 rounded-full">
                              CHECK-OUT
                            </span>
                            <div>
                              <p className="font-body text-sm font-medium text-gray-800">
                                {formatDate(checkOut.created_at)}
                              </p>
                              <p className="font-body text-xs text-gray-400">
                                {checkOut.room_count} room
                                {checkOut.room_count !== 1 ? "s" : ""} inspected
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <span
                              className={`rounded-full px-2.5 py-0.5 ${statusBadge(checkOut.status).className}`}
                            >
                              {statusBadge(checkOut.status).label}
                            </span>
                            {(checkOut.status === "completed" ||
                              checkOut.status === "signed") && (
                              <span className="font-body text-xs text-[#9A88FD] font-medium">
                                View →
                              </span>
                            )}
                          </div>
                        </Link>
                      ) : (
                        <div className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0 opacity-60">
                          <span className="bg-gray-100 text-gray-400 text-xs px-3 py-1 rounded-full font-body">
                            CHECK-OUT
                          </span>
                          <span className="font-body text-xs text-gray-400 italic">
                            Not done yet
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Card footer */}
                    {bothComplete && (
                      <div
                        className="rounded-b-2xl p-3 font-body text-xs text-green-700"
                        style={{ backgroundColor: "#F0FDF4" }}
                      >
                        ✅ Complete tenancy cycle documented
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
