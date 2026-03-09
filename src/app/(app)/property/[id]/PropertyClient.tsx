"use client";

import Link from "next/link";
import { ArrowLeft, ChevronRight, Plus } from "lucide-react";

type InspectionRow = {
  id: string;
  type: string | null;
  status: string | null;
  created_at: string | null;
  completed_at: string | null;
  landlord_name: string | null;
  tenant_name: string | null;
  ejari_ref: string | null;
  contract_from: string | null;
  contract_to: string | null;
  room_count: number;
};

interface PropertyClientProps {
  property: {
    id: string;
    building_name: string | null;
    unit_number: string | null;
    address: string | null;
    property_type: string | null;
  };
  inspections: InspectionRow[];
}

function propertyEmoji(type: string | null): string {
  if (!type) return "🏢";
  const t = type.toLowerCase();
  if (t.includes("villa")) return "🏠";
  if (t.includes("studio")) return "🛏️";
  if (t.includes("townhouse")) return "🏬";
  return "🏢";
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

function statusBadge(status: string | null) {
  switch (status) {
    case "completed":
      return { label: "Completed", className: "bg-[#F0EDFF] text-[#9A88FD]" };
    case "signed":
      return { label: "Signed ✓", className: "bg-[#cafe87] text-[#1A1A1A]" };
    default:
      return { label: "Draft", className: "bg-gray-100 text-gray-600" };
  }
}

function typeBadge(type: string | null) {
  const t = (type ?? "check-in").toLowerCase();
  if (t.includes("check-out") || t.includes("check_out")) {
    return {
      label: "CHECK‑OUT",
      className: "bg-[#FEDE80] text-[#1A1A1A]",
    };
  }
  return {
    label: "CHECK‑IN",
    className: "bg-[#F0EDFF] text-[#9A88FD]",
  };
}

function timelineDotColor(status: string | null): string {
  if (status === "signed") return "bg-[#cafe87]";
  if (status === "completed") return "bg-[#9A88FD]";
  return "bg-gray-300";
}

export function PropertyClient({ property, inspections }: PropertyClientProps) {
  const title =
    property.address ?? (property.building_name && property.unit_number
      ? `${property.building_name}, Unit ${property.unit_number}`
      : "Property");
  const truncTitle = title.length > 26 ? title.slice(0, 23) + "…" : title;
  const latest = inspections[0] ?? null;

  return (
    <div className="min-h-screen bg-[#fcfcfc] max-w-[480px] mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <ArrowLeft size={24} />
          </Link>
          <span className="font-heading font-bold text-sm text-brand-dark truncate max-w-[180px]">
            {truncTitle}
          </span>
          <Link
            href="/inspection/new"
            className="rounded-xl px-3 py-2 font-heading font-bold text-xs text-brand-dark flex items-center gap-1"
            style={{ backgroundColor: "#cafe87" }}
          >
            <Plus size={14} />
            Inspection
          </Link>
        </div>
      </header>

      <div className="px-4 py-5 space-y-5">
        {/* Property info card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-[#F0EDFF] flex items-center justify-center text-2xl flex-shrink-0">
              {propertyEmoji(property.property_type)}
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-heading font-bold text-lg text-[#1A1A1A]">
                {property.address ?? (property.building_name && property.unit_number
                  ? `${property.building_name}, Unit ${property.unit_number}`
                  : "Untitled")}
              </p>
              {property.property_type && (
                <p className="font-body text-sm text-[#9A88FD] capitalize mt-0.5">
                  {property.property_type}
                </p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-y-3 gap-x-4">
            {latest?.ejari_ref && (
              <div>
                <p className="font-body text-xs text-gray-400">Ejari Ref</p>
                <p className="font-body text-sm text-[#1A1A1A]">{latest.ejari_ref}</p>
              </div>
            )}
            {(latest?.contract_from || latest?.contract_to) && (
              <div>
                <p className="font-body text-xs text-gray-400">Contract</p>
                <p className="font-body text-sm text-[#1A1A1A]">
                  {[latest!.contract_from, latest!.contract_to].filter(Boolean).map(formatDate).join(" – ")}
                </p>
              </div>
            )}
            {latest?.landlord_name && (
              <div>
                <p className="font-body text-xs text-gray-400">Landlord</p>
                <p className="font-body text-sm text-[#1A1A1A]">{latest.landlord_name}</p>
              </div>
            )}
            {latest?.tenant_name && (
              <div>
                <p className="font-body text-xs text-gray-400">Tenant</p>
                <p className="font-body text-sm text-[#1A1A1A]">{latest.tenant_name}</p>
              </div>
            )}
          </div>
        </div>

        {/* Inspection history */}
        <div>
          <h2 className="font-heading font-bold text-lg text-brand-dark mb-4">
            Inspection History
          </h2>

          {inspections.length > 0 ? (
            <div className="relative pl-6">
              {/* Vertical line */}
              <div className="absolute left-[9px] top-2 bottom-2 w-0.5 bg-[#E5E7EB]" />

              <div className="space-y-0">
                {inspections.map((insp, idx) => {
                  const tb = typeBadge(insp.type);
                  const sb = statusBadge(insp.status);
                  const dotColor = timelineDotColor(insp.status);
                  const isLast = idx === inspections.length - 1;
                  const href =
                    insp.status === "completed" || insp.status === "signed"
                      ? `/inspection/${insp.id}/report`
                      : `/inspection/${insp.id}`;

                  return (
                    <div key={insp.id} className={`relative ${isLast ? "" : "pb-5"}`}>
                      {/* Dot */}
                      <div
                        className={`absolute -left-6 top-1 w-[18px] h-[18px] rounded-full border-[3px] border-white ${dotColor}`}
                        style={{ boxShadow: "0 0 0 1px #E5E7EB" }}
                      />

                      {/* Card */}
                      <Link
                        href={href}
                        className="block bg-white rounded-2xl shadow-sm border border-gray-100 p-4 active:bg-gray-50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap mb-1.5">
                              <span
                                className={`rounded-full px-2.5 py-0.5 font-heading font-bold text-xs ${tb.className}`}
                              >
                                {tb.label}
                              </span>
                              <span
                                className={`rounded-full px-2.5 py-0.5 font-heading font-medium text-xs ${sb.className}`}
                              >
                                {sb.label}
                              </span>
                            </div>
                            <p className="font-body text-sm text-gray-600">
                              {formatDate(insp.created_at)}
                            </p>
                            <p className="font-body text-xs text-gray-400 mt-1">
                              {insp.room_count} room{insp.room_count !== 1 ? "s" : ""} inspected
                            </p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0 mt-1">
                            {(insp.status === "completed" || insp.status === "signed") && (
                              <span className="font-body text-xs text-[#9A88FD] font-medium">
                                View Report
                              </span>
                            )}
                            <ChevronRight size={16} className="text-gray-400" />
                          </div>
                        </div>
                      </Link>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-4 min-h-[200px]">
              <span className="text-4xl" role="img" aria-hidden>
                📋
              </span>
              <p className="font-heading font-semibold text-brand-dark">
                No inspections yet for this property
              </p>
              <Link
                href="/inspection/new"
                className="inline-flex items-center justify-center rounded-xl px-6 py-3 font-heading font-bold text-white transition-transform active:scale-[0.98]"
                style={{ backgroundColor: "#9A88FD" }}
              >
                + Start First Inspection
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
