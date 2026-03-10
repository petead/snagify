"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  Check,
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
const ROOM_TEMPLATES: Record<string, string[]> = {
  "Studio":    ["Entrance", "Living / Bedroom", "Kitchen", "Bathroom 1", "Balcony"],
  "1 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bathroom 1", "Balcony"],
  "2 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bathroom 1", "Bathroom 2", "Balcony"],
  "3 BR":      ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Balcony"],
  "4 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Balcony", "Maid's Room"],
  "5 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Balcony", "Maid's Room", "Laundry"],
  "6 BR":      ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Bathroom 6", "Balcony", "Maid's Room", "Laundry", "Storage"],
  "Villa":     ["Entrance", "Living Room", "Dining Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Garden", "Garage", "Maid's Room", "Laundry", "Storage"],
  "Townhouse": ["Entrance", "Living Room", "Kitchen", "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bathroom 1", "Bathroom 2", "Bathroom 3", "Terrace", "Garage"],
};

const ALL_ROOMS = [
  "Entrance", "Living Room", "Dining Room",
  "Bedroom 1", "Bedroom 2", "Bedroom 3", "Bedroom 4", "Bedroom 5", "Bedroom 6",
  "Bathroom 1", "Bathroom 2", "Bathroom 3", "Bathroom 4", "Bathroom 5", "Bathroom 6",
  "Kitchen", "Laundry", "Storage", "Maid's Room",
  "Balcony", "Terrace", "Garden", "Garage",
  "Living / Bedroom",
];

const DAMAGE_TAGS = [
  "scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak",
];

