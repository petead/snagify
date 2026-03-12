"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { User, CalendarDays, FileText } from "lucide-react";
import DeleteInspectionButton from "@/components/inspection/DeleteInspectionButton";

type ReportRow = {
  id: string;
  type: string | null;
  status: string | null;
  signed_at?: string | null;
  created_at: string;
  property?: unknown;
  properties?: unknown;
  tenancy?: unknown;
  tenancies?: unknown;
  signatures?: { signer_type: string; otp_verified: boolean; signed_at?: string | null }[];
};

function first<T>(x: T | T[] | null | undefined): T | null {
  if (x == null) return null;
  return Array.isArray(x) ? (x[0] ?? null) : x;
}

export default function ReportsPage() {
  const router = useRouter();
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [signedIds, setSignedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "signed">("all");
  const reportsRollbackRef = useRef<ReportRow[]>([]);

  const refetch = useCallback(async () => {
    const supabase = createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.replace("/login");
      return;
    }

    const { data: reportsData } = await supabase
      .from("inspections")
      .select(
        `
        id, type, status, signed_at, created_at,
        properties (building_name, unit_number, property_type),
        tenancies (tenant_name, ejari_ref, contract_from, contract_to),
        signatures (signer_type, otp_verified, signed_at)
      `
      )
      .eq("agent_id", user.id)
      .in("status", ["completed", "signed", "in_progress"])
      .order("created_at", { ascending: false });

    const list = (reportsData ?? []) as ReportRow[];
    setReports(list);

    const ids = list.map((r) => r.id);
    if (ids.length > 0) {
      const { data: sigs } = await supabase
        .from("signatures")
        .select("inspection_id")
        .in("inspection_id", ids)
        .not("signed_at", "is", null);
      const set = new Set<string>();
      (sigs ?? []).forEach((s: { inspection_id: string }) => set.add(s.inspection_id));
      setSignedIds(set);
    } else {
      setSignedIds(new Set());
    }
    setLoading(false);
  }, [router]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const filtered =
    reports?.filter((r) => {
      const isSigned = r.status === "signed" || signedIds.has(r.id);
      if (filter === "pending") return r.status === "completed" && !isSigned;
      if (filter === "signed") return isSigned;
      return true;
    }) ?? [];

  type PropShape = { building_name?: string | null; unit_number?: string | null };
  type TenShape = { tenant_name?: string | null };
  const prop = (r: ReportRow): PropShape | null =>
    first(r.properties ?? r.property) as PropShape | null;
  const ten = (r: ReportRow): TenShape | null =>
    first(r.tenancies ?? r.tenancy) as TenShape | null;

  return (
    <main className="min-h-screen bg-[#fcfcfc] pb-24 max-w-lg mx-auto">
      <header className="bg-white border-b border-gray-100 px-4 h-14 flex items-center sticky top-0 z-50">
        <h1 className="text-lg font-bold text-gray-900" style={{ fontFamily: "Poppins, sans-serif" }}>
          Reports
        </h1>
        <span className="ml-2 bg-[#F0EDFF] text-[#9A88FD] text-xs font-semibold px-2 py-1 rounded-full">
          {reports?.length ?? 0}
        </span>
      </header>

      <div className="flex gap-2 px-4 py-3 bg-white border-b border-gray-100">
        {(["all", "pending", "signed"] as const).map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
              filter === f ? "bg-[#9A88FD] text-white" : "bg-gray-100 text-gray-500"
            }`}
          >
            {f === "all" ? "All" : f === "pending" ? "Pending" : "Signed"}
          </button>
        ))}
      </div>

      <div className="px-4 pt-3">
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-2 border-[#9A88FD] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : filtered.length > 0 ? (
          filtered.map((report) => {
            const isSigned = report.status === "signed" || signedIds.has(report.id);
            const p = prop(report);
            const t = ten(report);
            const buildingName = p?.building_name ?? "";
            const unitNumber = p?.unit_number ?? "";
            const tenantName = t?.tenant_name ?? "";

            return (
              <div key={report.id} style={{ position: "relative" }}>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => router.push(`/inspection/${report.id}/report`)}
                  onKeyDown={(e) => e.key === "Enter" && router.push(`/inspection/${report.id}/report`)}
                  className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-3 cursor-pointer active:scale-[0.98] transition-transform pr-12"
                  style={{
                    borderLeft: `4px solid ${
                      report.status === "signed" || isSigned
                        ? "#cafe87"
                        : report.type === "check-in"
                          ? "#9A88FD"
                          : "#FEDE80"
                    }`,
                  }}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold text-sm text-gray-900 truncate"
                        style={{ fontFamily: "Poppins, sans-serif" }}
                      >
                        {buildingName && unitNumber
                          ? `${buildingName}, Unit ${unitNumber}`
                          : buildingName || unitNumber || "Property"}
                      </p>
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        <User size={12} className="inline mr-1" /> {tenantName ? tenantName.split(" ").slice(0, 2).join(" ") : "Unknown"}
                      </p>
                    </div>
                    <div className="flex flex-col items-end gap-1 flex-shrink-0 ml-2">
                      <span
                        className={`text-xs font-semibold px-2 py-1 rounded-full ${
                          report.type === "check-in"
                            ? "bg-[#F0EDFF] text-[#9A88FD]"
                            : "bg-[#FEDE80] text-gray-700"
                        }`}
                      >
                        {report.type === "check-in" ? "CHECK-IN" : "CHECK-OUT"}
                      </span>
                      <span
                        className={`text-xs font-medium px-2 py-1 rounded-full ${
                          report.status === "signed" || isSigned
                            ? "bg-[#cafe87] text-gray-800"
                            : report.status === "completed"
                              ? "bg-[#F0EDFF] text-[#9A88FD]"
                              : "bg-gray-100 text-gray-500"
                        }`}
                      >
                        {report.status === "signed" || isSigned
                          ? "Signed"
                          : report.status === "completed"
                            ? "Completed"
                            : "Draft"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-50">
                    <span className="text-xs text-gray-400">
                      <CalendarDays size={12} className="inline mr-1" />{" "}
                      {new Date(report.created_at).toLocaleDateString("en-GB", {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })}
                    </span>
                    {report.status === "completed" && !isSigned && (
                      <span className="text-xs font-semibold text-[#9A88FD]">
                        Send for signature →
                      </span>
                    )}
                    {(report.status === "signed" || isSigned) && (
                      <span className="text-xs font-semibold text-green-600">View report →</span>
                    )}
                  </div>
                </div>
                <div style={{ position: "absolute", top: 10, right: 10, zIndex: 10 }}>
                  <DeleteInspectionButton
                    inspectionId={report.id}
                    inspectionType={(report.type ?? "check-in") as "check-in" | "check-out"}
                    status={report.status}
                    signatures={report.signatures ?? []}
                    redirectTo="/reports"
                    variant="icon"
                    onOptimisticRemove={() => {
                      reportsRollbackRef.current = [...reports];
                      setReports((prev) => prev.filter((r) => r.id !== report.id));
                    }}
                    onRollback={() => setReports(reportsRollbackRef.current)}
                    onSuccess={refetch}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <div className="flex flex-col items-center justify-center py-20 px-8 text-center">
            <span className="text-5xl mb-4 inline-flex"><FileText size={36} color="#9ca3af" /></span>
            <p
              className="font-bold text-gray-800 mb-1"
              style={{ fontFamily: "Poppins, sans-serif" }}
            >
              No reports yet
            </p>
            <p className="text-sm text-gray-400">
              Complete an inspection to generate your first report
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
