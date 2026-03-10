"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Check,
  Loader2,
  Camera,
  AlertTriangle,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────
type RoomData = {
  id: string;
  name: string;
  order_index: number | null;
  existingPhotos: { id: string; url: string; ai_analysis: string | null }[];
};

type PhotoItem = {
  id: string;
  src: string;
  flagged: boolean;
  tags: string[];
  uploading: boolean;
  aiAnalysis?: string;
};

interface Props {
  inspectionId: string;
  inspectionType: string;
  buildingName: string;
  unitNumber: string;
  rooms: RoomData[];
}

// ─── Constants ───────────────────────────────────
const DAMAGE_TAGS = [
  "scratch",
  "stain",
  "crack",
  "damp",
  "missing",
  "broken",
  "hole",
  "leak",
];

const GENERATION_STEPS = [
  "Analyzing rooms...",
  "Writing report...",
  "Creating PDF...",
  "Uploading report...",
] as const;

// ─── PhotoCard ───────────────────────────────────
function PhotoCard({
  photo,
  onToggleFlag,
  onTagAdd,
}: {
  photo: PhotoItem;
  onToggleFlag: () => void;
  onTagAdd: (tag: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <div
        onClick={() => setExpanded(!expanded)}
        className="relative rounded-xl overflow-hidden cursor-pointer"
        style={{
          border: photo.flagged
            ? "2px solid #FF6E40"
            : "2px solid rgba(202,254,135,0.25)",
          boxShadow: photo.flagged
            ? "0 0 12px rgba(255,110,64,0.25)"
            : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.src}
          alt=""
          className="w-full aspect-square object-cover"
        />

        <div className="absolute top-1.5 right-1.5">
          {photo.flagged ? (
            <span className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
              <AlertTriangle size={10} className="text-white" />
            </span>
          ) : photo.uploading ? (
            <span className="w-5 h-5 rounded-full bg-white/20 flex items-center justify-center">
              <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            </span>
          ) : (
            <span
              className="w-5 h-5 rounded-full flex items-center justify-center"
              style={{ background: "#cafe87" }}
            >
              <Check size={10} color="#1a1a2e" />
            </span>
          )}
        </div>

        {photo.tags.length > 0 && !expanded && (
          <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
            {photo.tags.map((t) => (
              <span
                key={t}
                className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white"
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {photo.aiAnalysis && !expanded && photo.tags.length === 0 && (
          <div className="absolute bottom-1 left-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
            <p className="text-[8px] text-white/80 line-clamp-1">
              {photo.aiAnalysis}
            </p>
          </div>
        )}
      </div>

      {expanded && (
        <div
          className="mt-1.5 p-2 rounded-xl"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          {photo.aiAnalysis && (
            <p className="text-[10px] text-white/60 mb-2 line-clamp-3">
              {photo.aiAnalysis}
            </p>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFlag();
            }}
            className="w-full py-2 rounded-lg text-xs font-semibold mb-2"
            style={{
              background: photo.flagged
                ? "rgba(255,110,64,0.2)"
                : "rgba(255,255,255,0.08)",
              color: photo.flagged ? "#FF6E40" : "rgba(255,255,255,0.5)",
            }}
          >
            {photo.flagged ? "⚠ Flagged — tap to unflag" : "Flag as damaged"}
          </button>
          {photo.flagged && (
            <div className="flex flex-wrap gap-1">
              {DAMAGE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onTagAdd(tag);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                  style={{
                    background: photo.tags.includes(tag)
                      ? "#FEDE80"
                      : "rgba(255,255,255,0.08)",
                    color: photo.tags.includes(tag)
                      ? "#1a1a2e"
                      : "rgba(255,255,255,0.5)",
                  }}
                >
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Main Component ──────────────────────────────
export function InspectionClient({
  inspectionId,
  inspectionType,
  buildingName,
  unitNumber,
  rooms,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [activeRoom, setActiveRoom] = useState(0);
  const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>({});
  const [screen, setScreen] = useState<"inspect" | "review">("inspect");
  const [toast, setToast] = useState<string | null>(null);

  // Report generation
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const genInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Lock scroll on this page
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = "";
    };
  }, []);

  // Load existing photos for all rooms on mount
  useEffect(() => {
    const loadExisting = async () => {
      const initial: Record<number, PhotoItem[]> = {};
      for (let i = 0; i < rooms.length; i++) {
        const room = rooms[i];
        if (room.existingPhotos.length > 0) {
          const loaded: PhotoItem[] = await Promise.all(
            room.existingPhotos.map(async (p) => {
              const path = p.url.includes("/inspection-photos/")
                ? p.url.split("/inspection-photos/").pop()
                : null;
              let src = p.url;
              if (path) {
                const { data: signed } = await supabase.storage
                  .from("inspection-photos")
                  .createSignedUrl(path, 60 * 60 * 24 * 7);
                if (signed?.signedUrl) src = signed.signedUrl;
              }
              return {
                id: p.id,
                src,
                flagged: false,
                tags: [],
                uploading: false,
                aiAnalysis: p.ai_analysis ?? undefined,
              };
            })
          );
          initial[i] = loaded;
        }
      }
      setPhotos(initial);
    };
    loadExisting();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // Cleanup generation interval
  useEffect(() => {
    return () => {
      if (genInterval.current) clearInterval(genInterval.current);
    };
  }, []);

  const roomCurrentPhotos = photos[activeRoom] || [];
  const totalPhotos = Object.values(photos).flat().length;
  const totalFlags = Object.values(photos)
    .flat()
    .filter((p) => p.flagged).length;
  const roomsWithPhotos = Object.keys(photos).filter(
    (k) => (photos[Number(k)] || []).length > 0
  ).length;
  const progressPct =
    rooms.length > 0 ? (roomsWithPhotos / rooms.length) * 100 : 0;

  // ── Photo capture + upload + AI analysis
  const handlePhotoCapture = async (files: FileList | null) => {
    if (!files) return;
    const room = rooms[activeRoom];

    for (const file of Array.from(files)) {
      const tempId = Math.random().toString(36).slice(2);

      const base64: string = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(file);
      });

      setPhotos((prev) => ({
        ...prev,
        [activeRoom]: [
          ...(prev[activeRoom] || []),
          { id: tempId, src: base64, flagged: false, tags: [], uploading: true },
        ],
      }));

      // Upload to Supabase Storage
      const fileName = `inspections/${inspectionId}/${room.id}/${tempId}.jpg`;
      let storedPath: string | null = null;
      let publicUrl = "";

      try {
        const { data, error } = await supabase.storage
          .from("inspection-photos")
          .upload(fileName, file, { contentType: file.type, upsert: false });
        if (!error && data) {
          storedPath = data.path;
          publicUrl = supabase.storage
            .from("inspection-photos")
            .getPublicUrl(fileName).data.publicUrl;
        }
      } catch {
        // continue with base64
      }

      // Save photo record to DB
      let photoRecordId: string | null = null;
      if (storedPath) {
        const { data: photoRecord } = await supabase
          .from("photos")
          .insert({
            room_id: room.id,
            url: publicUrl,
            taken_at: new Date().toISOString(),
          })
          .select("id")
          .single();
        if (photoRecord) photoRecordId = photoRecord.id;
      }

      // AI analysis (send base64 as the existing API expects)
      const rawBase64 = base64.split(",")[1] ?? "";
      let aiText = "";
      try {
        const aiRes = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: rawBase64, mimeType: file.type }),
        });
        if (aiRes.ok) {
          const a = await aiRes.json();
          aiText = a.description ?? "";

          // Update DB record with AI analysis
          if (photoRecordId) {
            await supabase
              .from("photos")
              .update({ ai_analysis: aiText })
              .eq("id", photoRecordId);
          }
        }
      } catch {
        // continue
      }

      // Get a signed URL for display
      let displayUrl = base64;
      if (storedPath) {
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(storedPath, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) displayUrl = signed.signedUrl;
      }

      // Update local state
      setPhotos((prev) => ({
        ...prev,
        [activeRoom]: (prev[activeRoom] || []).map((p) =>
          p.id === tempId
            ? { ...p, src: displayUrl, uploading: false, aiAnalysis: aiText || undefined }
            : p
        ),
      }));
    }
  };

  // ── Toggle flag on a photo
  const toggleFlag = (photoId: string) => {
    setPhotos((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).map((p) =>
        p.id === photoId ? { ...p, flagged: !p.flagged, tags: !p.flagged ? p.tags : [] } : p
      ),
    }));
  };

  // ── Add/remove tag on a photo
  const addTag = (photoId: string, tag: string) => {
    setPhotos((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).map((p) =>
        p.id === photoId
          ? {
              ...p,
              tags: p.tags.includes(tag)
                ? p.tags.filter((t) => t !== tag)
                : [...p.tags, tag],
            }
          : p
      ),
    }));
  };

  // ── Finish inspection + generate report
  const handleFinishInspection = async () => {
    setScreen("inspect");
    setGenerating(true);
    setGenStep(0);
    setGenError(null);

    genInterval.current = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 4000);

    try {
      // Save flags and tags as room_items for flagged photos
      for (const [roomIdx, roomPhotos] of Object.entries(photos)) {
        const room = rooms[Number(roomIdx)];
        const flagged = roomPhotos.filter((p) => p.flagged);
        if (flagged.length > 0) {
          await supabase
            .from("rooms")
            .update({ overall_condition: "poor" })
            .eq("id", room.id);
          for (const photo of flagged) {
            if (photo.tags.length > 0) {
              await supabase.from("room_items").insert(
                photo.tags.map((tag) => ({
                  room_id: room.id,
                  name: tag,
                  condition: "poor",
                  notes: photo.aiAnalysis || null,
                }))
              );
            }
          }
        } else if (roomPhotos.length > 0) {
          await supabase
            .from("rooms")
            .update({ overall_condition: "good" })
            .eq("id", room.id);
        }
      }

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown" }));
        throw new Error(err.error || "Report generation failed");
      }

      const { report, inspectionData } = await res.json();
      setGenStep(2);

      const { generateInspectionPDF } = await import("@/lib/generatePDF");
      const pdfBlob = await generateInspectionPDF(report, inspectionData);
      setGenStep(3);

      const pdfPath = `reports/${inspectionId}/${Date.now()}.pdf`;
      const { error: uploadErr } = await supabase.storage
        .from("inspection-reports")
        .upload(pdfPath, pdfBlob, {
          contentType: "application/pdf",
          upsert: false,
        });

      let reportUrl = "";
      if (uploadErr) {
        reportUrl = URL.createObjectURL(pdfBlob);
      } else {
        const { data: signedData } = await supabase.storage
          .from("inspection-reports")
          .createSignedUrl(pdfPath, 60 * 60 * 24 * 365);
        reportUrl = signedData?.signedUrl ?? "";
      }

      const hashData = JSON.stringify({ report, inspectionData });
      const hashBuffer = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(hashData)
      );
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

      if (genInterval.current) clearInterval(genInterval.current);
      router.push(`/inspection/${inspectionId}/report`);
    } catch (err) {
      if (genInterval.current) clearInterval(genInterval.current);
      setGenError(err instanceof Error ? err.message : "Something went wrong");
      setGenerating(false);
    }
  };

  // ═══ GENERATING SCREEN ═══
  if (generating) {
    return (
      <div
        className="fixed inset-0 z-50 flex flex-col items-center justify-center px-6"
        style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
      >
        <h1
          className="font-bold text-3xl text-white mb-2"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          Snagify
        </h1>
        <p className="text-white/80 text-sm mb-10">
          Property Inspection Report
        </p>
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-8">
          <Loader2 size={40} className="text-white animate-spin" />
        </div>
        <p
          className="text-white font-bold text-lg mb-6"
          style={{ fontFamily: "Poppins,sans-serif" }}
        >
          Generating your report...
        </p>
        <div className="w-full max-w-xs space-y-3">
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
                  <Check size={14} className="text-gray-900" />
                ) : i === genStep ? (
                  <Loader2
                    size={14}
                    className="text-[#9A88FD] animate-spin"
                  />
                ) : (
                  <span className="w-2 h-2 rounded-full bg-white/40" />
                )}
              </div>
              <span
                className={`text-sm ${i <= genStep ? "text-white" : "text-white/40"}`}
              >
                {step}
              </span>
            </div>
          ))}
        </div>
        {genError && (
          <div className="mt-6 bg-white/20 rounded-xl p-4 max-w-xs w-full">
            <p className="text-white text-sm text-center">{genError}</p>
            <button
              type="button"
              onClick={() => {
                setGenerating(false);
                setScreen("review");
              }}
              className="mt-3 w-full py-2 rounded-lg bg-white/20 text-white text-sm font-semibold"
            >
              Back to Review
            </button>
          </div>
        )}
      </div>
    );
  }

  // ═══ REVIEW SCREEN ═══
  if (screen === "review") {
    return (
      <div className="fixed inset-0 z-50 overflow-y-auto" style={{ background: "#fafafa" }}>
        <div className="px-6 pt-6 pb-4">
          <button
            type="button"
            onClick={() => setScreen("inspect")}
            className="text-sm mb-4 flex items-center gap-1"
            style={{ color: "#8888a0" }}
          >
            <ChevronLeft size={18} /> Back to capture
          </button>
          <h2
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: "Poppins,sans-serif", color: "#1a1a2e" }}
          >
            {inspectionType === "check-in"
              ? "Check-in Review"
              : "Check-out Review"}
          </h2>
          <p className="text-sm mb-4" style={{ color: "#8888a0" }}>
            {buildingName}, Unit {unitNumber}
          </p>

          {/* Stats row */}
          <div className="flex gap-3">
            {[
              { label: "Rooms", value: rooms.length, color: "#9A88FD" },
              { label: "Photos", value: totalPhotos, color: "#cafe87" },
              { label: "Flags", value: totalFlags, color: "#FF6E40" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="flex-1 p-3 rounded-xl text-center"
                style={{ background: `${stat.color}18` }}
              >
                <p className="text-xl font-bold" style={{ color: stat.color }}>
                  {stat.value}
                </p>
                <p className="text-[10px] font-medium text-gray-400">
                  {stat.label}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Room cards */}
        <div className="px-4 pb-32">
          {rooms.map((room, i) => {
            const rp = photos[i] || [];
            const flags = rp.filter((p) => p.flagged);
            return (
              <div
                key={room.id}
                className="mb-4 rounded-2xl p-4"
                style={{
                  background: "white",
                  border: `1px solid ${flags.length > 0 ? "rgba(255,110,64,0.3)" : "#eee"}`,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full"
                      style={{
                        background:
                          rp.length > 0
                            ? flags.length > 0
                              ? "#FF6E40"
                              : "#cafe87"
                            : "#ddd",
                      }}
                    />
                    <span className="text-sm font-semibold text-gray-900">
                      {room.name}
                    </span>
                  </div>
                  <span className="text-xs text-gray-400">
                    {rp.length} photo{rp.length !== 1 ? "s" : ""}
                    {flags.length > 0
                      ? ` · ${flags.length} flag${flags.length !== 1 ? "s" : ""}`
                      : ""}
                  </span>
                </div>

                {rp.length > 0 ? (
                  <div
                    className="flex gap-2 overflow-x-auto pb-1"
                    style={{ scrollbarWidth: "none" }}
                  >
                    {rp.map((photo) => (
                      <div
                        key={photo.id}
                        className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden"
                        style={{
                          border: photo.flagged
                            ? "2px solid #FF6E40"
                            : "1px solid #eee",
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={photo.src}
                          alt=""
                          className="w-full h-full object-cover"
                        />
                        {photo.tags.length > 0 && (
                          <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                            <span className="text-[7px] text-white">
                              {photo.tags.join(", ")}
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-300 py-1">No photos yet</p>
                )}
              </div>
            );
          })}
        </div>

        {/* Bottom CTA */}
        <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-4">
          <button
            type="button"
            onClick={handleFinishInspection}
            className="w-full h-13 rounded-xl font-bold text-white text-base"
            style={{ background: "linear-gradient(135deg, #9A88FD, #7B65FC)" }}
          >
            ✅ Finish &amp; Generate Report →
          </button>
        </div>
      </div>
    );
  }

  // ═══ INSPECT SCREEN (dark camera-first) ═══
  const accentColor = inspectionType === "check-in" ? "#9A88FD" : "#FF8A65";

  return (
    <div className="fixed inset-0 flex flex-col" style={{ background: "#0e0e14" }}>
      {/* TOP BAR */}
      <div style={{ background: "#0e0e14", padding: "16px 16px 8px" }}>
        <div className="flex items-center justify-between mb-3">
          <button type="button" onClick={() => router.back()} className="text-white/60">
            <ChevronLeft size={22} />
          </button>
          <div className="text-center">
            <p className="text-white font-semibold text-sm">
              {buildingName}, Unit {unitNumber}
            </p>
            <p className="text-xs font-semibold" style={{ color: accentColor }}>
              {inspectionType === "check-in" ? "Check-in" : "Check-out"}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setScreen("review")}
            className="text-xs font-semibold px-3 py-1.5 rounded-lg"
            style={{
              background:
                totalPhotos > 0 ? "#9A88FD" : "rgba(255,255,255,0.1)",
              color: "white",
            }}
          >
            Review
          </button>
        </div>

        {/* Room pills */}
        <div
          className="flex gap-2 overflow-x-auto pb-2"
          style={{ scrollbarWidth: "none" }}
        >
          {rooms.map((room, i) => {
            const rp = photos[i] || [];
            const hasFlagged = rp.some((p) => p.flagged);
            const isActive = i === activeRoom;
            return (
              <button
                key={room.id}
                type="button"
                onClick={() => setActiveRoom(i)}
                className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all relative"
                style={{
                  background: isActive
                    ? accentColor
                    : rp.length > 0
                      ? "rgba(202,254,135,0.15)"
                      : "rgba(255,255,255,0.08)",
                  color: isActive
                    ? "white"
                    : rp.length > 0
                      ? "#cafe87"
                      : "rgba(255,255,255,0.5)",
                }}
              >
                {room.name}
                {rp.length > 0 && (
                  <span className="ml-1 opacity-60">({rp.length})</span>
                )}
                {hasFlagged && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Progress bar */}
        <div
          className="h-1 rounded-full overflow-hidden mt-1"
          style={{ background: "rgba(255,255,255,0.06)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${progressPct}%`,
              background: "linear-gradient(90deg, #9A88FD, #cafe87)",
            }}
          />
        </div>
      </div>

      {/* CAMERA ZONE */}
      <div
        className="relative mx-4 mt-3 rounded-2xl overflow-hidden flex-shrink-0"
        style={{ height: 220, background: "#1a1a2e" }}
      >
        <div
          className="absolute inset-6 rounded-xl"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}
        />
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <label
            className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
            style={{
              background: "rgba(255,255,255,0.08)",
              border: `3px solid ${accentColor}`,
            }}
          >
            <div
              className="w-10 h-10 rounded-full"
              style={{ background: accentColor }}
            />
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              multiple
              onChange={(e) => handlePhotoCapture(e.target.files)}
            />
          </label>
          <p className="text-[10px] text-white/30 mt-3">Tap to capture</p>
        </div>
      </div>

      {/* PHOTO DOCK */}
      <div
        className="flex-1 px-4 pt-4 pb-6 overflow-y-auto"
        style={{ background: "#0e0e14" }}
      >
        {roomCurrentPhotos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 opacity-30">
            <Camera size={40} className="text-white mb-3" />
            <p className="text-white text-xs">Tap the shutter to capture</p>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {roomCurrentPhotos.map((photo) => (
              <PhotoCard
                key={photo.id}
                photo={photo}
                onToggleFlag={() => toggleFlag(photo.id)}
                onTagAdd={(tag) => addTag(photo.id, tag)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div
          className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl shadow-lg font-semibold text-sm"
          style={{
            background: "#cafe87",
            color: "#1a1a2e",
            fontFamily: "Poppins,sans-serif",
          }}
        >
          {toast}
        </div>
      )}
    </div>
  );
}
