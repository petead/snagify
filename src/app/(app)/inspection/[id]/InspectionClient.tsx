"use client";

import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, X, Check, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ────────────────────────────────────
type RoomRow = {
  id: string;
  name: string;
  order_index: number | null;
  overall_condition: string | null;
  item_count: number;
};

interface Props {
  inspectionId: string;
  inspectionType: string;
  buildingName: string;
  unitNumber: string;
  rooms: RoomRow[];
}

// ─── Speech Recognition types ─────────────────
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string };
}
interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}
interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

function getSpeechAPI(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

// ─── Helpers ──────────────────────────────────
const getRoomEmoji = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("living")) return "🛋️";
  if (n.includes("master") || n.includes("bedroom")) return "🛏️";
  if (n.includes("bath") || n.includes("toilet")) return "🚿";
  if (n.includes("kitchen")) return "🍳";
  if (n.includes("garden")) return "🌿";
  if (n.includes("garage")) return "🚗";
  if (n.includes("balcony") || n.includes("terrace")) return "🌅";
  if (n.includes("laundry")) return "🧺";
  if (n.includes("storage")) return "📦";
  if (n.includes("maid")) return "🧹";
  if (n.includes("dining")) return "🍽️";
  if (n.includes("study") || n.includes("office")) return "📚";
  return "🏠";
};

const getDamageOptions = (roomName: string) => {
  const n = roomName.toLowerCase();
  const base = ["Paint", "Flooring", "Door", "Window", "Light", "Cleaning"];
  if (n.includes("bath") || n.includes("toilet"))
    return [...base, "Plumbing", "Tiles", "Mirror", "Shower"];
  if (n.includes("kitchen"))
    return [...base, "Appliances", "Cabinets", "Sink", "Countertop"];
  if (n.includes("bedroom") || n.includes("living"))
    return [...base, "AC", "Ceiling", "Curtains", "Sockets"];
  return base;
};

const GENERATION_STEPS = [
  "Analyzing rooms...",
  "Writing report...",
  "Creating PDF...",
  "Uploading report...",
] as const;

