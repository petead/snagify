"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import {
  ChevronLeft,
  Check,
  Camera,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

// ─── Types ───────────────────────────────────────
type RoomData = {
  id: string;
  name: string;
  order_index: number | null;
  existingPhotos: { id: string; url: string; ai_analysis: string | null; damage_tags: string[]; notes: string | null }[];
};

type PhotoItem = {
  id: string;
  room_id: string;
  url: string;
  damage_tags: string[];
  notes: string;
  isUploading: boolean;
  uploadFailed: boolean;
};

type GeoCoords = { lat: number; lng: number };

function getGeoCoords(): Promise<GeoCoords | null> {
  if (typeof navigator === "undefined" || !navigator.geolocation) return Promise.resolve(null);
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(null), 8000);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(timeout);
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      () => {
        clearTimeout(timeout);
        resolve(null);
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 30000 }
    );
  });
}

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
  "Living / Bedroom", "Study / Office",
];

const DAMAGE_TAGS = [
  "scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak",
];

// ─── Helpers ─────────────────────────────────────
// ─── PhotoCard ───────────────────────────────────
function PhotoCard({
  photo,
  onTagToggle,
  onDelete,
}: {
  photo: PhotoItem;
  onTagToggle: (tag: string) => void;
  onDelete: () => void;
}) {
  const [open, setOpen] = useState(false);
  const hasDamage = photo.damage_tags.length > 0;
  const isAnalyzing = photo.notes === "Analyzing...";

  const modal = open && typeof document !== "undefined"
    ? createPortal(
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 9999,
            background: "rgba(10,10,20,0.97)",
            display: "flex", flexDirection: "column",
            paddingBottom: "env(safe-area-inset-bottom, 0px)",
          }}
        >
          {/* Header */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "16px 16px 12px",
            flexShrink: 0,
          }}>
            <p style={{
              fontSize: 13, fontWeight: 700, color: "rgba(255,255,255,0.9)",
              margin: 0,
            }}>
              Photo details
            </p>
            <button
              type="button"
              onClick={() => setOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: "50%",
                border: "none", cursor: "pointer",
                background: "rgba(255,255,255,0.1)",
                color: "white", fontSize: 18, fontWeight: 700,
                display: "flex", alignItems: "center", justifyContent: "center",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Photo */}
          <div style={{
            flex: 1, padding: "0 16px",
            display: "flex", flexDirection: "column",
            gap: 16, overflowY: "auto",
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={photo.url}
              alt=""
              style={{
                width: "100%", borderRadius: 16,
                objectFit: "cover", maxHeight: 280,
              }}
            />

            {/* AI Notes */}
            {photo.notes && !isAnalyzing && (
              <div style={{
                padding: "12px 14px", borderRadius: 12,
                background: "rgba(255,255,255,0.07)",
              }}>
                <p style={{
                  fontSize: 11, fontWeight: 700,
                  color: "rgba(255,255,255,0.35)",
                  textTransform: "uppercase", letterSpacing: 0.5,
                  marginBottom: 6,
                }}>
                  AI Description
                </p>
                <p style={{
                  fontSize: 13, color: "rgba(255,255,255,0.8)",
                  lineHeight: 1.5, margin: 0,
                }}>
                  {photo.notes}
                </p>
              </div>
            )}

            {/* Damage Tags */}
            <div style={{
              padding: "12px 14px", borderRadius: 12,
              background: "rgba(255,255,255,0.07)",
            }}>
              <p style={{
                fontSize: 11, fontWeight: 700,
                color: "rgba(255,255,255,0.35)",
                textTransform: "uppercase", letterSpacing: 0.5,
                marginBottom: 10,
              }}>
                Tag damage
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {DAMAGE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onTagToggle(tag)}
                    style={{
                      padding: "8px 14px", borderRadius: 8, border: "none",
                      cursor: "pointer", fontSize: 12, fontWeight: 700,
                      background: photo.damage_tags.includes(tag)
                        ? "#FEDE80" : "rgba(255,255,255,0.1)",
                      color: photo.damage_tags.includes(tag)
                        ? "#1a1a2e" : "rgba(255,255,255,0.5)",
                      transition: "all 0.15s",
                    }}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            {/* Delete button */}
            <button
              type="button"
              onClick={() => { onDelete(); setOpen(false); }}
              style={{
                width: "100%", padding: "14px",
                borderRadius: 12, border: "none", cursor: "pointer",
                background: "rgba(239,68,68,0.12)",
                color: "#ef4444", fontSize: 13, fontWeight: 700,
              }}
            >
              Delete photo
            </button>

            {/* Spacer */}
            <div style={{ height: 16 }} />
          </div>
        </div>,
        document.body
      )
    : null;

  return (
    <>
      {modal}
      <div style={{ marginBottom: 2 }}>
        {/* Thumbnail */}
        <div
          onClick={() => !photo.isUploading && setOpen(true)}
          style={{
            position: "relative",
            aspectRatio: "1",
            borderRadius: 10,
            overflow: "hidden",
            border: hasDamage
              ? "2px solid rgba(255,110,64,0.8)"
              : "2px solid rgba(202,254,135,0.2)",
            cursor: photo.isUploading ? "default" : "pointer",
            background: "#1a1a2e",
          }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo.url}
            alt=""
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
            style={{
              width: "100%", height: "100%", objectFit: "cover",
              opacity: photo.isUploading ? 0.35 : 1,
              transition: "opacity 0.25s",
            }}
          />

          {/* Uploading spinner */}
          {photo.isUploading && (
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <div style={{
                width: 22, height: 22, borderRadius: "50%",
                border: "2px solid rgba(255,255,255,0.15)",
                borderTopColor: "white",
                animation: "spin 0.7s linear infinite",
              }} />
            </div>
          )}

          {/* Badge top-right */}
          {!photo.isUploading && (
            <div style={{
              position: "absolute", top: 4, right: 4,
              minWidth: 18, height: 18, borderRadius: 9,
              background: hasDamage ? "#ef4444" : "#cafe87",
              display: "flex", alignItems: "center", justifyContent: "center",
              padding: "0 4px",
            }}>
              {hasDamage ? (
                <span style={{ fontSize: 9, fontWeight: 900, color: "white" }}>
                  {photo.damage_tags.length}
                </span>
              ) : (
                <Check size={9} color="#1a1a2e" strokeWidth={3} />
              )}
            </div>
          )}

          {/* Damage tags overlay bottom */}
          {hasDamage && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              background: "linear-gradient(transparent, rgba(0,0,0,0.75))",
              padding: "10px 4px 4px",
              display: "flex", flexWrap: "wrap", gap: 2,
            }}>
              {photo.damage_tags.slice(0, 2).map((t) => (
                <span key={t} style={{
                  fontSize: 7, fontWeight: 800, padding: "1px 4px",
                  borderRadius: 3, background: "rgba(239,68,68,0.9)",
                  color: "white", textTransform: "uppercase",
                }}>
                  {t}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Notes below thumbnail — truncated, always visible */}
        {photo.isUploading ? (
          <p style={{ fontSize: 10, color: "rgba(255,255,255,0.3)", margin: "4px 2px 0", fontStyle: "italic" }}>
            Uploading...
          </p>
        ) : isAnalyzing ? (
          <p style={{ fontSize: 10, color: "rgba(154,136,253,0.7)", margin: "4px 2px 0", fontStyle: "italic" }}>
            Analyzing...
          </p>
        ) : photo.notes ? (
          <p style={{
            fontSize: 10, color: "rgba(255,255,255,0.7)", margin: "4px 2px 0",
            lineHeight: 1.3,
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            overflow: "hidden",
          } as React.CSSProperties}>
            {photo.notes}
          </p>
        ) : null}
      </div>
    </>
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
  const [activeReviewRoom, setActiveReviewRoom] = useState(0);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
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
  const [navigating, setNavigating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const deletedPhotoIds = useRef<Set<string>>(new Set());

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

  // Pre-select existing room names on mount + detect matching template
  useEffect(() => {
    if (initialRooms.length > 0 && selectedRooms.length === 0) {
      const names = initialRooms.map((r) => r.name);
      setSelectedRooms(names);
      const matchedType =
        Object.entries(ROOM_TEMPLATES).find(
          ([, roomList]) =>
            roomList.length === names.length &&
            roomList.every((r) => names.includes(r))
        )?.[0] ?? null;
      setSelectedType(matchedType);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRooms]);

  // Load existing photos from DB on mount (single source of truth)
  useEffect(() => {
    if (liveRooms.length === 0) return;
    const loadPhotos = async () => {
      const roomIds = liveRooms.map((r) => r.id);
      const { data } = await supabase
        .from("photos")
        .select("id, room_id, url, damage_tags, notes")
        .in("room_id", roomIds)
        .order("taken_at", { ascending: true });
      if (data) {
        setPhotos((prev) => {
          const localById: Record<string, PhotoItem> = {};
          for (const p of prev) localById[p.id] = p;
          return data
            .filter((p) => !deletedPhotoIds.current.has(p.id))
            .map((p) => {
              const local = localById[p.id];
              return {
                id: p.id,
                room_id: p.room_id,
                url: p.url,
                damage_tags: local
                  ? local.damage_tags
                  : Array.isArray(p.damage_tags) ? p.damage_tags : [],
                notes: local ? local.notes : (p.notes ?? ""),
                isUploading: false,
                uploadFailed: false,
              };
            });
        });
      }
    };
    loadPhotos();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRooms.map((r) => r.id).join(",")]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  const showToast = (msg: string) => setToast(msg);

  // ── Derived (currentRoom = selected room for dock and handlers)
  const currentRoom = liveRooms[activeRoom] ?? null;
  const currentRoomId = currentRoom?.id;
  const roomCurrentPhotos = photos.filter((p) => p.room_id === currentRoomId);
  const totalPhotos = photos.length;
  const damagedPhotos = photos.filter((p) => p.damage_tags?.length > 0).length;
  const roomsWithPhotos = liveRooms.filter((room) =>
    photos.some((p) => p.room_id === room.id)
  ).length;
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
    // Do NOT reset photos — loadPhotos useEffect will reload from DB
    setActiveRoom(0);
    setCreatingRooms(false);
    setScreen("inspect");
  };

  const handlePhotoCapture = async (base64: string, roomId: string, roomName: string) => {
    const localBase64 = base64;
    const localRoomId = roomId;
    const localRoomName = roomName;
    const tempId = `temp_${Date.now()}`;

    // ── STEP 1: Show preview immediately
    setPhotos((prev) => [...prev, {
      id: tempId,
      room_id: localRoomId,
      url: localBase64,
      damage_tags: [],
      notes: "Uploading...",
      isUploading: true,
      uploadFailed: false,
    }]);

    try {
      // ── STEP 2: Upload to Supabase Storage
      const fileName = `inspections/${inspectionId}/${localRoomId}/${Date.now()}.jpg`;
      const base64Clean = localBase64.replace(/^data:image\/\w+;base64,/, "");
      const byteCharacters = atob(base64Clean);
      const byteArray = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteArray[i] = byteCharacters.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: "image/jpeg" });

      const { error: storageError } = await supabase.storage
        .from("inspection-photos")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });

      if (storageError) throw new Error(`Storage: ${storageError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("inspection-photos")
        .getPublicUrl(fileName);
      console.log("Storage publicUrl:", publicUrl);
      if (!publicUrl || !publicUrl.includes("/storage/v1/object/public/inspection-photos/")) {
        throw new Error("Storage: invalid public URL");
      }

      // ── STEP 3: Insert photo in DB
      const coords = await getGeoCoords();
      const { data: newPhoto, error: dbError } = await supabase
        .from("photos")
        .insert({
          room_id: localRoomId,
          url: publicUrl,
          damage_tags: [],
          notes: "",
          taken_at: new Date().toISOString(),
          gps_lat: coords?.lat ?? null,
          gps_lng: coords?.lng ?? null,
        })
        .select("id")
        .single();

      if (dbError) throw new Error(`DB: ${dbError.message}`);
      const realPhotoId = newPhoto.id;

      // ── STEP 4: Replace temp with real URL, show "Analyzing..."
      setPhotos((prev) => prev.map((p) =>
        p.id === tempId
          ? { ...p, id: realPhotoId, url: publicUrl, isUploading: false, notes: "Analyzing..." }
          : p
      ));

      // ── STEP 5: Call AI — await it so notes update right after
      try {
        const res = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: localBase64,
            photoId: realPhotoId,
            roomName: localRoomName,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          // Update state with AI result
          setPhotos((prev) => prev.map((p) =>
            p.id === realPhotoId
              ? {
                  ...p,
                  notes: data.ai_analysis || "",
                  damage_tags: Array.isArray(data.damage_tags) && data.damage_tags.length > 0
                    ? data.damage_tags
                    : [],
                }
              : p
          ));
        } else {
          // AI failed — just clear "Analyzing..."
          setPhotos((prev) => prev.map((p) =>
            p.id === realPhotoId ? { ...p, notes: "" } : p
          ));
        }
      } catch {
        setPhotos((prev) => prev.map((p) =>
          p.id === realPhotoId ? { ...p, notes: "" } : p
        ));
      }

    } catch (err) {
      console.error("Photo capture error:", err);
      // Keep photo visible but mark upload failed
      setPhotos((prev) => prev.map((p) =>
        p.id === tempId
          ? { ...p, isUploading: false, notes: "Upload failed" }
          : p
      ));
    }
  };

  useEffect(() => {
    if (screen !== "review") return;
    if (liveRooms.length === 0) return;
    const reload = async () => {
      const roomIds = liveRooms.map((r) => r.id);
      const { data } = await supabase
        .from("photos")
        .select("id, room_id, url, damage_tags, notes")
        .in("room_id", roomIds)
        .order("taken_at", { ascending: true });
      if (data && data.length > 0) {
        setPhotos((prev) => {
          const localById: Record<string, PhotoItem> = {};
          for (const p of prev) localById[p.id] = p;

          return data
            .filter((p) => !deletedPhotoIds.current.has(p.id))
            .map((p) => {
              const local = localById[p.id];
              return {
                id: p.id,
                room_id: p.room_id,
                url: p.url,
                damage_tags: local
                  ? local.damage_tags
                  : Array.isArray(p.damage_tags) ? p.damage_tags : [],
                notes: local ? local.notes : (p.notes ?? ""),
                isUploading: false,
                uploadFailed: false,
              };
            });
        });
      }
    };
    reload();
    setActiveReviewRoom(0);
  }, [screen]); // eslint-disable-line react-hooks/exhaustive-deps

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || !currentRoom) return;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const base64: string = await new Promise((res) => {
        const reader = new FileReader();
        reader.onload = () => res(reader.result as string);
        reader.readAsDataURL(file);
      });

      if (!base64.startsWith("data:image")) {
        console.error("Invalid base64:", base64.substring(0, 50));
        return;
      }

      await handlePhotoCapture(base64, currentRoom.id, currentRoom.name);
    }

    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    if (input) input.value = "";
  };

  const handlePhotoTap = (_photo: PhotoItem) => {
    // Placeholder for future fullscreen/photo actions
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    deletedPhotoIds.current.add(photoId);

    setPhotos((prev) => prev.filter((p) => p.id !== photoId));

    if (photoId.startsWith("temp_")) return;

    try {
      const { error } = await supabase
        .from("photos")
        .delete()
        .eq("id", photoId);

      if (error) {
        console.error("PHOTO DELETE FAILED:", error.message, "photoId:", photoId);
        return;
      } else {
        console.log("Photo deleted from DB:", photoId);
      }

      const urlParts = photoUrl.split("/inspection-photos/");
      if (urlParts.length > 1) {
        const filePath = decodeURIComponent(urlParts[1].split("?")[0]);
        const { error: storageError } = await supabase.storage
          .from("inspection-photos")
          .remove([filePath]);
        if (storageError) {
          console.error("Storage delete failed:", storageError);
        }
      }
    } catch (err) {
      console.error("Delete photo error:", err);
    }
  };

  const handleNotesChange = (photoId: string, value: string) => {
    setPhotos((prev) => prev.map((p) => (p.id === photoId ? { ...p, notes: value } : p)));
    const existing = notesTimers.current[photoId];
    if (existing) clearTimeout(existing);
    notesTimers.current[photoId] = setTimeout(async () => {
      if (photoId.startsWith("temp_")) return;
      await supabase.from("photos").update({ notes: value }).eq("id", photoId);
    }, 600);
  };

  // ── Add/remove damage tag (persist to DB when photo has real id)
  const handleTagToggle = async (photoId: string, tag: string) => {
    let newTags: string[] = [];
    setPhotos((prev) =>
      prev.map((p) => {
        if (p.id !== photoId) return p;
        const hasTag = p.damage_tags.includes(tag);
        newTags = hasTag
          ? p.damage_tags.filter((t) => t !== tag)
          : [...p.damage_tags, tag];
        return { ...p, damage_tags: newTags };
      })
    );

    if (photoId.startsWith("temp_")) return;
    console.log("Saving tags to DB:", photoId, newTags);
    const { data, error } = await supabase
      .from("photos")
      .update({ damage_tags: newTags })
      .eq("id", photoId)
      .select("id, damage_tags");

    if (error) {
      console.error("TAG SAVE FAILED:", error.message, error.code, error.details);
    } else {
      console.log("TAG SAVED OK:", data);
    }
  };

  // ── Generate report (from review screen)
  const handleGenerateReport = async () => {
    if (generating || navigating) return;
    setGenerating(true);

    for (const [photoId, timer] of Object.entries(notesTimers.current)) {
      clearTimeout(timer);
      const photo = photos.find((p) => p.id === photoId);
      if (photo && !photo.id.startsWith("temp_")) {
        await supabase.from("photos").update({ notes: photo.notes }).eq("id", photo.id);
      }
    }
    notesTimers.current = {};
    try {
      for (const room of liveRooms) {
        const roomPhotos = photos.filter((p) => p.room_id === room.id);
        const hasDamages = roomPhotos.some((p) => p.damage_tags?.length > 0);
        await supabase
          .from("rooms")
          .update({ overall_condition: hasDamages ? "poor" : "good" })
          .eq("id", room.id);
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

      setNavigating(true);
      router.push(`/inspection/${inspectionId}/report`);
      return;
    } catch {
      showToast("❌ Error generating report");
      setGenerating(false);
      setNavigating(false);
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

      {/* ═══ ROOMS SCREEN ═══ */}
      {screen === "rooms" && (
        <div style={{ minHeight: "100vh", background: "white", display: "flex", flexDirection: "column" }}>

          {/* Sticky header */}
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            background: "white", borderBottom: "1px solid #f0f0f0",
            padding: "14px 16px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <button type="button" onClick={() => router.back()} style={{
                width: 34, height: 34, borderRadius: "50%", border: "none",
                background: "#f5f5f5", cursor: "pointer", display: "flex",
                alignItems: "center", justifyContent: "center",
              }}>
                <ChevronLeft size={18} color="#555" />
              </button>
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontFamily: "Poppins, sans-serif", fontWeight: 700,
                  fontSize: 14, margin: 0, color: "#1a1a1a",
                }}>
                  {buildingName}, Unit {unitNumber}
                </p>
                <p style={{
                  fontSize: 12, fontWeight: 600, margin: "2px 0 0",
                  color: inspectionType === "check-in" ? "#9A88FD" : "#FF8A65",
                }}>
                  {inspectionType === "check-in" ? "● Check-in" : "● Check-out"}
                </p>
              </div>
              <div style={{ width: 34 }} />
            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: "auto", padding: "20px 16px 180px" }}>

            {/* Quick templates label */}
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Quick templates
            </p>

            {/* Type pills */}
            <div style={{
              display: "flex", gap: 8, overflowX: "auto",
              marginLeft: -16, marginRight: -16,
              paddingLeft: 16, paddingRight: 16,
              paddingBottom: 4, marginBottom: 20,
              scrollbarWidth: "none",
              WebkitOverflowScrolling: "touch",
            } as React.CSSProperties}>
              {Object.keys(ROOM_TEMPLATES).map((type) => (
                <button key={type} type="button"
                  onClick={() => { setSelectedType(type); setSelectedRooms(ROOM_TEMPLATES[type]); }}
                  style={{
                    flexShrink: 0,
                    padding: "8px 18px",
                    borderRadius: 100,
                    border: `2px solid ${selectedType === type ? "#9A88FD" : "#e5e7eb"}`,
                    background: selectedType === type ? "#9A88FD" : "white",
                    color: selectedType === type ? "white" : "#555",
                    fontWeight: 700, fontSize: 13,
                    cursor: "pointer", whiteSpace: "nowrap",
                    transition: "all 0.15s",
                  }}>
                  {type}
                </button>
              ))}
            </div>

            {/* Rooms count label */}
            <p style={{
              fontSize: 11, fontWeight: 700, color: "#9ca3af",
              textTransform: "uppercase", letterSpacing: 1, marginBottom: 10,
            }}>
              Select rooms ({selectedRooms.length} selected)
            </p>

            {/* Room chips grid */}
            <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
              {[...ALL_ROOMS, ...selectedRooms.filter((r) => !ALL_ROOMS.includes(r))].map((room) => {
                const isSelected = selectedRooms.includes(room);
                return (
                  <button key={room} type="button" onClick={() => toggleRoom(room)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 10,
                      border: `1.5px solid ${isSelected ? "#9A88FD" : "#e5e7eb"}`,
                      background: isSelected ? "#9A88FD" : "white",
                      color: isSelected ? "white" : "#374151",
                      fontWeight: 600, fontSize: 13,
                      cursor: "pointer", transition: "all 0.15s",
                      boxShadow: isSelected ? "0 2px 8px rgba(154,136,253,0.25)" : "none",
                    }}>
                    {room}
                  </button>
                );
              })}
            </div>

            {/* Custom room input */}
            <div style={{ display: "flex", gap: 8 }}>
              <input
                value={customRoom}
                onChange={(e) => setCustomRoom(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                placeholder="+ Add a custom room..."
                style={{
                  flex: 1, height: 44, padding: "0 16px",
                  borderRadius: 10, fontSize: 13, color: "#374151",
                  border: "1.5px dashed #d1d5db",
                  outline: "none", background: "white",
                  fontFamily: "DM Sans, sans-serif",
                }}
              />
              <button type="button"
                onClick={() => {
                  if (customRoom.trim()) {
                    setSelectedRooms((prev) => [...prev, customRoom.trim()]);
                    setCustomRoom("");
                  }
                }}
                style={{
                  width: 44, height: 44, borderRadius: 10, border: "none",
                  background: "#9A88FD", color: "white",
                  fontWeight: 700, fontSize: 20, cursor: "pointer",
                }}>
                +
              </button>
            </div>
          </div>

          {/* Fixed bottom bar */}
          <div style={{
            position: "fixed", bottom: 64, left: 0, right: 0,
            background: "rgba(255,255,255,0.97)",
            borderTop: "1px solid #f0f0f0",
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
            zIndex: 20,
          }}>
            {selectedRooms.length > 0 && (
              <div style={{
                display: "flex", gap: 6, overflowX: "auto",
                marginBottom: 10, paddingBottom: 2,
                scrollbarWidth: "none",
              } as React.CSSProperties}>
                {selectedRooms.map((room) => (
                  <span key={room} style={{
                    flexShrink: 0, fontSize: 11, fontWeight: 600,
                    padding: "4px 10px", borderRadius: 100,
                    background: "#F0EDFF", color: "#7B65FC",
                    whiteSpace: "nowrap",
                  }}>
                    {room}
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
                  ? "linear-gradient(135deg, #9A88FD, #7B65FC)"
                  : "#e5e7eb",
                color: selectedRooms.length > 0 ? "white" : "#9ca3af",
                fontFamily: "Poppins, sans-serif",
                fontWeight: 700, fontSize: 15,
                cursor: selectedRooms.length > 0 ? "pointer" : "default",
                transition: "all 0.2s",
              }}>
              {creatingRooms
                ? "Creating rooms..."
                : selectedRooms.length > 0
                  ? `Continue → ${selectedRooms.length} rooms selected`
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
                const rp = photos.filter((p) => p.room_id === room.id);
                const hasDamages = rp.some((p) => p.damage_tags?.length > 0);
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
                    {hasDamages && !isActive && (
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
                  ref={fileInputRef}
                  onChange={async (e) => {
                    await handlePhotoFiles(e.target.files);
                    if (fileInputRef.current) fileInputRef.current.value = "";
                  }} />
              </label>
              <p className="text-[10px] text-white/30 mt-3">Tap to capture</p>
            </div>
          </div>

          {/* Photo dock — uses PhotoCard for expand/tag/notes */}
          <div
            className="flex-1 overflow-y-auto no-scrollbar"
            style={{ padding: "12px 0 16px" }}
          >
            {roomCurrentPhotos.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 opacity-30">
                <Camera size={40} className="text-white mb-3" />
                <p className="text-white text-xs">Tap the shutter to capture</p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(3, 1fr)",
                  gap: 6,
                  padding: "0 16px",
                }}
              >
                {roomCurrentPhotos.map((photo) => (
                  <PhotoCard
                    key={photo.id}
                    photo={photo}
                    onTagToggle={(tag) => handleTagToggle(photo.id, tag)}
                    onDelete={() => handleDeletePhoto(photo.id, photo.url)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ═══ REVIEW SCREEN ═══ */}
      {screen === "review" && (
        <div className="fixed inset-0 z-40 flex flex-col" style={{ background: "#fafafa" }}>

          {/* ── STICKY HEADER ── */}
          <div style={{
            background: "white",
            borderBottom: "1px solid #f0f0f0",
            padding: "14px 16px 0",
            flexShrink: 0,
            position: "sticky", top: 0, zIndex: 10,
          }}>
            {/* Top row */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
              <button type="button" onClick={() => setScreen("inspect")}
                style={{
                  display: "flex", alignItems: "center", gap: 4,
                  background: "none", border: "none", cursor: "pointer",
                  color: "#8888a0", fontSize: 13, fontWeight: 600,
                }}>
                <ChevronLeft size={18} /> Capture
              </button>

              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontFamily: "Poppins, sans-serif", fontWeight: 700,
                  fontSize: 14, margin: 0, color: "#1a1a2e",
                }}>
                  {buildingName}, Unit {unitNumber}
                </p>
                <p style={{
                  fontSize: 11, fontWeight: 700, margin: "2px 0 0",
                  color: inspectionType === "check-in" ? "#9A88FD" : "#FF8A65",
                }}>
                  {inspectionType === "check-in" ? "Check-in Review" : "Check-out Review"}
                </p>
              </div>

              {/* Stats badge */}
              <div style={{
                display: "flex", gap: 8, alignItems: "center",
              }}>
                <div style={{
                  fontSize: 11, fontWeight: 700, padding: "4px 10px",
                  borderRadius: 100, background: damagedPhotos > 0 ? "#fff0f0" : "#f0fff4",
                  color: damagedPhotos > 0 ? "#ef4444" : "#22c55e",
                }}>
                  {damagedPhotos > 0 ? `${damagedPhotos} damage${damagedPhotos > 1 ? "s" : ""}` : "No damage"}
                </div>
              </div>
            </div>

            {/* Room pills */}
            <div style={{
              display: "flex", gap: 8, overflowX: "auto",
              paddingBottom: 12, scrollbarWidth: "none",
              marginLeft: -16, paddingLeft: 16,
              marginRight: -16, paddingRight: 16,
            } as React.CSSProperties}>
              {liveRooms.map((room, i) => {
                const rp = photos.filter((p) => p.room_id === room.id);
                const hasDamages = rp.some((p) => p.damage_tags?.length > 0);
                const isActive = i === activeReviewRoom;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveReviewRoom(i)}
                    style={{
                      flexShrink: 0,
                      padding: "8px 16px",
                      borderRadius: 100,
                      border: "none",
                      cursor: "pointer",
                      fontSize: 12, fontWeight: 700,
                      whiteSpace: "nowrap",
                      transition: "all 0.15s",
                      position: "relative",
                      background: isActive
                        ? (inspectionType === "check-in" ? "#9A88FD" : "#FF8A65")
                        : rp.length > 0 ? "#f5f5f5" : "#f0f0f0",
                      color: isActive ? "white" : rp.length > 0 ? "#374151" : "#9ca3af",
                    }}
                  >
                    {room.name}
                    {rp.length > 0 && (
                      <span style={{ marginLeft: 5, opacity: 0.7, fontSize: 11 }}>
                        ({rp.length})
                      </span>
                    )}
                    {hasDamages && !isActive && (
                      <span style={{
                        position: "absolute", top: 2, right: 2,
                        width: 7, height: 7, borderRadius: "50%",
                        background: "#FF6E40",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ── ROOM CONTENT ── */}
          {(() => {
            const room = liveRooms[activeReviewRoom];
            if (!room) return null;
            const roomPhotos = photos.filter((p) => p.room_id === room.id);
            const hasDamages = roomPhotos.some((p) => p.damage_tags.length > 0);

            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 160px" }}>

                {/* Room header */}
                <div style={{
                  display: "flex", alignItems: "center", gap: 10,
                  marginBottom: 16,
                }}>
                  <div style={{
                    width: 10, height: 10, borderRadius: "50%",
                    background: roomPhotos.length === 0 ? "#ddd"
                      : hasDamages ? "#FF6E40" : "#cafe87",
                  }} />
                  <span style={{
                    fontFamily: "Poppins, sans-serif",
                    fontWeight: 700, fontSize: 18, color: "#1a1a2e",
                  }}>
                    {room.name}
                  </span>
                  <span style={{ fontSize: 12, color: "#9ca3af", fontWeight: 500 }}>
                    {roomPhotos.length} photo{roomPhotos.length !== 1 ? "s" : ""}
                  </span>
                </div>

                {/* Photos */}
                {roomPhotos.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                    {roomPhotos.map((photo) => (
                      <div key={photo.id} style={{
                        background: "white",
                        borderRadius: 16,
                        padding: 12,
                        boxShadow: "0 1px 8px rgba(0,0,0,0.06)",
                        border: photo.damage_tags.length > 0
                          ? "1.5px solid rgba(255,110,64,0.3)"
                          : "1.5px solid #f0f0f0",
                      }}>
                        {/* Photo */}
                        <div style={{ position: "relative", marginBottom: 10 }}>
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={photo.url}
                            alt=""
                            style={{
                              width: "100%",
                              aspectRatio: "16/9",
                              objectFit: "cover",
                              borderRadius: 10,
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id, photo.url)}
                            style={{
                              position: "absolute", top: 8, right: 8,
                              width: 28, height: 28, borderRadius: "50%",
                              border: "none", cursor: "pointer",
                              background: "rgba(0,0,0,0.55)",
                              color: "white", fontSize: 16, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ×
                          </button>
                        </div>

                        {/* Damage tags */}
                        {photo.damage_tags.length > 0 && (
                          <div style={{
                            display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10,
                          }}>
                            {photo.damage_tags.map((tag) => (
                              <span key={tag} style={{
                                fontSize: 11, fontWeight: 700,
                                padding: "4px 10px", borderRadius: 100,
                                background: "#fff0f0", color: "#ef4444",
                                textTransform: "uppercase", letterSpacing: 0.5,
                              }}>
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Notes textarea */}
                        <textarea
                          value={photo.notes ?? ""}
                          onChange={(e) => handleNotesChange(photo.id, e.target.value)}
                          placeholder="AI description — tap to edit..."
                          rows={Math.max(2, Math.ceil((photo.notes?.length || 0) / 45))}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 10,
                            border: "1.5px solid #e5e7eb",
                            fontSize: 13,
                            color: "#374151",
                            fontFamily: "DM Sans, sans-serif",
                            lineHeight: 1.5,
                            resize: "none",
                            outline: "none",
                            boxSizing: "border-box",
                            background: photo.notes ? "white" : "#fafafa",
                          }}
                        />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{
                    display: "flex", flexDirection: "column",
                    alignItems: "center", justifyContent: "center",
                    padding: "60px 20px", opacity: 0.4,
                  }}>
                    <Camera size={40} color="#9ca3af" />
                    <p style={{ color: "#9ca3af", fontSize: 13, marginTop: 12 }}>
                      No photos for this room
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setActiveRoom(activeReviewRoom);
                        setScreen("inspect");
                      }}
                      style={{
                        marginTop: 16, padding: "10px 20px",
                        borderRadius: 100, border: "none", cursor: "pointer",
                        background: "#9A88FD", color: "white",
                        fontSize: 13, fontWeight: 700,
                      }}
                    >
                      Add photos
                    </button>
                  </div>
                )}

                {/* Prev / Next room navigation */}
                {liveRooms.length > 1 && (
                  <div style={{
                    display: "flex", gap: 10, marginTop: 20,
                  }}>
                    {activeReviewRoom > 0 && (
                      <button
                        type="button"
                        onClick={() => setActiveReviewRoom(activeReviewRoom - 1)}
                        style={{
                          flex: 1, height: 44, borderRadius: 12,
                          border: "1.5px solid #e5e7eb",
                          background: "white", color: "#374151",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        ← {liveRooms[activeReviewRoom - 1]?.name}
                      </button>
                    )}
                    {activeReviewRoom < liveRooms.length - 1 && (
                      <button
                        type="button"
                        onClick={() => setActiveReviewRoom(activeReviewRoom + 1)}
                        style={{
                          flex: 1, height: 44, borderRadius: 12,
                          border: "none",
                          background: "linear-gradient(135deg, #9A88FD22, #9A88FD33)",
                          color: "#7B65FC",
                          fontSize: 13, fontWeight: 700, cursor: "pointer",
                        }}
                      >
                        {liveRooms[activeReviewRoom + 1]?.name} →
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* ── BOTTOM BAR ── */}
          <div style={{
            position: "fixed", bottom: 64, left: 0, right: 0, zIndex: 20,
            background: "rgba(255,255,255,0.97)",
            backdropFilter: "blur(12px)",
            borderTop: "1px solid #f0f0f0",
            padding: "12px 16px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}>
            {/* Mini stats row */}
            <div style={{
              display: "flex", gap: 8, marginBottom: 10, justifyContent: "center",
            }}>
              {[
                { label: "Rooms", value: liveRooms.length, color: "#9A88FD" },
                { label: "Photos", value: totalPhotos, color: "#1a1a2e" },
                { label: "Damages", value: damagedPhotos, color: damagedPhotos > 0 ? "#ef4444" : "#22c55e" },
              ].map((s) => (
                <div key={s.label} style={{
                  display: "flex", alignItems: "center", gap: 4,
                  fontSize: 12, fontWeight: 700,
                }}>
                  <span style={{ color: s.color }}>{s.value}</span>
                  <span style={{ color: "#9ca3af" }}>{s.label}</span>
                  <span style={{ color: "#e5e7eb", marginLeft: 4 }}>·</span>
                </div>
              ))}
            </div>

            <button
              type="button"
              onClick={handleGenerateReport}
              disabled={generating || navigating}
              style={{
                width: "100%", height: 52, borderRadius: 14, border: "none",
                background: (generating || navigating)
                  ? "#e5e7eb"
                  : "linear-gradient(135deg, #9A88FD, #7B65FC)",
                color: (generating || navigating) ? "#9ca3af" : "white",
                fontFamily: "Poppins, sans-serif",
                fontWeight: 800, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: (generating || navigating) ? "default" : "pointer",
              }}
            >
              {navigating ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid #9ca3af", borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Opening report...
                </>
              ) : generating ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid #9ca3af", borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Generating...
                </>
              ) : (
                "Generate Report"
              )}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
