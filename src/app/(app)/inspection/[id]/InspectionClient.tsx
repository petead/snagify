"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { RoomDetailSheet } from "@/components/inspection/RoomDetailSheet";
import { createClient } from "@/lib/supabase/client";

type RoomRow = {
  id: string;
  name: string;
  order_index: number | null;
  overall_condition: string | null;
  item_count: number;
  photo_count: number;
};

interface InspectionClientProps {
  inspectionId: string;
  address: string;
  rooms: RoomRow[];
}

const GENERATION_STEPS = [
  "Analyzing rooms...",
  "Writing report...",
  "Creating PDF...",
  "Uploading report...",
] as const;

export function InspectionClient({
  inspectionId,
  address,
  rooms: initialRooms,
}: InspectionClientProps) {
  const [rooms, setRooms] = useState(initialRooms);
  const [selectedRoom, setSelectedRoom] = useState<RoomRow | null>(null);
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const genStepInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const router = useRouter();

  const completedCount = rooms.filter((r) => r.overall_condition).length;
  const totalCount = rooms.length;
  const progressPct = totalCount ? (completedCount / totalCount) * 100 : 0;
  const incompleteCount = totalCount - completedCount;

  const refreshRooms = async () => {
    const res = await fetch(`/api/inspection/${inspectionId}/rooms`);
    if (res.ok) {
      const data = await res.json();
      setRooms(data.rooms ?? rooms);
    }
    router.refresh();
  };

  useEffect(() => {
    return () => {
      if (genStepInterval.current) clearInterval(genStepInterval.current);
    };
  }, []);

  const handleFinish = () => {
    setShowConfirm(true);
  };

  const generateReport = async () => {
    setShowConfirm(false);
    setGenerating(true);
    setGenStep(0);
    setGenError(null);

    genStepInterval.current = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 4000);

    try {
      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error || "Report generation failed");
      }

      const { report, inspectionData } = await res.json();

      setGenStep(2);

      const { generateInspectionPDF } = await import("@/lib/generatePDF");
      const pdfBlob = await generateInspectionPDF(report, inspectionData);

      setGenStep(3);

      const supabase = createClient();
      const pdfPath = `reports/${inspectionId}/${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from("inspection-reports")
        .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: false });

      let reportUrl = "";
      if (uploadErr) {
        console.error("[Report] PDF upload error:", uploadErr);
        const localUrl = URL.createObjectURL(pdfBlob);
        reportUrl = localUrl;
      } else {
        const { data: signedData } = await supabase.storage
          .from("inspection-reports")
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 365);
        reportUrl = signedData?.signedUrl ?? "";
      }

      const hashData = JSON.stringify({ report, inspectionData });
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashData));
      const documentHash = Array.from(new Uint8Array(hashBuffer))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      await supabase
        .from("inspections")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          report_url: reportUrl,
          document_hash: documentHash,
        })
        .eq("id", inspectionId);

      if (genStepInterval.current) {
        clearInterval(genStepInterval.current);
        genStepInterval.current = null;
      }

      router.push(`/inspection/${inspectionId}/report`);
    } catch (err) {
      if (genStepInterval.current) {
        clearInterval(genStepInterval.current);
        genStepInterval.current = null;
      }
      setGenError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  const truncatedAddress =
    address.length > 28 ? `${address.slice(0, 25)}…` : address;

  if (generating) {
    return (
      <div className="min-h-screen bg-[#9A88FD] flex flex-col items-center justify-center max-w-[480px] mx-auto px-6">
        <h1 className="font-heading font-bold text-3xl text-white mb-2">Snagify</h1>
        <p className="text-white/80 font-body text-sm mb-10">Property Inspection Report</p>

        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-8">
          <Loader2 size={40} className="text-white animate-spin" />
        </div>

        <p className="text-white font-heading font-bold text-lg mb-6">
          Generating your report...
        </p>

        <div className="w-full space-y-3">
          {GENERATION_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                  i < genStep
                    ? "bg-[#cafe87]"
                    : i === genStep
                      ? "bg-white"
                      : "bg-white/20"
                }`}
              >
                {i < genStep ? (
                  <Check size={14} className="text-brand-dark" />
                ) : i === genStep ? (
                  <Loader2 size={14} className="text-[#9A88FD] animate-spin" />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white/40" />
                )}
              </div>
              <span
                className={`font-body text-sm ${
                  i <= genStep ? "text-white" : "text-white/40"
                }`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#fcfcfc] max-w-[480px] mx-auto">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white shadow-sm">
        <div className="flex items-center justify-between h-14 px-4">
          <Link
            href="/dashboard"
            className="p-2 -ml-2 rounded-lg text-gray-600 hover:bg-gray-100"
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7" />
            </svg>
          </Link>
          <span className="font-heading font-bold text-sm text-brand-dark truncate max-w-[180px]">
            {truncatedAddress}
          </span>
          <button
            type="button"
            onClick={handleFinish}
            className="rounded-xl px-4 py-2 font-heading font-bold text-sm text-brand-dark"
            style={{ backgroundColor: "#cafe87" }}
          >
            Finish
          </button>
        </div>
      </header>

      {/* Progress bar */}
      <div className="px-4 pt-3 pb-1">
        <div className="h-1.5 w-full rounded-full bg-[#E5E7EB] overflow-hidden">
          <div
            className="h-full rounded-full bg-[#9A88FD] transition-all duration-300"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <p className="font-body text-xs text-gray-500 text-right mt-1">
          {completedCount} of {totalCount} rooms done
        </p>
      </div>

      {/* Rooms list */}
      <div className="px-4 py-4 space-y-3">
        {rooms.map((room) => {
          const isCompleted = !!room.overall_condition;
          return (
            <div
              key={room.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {isCompleted && (
                    <div className="w-8 h-8 rounded-full bg-[#cafe87] flex items-center justify-center flex-shrink-0">
                      <Check size={18} className="text-brand-dark" />
                    </div>
                  )}
                  <div>
                    <p className="font-heading font-bold text-base text-brand-dark">
                      {room.name}
                    </p>
                    <p
                      className={`font-body text-xs ${
                        isCompleted ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {room.item_count} items ·{" "}
                      {isCompleted ? "Completed" : "Not started"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedRoom(room)}
                  className={`rounded-xl px-4 py-2 font-heading font-semibold text-sm ${
                    isCompleted
                      ? "border-2 border-[#9A88FD] text-[#9A88FD] bg-transparent"
                      : "bg-[#9A88FD] text-white"
                  }`}
                >
                  {isCompleted ? "Edit" : "Start →"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {selectedRoom && (
        <RoomDetailSheet
          room={selectedRoom}
          inspectionId={inspectionId}
          onClose={() => setSelectedRoom(null)}
          onSaved={refreshRooms}
        />
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl mx-6 p-6 max-w-sm w-full">
            <h3 className="font-heading font-bold text-lg text-brand-dark mb-2">
              Finish Inspection?
            </h3>
            {incompleteCount > 0 ? (
              <p className="font-body text-sm text-gray-600 mb-5">
                <span className="font-semibold text-amber-600">{incompleteCount} room{incompleteCount > 1 ? "s" : ""}</span>{" "}
                not completed yet. The report will be generated with available data. Continue?
              </p>
            ) : (
              <p className="font-body text-sm text-gray-600 mb-5">
                All rooms are completed. Ready to generate the inspection report.
              </p>
            )}
            {genError && (
              <p className="font-body text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-4">
                {genError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 rounded-xl border-2 border-gray-200 font-heading font-semibold text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generateReport}
                className="flex-1 h-11 rounded-xl bg-[#9A88FD] text-white font-heading font-bold text-sm"
              >
                Generate Report
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
