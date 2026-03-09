"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import Image from "next/image";
import { X, Mic, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  readonly [index: number]: { readonly transcript: string; readonly confidence: number };
}

interface SpeechRecognitionResultList {
  readonly length: number;
  readonly [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionEvent {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}

interface SpeechRecognitionErrorEvent {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
}

const DEFAULT_ITEMS: Record<string, string[]> = {
  "Living Room": ["TV", "AC", "Sofa", "Curtains", "Flooring", "Walls", "Ceiling", "Lights", "Windows"],
  "Master Bedroom": ["AC", "Wardrobe", "Flooring", "Walls", "Ceiling", "Lights", "Windows", "Door"],
  "Bedroom 2": ["AC", "Wardrobe", "Flooring", "Walls", "Ceiling", "Lights", "Windows", "Door"],
  "Bedroom 3": ["AC", "Wardrobe", "Flooring", "Walls", "Ceiling", "Lights", "Windows", "Door"],
  Kitchen: ["Oven", "Hood", "Fridge", "Cabinets", "Sink", "Countertop", "Flooring", "Walls"],
  "Bathroom 1": ["Toilet", "Sink", "Shower/Bathtub", "Mirror", "Taps", "Tiles", "Towel Rail"],
  "Bathroom 2": ["Toilet", "Sink", "Shower/Bathtub", "Mirror", "Taps", "Tiles", "Towel Rail"],
  "Guest Toilet": ["Toilet", "Sink", "Mirror", "Taps", "Tiles"],
  Balcony: ["Flooring", "Railing", "Walls", "Ceiling"],
  Laundry: ["Washing machine", "Sink", "Flooring", "Walls"],
  "Laundry Room": ["Washing machine", "Sink", "Flooring", "Walls"],
  Storage: ["Flooring", "Walls", "Ceiling", "Door"],
  Parking: ["Flooring", "Walls", "Door"],
  Garden: ["Flooring", "Plants", "Fencing"],
  Pool: ["Pool condition", "Tiles", "Surrounding area"],
};

const CONDITION_OPTIONS = [
  { id: "good", label: "Good", bg: "bg-[#cafe87]" },
  { id: "fair", label: "Fair", bg: "bg-[#FEDE80]" },
  { id: "poor", label: "Poor", bg: "bg-[#FFD5D5]" },
] as const;

type RoomWithMeta = {
  id: string;
  name: string;
  order_index: number | null;
  overall_condition: string | null;
  item_count?: number;
  photo_count?: number;
};

interface RoomDetailSheetProps {
  room: RoomWithMeta;
  inspectionId: string;
  onClose: () => void;
  onSaved: () => void;
}

function getSpeechRecognitionAPI(): (new () => SpeechRecognitionInstance) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as Record<string, unknown>;
  return (w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null) as
    | (new () => SpeechRecognitionInstance)
    | null;
}

export function RoomDetailSheet({
  room,
  inspectionId,
  onClose,
  onSaved,
}: RoomDetailSheetProps) {
  const supabase = useMemo(() => createClient(), []);
  const [overallCondition, setOverallCondition] = useState<string | null>(room.overall_condition);
  const [photos, setPhotos] = useState<
    { id?: string; url: string; ai?: string; aiCondition?: string; loading?: boolean; _tempId?: string }[]
  >([]);
  const [photoAnalyses, setPhotoAnalyses] = useState<
    { thumbnailUrl: string; analysis: { description: string; condition: string; issues: string[] } }[]
  >([]);
  const [voiceNote, setVoiceNote] = useState("");
  const [items, setItems] = useState<{ id?: string; name: string; condition: string; notes: string }[]>(() => {
    const defaultNames = DEFAULT_ITEMS[room.name] ?? ["Item 1"];
    return defaultNames.map((name) => ({ name, condition: "good", notes: "" }));
  });
  const [customItemName, setCustomItemName] = useState("");
  const [saving, setSaving] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isReformulating, setIsReformulating] = useState(false);
  const [showReformulatedBadge, setShowReformulatedBadge] = useState(false);
  const isRecordingRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const API = getSpeechRecognitionAPI();
    if (!API) return;
    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => stream.getTracks().forEach((t) => t.stop()))
      .catch(() => {});
  }, []);

  useEffect(() => {
    (async () => {
      const { data: existingItems } = await supabase
        .from("room_items")
        .select("id, name, condition, notes")
        .eq("room_id", room.id)
        .order("created_at");
      if (existingItems?.length) {
        setItems(
          existingItems.map((r) => ({
            id: r.id,
            name: r.name,
            condition: r.condition ?? "good",
            notes: r.notes ?? "",
          }))
        );
      }
      const { data: existingPhotos } = await supabase
        .from("photos")
        .select("id, url, ai_analysis")
        .eq("room_id", room.id)
        .order("taken_at", { ascending: true });
      if (existingPhotos?.length) {
        const photosWithSignedUrls = await Promise.all(
          existingPhotos.map(async (p) => {
            const storagePath = p.url.includes("/inspection-photos/")
              ? p.url.split("/inspection-photos/").pop()
              : null;
            if (storagePath) {
              const { data: signed } = await supabase.storage
                .from("inspection-photos")
                .createSignedUrl(storagePath, 60 * 60 * 24 * 7);
              if (signed?.signedUrl) {
                return { ...p, displayUrl: signed.signedUrl };
              }
            }
            return { ...p, displayUrl: p.url };
          })
        );
        setPhotos(
          photosWithSignedUrls.map((p) => ({
            id: p.id,
            url: p.displayUrl,
            ai: p.ai_analysis ?? undefined,
          }))
        );
        const withAnalysis = photosWithSignedUrls.filter((p) => p.ai_analysis);
        if (withAnalysis.length) {
          setPhotoAnalyses(
            withAnalysis.map((p) => ({
              thumbnailUrl: p.displayUrl,
              analysis: {
                description: p.ai_analysis ?? "",
                condition: "",
                issues: [],
              },
            }))
          );
        }
      }
    })();
  }, [room.id, supabase]);

  const addPhoto = async (file: File) => {
    const tempId = `temp-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);
    setPhotos((p) => [...p, { url: objectUrl, loading: true, _tempId: tempId }]);

    const filePath = `inspections/${inspectionId}/${room.id}/${Date.now()}.jpg`;
    let signedUrl: string | null = null;
    let storedPath: string | null = null;

    try {
      const { data, error: uploadErr } = await supabase.storage
        .from("inspection-photos")
        .upload(filePath, file, { contentType: file.type, upsert: false });
      if (uploadErr) {
        console.error("[RoomDetailSheet] Storage upload error:", uploadErr);
      } else {
        storedPath = data.path;
        const { data: signedUrlData } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(data.path, 60 * 60 * 24 * 7);
        signedUrl = signedUrlData?.signedUrl ?? null;
      }
    } catch (err) {
      console.error("[RoomDetailSheet] Storage upload exception:", err);
    }

    const thumbnailUrl = signedUrl ?? objectUrl;

    const base64 = await new Promise<string>((res) => {
      const r = new FileReader();
      r.onload = () => res((r.result as string).split(",")[1] ?? "");
      r.readAsDataURL(file);
    });

    let analysis: { description: string; condition: string; issues: string[] };
    try {
      const analyzeRes = await fetch("/api/analyze-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: base64, mimeType: file.type }),
      });
      analysis = analyzeRes.ok
        ? await analyzeRes.json()
        : { description: "", condition: "Good", issues: [] };
    } catch (err) {
      console.error("[RoomDetailSheet] analyze-photo exception:", err);
      analysis = { description: "", condition: "Good", issues: [] };
    }

    console.log("[RoomDetailSheet] analyze-photo API response:", analysis);

    if (signedUrl) URL.revokeObjectURL(objectUrl);

    setPhotos((p) =>
      p.map((x) =>
        x._tempId === tempId
          ? {
              url: thumbnailUrl,
              ai: analysis.description,
              aiCondition: analysis.condition,
              loading: false,
            }
          : x
      )
    );

    setPhotoAnalyses((prev) => [
      ...prev,
      {
        thumbnailUrl,
        analysis: {
          description: analysis.description,
          condition: analysis.condition,
          issues: Array.isArray(analysis.issues) ? analysis.issues : [],
        },
      },
    ]);

    if (storedPath) {
      const rawUrl = supabase.storage.from("inspection-photos").getPublicUrl(storedPath).data.publicUrl;
      await supabase.from("photos").insert({
        room_id: room.id,
        url: rawUrl,
        ai_analysis: analysis.description || null,
      });
    }
  };

  const startRecording = () => {
    if (isRecordingRef.current) return;

    const SpeechRecognitionAPI = getSpeechRecognitionAPI();
    if (!SpeechRecognitionAPI) {
      alert("Voice recognition not supported. Please type manually.");
      return;
    }

    isRecordingRef.current = true;
    setIsRecording(true);
    setRecordingSeconds(0);
    setShowReformulatedBadge(false);
    transcriptRef.current = "";

    recordingTimerRef.current = setInterval(
      () => setRecordingSeconds((s) => s + 1),
      1000
    );

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }
      if (finalTranscript) {
        transcriptRef.current += finalTranscript;
      }
      setVoiceNote(transcriptRef.current + interimTranscript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        isRecordingRef.current = false;
        setIsRecording(false);
        if (recordingTimerRef.current) {
          clearInterval(recordingTimerRef.current);
          recordingTimerRef.current = null;
        }
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (isRecordingRef.current) {
        try {
          recognition.start();
        } catch {
          /* ignore restart errors */
        }
      }
    };

    recognitionRef.current = recognition;
    try {
      recognition.start();
    } catch (e) {
      console.error("Could not start recognition:", e);
      isRecordingRef.current = false;
      setIsRecording(false);
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
        recordingTimerRef.current = null;
      }
    }
  };

  const stopRecording = async () => {
    if (!isRecordingRef.current) return;
    isRecordingRef.current = false;
    setIsRecording(false);

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      try {
        recognitionRef.current.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    }

    await new Promise((r) => setTimeout(r, 350));

    const finalText = transcriptRef.current.trim();
    if (!finalText) return;

    setVoiceNote(finalText);
    setIsReformulating(true);

    try {
      const res = await fetch("/api/reformulate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: finalText }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.text) {
          setVoiceNote(data.text);
          setShowReformulatedBadge(true);
        }
      }
    } catch (e) {
      console.error("Reformulation error:", e);
    } finally {
      setIsReformulating(false);
    }
  };

  const reformulateNote = async () => {
    if (!voiceNote.trim()) return;
    setIsReformulating(true);
    try {
      const res = await fetch("/api/reformulate-note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: voiceNote }),
      });
      if (res.ok) {
        const { text } = await res.json();
        setVoiceNote(text);
        setShowReformulatedBadge(true);
      }
    } catch (e) {
      console.error("Reformulation error:", e);
    } finally {
      setIsReformulating(false);
    }
  };

  const addCustomItem = () => {
    const name = customItemName.trim();
    if (name) {
      setItems((i) => [...i, { name, condition: "good", notes: "" }]);
      setCustomItemName("");
    }
  };

  const saveRoom = async () => {
    setSaving(true);
    await supabase
      .from("rooms")
      .update({ overall_condition: overallCondition ?? undefined })
      .eq("id", room.id);

    for (const item of items) {
      if (item.id) {
        await supabase
          .from("room_items")
          .update({ condition: item.condition, notes: item.notes || null })
          .eq("id", item.id);
      } else {
        const { data: inserted } = await supabase
          .from("room_items")
          .insert({
            room_id: room.id,
            name: item.name,
            condition: item.condition,
            notes: item.notes || null,
          })
          .select("id")
          .single();
        if (inserted) item.id = inserted.id;
      }
    }

    setSaving(false);
    onSaved();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl h-[85vh] flex flex-col max-w-[480px] mx-auto w-full">
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-12 h-1 rounded-full bg-gray-300" />
        </div>
        <div className="flex items-center justify-between px-4 pb-3 border-b border-gray-100">
          <h2 className="font-heading font-bold text-lg text-brand-dark">{room.name}</h2>
          <button type="button" onClick={onClose} className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {/* Photos */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-brand-dark mb-2">Photos</h3>
            <div className="flex gap-2 overflow-x-auto pb-2">
              {photos.map((p, i) => (
                <div key={i} className="flex-shrink-0 relative w-20 h-20">
                  <Image
                    src={p.url}
                    alt=""
                    fill
                    className="rounded-xl object-cover bg-gray-100"
                    unoptimized
                  />
                  {p.loading && (
                    <div className="absolute inset-0 rounded-xl bg-black/60 flex flex-col items-center justify-center gap-1 z-10">
                      <Loader2 size={18} className="text-white animate-spin" />
                      <span className="text-white text-xs">Analyzing...</span>
                    </div>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => {
                  fileInputRef.current?.click();
                }}
                className="flex-shrink-0 w-20 h-20 rounded-xl border-2 border-dashed border-[#9A88FD] flex items-center justify-center text-2xl bg-[#F0EDFF]/30"
              >
                📷
              </button>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) addPhoto(f);
                e.target.value = "";
              }}
            />
            {photoAnalyses.length > 0 && (
              <div className="mt-2 space-y-2">
                {photoAnalyses.map((item, idx) => (
                  <div
                    key={`analysis-${idx}`}
                    className="rounded-xl p-3 bg-[#F0EDFF] flex gap-3"
                  >
                    <div className="relative w-12 h-12 flex-shrink-0">
                      <Image
                        src={item.thumbnailUrl}
                        alt=""
                        fill
                        className="rounded-lg object-cover"
                        unoptimized
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-[#9A88FD] text-xs font-semibold mb-1">
                        🤖 AI Analysis
                      </p>
                      <p className="font-body text-sm text-[#1A1A1A]">
                        {item.analysis.description}
                      </p>
                      {item.analysis.condition && (
                        <span
                          className={`inline-block mt-2 px-2 py-0.5 rounded-full text-xs font-medium ${
                            item.analysis.condition === "Good"
                              ? "bg-[#cafe87] text-brand-dark"
                              : item.analysis.condition === "Fair"
                                ? "bg-[#FEDE80] text-brand-dark"
                                : "bg-[#FFD5D5] text-red-800"
                          }`}
                        >
                          {item.analysis.condition}
                        </span>
                      )}
                      {item.analysis.issues.length > 0 && (
                        <ul className="mt-2 text-gray-500 text-xs font-body space-y-0.5">
                          {item.analysis.issues.map((issue, i) => (
                            <li key={i}>• {issue}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Voice Notes */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-brand-dark mb-2">Voice Notes</h3>
            <div className="flex flex-col items-center gap-2">
              <div className="relative">
                {isRecording && (
                  <span className="absolute inset-0 rounded-full bg-red-400 animate-[pulse-ring_1.2s_ease-out_infinite] pointer-events-none" />
                )}
                <button
                  type="button"
                  onMouseDown={startRecording}
                  onMouseUp={stopRecording}
                  onMouseLeave={stopRecording}
                  onTouchStart={(e) => {
                    e.preventDefault();
                    startRecording();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    stopRecording();
                  }}
                  onContextMenu={(e) => e.preventDefault()}
                  className={`relative z-10 w-16 h-16 rounded-full flex items-center justify-center touch-none select-none transition-colors ${
                    isRecording ? "bg-[#EF4444]" : "bg-[#9A88FD]"
                  } text-white`}
                >
                  <Mic size={28} />
                </button>
              </div>
              <span className="font-body text-xs text-gray-400">
                {isRecording
                  ? `Recording... ${recordingSeconds}s`
                  : "Hold to record"}
              </span>
            </div>
            <textarea
              value={voiceNote}
              onChange={(e) => {
                setVoiceNote(e.target.value);
                setShowReformulatedBadge(false);
              }}
              className={`mt-2 w-full min-h-[80px] px-4 py-3 rounded-xl border font-body text-sm resize-y transition-colors ${
                isRecording
                  ? "border-[#EF4444] bg-red-50/40"
                  : "border-[#E5E7EB]"
              }`}
              placeholder="Transcription or notes..."
            />
            {isReformulating && (
              <div className="mt-1 flex items-center gap-1.5">
                <Loader2 size={12} className="text-[#9A88FD] animate-spin" />
                <span className="font-body text-xs text-[#9A88FD]">
                  ✨ AI reformulating...
                </span>
              </div>
            )}
            {showReformulatedBadge && !isReformulating && (
              <p className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#cafe87]/40 font-body text-xs text-green-700">
                ✨ Reformulated by AI
              </p>
            )}
            {voiceNote.trim() && !showReformulatedBadge && !isReformulating && !isRecording && (
              <button
                type="button"
                onClick={reformulateNote}
                className="mt-1 text-[#9A88FD] font-body text-xs"
              >
                Reformulate with AI →
              </button>
            )}
          </div>

          {/* Overall Condition */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-brand-dark mb-2">Overall Condition</h3>
            <div className="grid grid-cols-3 gap-2">
              {CONDITION_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => setOverallCondition(opt.id)}
                  className={`h-12 rounded-xl font-body font-medium text-sm border-2 ${
                    overallCondition === opt.id ? `${opt.bg} border-transparent` : "bg-white border-gray-200"
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Items */}
          <div>
            <h3 className="font-heading font-semibold text-sm text-brand-dark mb-2">Items to Check</h3>
            <div className="space-y-3">
              {items.map((item, idx) => (
                <div key={idx} className="p-3 rounded-xl border border-gray-100 bg-white">
                  <p className="font-body font-medium text-brand-dark text-sm">{item.name}</p>
                  <div className="flex gap-2 mt-2">
                    {CONDITION_OPTIONS.map((opt) => (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setItems((i) =>
                            i.map((x, j) =>
                              j === idx ? { ...x, condition: opt.id } : x
                            )
                          )
                        }
                        className={`px-2 py-1 rounded-lg text-xs font-body ${
                          item.condition === opt.id ? opt.bg : "bg-gray-100"
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={item.notes}
                    onChange={(e) =>
                      setItems((i) =>
                        i.map((x, j) => (j === idx ? { ...x, notes: e.target.value } : x))
                      )
                    }
                    className="mt-2 w-full px-3 py-2 rounded-lg border border-gray-200 text-sm font-body"
                    placeholder="Notes"
                  />
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customItemName}
                  onChange={(e) => setCustomItemName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustomItem()}
                  className="flex-1 h-10 px-3 rounded-xl border border-gray-200 font-body text-sm"
                  placeholder="Custom item name"
                />
                <button
                  type="button"
                  onClick={addCustomItem}
                  className="px-4 rounded-xl bg-[#9A88FD] text-white font-heading font-medium text-sm"
                >
                  + Add
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-100">
          <button
            type="button"
            onClick={saveRoom}
            disabled={saving}
            className="w-full h-12 rounded-xl bg-[#9A88FD] text-white font-heading font-bold disabled:opacity-60"
          >
            Save Room ✓
          </button>
        </div>
      </div>
    </div>
  );
}
