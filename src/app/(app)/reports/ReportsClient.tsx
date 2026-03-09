"use client";

import { useState } from "react";
import Link from "next/link";

type ReportRow = {
  id: string;
  type: string | null;
  status: string | null;
  completed_at: string | null;
  created_at: string | null;
  building_name: string | null;
  unit_number: string | null;
  tenant_name: string | null;
  ejari_ref: string | null;
  isSigned: boolean;
};

const TABS = [
  { id: "all", label: "All" },
  { id: "pending", label: "Pending Signature" },
  { id: "signed", label: "Signed" },
] as const;

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  try {
    return new Date(dateStr).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return dateStr;
  }
}

export function ReportsClient({ reports }: { reports: ReportRow[] }) {
  const [tab, setTab] = useState<"all" | "pending" | "signed">("all");

  const filtered =
    tab === "all"
      ? reports
      : tab === "pending"
        ? reports.filter((r) => !r.isSigned)
        : reports.filter((r) => r.isSigned);

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="font-heading font-bold text-xl mb-4" style={{ color: "#111827" }}>
        Reports
      </h1>

      <div className="flex gap-2 mb-6">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className="px-4 py-2 rounded-xl text-sm font-heading font-medium transition-colors"
            style={{
              backgroundColor: tab === t.id ? "#9A88FD" : "#f3f4f6",
              color: tab === t.id ? "white" : "#4b5563",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered.length > 0 ? (
        <div className="space-y-3">
          {filtered.map((r) => (
            <Link
              key={r.id}
              href={`/inspection/${r.id}/report`}
              className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 block"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-heading font-semibold text-sm truncate" style={{ color: "#111827" }}>
                    {r.building_name && r.unit_number
                      ? `${r.building_name}, Unit ${r.unit_number}`
                      : r.building_name ?? r.unit_number ?? "Property"}
                  </p>
                  <p className="font-body text-xs text-gray-500 truncate mt-0.5">
                    {r.tenant_name ?? "—"}
                  </p>
                </div>
                <span className="text-xs font-semibold text-[#9A88FD] flex-shrink-0">
                  View →
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <span
                  className="rounded-full text-xs px-2.5 py-1 font-heading font-medium"
                  style={{
                    backgroundColor: "#F0EDFF",
                    color: "#9A88FD",
                  }}
                >
                  {(r.type ?? "check-in").toUpperCase().replace("-", "‑")}
                </span>
                <span className="font-body text-xs text-gray-400">
                  {formatDate(r.completed_at ?? r.created_at)}
                </span>
                <span
                  className="rounded-full text-xs px-2.5 py-1 font-heading font-medium"
                  style={{
                    backgroundColor: r.isSigned ? "#cafe87" : "#FEDE80",
                    color: r.isSigned ? "#111827" : "#92400e",
                  }}
                >
                  {r.isSigned ? "Signed ✓" : "Completed"}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white shadow-sm p-8 flex flex-col items-center justify-center gap-3 min-h-[200px]">
          <span className="text-4xl" role="img" aria-hidden>
            📄
          </span>
          <p className="font-heading font-semibold mt-0 mb-0" style={{ color: "#111827" }}>
            {tab === "all" ? "No reports yet" : `No ${tab === "pending" ? "pending" : "signed"} reports`}
          </p>
          <p className="font-body text-sm text-center text-gray-500">
            {tab === "all"
              ? "Complete an inspection to generate a report."
              : tab === "pending"
                ? "No reports waiting for signature."
                : "No signed reports yet."}
          </p>
        </div>
      )}
    </div>
  );
}