// ─── Helpers ─────────────────────────────────────
const getRoomEmoji = (name: string) => {
  const n = name.toLowerCase();
  if (n.includes("entrance")) return "🚪";
  if (n.includes("living") && n.includes("bedroom")) return "🛋️";
  if (n.includes("living")) return "🛋️";
  if (n.includes("dining")) return "🍽️";
  if (n.includes("bedroom") || n.includes("bed")) return "🛏️";
  if (n.includes("bathroom") || n.includes("bath")) return "🚿";
  if (n.includes("kitchen")) return "🍳";
  if (n.includes("balcony")) return "🌅";
  if (n.includes("terrace")) return "🌅";
  if (n.includes("garden")) return "🌿";
  if (n.includes("garage")) return "🚗";
  if (n.includes("laundry")) return "🧺";
  if (n.includes("storage")) return "📦";
  if (n.includes("maid")) return "🧹";
  return "🏠";
};

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
          boxShadow: photo.flagged ? "0 0 12px rgba(255,110,64,0.25)" : "none",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo.src} alt="" className="w-full aspect-square object-cover" />
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
            <span className="w-5 h-5 rounded-full flex items-center justify-center" style={{ background: "#cafe87" }}>
              <Check size={10} color="#1a1a2e" />
            </span>
          )}
        </div>
        {photo.tags.length > 0 && !expanded && (
          <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
            {photo.tags.map((t) => (
              <span key={t} className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-black/60 text-white">{t}</span>
            ))}
          </div>
        )}
        {photo.aiAnalysis && !expanded && photo.tags.length === 0 && (
          <div className="absolute bottom-1 left-1 right-1 bg-black/60 rounded px-1.5 py-0.5">
            <p className="text-[8px] text-white/80 line-clamp-1">{photo.aiAnalysis}</p>
          </div>
        )}
      </div>
      {expanded && (
        <div className="mt-1.5 p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.06)" }}>
          {photo.aiAnalysis && (
            <p className="text-[10px] text-white/60 mb-2 line-clamp-3">{photo.aiAnalysis}</p>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onToggleFlag(); }}
            className="w-full py-2 rounded-lg text-xs font-semibold mb-2"
            style={{
              background: photo.flagged ? "rgba(255,110,64,0.2)" : "rgba(255,255,255,0.08)",
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
                  onClick={(e) => { e.stopPropagation(); onTagAdd(tag); }}
                  className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold"
                  style={{
                    background: photo.tags.includes(tag) ? "#FEDE80" : "rgba(255,255,255,0.08)",
                    color: photo.tags.includes(tag) ? "#1a1a2e" : "rgba(255,255,255,0.5)",
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
  rooms: initialRooms,
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [liveRooms, setLiveRooms] = useState<RoomData[]>(initialRooms);
  const [activeRoom, setActiveRoom] = useState(0);
  const [photos, setPhotos] = useState<Record<number, PhotoItem[]>>({});
  const [screen, setScreen] = useState<"rooms" | "inspect" | "review">(
    initialRooms.length > 0 ? "inspect" : "rooms"
  );
  const [toast, setToast] = useState<string | null>(null);

  // Setup state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [customRoom, setCustomRoom] = useState("");
  const [creatingRooms, setCreatingRooms] = useState(false);

  // Report generation (review screen)
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(false);

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Hide bottom nav on inspect screen
  useEffect(() => {
    const nav = document.getElementById("bottom-nav");
    if (screen === "inspect") {
      if (nav) nav.style.display = "none";
    } else {
      if (nav) nav.style.display = "";
    }
    return () => { if (nav) nav.style.display = ""; };
  }, [screen]);

  // Pre-select existing room names on mount
  useEffect(() => {
    if (initialRooms.length > 0) {
      setSelectedRooms(initialRooms.map((r) => r.name));
    }
  }, [initialRooms]);

  // Load existing photos on mount
  useEffect(() => {
    if (initialRooms.length === 0) return;
    const load = async () => {
      const initial: Record<number, PhotoItem[]> = {};
      for (let i = 0; i < initialRooms.length; i++) {
        const room = initialRooms[i];
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
              return { id: p.id, src, flagged: false, tags: [], uploading: false, aiAnalysis: p.ai_analysis ?? undefined };
            })
          );
          initial[i] = loaded;
        }
      }
      setPhotos(initial);
    };
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  // ── Derived
  const roomCurrentPhotos = photos[activeRoom] || [];
  const totalPhotos = Object.values(photos).flat().length;
  const totalFlags = Object.values(photos).flat().filter((p) => p.flagged).length;
  const roomsWithPhotos = Object.keys(photos).filter((k) => (photos[Number(k)] || []).length > 0).length;
  const progressPct = liveRooms.length > 0 ? (roomsWithPhotos / liveRooms.length) * 100 : 0;

  // ── Setup handlers
  const handleTypeSelect = (type: string) => {
    setSelectedType(type);
    setSelectedRooms(ROOM_TEMPLATES[type]);
  };

  const toggleRoom = (room: string) => {
    setSelectedRooms((prev) =>
      prev.includes(room) ? prev.filter((r) => r !== room) : [...prev, room]
    );
  };

  const handleStartInspection = async () => {
    if (selectedRooms.length === 0) return;
    setCreatingRooms(true);
    await supabase.from("rooms").delete().eq("inspection_id", inspectionId);
    const roomInserts = selectedRooms.map((name, i) => ({
      inspection_id: inspectionId,
      name,
      order_index: i,
    }));
    const { data: newRooms } = await supabase
      .from("rooms")
      .insert(roomInserts)
      .select("id, name, order_index");
    const mapped: RoomData[] = (newRooms || []).map((r) => ({
      id: r.id,
      name: r.name,
      order_index: r.order_index,
      existingPhotos: [],
    }));
    setLiveRooms(mapped);
    setPhotos({});
    setActiveRoom(0);
    setCreatingRooms(false);
    setScreen("inspect");
  };

  // ── Photo capture + upload + AI analysis
  const handlePhotoCapture = async (files: FileList | null) => {
    if (!files) return;
    const room = liveRooms[activeRoom];
    if (!room) return;

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

      const fileName = `inspections/${inspectionId}/${room.id}/${tempId}.jpg`;
      let storedPath: string | null = null;
      let publicUrl = "";
      try {
        const { data, error } = await supabase.storage
          .from("inspection-photos")
          .upload(fileName, file, { contentType: file.type, upsert: false });
        if (!error && data) {
          storedPath = data.path;
          publicUrl = supabase.storage.from("inspection-photos").getPublicUrl(fileName).data.publicUrl;
        }
      } catch { /* continue */ }

      let photoRecordId: string | null = null;
      if (storedPath) {
        const { data: photoRecord } = await supabase
          .from("photos")
          .insert({ room_id: room.id, url: publicUrl, taken_at: new Date().toISOString() })
          .select("id")
          .single();
        if (photoRecord) photoRecordId = photoRecord.id;
      }

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
          if (photoRecordId) {
            await supabase.from("photos").update({ ai_analysis: aiText }).eq("id", photoRecordId);
          }
        }
      } catch { /* continue */ }

      let displayUrl = base64;
      if (storedPath) {
        const { data: signed } = await supabase.storage
          .from("inspection-photos")
          .createSignedUrl(storedPath, 60 * 60 * 24 * 7);
        if (signed?.signedUrl) displayUrl = signed.signedUrl;
      }

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

  // ── Toggle flag / add tag
  const toggleFlag = (photoId: string) => {
    setPhotos((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).map((p) =>
        p.id === photoId ? { ...p, flagged: !p.flagged, tags: !p.flagged ? p.tags : [] } : p
      ),
    }));
  };

  const addTag = (photoId: string, tag: string) => {
    setPhotos((prev) => ({
      ...prev,
      [activeRoom]: (prev[activeRoom] || []).map((p) =>
        p.id === photoId
          ? { ...p, tags: p.tags.includes(tag) ? p.tags.filter((t) => t !== tag) : [...p.tags, tag] }
          : p
      ),
    }));
  };

  // ── Generate report (from review screen)
  const handleGenerateReport = async () => {
    setGenerating(true);
    try {
      // Save flags/conditions to DB
      for (const [roomIdx, roomPhotos] of Object.entries(photos)) {
        const room = liveRooms[Number(roomIdx)];
        if (!room) continue;
        const flagged = roomPhotos.filter((p) => p.flagged);
        if (flagged.length > 0) {
          await supabase.from("rooms").update({ overall_condition: "poor" }).eq("id", room.id);
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
          await supabase.from("rooms").update({ overall_condition: "good" }).eq("id", room.id);
        }
      }

      await supabase
        .from("inspections")
        .update({ status: "completed", completed_at: new Date().toISOString() })
        .eq("id", inspectionId);

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });
      if (!res.ok) throw new Error("Generation failed");

      setGenerated(true);
      showToast("✅ Report generated!");
    } catch {
      showToast("❌ Error generating report");
    } finally {
      setGenerating(false);
    }
  };

  const accentColor = inspectionType === "check-in" ? "#9A88FD" : "#FF8A65";

  // ═══════════════════════════════════════════════
  return (
    <>
      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── TOAST ── */}
      {toast && (
        <div
          style={{
            position: "fixed", top: 20, left: "50%", transform: "translateX(-50%)",
            background: "rgba(26,26,46,0.92)", color: "#FEDE80",
            padding: "10px 20px", borderRadius: 100,
            fontSize: 13, fontWeight: 700, zIndex: 999,
            backdropFilter: "blur(12px)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
            whiteSpace: "nowrap",
          }}
        >
          {toast}
        </div>
      )}

      {/* ═══ SETUP SCREEN ═══ */}
      {screen === "rooms" && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "white" }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100 flex-shrink-0">
            <button type="button" onClick={() => router.back()}
              className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center">
              <ChevronLeft size={18} className="text-gray-600" />
            </button>
            <div className="text-center">
              <p className="font-bold text-sm" style={{ fontFamily: "Poppins,sans-serif" }}>
                {buildingName}, Unit {unitNumber}
              </p>
              <p className="text-xs font-semibold" style={{ color: accentColor }}>
                {inspectionType === "check-in" ? "🟢 Check-in" : "🟡 Check-out"}
              </p>
            </div>
            <div className="w-9" />
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto no-scrollbar px-4 pt-5 pb-44">
            <p className="text-xl font-bold mb-1" style={{ fontFamily: "Poppins,sans-serif" }}>
              What type of property?
            </p>
            <p className="text-sm text-gray-400 mb-5">Select type to pre-fill rooms, then customize</p>

            {/* Type pills */}
            <div
              className="no-scrollbar mb-5"
              style={{
                display: "flex",
                gap: 8,
                overflowX: "auto",
                paddingBottom: 4,
                marginLeft: -16,
                marginRight: -16,
                paddingLeft: 16,
                paddingRight: 16,
                WebkitOverflowScrolling: "touch",
              }}
            >
              {Object.keys(ROOM_TEMPLATES).map((type) => (
                <button key={type} type="button" onClick={() => handleTypeSelect(type)}
                  style={{
                    flexShrink: 0,
                    padding: "8px 16px",
                    borderRadius: 10,
                    border: "none",
                    background: selectedType === type
                      ? "linear-gradient(135deg, #9A88FD, #7B65FC)"
                      : "#f0f0f5",
                    color: selectedType === type ? "white" : "#666",
                    fontWeight: 700,
                    fontSize: 13,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    boxShadow: selectedType === type ? "0 4px 12px rgba(154,136,253,0.3)" : "none",
                  }}>
                  {type}
                </button>
              ))}
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-gray-100" />
              <p className="text-xs text-gray-400 font-medium">{selectedRooms.length} rooms selected</p>
              <div className="flex-1 h-px bg-gray-100" />
            </div>

            {/* Room chips */}
            <div className="flex flex-wrap gap-2 mb-6">
              {ALL_ROOMS.map((room) => {
                const isSelected = selectedRooms.includes(room);
                return (
                  <button key={room} type="button" onClick={() => toggleRoom(room)}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                    style={{
                      background: isSelected ? "#9A88FD" : "#f5f5f5",
                      color: isSelected ? "white" : "#666",
                      boxShadow: isSelected ? "0 2px 8px rgba(154,136,253,0.25)" : "none",
                    }}>
                    <span style={{ fontSize: 16 }}>{getRoomEmoji(room)}</span>
                    {room}
                    {isSelected && (
                      <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-white text-xs">✓</span>
                    )}
                  </button>
                );
              })}
              {selectedRooms.filter((r) => !ALL_ROOMS.includes(r)).map((room) => (
                <button key={room} type="button" onClick={() => toggleRoom(room)}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all active:scale-95"
                  style={{ background: "#9A88FD", color: "white", boxShadow: "0 2px 8px rgba(154,136,253,0.25)" }}>
                  <span style={{ fontSize: 16 }}>{getRoomEmoji(room)}</span>
                  {room}
                  <span className="w-4 h-4 rounded-full bg-white/30 flex items-center justify-center text-white text-xs">✓</span>
                </button>
              ))}
            </div>

            {/* Custom room input */}
            <div className="flex gap-2">
              <input value={customRoom} onChange={(e) => setCustomRoom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                placeholder="+ Add a custom room..."
                className="flex-1 h-11 px-4 rounded-xl text-sm border-2 border-dashed border-gray-200 focus:border-[#9A88FD] focus:outline-none"
                style={{ color: "#1a1a1a" }}
              />
              <button type="button" onClick={() => {
                  if (customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                className="w-11 h-11 rounded-xl font-bold text-lg text-white flex-shrink-0 flex items-center justify-center"
                style={{ background: "#9A88FD" }}>
                +
              </button>
            </div>
          </div>

          {/* Bottom CTA */}
          <div className="fixed bottom-16 left-0 right-0 z-20"
            style={{
              background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
              borderTop: "1px solid #f0f0f0", padding: "12px 16px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}>
            {selectedRooms.length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar mb-2.5">
                {selectedRooms.map((room) => (
                  <span key={room} className="flex-shrink-0 text-xs px-2.5 py-1 rounded-full font-medium"
                    style={{ background: "#F0EDFF", color: "#7B65FC" }}>
                    {getRoomEmoji(room)} {room}
                  </span>
                ))}
              </div>
            )}
            <button type="button"
              onClick={() => selectedRooms.length > 0 && handleStartInspection()}
              disabled={selectedRooms.length === 0 || creatingRooms}
              style={{
                width: "100%", height: 52, borderRadius: 14, border: "none",
                background: selectedRooms.length > 0
                  ? "linear-gradient(135deg,#9A88FD,#7B65FC)" : "#e5e7eb",
                color: selectedRooms.length > 0 ? "white" : "#9ca3af",
                fontWeight: 700, fontSize: 15,
                cursor: selectedRooms.length > 0 ? "pointer" : "default",
              }}>
              {creatingRooms
                ? "Creating rooms..."
                : selectedRooms.length > 0
                  ? `Start inspection → ${selectedRooms.length} rooms`
                  : "Select at least 1 room"}
            </button>
          </div>
        </div>
      )}

      {/* ═══ INSPECT SCREEN ═══ */}
      {screen === "inspect" && (
        <div style={{
          position: "fixed", inset: 0, background: "#0e0e14",
          display: "flex", flexDirection: "column",
          paddingBottom: "env(safe-area-inset-bottom, 0px)",
          zIndex: 50,
        }}>
          {/* Top bar */}
          <div style={{ background: "#0e0e14", padding: "16px 16px 8px", flexShrink: 0 }}>
            <div className="flex items-center justify-between mb-3">
              <button type="button" onClick={() => setScreen("rooms")} className="text-white/60">
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
              <button type="button" onClick={() => setScreen("review")}
                className="text-xs font-semibold px-3 py-1.5 rounded-lg"
                style={{
                  background: totalPhotos > 0 ? "#9A88FD" : "rgba(255,255,255,0.1)",
                  color: "white",
                }}>
                Review
              </button>
            </div>

            {/* Room pills */}
            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {liveRooms.map((room, i) => {
                const rp = photos[i] || [];
                const hasFlagged = rp.some((p) => p.flagged);
                const isActive = i === activeRoom;
                return (
                  <button key={room.id} type="button" onClick={() => setActiveRoom(i)}
                    className="flex-shrink-0 px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all relative"
                    style={{
                      background: isActive ? accentColor
                        : rp.length > 0 ? "rgba(202,254,135,0.15)" : "rgba(255,255,255,0.08)",
                      color: isActive ? "white" : rp.length > 0 ? "#cafe87" : "rgba(255,255,255,0.5)",
                    }}>
                    {room.name}
                    {rp.length > 0 && <span className="ml-1 opacity-60">({rp.length})</span>}
                    {hasFlagged && !isActive && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-orange-400" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Progress bar */}
            <div className="h-1 rounded-full overflow-hidden mt-1" style={{ background: "rgba(255,255,255,0.06)" }}>
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${progressPct}%`, background: "linear-gradient(90deg, #9A88FD, #cafe87)" }} />
            </div>
          </div>

          {/* Camera zone */}
          <div className="relative mx-4 mt-3 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ height: 200, background: "#1a1a2e" }}>
            <div className="absolute inset-6 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <label className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                style={{ background: "rgba(255,255,255,0.08)", border: `3px solid ${accentColor}` }}>
                <div className="w-10 h-10 rounded-full" style={{ background: accentColor }} />
                <input type="file" accept="image/*" capture="environment" className="hidden" multiple
                  onChange={(e) => handlePhotoCapture(e.target.files)} />
              </label>
              <p className="text-[10px] text-white/30 mt-3">Tap to capture</p>
            </div>
          </div>

          {/* Photo dock */}
          <div className="flex-1 px-4 pt-4 overflow-y-auto no-scrollbar" style={{ paddingBottom: 16 }}>
            {roomCurrentPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-30">
                <Camera size={40} className="text-white mb-3" />
                <p className="text-white text-xs">Tap the shutter to capture</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {roomCurrentPhotos.map((photo) => (
                  <PhotoCard key={photo.id} photo={photo}
                    onToggleFlag={() => toggleFlag(photo.id)}
                    onTagAdd={(tag) => addTag(photo.id, tag)} />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ REVIEW SCREEN ═══ */}
      {screen === "review" && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#fafafa" }}>
          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto no-scrollbar pb-44">
            <div className="px-6 pt-6 pb-4">
              <button type="button" onClick={() => setScreen("inspect")}
                className="text-sm mb-4 flex items-center gap-1" style={{ color: "#8888a0" }}>
                <ChevronLeft size={18} /> Back to capture
              </button>
              <h2 className="text-2xl font-bold mb-1"
                style={{ fontFamily: "Poppins,sans-serif", color: "#1a1a2e" }}>
                {inspectionType === "check-in" ? "Check-in Review" : "Check-out Review"}
              </h2>
              <p className="text-sm mb-4" style={{ color: "#8888a0" }}>
                {buildingName}, Unit {unitNumber}
              </p>

              {/* Stats row */}
              <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
                {[
                  { label: "Rooms", value: liveRooms.length, color: "#9A88FD" },
                  { label: "Photos", value: totalPhotos, color: "#cafe87" },
                  { label: "Flags", value: totalFlags, color: totalFlags > 0 ? "#FF6E40" : "#cafe87" },
                ].map((s) => (
                  <div key={s.label} style={{
                    flex: 1, padding: "12px 8px", borderRadius: 14, textAlign: "center",
                    background: `${s.color}18`,
                  }}>
                    <p style={{ fontSize: 22, fontWeight: 800, color: s.color, margin: 0 }}>{s.value}</p>
                    <p style={{ fontSize: 10, fontWeight: 600, color: "#888", margin: "2px 0 0" }}>{s.label}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Generated banner */}
            {generated && (
              <div style={{
                margin: "0 16px 16px", background: "#cafe87", borderRadius: 16, padding: "14px 16px",
                display: "flex", alignItems: "center", gap: 12,
              }}>
                <span style={{ fontSize: 28 }}>✅</span>
                <div>
                  <p style={{ fontFamily: "Poppins,sans-serif", fontWeight: 800, fontSize: 15, margin: 0, color: "#3a5a1c" }}>
                    Report ready!
                  </p>
                  <p style={{ fontSize: 12, margin: "2px 0 0", color: "#5a7a2e" }}>
                    Tap &quot;View Report&quot; or send for signature
                  </p>
                </div>
              </div>
            )}

            {/* Room cards */}
            <div className="px-4">
              {liveRooms.map((room, i) => {
                const rp = photos[i] || [];
                const flags = rp.filter((p) => p.flagged);
                return (
                  <div key={room.id} className="mb-4 rounded-2xl p-4"
                    style={{
                      background: "white",
                      border: `1px solid ${flags.length > 0 ? "rgba(255,110,64,0.3)" : "#eee"}`,
                      boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
                    }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{
                          background: rp.length > 0 ? (flags.length > 0 ? "#FF6E40" : "#cafe87") : "#ddd",
                        }} />
                        <span className="text-sm font-semibold text-gray-900">{room.name}</span>
                      </div>
                      <span className="text-xs text-gray-400">
                        {rp.length} photo{rp.length !== 1 ? "s" : ""}
                        {flags.length > 0 ? ` · ${flags.length} flag${flags.length !== 1 ? "s" : ""}` : ""}
                      </span>
                    </div>
                    {rp.length > 0 ? (
                      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                        {rp.map((photo) => (
                          <div key={photo.id} className="relative flex-shrink-0 w-20 h-20 rounded-xl overflow-hidden"
                            style={{ border: photo.flagged ? "2px solid #FF6E40" : "1px solid #eee" }}>
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={photo.src} alt="" className="w-full h-full object-cover" />
                            {photo.tags.length > 0 && (
                              <div className="absolute bottom-0 left-0 right-0 bg-black/60 px-1 py-0.5">
                                <span className="text-[7px] text-white">{photo.tags.join(", ")}</span>
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
          </div>

          {/* Bottom action bar */}
          <div className="fixed bottom-16 left-0 right-0 z-20"
            style={{
              background: "rgba(255,255,255,0.97)", backdropFilter: "blur(12px)",
              borderTop: "1px solid #f0f0f0", padding: "12px 16px",
              paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            }}>
            {!generated ? (
              <button type="button" onClick={handleGenerateReport} disabled={generating}
                style={{
                  width: "100%", height: 56, borderRadius: 16, border: "none",
                  background: generating ? "#e5e7eb" : "linear-gradient(135deg, #9A88FD, #7B65FC)",
                  color: generating ? "#9ca3af" : "white",
                  fontWeight: 800, fontSize: 16,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                  cursor: generating ? "default" : "pointer",
                }}>
                {generating ? (
                  <>
                    <div style={{
                      width: 18, height: 18, borderRadius: "50%",
                      border: "2px solid #9ca3af", borderTopColor: "transparent",
                      animation: "spin 0.8s linear infinite",
                    }} />
                    Generating report...
                  </>
                ) : (
                  <>✨ Generate Report</>
                )}
              </button>
            ) : (
              <div style={{ display: "flex", gap: 10 }}>
                <button type="button"
                  onClick={() => router.push(`/inspection/${inspectionId}/report`)}
                  style={{
                    flex: 1, height: 52, borderRadius: 14, border: "none",
                    background: "linear-gradient(135deg,#9A88FD,#7B65FC)",
                    color: "white", fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}>
                  📄 View Report
                </button>
                <button type="button"
                  onClick={() => router.push(`/inspection/${inspectionId}/report`)}
                  style={{
                    flex: 1, height: 52, borderRadius: 14, border: "none",
                    background: "#cafe87", color: "#3a5a1c",
                    fontWeight: 700, fontSize: 14, cursor: "pointer",
                  }}>
                  ✍️ Send for Signature
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