// ─── Main Component ──────────────────────────
export function InspectionClient({
  inspectionId,
  inspectionType,
  buildingName,
  unitNumber,
  rooms: initialRooms,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [rooms, setRooms] = useState(initialRooms);
  const [activeRoom, setActiveRoom] = useState<RoomRow | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Report generation
  const [showConfirm, setShowConfirm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const genInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  // Room overlay state
  const [roomStep, setRoomStep] = useState<"photos" | "condition" | "notes">(
    "photos"
  );
  const [condition, setCondition] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<
    { url: string; loading?: boolean; _tempId?: string }[]
  >([]);
  const [damageTypes, setDamageTypes] = useState<string[]>([]);
  const [savingRoom, setSavingRoom] = useState(false);

  // Voice
  const [isRecording, setIsRecording] = useState(false);
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");

  const completedCount = rooms.filter((r) => r.overall_condition).length;

  // ── Refresh rooms from API
  const refreshRooms = useCallback(async () => {
    const res = await fetch(`/api/inspection/${inspectionId}/rooms`);
    if (res.ok) {
      const data = await res.json();
      if (data.rooms) setRooms(data.rooms);
    }
    router.refresh();
  }, [inspectionId, router]);

  // ── Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 1500);
      return () => clearTimeout(t);
    }
  }, [toast]);

  // ── Open room overlay
  const openRoom = (room: RoomRow) => {
    setActiveRoom(room);
    setRoomStep("photos");
    setCondition(room.overall_condition ?? "");
    setNotes("");
    setPhotos([]);
    setDamageTypes([]);

    // Load existing photos
    (async () => {
      const { data: existingPhotos } = await supabase
        .from("photos")
        .select("id, url")
        .eq("room_id", room.id)
        .order("taken_at", { ascending: true });
      if (existingPhotos?.length) {
        const withUrls = await Promise.all(
          existingPhotos.map(async (p) => {
            const path = p.url.includes("/inspection-photos/")
              ? p.url.split("/inspection-photos/").pop()
              : null;
            if (path) {
              const { data: signed } = await supabase.storage
                .from("inspection-photos")
                .createSignedUrl(path, 60 * 60 * 24 * 7);
              if (signed?.signedUrl) return { url: signed.signedUrl };
            }
            return { url: p.url };
          })
        );
        setPhotos(withUrls);
      }
    })();
  };

  // ── Photo upload + AI analysis
  const handlePhotoUpload = async (files: FileList | null) => {
    if (!files || !activeRoom) return;
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const tempId = `temp-${Date.now()}-${i}`;
      const objectUrl = URL.createObjectURL(file);
      setPhotos((p) => [...p, { url: objectUrl, loading: true, _tempId: tempId }]);

      const filePath = `inspections/${inspectionId}/${activeRoom.id}/${Date.now()}-${i}.jpg`;
      let storedPath: string | null = null;
      let signedUrl: string | null = null;

      try {
        const { data, error } = await supabase.storage
          .from("inspection-photos")
          .upload(filePath, file, { contentType: file.type, upsert: false });
        if (!error && data) {
          storedPath = data.path;
          const { data: sd } = await supabase.storage
            .from("inspection-photos")
            .createSignedUrl(data.path, 60 * 60 * 24 * 7);
          signedUrl = sd?.signedUrl ?? null;
        }
      } catch {
        // continue
      }

      const displayUrl = signedUrl ?? objectUrl;

      // AI analysis
      const base64 = await new Promise<string>((res) => {
        const r = new FileReader();
        r.onload = () => res((r.result as string).split(",")[1] ?? "");
        r.readAsDataURL(file);
      });

      let aiAnalysis = "";
      try {
        const analyzeRes = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image: base64, mimeType: file.type }),
        });
        if (analyzeRes.ok) {
          const a = await analyzeRes.json();
          aiAnalysis = a.description ?? "";
        }
      } catch {
        // continue
      }

      if (signedUrl) URL.revokeObjectURL(objectUrl);

      setPhotos((p) =>
        p.map((x) =>
          x._tempId === tempId ? { url: displayUrl, loading: false } : x
        )
      );

      if (storedPath) {
        const rawUrl = supabase.storage
          .from("inspection-photos")
          .getPublicUrl(storedPath).data.publicUrl;
        await supabase.from("photos").insert({
          room_id: activeRoom.id,
          url: rawUrl,
          ai_analysis: aiAnalysis || null,
        });
      }
    }
  };

  // ── Voice recording
  const startRecording = () => {
    if (isRecordingRef.current) return;
    const API = getSpeechAPI();
    if (!API) {
      alert("Voice recognition not supported.");
      return;
    }
    isRecordingRef.current = true;
    setIsRecording(true);
    transcriptRef.current = notes;

    const recognition = new API();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let final = "";
      let interim = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) final += t;
        else interim += t;
      }
      if (final) transcriptRef.current += final;
      setNotes(transcriptRef.current + interim);
    };
    recognition.onerror = () => {
      isRecordingRef.current = false;
      setIsRecording(false);
    };
    recognition.onend = () => {
      if (isRecordingRef.current) {
        try { recognition.start(); } catch { /* */ }
      }
    };
    recognitionRef.current = recognition;
    try { recognition.start(); } catch {
      isRecordingRef.current = false;
      setIsRecording(false);
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try { recognitionRef.current.stop(); } catch { /* */ }
      recognitionRef.current = null;
    }
    await new Promise((r) => setTimeout(r, 300));
    const text = transcriptRef.current.trim();
    if (!text) return;
    setNotes(text);
    // Auto-reformulate
    try {
      const res = await fetch("/api/reformulate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (res.ok) {
        const d = await res.json();
        if (d.text) setNotes(d.text);
      }
    } catch { /* */ }
  };

  // ── Save room
  const handleSaveRoom = async () => {
    if (!activeRoom || !condition) return;
    setSavingRoom(true);

    await supabase
      .from("rooms")
      .update({ overall_condition: condition })
      .eq("id", activeRoom.id);

    // Save damage types as room items
    if (damageTypes.length > 0) {
      const itemRows = damageTypes.map((name) => ({
        room_id: activeRoom.id,
        name,
        condition,
        notes: notes || null,
      }));
      await supabase.from("room_items").insert(itemRows);
    }

    // If notes but no damage types, save a general note item
    if (notes.trim() && damageTypes.length === 0) {
      await supabase.from("room_items").insert({
        room_id: activeRoom.id,
        name: "General Notes",
        condition,
        notes: notes.trim(),
      });
    }

    setSavingRoom(false);
    const savedName = activeRoom.name;
    setActiveRoom(null);
    setToast(`✅ ${savedName} saved!`);
    await refreshRooms();
  };

  // ── Finish / Report generation
  const handleFinish = () => {
    if (completedCount === 0) return;
    setShowConfirm(true);
  };

  const generateReport = async () => {
    setShowConfirm(false);
    setGenerating(true);
    setGenStep(0);
    setGenError(null);

    genInterval.current = setInterval(() => {
      setGenStep((s) => Math.min(s + 1, GENERATION_STEPS.length - 1));
    }, 4000);

    try {
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
        .upload(pdfPath, pdfBlob, { contentType: "application/pdf", upsert: false });

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

  useEffect(() => {
    return () => {
      if (genInterval.current) clearInterval(genInterval.current);
    };
  }, []);

  // ─── GENERATING SCREEN ───
  if (generating) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center px-6"
        style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}>
        <h1 className="font-bold text-3xl text-white mb-2" style={{ fontFamily: "Poppins,sans-serif" }}>
          Snagify
        </h1>
        <p className="text-white/80 text-sm mb-10">Property Inspection Report</p>
        <div className="w-20 h-20 rounded-full bg-white/20 flex items-center justify-center mb-8">
          <Loader2 size={40} className="text-white animate-spin" />
        </div>
        <p className="text-white font-bold text-lg mb-6" style={{ fontFamily: "Poppins,sans-serif" }}>
          Generating your report...
        </p>
        <div className="w-full max-w-xs space-y-3">
          {GENERATION_STEPS.map((step, i) => (
            <div key={step} className="flex items-center gap-3">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                i < genStep ? "bg-[#cafe87]" : i === genStep ? "bg-white" : "bg-white/20"
              }`}>
                {i < genStep ? <Check size={14} className="text-gray-900" /> :
                 i === genStep ? <Loader2 size={14} className="text-[#9A88FD] animate-spin" /> :
                 <span className="w-2 h-2 rounded-full bg-white/40" />}
              </div>
              <span className={`text-sm ${i <= genStep ? "text-white" : "text-white/40"}`}>
                {step}
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const stepIndex = (s: "photos" | "condition" | "notes") =>
    ["photos", "condition", "notes"].indexOf(s);

  // ─── MAIN RENDER ───
  return (
    <div className="min-h-screen bg-white max-w-lg mx-auto flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white border-b border-gray-100">
        <button
          type="button"
          onClick={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="text-center">
          <p className="font-bold text-sm truncate max-w-[180px]"
            style={{ fontFamily: "Poppins,sans-serif" }}>
            {buildingName}
          </p>
          <p className="text-xs text-gray-400">
            {inspectionType === "check-in" ? "🟢 Check-in" : "🟡 Check-out"}
            {unitNumber ? ` · Unit ${unitNumber}` : ""}
          </p>
        </div>
        <button
          type="button"
          onClick={handleFinish}
          disabled={completedCount === 0}
          className="px-4 py-2 rounded-xl text-sm font-bold transition-all disabled:opacity-30"
          style={{
            backgroundColor: completedCount > 0 ? "#cafe87" : "#e5e7eb",
            color: "#1A1A1A",
          }}
        >
          Finish
        </button>
      </div>

      {/* Progress */}
      <div className="px-4 py-2 bg-white">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-gray-400">
            {completedCount} of {rooms.length} rooms done
          </span>
          <span className="text-xs font-semibold" style={{ color: "#9A88FD" }}>
            {rooms.length > 0
              ? Math.round((completedCount / rooms.length) * 100)
              : 0}
            %
          </span>
        </div>
        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{
              width: `${rooms.length > 0 ? (completedCount / rooms.length) * 100 : 0}%`,
              background: "linear-gradient(90deg, #9A88FD, #cafe87)",
            }}
          />
        </div>
      </div>

      {/* Completion banner */}
      {completedCount === rooms.length && rooms.length > 0 && (
        <div className="mx-4 mt-4 bg-[#cafe87] rounded-2xl p-6 text-center mb-4">
          <div className="text-5xl mb-3">🎉</div>
          <p className="font-bold text-xl text-gray-900 mb-1"
            style={{ fontFamily: "Poppins,sans-serif" }}>
            All rooms inspected!
          </p>
          <p className="text-sm text-gray-700 mb-4">
            {rooms.length} rooms · Ready to generate report
          </p>
          <button
            type="button"
            onClick={handleFinish}
            className="w-full h-12 rounded-xl font-bold text-white text-base"
            style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
          >
            Generate Report →
          </button>
        </div>
      )}

      {/* Rooms list */}
      <div className="flex-1 pt-2 pb-4">
        {rooms.map((room, index) => {
          const isDone = !!room.overall_condition;
          const isNext =
            !isDone &&
            rooms.slice(0, index).every((r) => !!r.overall_condition);
          return (
            <div
              key={room.id}
              onClick={() => openRoom(room)}
              className={`mx-4 mb-3 rounded-2xl border-2 p-4 cursor-pointer transition-all active:scale-[0.98] ${
                isDone
                  ? "border-[#cafe87] bg-[#cafe87]/10"
                  : isNext
                    ? "border-[#9A88FD] bg-white shadow-md shadow-[#9A88FD]/10"
                    : "border-gray-100 bg-white opacity-60"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl ${
                      isDone
                        ? "bg-[#cafe87]"
                        : isNext
                          ? "bg-[#F0EDFF]"
                          : "bg-gray-100"
                    }`}
                  >
                    {isDone ? "✅" : getRoomEmoji(room.name)}
                  </div>
                  <div>
                    <p
                      className="font-bold text-sm text-gray-900"
                      style={{ fontFamily: "Poppins,sans-serif" }}
                    >
                      {room.name}
                    </p>
                    <p className="text-xs text-gray-400">
                      {isDone
                        ? `${room.overall_condition} · ${room.item_count} items`
                        : isNext
                          ? "👆 Tap to inspect"
                          : "Waiting..."}
                    </p>
                  </div>
                </div>
                {isDone ? (
                  <div className="flex items-center gap-1">
                    <span
                      className={`text-xs px-2 py-1 rounded-full font-semibold capitalize ${
                        room.overall_condition === "good"
                          ? "bg-[#cafe87] text-gray-700"
                          : room.overall_condition === "fair"
                            ? "bg-[#FEDE80] text-gray-700"
                            : "bg-red-100 text-red-600"
                      }`}
                    >
                      {room.overall_condition}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openRoom(room);
                      }}
                      className="text-xs text-gray-400 ml-1"
                    >
                      ✏️
                    </button>
                  </div>
                ) : isNext ? (
                  <div
                    className="w-9 h-9 rounded-xl flex items-center justify-center"
                    style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
                  >
                    <ChevronRight size={16} className="text-white" />
                  </div>
                ) : null}
              </div>
            </div>
          );
        })}

        {/* Up next */}
        {rooms.filter((r) => !r.overall_condition).length > 0 &&
          completedCount < rooms.length && (
            <div className="px-4 mt-2 mb-6">
              <p className="text-xs text-gray-300 uppercase tracking-wider mb-2">
                Up next
              </p>
              <div className="flex gap-2">
                {rooms
                  .filter((r) => !r.overall_condition)
                  .slice(0, 2)
                  .map((room) => (
                    <div
                      key={room.id}
                      onClick={() => openRoom(room)}
                      className="flex-1 bg-gray-50 rounded-xl p-3 border border-gray-100 cursor-pointer"
                    >
                      <span className="text-lg">{getRoomEmoji(room.name)}</span>
                      <p className="text-xs font-semibold text-gray-600 mt-1 truncate">
                        {room.name}
                      </p>
                    </div>
                  ))}
              </div>
            </div>
          )}
      </div>

      {/* ═══ ROOM FULL-SCREEN OVERLAY ═══ */}
      {activeRoom && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          {/* Room header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <button
              type="button"
              onClick={() => setActiveRoom(null)}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center"
            >
              <X size={18} />
            </button>
            <div className="text-center">
              <p className="font-bold" style={{ fontFamily: "Poppins,sans-serif" }}>
                {getRoomEmoji(activeRoom.name)} {activeRoom.name}
              </p>
            </div>
            <div className="flex gap-1.5">
              {(["photos", "condition", "notes"] as const).map((s) => (
                <div
                  key={s}
                  className={`h-2 rounded-full transition-all ${
                    s === roomStep
                      ? "w-5 bg-[#9A88FD]"
                      : stepIndex(s) < stepIndex(roomStep)
                        ? "w-2 bg-[#cafe87]"
                        : "w-2 bg-gray-200"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Room content */}
          <div className="flex-1 flex flex-col px-4 pt-6 pb-8 overflow-y-auto">
            {/* ── PHOTOS ── */}
            {roomStep === "photos" && (
              <>
                <p className="text-2xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: "Poppins,sans-serif" }}>
                  📸 Take photos
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  Capture the current state of {activeRoom.name}
                </p>

                <div className="grid grid-cols-3 gap-2 mb-6">
                  {photos.map((photo, i) => (
                    <div key={i} className="aspect-square rounded-xl overflow-hidden relative">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt="" className="w-full h-full object-cover" />
                      {photo.loading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 size={20} className="text-white animate-spin" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          setPhotos((p) => p.filter((_, j) => j !== i))
                        }
                        className="absolute top-1 right-1 w-6 h-6 bg-black/50 rounded-full flex items-center justify-center text-white text-xs"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                  <label className="aspect-square rounded-xl border-2 border-dashed border-[#9A88FD] bg-[#F0EDFF] flex flex-col items-center justify-center cursor-pointer active:scale-95 transition-transform">
                    <span className="text-2xl mb-1">📷</span>
                    <span className="text-xs text-[#9A88FD] font-semibold">
                      Add photo
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      multiple
                      onChange={(e) => handlePhotoUpload(e.target.files)}
                    />
                  </label>
                </div>

                {photos.length > 0 && (
                  <div className="bg-[#F0EDFF] rounded-xl p-3 flex items-center gap-2 mb-6">
                    <span>✨</span>
                    <p className="text-xs text-[#7B65FC]">
                      Claude will analyze your photos automatically
                    </p>
                  </div>
                )}

                <div className="mt-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRoomStep("condition")}
                    className="flex-1 h-12 rounded-xl border-2 border-gray-200 text-gray-500 font-semibold text-sm"
                  >
                    Skip photos
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomStep("condition")}
                    disabled={photos.length === 0}
                    className="h-12 rounded-xl font-bold text-white px-8 disabled:opacity-40 transition-all"
                    style={{
                      background: "linear-gradient(135deg,#9A88FD,#7B65FC)",
                      flex: 2,
                    }}
                  >
                    Next →{" "}
                    {photos.length > 0
                      ? `${photos.length} photo${photos.length > 1 ? "s" : ""}`
                      : ""}
                  </button>
                </div>
              </>
            )}

            {/* ── CONDITION ── */}
            {roomStep === "condition" && (
              <>
                <p className="text-2xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: "Poppins,sans-serif" }}>
                  How is the {activeRoom.name}?
                </p>
                <p className="text-sm text-gray-400 mb-8">
                  Tap to select overall condition
                </p>

                <div className="flex flex-col gap-3 mb-6">
                  {[
                    {
                      value: "good", emoji: "✅", label: "Good",
                      desc: "Clean, no issues", color: "#cafe87", textColor: "#3a5a1c",
                    },
                    {
                      value: "fair", emoji: "⚠️", label: "Fair",
                      desc: "Minor issues or wear", color: "#FEDE80", textColor: "#7a5a00",
                    },
                    {
                      value: "poor", emoji: "❌", label: "Poor",
                      desc: "Damaged or needs repair", color: "#FFD5D5", textColor: "#cc2222",
                    },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setCondition(opt.value)}
                      className={`w-full p-5 rounded-2xl border-2 text-left transition-all active:scale-[0.98] ${
                        condition === opt.value
                          ? "border-transparent shadow-md"
                          : "border-gray-200 bg-white"
                      }`}
                      style={
                        condition === opt.value
                          ? { backgroundColor: opt.color }
                          : {}
                      }
                    >
                      <div className="flex items-center gap-4">
                        <span className="text-3xl">{opt.emoji}</span>
                        <div>
                          <p
                            className="font-bold text-lg"
                            style={{
                              color: condition === opt.value ? opt.textColor : "#1A1A1A",
                              fontFamily: "Poppins,sans-serif",
                            }}
                          >
                            {opt.label}
                          </p>
                          <p
                            className="text-sm"
                            style={{
                              color: condition === opt.value ? opt.textColor : "#9CA3AF",
                            }}
                          >
                            {opt.desc}
                          </p>
                        </div>
                        {condition === opt.value && (
                          <div className="ml-auto w-6 h-6 rounded-full bg-white/60 flex items-center justify-center">
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: opt.textColor }}
                            />
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>

                {(condition === "fair" || condition === "poor") && (
                  <div className="mb-6">
                    <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
                      What&apos;s the issue?
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {getDamageOptions(activeRoom.name).map((tag) => (
                        <button
                          key={tag}
                          type="button"
                          onClick={() =>
                            setDamageTypes((prev) =>
                              prev.includes(tag)
                                ? prev.filter((t) => t !== tag)
                                : [...prev, tag]
                            )
                          }
                          className={`text-sm px-3 py-1.5 rounded-xl font-medium transition-all ${
                            damageTypes.includes(tag)
                              ? "bg-[#9A88FD] text-white"
                              : "bg-gray-100 text-gray-600"
                          }`}
                        >
                          {tag}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="mt-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRoomStep("photos")}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center flex-shrink-0"
                  >
                    <ChevronLeft size={18} className="text-gray-400" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomStep("notes")}
                    disabled={!condition}
                    className="flex-1 h-12 rounded-xl font-bold text-white disabled:opacity-40"
                    style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
                  >
                    Next →
                  </button>
                </div>
              </>
            )}

            {/* ── NOTES ── */}
            {roomStep === "notes" && (
              <>
                <p className="text-2xl font-bold text-gray-900 mb-1"
                  style={{ fontFamily: "Poppins,sans-serif" }}>
                  Any notes?
                </p>
                <p className="text-sm text-gray-400 mb-6">
                  Optional — voice or text
                </p>

                <button
                  type="button"
                  onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                  onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`w-full py-6 rounded-2xl flex flex-col items-center gap-2 mb-4 transition-all touch-none select-none ${
                    isRecording
                      ? "bg-red-50 border-2 border-red-300 scale-[0.98]"
                      : "bg-[#F0EDFF] border-2 border-[#9A88FD]/30"
                  }`}
                >
                  <span className={`text-4xl ${isRecording ? "animate-pulse" : ""}`}>
                    {isRecording ? "🔴" : "🎙️"}
                  </span>
                  <span
                    className="text-sm font-semibold"
                    style={{ color: isRecording ? "#cc2222" : "#9A88FD" }}
                  >
                    {isRecording ? "Recording... release to stop" : "Hold to record"}
                  </span>
                </button>

                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 h-px bg-gray-100" />
                  <span className="text-xs text-gray-300">or type</span>
                  <div className="flex-1 h-px bg-gray-100" />
                </div>

                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder={`Notes about ${activeRoom.name}...`}
                  rows={4}
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm resize-none focus:border-[#9A88FD] focus:outline-none mb-6"
                />

                <div className="mt-auto flex gap-3">
                  <button
                    type="button"
                    onClick={() => setRoomStep("condition")}
                    className="w-12 h-12 rounded-xl border-2 border-gray-200 flex items-center justify-center flex-shrink-0"
                  >
                    <ChevronLeft size={18} className="text-gray-400" />
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveRoom}
                    disabled={savingRoom}
                    className="flex-1 h-12 rounded-xl font-bold text-gray-900 text-base active:scale-[0.98] transition-transform disabled:opacity-50"
                    style={{ backgroundColor: "#cafe87" }}
                  >
                    {savingRoom ? "Saving..." : "✅ Done — Save Room"}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[60] bg-[#cafe87] text-gray-900 px-6 py-3 rounded-2xl shadow-lg font-semibold text-sm animate-[fadeIn_0.2s]"
          style={{ fontFamily: "Poppins,sans-serif" }}>
          {toast}
        </div>
      )}

      {/* Confirmation modal */}
      {showConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => setShowConfirm(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-xl mx-6 p-6 max-w-sm w-full">
            <h3 className="font-bold text-lg text-gray-900 mb-2"
              style={{ fontFamily: "Poppins,sans-serif" }}>
              Finish Inspection?
            </h3>
            {completedCount < rooms.length ? (
              <p className="text-sm text-gray-600 mb-5">
                <span className="font-semibold text-amber-600">
                  {rooms.length - completedCount} room
                  {rooms.length - completedCount > 1 ? "s" : ""}
                </span>{" "}
                not completed yet. The report will be generated with available
                data.
              </p>
            ) : (
              <p className="text-sm text-gray-600 mb-5">
                All rooms are completed. Ready to generate the report.
              </p>
            )}
            {genError && (
              <p className="text-sm text-red-600 bg-red-50 rounded-xl p-3 mb-4">
                {genError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowConfirm(false)}
                className="flex-1 h-11 rounded-xl border-2 border-gray-200 font-semibold text-sm text-gray-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={generateReport}
                className="flex-1 h-11 rounded-xl text-white font-bold text-sm"
                style={{ background: "linear-gradient(135deg,#9A88FD,#7B65FC)" }}
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
