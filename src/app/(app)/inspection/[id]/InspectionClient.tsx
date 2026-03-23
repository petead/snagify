"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { Check, Camera } from "lucide-react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import GhostCamera from "@/components/GhostCamera";
import { assertValidDimensions } from "@/lib/getImageDimensions";
import { compressPhoto, compressPhotoDataUrl } from "@/lib/compressPhoto";
import { CheckoutCreditConfirmModal } from "@/components/inspection/CheckoutCreditConfirmModal";
import { ProGateSheet } from "@/components/ProGateSheet";
import { checkProAccess, type ProAccessState } from "@/lib/checkProAccess";
import { trackAction } from "@/lib/breadcrumb";

// ─── Types ───────────────────────────────────────
type RoomData = {
  id: string;
  name: string;
  order_index: number | null;
  condition: string | null;
  existingPhotos: { id: string; url: string; ai_analysis: string | null; damage_tags: string[]; notes: string | null }[];
};

type PhotoItem = {
  id: string;
  room_id: string;
  url: string;
  width: number | null;
  height: number | null;
  damage_tags: string[];
  notes: string;
  isUploading: boolean;
  uploadFailed: boolean;
  checkin_photo_id?: string | null;
  is_additional?: boolean;
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

type GhostPhoto = {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  zoom_level?: number | null;
  damage_tags?: string[];
  ai_analysis?: string | null;
};

interface Props {
  inspectionId: string;
  propertyId: string;
  inspectionType: string;
  buildingName: string;
  unitNumber: string;
  rooms: RoomData[];
  initialKeyHandover?: { item: string; qty: number }[];
  initialCheckinKeyHandover?: { item: string; qty: number }[];
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

function creditActionFor(
  inspectionType: "check-in" | "check-out",
  accountType: "pro" | "individual"
) {
  return accountType === "pro"
    ? inspectionType === "check-in"
      ? "pro_checkin"
      : "pro_checkout"
    : inspectionType === "check-in"
      ? "individual_checkin"
      : "individual_checkout";
}

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
            <div style={{ position: "relative", width: "100%", maxHeight: 280, aspectRatio: "4/3", borderRadius: 16, overflow: "hidden" }}>
              <Image
                src={photo.url}
                alt=""
                fill
                sizes="100vw"
                style={{ objectFit: "cover", borderRadius: 16 }}
              />
            </div>

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
          <Image
            src={photo.url}
            alt=""
            fill
            sizes="(max-width: 768px) 50vw, 25vw"
            style={{
              objectFit: "cover",
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
  propertyId,
  inspectionType,
  buildingName,
  unitNumber,
  rooms: initialRooms,
  initialKeyHandover = [],
  initialCheckinKeyHandover = [],
}: Props) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const isCheckout = inspectionType === "check-out";

  const [liveRooms, setLiveRooms] = useState<RoomData[]>(initialRooms);
  const [activeRoom, setActiveRoom] = useState(0);
  const [activeReviewRoom, setActiveReviewRoom] = useState<string | null>(null);
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [screen, setScreen] = useState<"rooms" | "inspect" | "review">(
    initialRooms.length > 0 ? "inspect" : "rooms"
  );
  const [toast, setToast] = useState<string | null>(null);

  const [keyHandover, setKeyHandover] = useState<{ item: string; qty: number }[]>([]);

  // Keys inline edit mode
  const [editingKeys, setEditingKeys] = useState(false);
  const [editableKeys, setEditableKeys] = useState<Array<{ item: string; qty: number }>>([]);
  const [savingKeys, setSavingKeys] = useState(false);

  function startEditKeys(keyItems: Array<{ item: string; qty: number }>) {
    setEditableKeys(keyItems.map(k => ({ ...k })));
    setEditingKeys(true);
  }

  async function saveKeys() {
    setSavingKeys(true);
    try {
      const { error } = await supabase
        .from("inspections")
        .update({ key_handover: editableKeys })
        .eq("id", inspectionId);

      if (error) throw error;

      setKeyHandover(editableKeys);
      setEditingKeys(false);
    } catch (err) {
      console.error("Failed to save keys:", err);
    } finally {
      setSavingKeys(false);
    }
  }

  // Check-out ghost overlay: room name → check-in photos
  const [checkinGhostMap, setCheckinGhostMap] = useState<Record<string, GhostPhoto[]>>({});
  const [checkinInspectionId, setCheckinInspectionId] = useState<string | null>(null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [landscapePhotoError, setLandscapePhotoError] = useState(false);

  // Setup state
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [selectedRooms, setSelectedRooms] = useState<string[]>([]);
  const [customRoom, setCustomRoom] = useState("");
  const [creatingRooms, setCreatingRooms] = useState(false);

  // Report generation (review screen)
  const [generating, setGenerating] = useState(false);
  const [navigating, setNavigating] = useState(false);
  const [showCompletenessWarning, setShowCompletenessWarning] = useState(false);
  const [showCreditConfirm, setShowCreditConfirm] = useState(false);
  const [liveCredits, setLiveCredits] = useState<number | null>(null);
  const [creditCost, setCreditCost] = useState(1);
  const [openingCreditModal, setOpeningCreditModal] = useState(false);
  const [showProGate, setShowProGate] = useState(false);
  const [gateState, setGateState] = useState<ProAccessState>("ok");
  const [gateBalance, setGateBalance] = useState(0);
  const [gatePlan, setGatePlan] = useState("free");
  const [gateCost, setGateCost] = useState(0);
  const [gateActionLabel, setGateActionLabel] = useState("Generate Report");
  const [showAbandonConfirm, setShowAbandonConfirm] = useState(false);
  const [abandonPortalMounted, setAbandonPortalMounted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const notesTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const tagsTimers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const deletedPhotoIds = useRef<Set<string>>(new Set());

  // Lock body scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    trackAction(`Viewed Inspection ${inspectionId.slice(0, 8)}`);
    return () => { document.body.style.overflow = ""; };
  }, [inspectionId]);

  useEffect(() => {
    setAbandonPortalMounted(true);
  }, []);

  useEffect(() => {
    const update = () => setIsLandscape(window.innerWidth > window.innerHeight);
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
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

  // Initialize key handover from server when present
  useEffect(() => {
    if (initialKeyHandover.length > 0) {
      setKeyHandover(initialKeyHandover);
    }
  }, [initialKeyHandover]);

  // Scroll to top on any screen change
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [screen]);

  /** Fresh balance + cost from DB, then open the confirm sheet (avoids stale 0 balance flash). */
  async function openCheckoutCreditConfirmModal() {
    setOpeningCreditModal(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const profileRes = await supabase
        .from("profiles")
        .select("account_type, company:companies(credits_balance)")
        .eq("id", user.id)
        .single();

      const profileAccountType =
        profileRes.data?.account_type === "individual" ? "individual" : "pro";
      const action = creditActionFor(
        inspectionType === "check-in" ? "check-in" : "check-out",
        profileAccountType
      );

      const costRes = await supabase
        .from("credit_costs")
        .select("credits")
        .eq("action", action)
        .eq("is_active", true)
        .single();

      if (profileRes.error) {
        setToast("Could not load credit balance");
        return;
      }

      const balance =
        (profileRes.data?.company as { credits_balance?: number } | null)
          ?.credits_balance ?? 0;
      setLiveCredits(balance);
      setCreditCost(Number(costRes.data?.credits ?? 1) || 1);
      setShowCreditConfirm(true);
    } finally {
      setOpeningCreditModal(false);
    }
  }

  async function openProGateForReport() {
    setOpeningCreditModal(true);
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type, company_id")
        .eq("id", user.id)
        .single();

      const accountType = profile?.account_type === "individual" ? "individual" : "pro";
      const inspType = inspectionType === "check-in" ? "check-in" : "check-out";
      const action =
        accountType === "pro"
          ? inspType === "check-in"
            ? "pro_checkin"
            : "pro_checkout"
          : inspType === "check-in"
            ? "individual_checkin"
            : "individual_checkout";

      const { data: costData } = await supabase
        .from("credit_costs")
        .select("credits")
        .eq("action", action)
        .eq("is_active", true)
        .single();
      const cost = Number(costData?.credits ?? 1) || 1;

      if (accountType !== "pro") {
        if (inspType === "check-in") {
          await handleGenerateReport();
          return;
        }
        setCreditCost(cost);
        await openCheckoutCreditConfirmModal();
        return;
      }

      if (!profile?.company_id) {
        setToast("Could not verify company access");
        return;
      }
      const access = await checkProAccess(profile.company_id, cost, supabase);
      setGateState(access.state);
      setGateBalance(access.balance);
      setGateCost(cost);
      setGatePlan(access.plan);
      setGateActionLabel(
        `Generate ${inspType === "check-in" ? "Check-in" : "Check-out"} Report`
      );
      setShowProGate(true);
    } finally {
      setOpeningCreditModal(false);
    }
  }

  // Fetch credit cost from DB with account-type specific action.
  useEffect(() => {
    if (!isCheckout) return;
    const fetchCost = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("account_type")
        .eq("id", user.id)
        .single();

      const accountType = profile?.account_type === "individual" ? "individual" : "pro";
      const action = creditActionFor("check-out", accountType);
      const { data } = await supabase
        .from("credit_costs")
        .select("credits")
        .eq("action", action)
        .eq("is_active", true)
        .single();

      setCreditCost(Number(data?.credits ?? 1) || 1);
    };
    void fetchCost();
  }, [isCheckout, supabase]);

  const showToast = (msg: string) => setToast(msg);

  // ── Derived (currentRoom = selected room for dock and handlers)
  const currentRoom = liveRooms[activeRoom] ?? null;
  const currentRoomId = currentRoom?.id;
  const roomCurrentPhotos = photos.filter((p) => p.room_id === currentRoomId);
  const totalPhotos = photos.length;

  const navigateToProperty = () => {
    router.push(`/property/${propertyId}`);
  };

  const handleAbandonHeaderClick = () => {
    if (totalPhotos > 0) {
      setShowAbandonConfirm(true);
    } else {
      navigateToProperty();
    }
  };

  const damagedPhotos = photos.filter((p) => p.damage_tags?.length > 0).length;
  const roomsWithPhotos = liveRooms.filter((room) =>
    photos.some((p) => p.room_id === room.id)
  ).length;
  const progressPct = liveRooms.length > 0 ? (roomsWithPhotos / liveRooms.length) * 100 : 0;

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
        .select("id, room_id, url, width, height, zoom_level, damage_tags, notes, checkin_photo_id, is_additional")
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
                width: (p as { width?: number | null }).width ?? null,
                height: (p as { height?: number | null }).height ?? null,
                damage_tags: local
                  ? local.damage_tags
                  : Array.isArray(p.damage_tags) ? p.damage_tags : [],
                notes: local ? local.notes : (p.notes ?? ""),
                isUploading: false,
                uploadFailed: false,
                checkin_photo_id: (p as { checkin_photo_id?: string | null }).checkin_photo_id ?? null,
                is_additional: (p as { is_additional?: boolean }).is_additional ?? false,
              };
            });
        });
      }
    };
    loadPhotos();
// eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveRooms.map((r) => r.id).join(",")]);

  // Check-out: fetch linked check-in inspection and build ghost map (room name → photos)
  useEffect(() => {
    if (inspectionType !== "check-out" || !propertyId) return;
    const loadCheckinGhost = async () => {
      const { data: checkinInspection } = await supabase
        .from("inspections")
        .select("id")
        .eq("property_id", propertyId)
        .eq("type", "check-in")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!checkinInspection) return;

      const { data: checkinRooms } = await supabase
        .from("rooms")
        .select(
          `
          id,
          name,
          photos (
            id,
            url,
            width,
            height,
            zoom_level,
            damage_tags,
            ai_analysis
          )
        `
        )
        .eq("inspection_id", checkinInspection.id);

      const ghostMap: Record<string, GhostPhoto[]> = {};
      (checkinRooms ?? []).forEach((room: { name: string; photos?: GhostPhoto[] }) => {
        if (room.photos?.length) {
          const key = room.name.toLowerCase().trim();
          ghostMap[key] = room.photos.map((p) => ({
            id: p.id,
            url: p.url,
            width: (p as { width?: number | null }).width ?? null,
            height: (p as { height?: number | null }).height ?? null,
            zoom_level: (p as { zoom_level?: number | null }).zoom_level ?? null,
            damage_tags: p.damage_tags,
            ai_analysis: p.ai_analysis,
          }));
        }
      });
      setCheckinGhostMap(ghostMap);
      setCheckinInspectionId(checkinInspection.id);
    };
    loadCheckinGhost();
  }, [inspectionType, propertyId, supabase]);

  // Toast auto-dismiss
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 2000);
      return () => clearTimeout(t);
    }
  }, [toast]);

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
      condition: null,
      existingPhotos: [],
    }));
    setLiveRooms(mapped);
    // Do NOT reset photos — loadPhotos useEffect will reload from DB
    setActiveRoom(0);
    setCreatingRooms(false);
    setScreen("inspect");
  };

  const handlePhotoCapture = async (
    imageInput: string | Blob,
    roomId: string,
    roomName: string,
    checkinPhotoId?: string | null,
    isAdditional: boolean = false,
    prefillDamageTags: string[] = [],
    /** Camera zoom at capture (1 = default; check-in file upload uses 1). */
    captureZoomLevel: number = 1
  ) => {
    const localPreviewUrl =
      typeof imageInput === "string" ? imageInput : URL.createObjectURL(imageInput);
    const localRoomId = roomId;
    const localRoomName = roomName;
    const tempId = `temp_${Date.now()}`;

    // ── STEP 1: Show preview immediately
    setPhotos((prev) => [...prev, {
      id: tempId,
      room_id: localRoomId,
      url: localPreviewUrl,
      width: null,
      height: null,
      damage_tags: [...prefillDamageTags],
      notes: "Uploading...",
      isUploading: true,
      uploadFailed: false,
    }]);

    try {
      // ── STEP 2: Upload to Supabase Storage ({userId}/inspectionId/roomId/...)
      const {
        data: { user },
        error: authUserErr,
      } = await supabase.auth.getUser();
      if (authUserErr || !user?.id) {
        throw new Error(authUserErr?.message || "Not authenticated");
      }
      const userId = user.id;
      const fileName = `${userId}/${inspectionId}/${localRoomId}/${Date.now()}.jpg`;
      let blob: Blob;
      let localBase64: string;

      let dimensions: { width: number; height: number };

      if (typeof imageInput === "string") {
        if (!imageInput.startsWith("data:image")) {
          throw new Error("Invalid image data URL");
        }
        const compressed = await compressPhotoDataUrl(imageInput, {
          maxDimension: 1920,
          quality: 0.82,
        });
        blob = compressed.blob;
        dimensions = { width: compressed.width, height: compressed.height };
        localBase64 = compressed.dataUrl;
      } else {
        const compressed = await compressPhoto(imageInput, {
          maxDimension: 1920,
          quality: 0.82,
        });
        blob = compressed.blob;
        dimensions = { width: compressed.width, height: compressed.height };
        localBase64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });
      }

      assertValidDimensions(dimensions, "inspection photo blob");

      const { error: storageError } = await supabase.storage
        .from("inspection-photos")
        .upload(fileName, blob, { contentType: "image/jpeg", upsert: false });

      if (storageError) throw new Error(`Storage: ${storageError.message}`);

      const { data: { publicUrl } } = supabase.storage
        .from("inspection-photos")
        .getPublicUrl(fileName);
      
      if (!publicUrl || !publicUrl.includes("/storage/v1/object/public/inspection-photos/")) {
        throw new Error("Storage: invalid public URL");
      }

      // ── STEP 3: Insert photo in DB
      const coords = await getGeoCoords();
      const insertPayload = {
        room_id: localRoomId,
        url: publicUrl,
        width: dimensions.width,
        height: dimensions.height,
        zoom_level: captureZoomLevel,
        damage_tags: [...prefillDamageTags],
        notes: "",
        taken_at: new Date().toISOString(),
        gps_lat: coords?.lat ?? null,
        gps_lng: coords?.lng ?? null,
        checkin_photo_id: checkinPhotoId ?? null,
        is_additional: isAdditional,
      };
      let { data: newPhoto, error: dbError } = await supabase
        .from("photos")
        .insert(insertPayload)
        .select("id")
        .single();

      if (dbError) {
        console.error("[photos insert] DB ERROR:", dbError.message, dbError.details);
        const missingNewColumns =
          /checkin_photo_id|is_additional|zoom_level/i.test(dbError.message ?? "");
        if (missingNewColumns) {
          console.warn(
            "[photos insert] Missing columns in DB. Run migration for checkin_photo_id/is_additional."
          );
          const fallbackInsert = await supabase
            .from("photos")
            .insert({
              room_id: localRoomId,
              url: publicUrl,
              width: dimensions.width,
              height: dimensions.height,
              damage_tags: [...prefillDamageTags],
              notes: "",
              taken_at: new Date().toISOString(),
              gps_lat: coords?.lat ?? null,
              gps_lng: coords?.lng ?? null,
            })
            .select("id")
            .single();
          newPhoto = fallbackInsert.data;
          dbError = fallbackInsert.error;
        }
      }

      if (dbError || !newPhoto?.id) {
        throw new Error(`DB insert failed: ${dbError?.message ?? "Unknown DB error"}`);
      }
      const realPhotoId = newPhoto.id;

      // ── STEP 4: Replace temp with real URL, show "Analyzing..."
      setPhotos((prev) => prev.map((p) =>
        p.id === tempId
          ? { ...p, id: realPhotoId, url: publicUrl, width: dimensions.width, height: dimensions.height, isUploading: false, uploadFailed: false, notes: "Analyzing..." }
          : p
      ));
      if (localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }

      // ── STEP 5: Call AI — await it so notes update right after
      try {
        const res = await fetch("/api/analyze-photo", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            base64: localBase64,
            photoId: realPhotoId,
            roomName: localRoomName,
            checkinPhotoId: checkinPhotoId ?? null,
            isAdditional,
            prefillDamageTags,
          }),
        });

        if (res.ok) {
          const data = await res.json();
          const aiTags = Array.isArray(data.damage_tags) ? data.damage_tags : [];
          const mergedTags = aiTags.length > 0 ? aiTags : [...prefillDamageTags];
          // Update state with AI result; keep pre-filled check-in tags if AI returns none
          setPhotos((prev) => prev.map((p) =>
            p.id === realPhotoId
              ? {
                  ...p,
                  notes: data.ai_analysis || "",
                  damage_tags: mergedTags,
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
      console.error("[handlePhotoUpload] FULL ERROR:", err);
      console.error(
        "[handlePhotoUpload] Error message:",
        err instanceof Error ? err.message : String(err)
      );
      if (localPreviewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(localPreviewUrl);
      }
      // Keep photo visible but mark upload failed
      setPhotos((prev) => prev.map((p) =>
        p.id === tempId
          ? { ...p, isUploading: false, uploadFailed: true, notes: "Upload failed" }
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
        .select("id, room_id, url, width, height, zoom_level, damage_tags, notes, checkin_photo_id, is_additional")
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
                checkin_photo_id: (p as { checkin_photo_id?: string | null }).checkin_photo_id ?? null,
                is_additional: (p as { is_additional?: boolean }).is_additional ?? false,
                width: (p as { width?: number | null }).width ?? null,
                height: (p as { height?: number | null }).height ?? null,
              };
            });
        });
      }
    };
    reload();
    // Set initial tab to first room
    if (liveRooms.length > 0 && activeReviewRoom === null) {
      setActiveReviewRoom(liveRooms[0].id);
    }
  }, [screen, liveRooms, activeReviewRoom]);

  const handlePhotoFiles = async (files: FileList | null) => {
    if (!files || !currentRoom) return;
    const fileArray = Array.from(files);

    for (const file of fileArray) {
      const isLandscapePhoto = await new Promise<boolean>((resolve) => {
        const img = new Image();
        img.onload = () => {
          resolve(img.naturalWidth > img.naturalHeight);
          URL.revokeObjectURL(img.src);
        };
        img.onerror = () => resolve(false);
        img.src = URL.createObjectURL(file);
      });

      if (isLandscapePhoto) {
        setLandscapePhotoError(true);
        setTimeout(() => setLandscapePhotoError(false), 3500);
        continue;
      }

      // Native check-in camera / file picker — no variable zoom (always 1.0); GhostCamera check-out passes live zoom.
      await handlePhotoCapture(file, currentRoom.id, currentRoom.name, null, false, [], 1);
    }

    const input = document.querySelector('input[type="file"][accept="image/*"]') as HTMLInputElement;
    if (input) input.value = "";
  };

  const handlePhotoTap = (_photo: PhotoItem) => {
    // Placeholder for future fullscreen/photo actions
  };

  const handleDeletePhoto = async (photoId: string, photoUrl: string) => {
    const roomId = photos.find((p) => p.id === photoId)?.room_id;
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
      await fetch("/api/update-photo-tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ photoId, notes: value }),
      });
    }, 600);
  };

  // ── Add/remove damage tag (persist via service-role API; debounce to avoid race)
  const handleTagToggle = async (photoId: string, tag: string) => {
    let capturedTags: string[] = [];

    setPhotos((prev) => {
      const updated = prev.map((p) => {
        if (p.id !== photoId) return p;
        const hasTag = p.damage_tags.includes(tag);
        const newTags = hasTag
          ? p.damage_tags.filter((t) => t !== tag)
          : [...p.damage_tags, tag];
        capturedTags = newTags;
        return { ...p, damage_tags: newTags };
      });
      return updated;
    });

    if (photoId.startsWith("temp_")) return;

    // Debounce the DB save — wait 500ms after last tag toggle
    const existing = tagsTimers.current[photoId];
    if (existing) clearTimeout(existing);

    tagsTimers.current[photoId] = setTimeout(() => {
      setPhotos((prev) => {
        const photo = prev.find((p) => p.id === photoId);
        const finalTags = photo?.damage_tags ?? capturedTags;

        fetch("/api/update-photo-tags", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ photoId, damage_tags: finalTags }),
        })
          .then((res) => res.json())
          .then((data) => {
            if (data.error) {
              console.error("TAG SAVE FAILED:", data.error);
            }
          })
          .catch((err) => console.error("TAG SAVE ERROR:", err));

        return prev;
      });
    }, 500);
  };

  const checkCompleteness = (): string[] => {
    const issues: string[] = [];
    liveRooms.forEach((room) => {
      const checkinPhotos = checkinGhostMap[room.name.toLowerCase().trim()] ?? [];
      if (checkinPhotos.length === 0) return;
      const checkoutPhotos = photos.filter((p) => p.room_id === room.id);
      const coveredCheckinIds = new Set(
        checkoutPhotos.map((p) => p.checkin_photo_id).filter(Boolean) as string[]
      );
      const uncovered = checkinPhotos.filter((p) => !coveredCheckinIds.has(p.id));
      if (checkoutPhotos.length === 0) {
        issues.push(`❌ ${room.name}: no check-out photos taken`);
      } else if (uncovered.length > 0) {
        issues.push(`⚠️ ${room.name}: ${uncovered.length} entry photo(s) not covered`);
      }
    });
    return issues;
  };

  const completenessIssues =
    inspectionType === "check-out" ? checkCompleteness() : [];
  const hasBlockingIssues = completenessIssues.some((i) => i.startsWith("❌"));

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
      await supabase
        .from("inspections")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          key_handover: keyHandover.length > 0 ? keyHandover : [],
        })
        .eq("id", inspectionId);

      const res = await fetch("/api/generate-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inspectionId }),
      });
      if (!res.ok) {
        const errBody = (await res.json().catch(() => ({}))) as {
          error?: string;
          balance?: number;
          credits_needed?: number;
        };
        if (res.status === 402) {
          throw new Error(
            errBody.error ??
              `Insufficient credits (need ${errBody.credits_needed ?? creditCost})`
          );
        }
        throw new Error(errBody.error ?? "Generation failed");
      }

      setNavigating(true);
      trackAction(`Generated ${inspectionType} report`, `/inspection/${inspectionId}/review`);
      router.refresh();
      router.push(`/inspection/${inspectionId}/report`);
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to generate report";
      console.error(
        "[handleGenerateReport] ERROR:",
        err instanceof Error ? err.message : String(err)
      );
      showToast(`❌ ${message}`);
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

      {typeof document !== "undefined" &&
        landscapePhotoError &&
        createPortal(
          <div
            style={{
              position: "fixed",
              bottom: 100,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 9999,
              background: "rgba(239,68,68,0.95)",
              borderRadius: 16,
              padding: "14px 24px",
              display: "flex",
              alignItems: "center",
              gap: 12,
              maxWidth: 320,
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
            }}
          >
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="2" y="7" width="10" height="14" rx="2" />
              <path d="M14 9l3-3 3 3M17 6v8" />
            </svg>
            <div>
              <p
                style={{
                  color: "white",
                  fontSize: 13,
                  fontWeight: 700,
                  margin: 0,
                  fontFamily: "Poppins, sans-serif",
                }}
              >
                Portrait mode required
              </p>
              <p
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 12,
                  margin: "2px 0 0",
                }}
              >
                Please retake in portrait orientation
              </p>
            </div>
          </div>,
          document.body
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
              <button
                type="button"
                onClick={handleAbandonHeaderClick}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                aria-label="Close inspection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
                  borderRadius: 10, fontSize: 16, color: "#374151",
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
              <button
                type="button"
                onClick={handleAbandonHeaderClick}
                className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10"
                aria-label="Close inspection"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
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
                  background: totalPhotos > 0 ? accentColor : "rgba(255,255,255,0.1)",
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
                style={{ width: `${progressPct}%`, background: inspectionType === "check-out" ? "linear-gradient(90deg, #FF8A65, #cafe87)" : "linear-gradient(90deg, #9A88FD, #cafe87)" }} />
            </div>

            {/* Check-out ghost mode banner */}
            {inspectionType === "check-out" && (
              <div
                style={{
                  background: "rgba(255,138,101,0.12)",
                  border: "1px solid rgba(255,138,101,0.3)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  margin: "8px 16px 0",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span style={{ fontSize: 13 }}>👻</span>
                <p style={{ fontSize: 12, color: "#FF8A65", fontWeight: 600, margin: 0 }}>
                  Ghost mode active — entry photos overlaid on camera
                </p>
              </div>
            )}
          </div>

          {/* Camera zone */}
          <div className="relative mx-4 mt-3 rounded-2xl overflow-hidden flex-shrink-0"
            style={{ height: 200, background: "#1a1a2e" }}>
            <div className="absolute inset-6 rounded-xl" style={{ border: "1px solid rgba(255,255,255,0.08)" }} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              {inspectionType === "check-out" ? (
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(true)}
                  className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.08)", border: `3px solid ${accentColor}` }}
                >
                  <Camera size={28} style={{ color: accentColor }} />
                </button>
              ) : (
                <label
                  className="w-16 h-16 rounded-full flex items-center justify-center cursor-pointer transition-all active:scale-90"
                  style={{ background: "rgba(255,255,255,0.08)", border: `3px solid ${accentColor}` }}
                >
                  <div className="w-10 h-10 rounded-full" style={{ background: accentColor }} />
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    multiple
                    ref={fileInputRef}
                    onChange={async (e) => {
                      await handlePhotoFiles(e.target.files);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  />
                </label>
              )}
              <p className="text-[10px] text-white/30 mt-3">
                {inspectionType === "check-out" ? "Tap for camera + ghost overlay" : "Tap to capture"}
              </p>
            </div>
          </div>

          {isCameraOpen && currentRoom && (
            <GhostCamera
              checkinPhotos={
                checkinGhostMap[currentRoom.name?.toLowerCase().trim() ?? ""] ?? []
              }
              roomName={currentRoom.name}
              isCheckout={true}
              initialCoveredIds={
                photos
                  .filter(p => p.room_id === currentRoom.id && p.checkin_photo_id)
                  .map(p => p.checkin_photo_id as string)
              }
              onClose={() => setIsCameraOpen(false)}
              onPhotoTaken={async (blob, linkedCheckinPhotoId, isAdditional, damageTags, captureZoom) => {
                setIsCameraOpen(false);
                await handlePhotoCapture(
                  blob,
                  currentRoom.id,
                  currentRoom.name,
                  linkedCheckinPhotoId,
                  isAdditional,
                  damageTags,
                  captureZoom ?? 1
                );
              }}
            />
          )}

          {typeof document !== "undefined" &&
            isLandscape &&
            (screen === "inspect" || isCameraOpen) &&
            createPortal(
              <div
                style={{
                  position: "fixed",
                  inset: 0,
                  zIndex: 99999,
                  background: "black",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 20,
                }}
              >
                <svg
                  width="52"
                  height="52"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                >
                  <rect x="2" y="7" width="10" height="14" rx="2" />
                  <path d="M14 9l3-3 3 3M17 6v8" />
                </svg>
                <p
                  style={{
                    color: "white",
                    fontSize: 17,
                    fontWeight: 700,
                    fontFamily: "Poppins, sans-serif",
                    textAlign: "center",
                    margin: 0,
                    padding: "0 40px",
                    lineHeight: 1.5,
                  }}
                >
                  Please rotate your phone
                  <br />
                  to portrait mode
                </p>
                <p
                  style={{
                    color: "rgba(255,255,255,0.45)",
                    fontSize: 13,
                    textAlign: "center",
                    margin: 0,
                    padding: "0 40px",
                  }}
                >
                  Photos must be taken in portrait for best results
                </p>
              </div>,
              document.body
            )}

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

          {/* Sticky header */}
          <div style={{
            position: "sticky", top: 0, zIndex: 10,
            background: "rgba(250,250,250,0.97)",
            backdropFilter: "blur(12px)",
            borderBottom: "1px solid #f0f0f0",
            padding: "14px 16px 12px",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              {isCheckout ? (
                <button
                  type="button"
                  onClick={() => router.back()}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                  aria-label="Back"
                >
                  <svg
                    width="18"
                    height="18"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="#111827"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <polyline points="15 18 9 12 15 6" />
                  </svg>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleAbandonHeaderClick}
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100"
                  aria-label="Close inspection"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#555" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              )}
              <div style={{ textAlign: "center" }}>
                <p style={{
                  fontFamily: "Poppins, sans-serif", fontWeight: 700,
                  fontSize: 14, margin: 0, color: "#1a1a2e",
                }}>
                  {buildingName}, Unit {unitNumber}
                </p>
                <p style={{
                  fontSize: 12, fontWeight: 600, margin: "2px 0 0",
                  color: inspectionType === "check-in" ? "#9A88FD" : "#FF8A65",
                }}>
                  {inspectionType === "check-in" ? "● Check-in Review" : "● Check-out Review"}
                </p>
              </div>
              <div style={{ width: 34 }} />
            </div>
          </div>

          <div style={{ padding: "16px 16px 0" }}>
            {/* Room pills + Keys tab */}
            <div style={{
              display: "flex", gap: 8, overflowX: "auto",
              paddingBottom: 12, scrollbarWidth: "none",
              marginLeft: -16, paddingLeft: 16,
              marginRight: -16, paddingRight: 16,
            } as React.CSSProperties}>
              {liveRooms.map((room) => {
                const rp = photos.filter((p) => p.room_id === room.id);
                const hasDamages = rp.some((p) => p.damage_tags?.length > 0);
                const isActive = room.id === activeReviewRoom;
                return (
                  <button
                    key={room.id}
                    type="button"
                    onClick={() => setActiveReviewRoom(room.id)}
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
              {/* Keys tab */}
              <button
                type="button"
                onClick={() => setActiveReviewRoom("keys")}
                style={{
                  flexShrink: 0,
                  padding: "8px 16px",
                  borderRadius: 100,
                  border: "none",
                  cursor: "pointer",
                  fontSize: 12, fontWeight: 700,
                  whiteSpace: "nowrap",
                  transition: "all 0.15s",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  background: activeReviewRoom === "keys"
                    ? (inspectionType === "check-in" ? "#9A88FD" : "#FF8A65")
                    : keyHandover.length > 0 ? "#f5f5f5" : "#f0f0f0",
                  color: activeReviewRoom === "keys" ? "white" : keyHandover.length > 0 ? "#374151" : "#9ca3af",
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
                  <circle cx="7.5" cy="15.5" r="4.5"
                    stroke={activeReviewRoom === "keys" ? "white" : "#9A88FD"}
                    strokeWidth="1.8"/>
                  <path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
                    stroke={activeReviewRoom === "keys" ? "white" : "#9A88FD"}
                    strokeWidth="1.8" strokeLinecap="round"/>
                </svg>
                Keys
                {keyHandover.length > 0 && (
                  <span style={{
                    marginLeft: 2, opacity: 0.7, fontSize: 11,
                    background: activeReviewRoom === "keys" ? "rgba(255,255,255,0.2)" : "#e5e7eb",
                    padding: "1px 6px", borderRadius: 100,
                  }}>
                    {keyHandover.length}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* ── KEYS TAB CONTENT ── */}
          {activeReviewRoom === "keys" && (() => {
            const keyItems = keyHandover;

            function getKeyHandoverIcon(itemName: string) {
              const name = (itemName || "").toLowerCase();

              // Door Keys → key icon
              if (name.includes("door") || name.includes("key")) {
                return (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <circle cx="7.5" cy="15.5" r="4.5" stroke="#9A88FD" strokeWidth="1.8" />
                    <path
                      d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              }

              // Parking Card → car/parking icon
              if (name.includes("parking") || name.includes("car")) {
                return (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="1" y="3" width="15" height="13" rx="2" stroke="#9A88FD" strokeWidth="1.8" />
                    <path
                      d="M16 8h4l3 3v5h-7V8z"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <circle cx="5.5" cy="18.5" r="2.5" stroke="#9A88FD" strokeWidth="1.8" />
                    <circle cx="18.5" cy="18.5" r="2.5" stroke="#9A88FD" strokeWidth="1.8" />
                  </svg>
                );
              }

              // Access Card → fingerprint/badge icon
              if (name.includes("access") || name.includes("fob") || name.includes("badge")) {
                return (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              }

              // Remote Control → remote icon
              if (name.includes("remote") || name.includes("control")) {
                return (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <rect x="7" y="2" width="10" height="20" rx="3" stroke="#9A88FD" strokeWidth="1.8" />
                    <path
                      d="M12 6h.01M12 10h.01M12 14h.01"
                      stroke="#9A88FD"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              }

              // Mailbox → mailbox icon
              if (name.includes("mailbox") || name.includes("mail")) {
                return (
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                    <path
                      d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="M22 6l-10 7L2 6"
                      stroke="#9A88FD"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                );
              }

              // Default → key icon
              return (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <circle cx="7.5" cy="15.5" r="4.5" stroke="#9A88FD" strokeWidth="1.8" />
                  <path
                    d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2"
                    stroke="#9A88FD"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              );
            }

            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 160px" }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
                  <div>
                    <h3 style={{ fontFamily: "Poppins, sans-serif", fontWeight: 800, fontSize: 16, color: "#1a1a2e", margin: 0 }}>
                      Key Handover
                    </h3>
                    <p style={{ fontSize: 12, color: "#9ca3af", margin: "4px 0 0" }}>
                      {inspectionType === "check-in" ? "Items handed over at check-in" : "Keys to be returned"}
                    </p>
                  </div>
                  {!editingKeys ? (
                    <button
                      type="button"
                      onClick={() => startEditKeys(keyItems)}
                      style={{
                        fontSize: 12, fontWeight: 600, color: "#9A88FD",
                        background: "#EDE9FF", padding: "6px 12px", borderRadius: 10,
                        border: "none", cursor: "pointer",
                      }}
                    >
                      Edit
                    </button>
                  ) : (
                    <div style={{ display: "flex", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setEditingKeys(false)}
                        style={{
                          fontSize: 12, fontWeight: 600, color: "#6B7280",
                          background: "#F3F4F6", padding: "6px 12px", borderRadius: 10,
                          border: "none", cursor: "pointer",
                        }}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={saveKeys}
                        disabled={savingKeys}
                        style={{
                          fontSize: 12, fontWeight: 600, color: "white",
                          background: "#9A88FD", padding: "6px 12px", borderRadius: 10,
                          border: "none", cursor: "pointer",
                          opacity: savingKeys ? 0.5 : 1,
                          display: "flex", alignItems: "center", gap: 6,
                        }}
                      >
                        {savingKeys && (
                          <svg className="animate-spin" width="12" height="12" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="10" stroke="white" strokeWidth="2" opacity="0.25"/>
                            <path d="M12 2a10 10 0 0110 10" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                          </svg>
                        )}
                        Save
                      </button>
                    </div>
                  )}
                </div>

                {/* READ MODE */}
                {!editingKeys && (
                  <>
                    {keyItems.length === 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "48px 20px", gap: 16 }}>
                        <div style={{ width: 56, height: 56, background: "#F3F3F8", borderRadius: 16, display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                            <circle cx="7.5" cy="15.5" r="4.5" stroke="#9B9BA8" strokeWidth="1.8"/>
                            <path d="M21 2l-9.6 9.6M15.5 7.5l3 3M18 5l2 2" stroke="#9B9BA8" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </div>
                        <div style={{ textAlign: "center" }}>
                          <p style={{ fontSize: 14, fontWeight: 600, color: "#1a1a2e", margin: "0 0 4px" }}>No keys recorded</p>
                          <p style={{ fontSize: 12, color: "#9ca3af", margin: 0 }}>Tap Edit to add items</p>
                        </div>
                      </div>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                        {keyItems.map((item, i) => (
                          <div key={i} style={{
                            background: "white", borderRadius: 16, border: "1px solid #EEECFF",
                            padding: 16, display: "flex", alignItems: "center", gap: 16,
                          }}>
                            <div style={{
                              width: 40, height: 40, background: "#EDE9FF", borderRadius: 12,
                              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                            }}>
                              {getKeyHandoverIcon(item.item || "")}
                            </div>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1a2e" }}>
                                {item.item}
                              </div>
                            </div>
                            <div style={{
                              background: "#EDE9FF", borderRadius: 12, padding: "6px 12px", flexShrink: 0,
                            }}>
                              <span style={{ fontSize: 15, fontWeight: 800, color: "#9A88FD" }}>
                                ×{item.qty}
                              </span>
                            </div>
                          </div>
                        ))}

                        {/* Summary */}
                        <div style={{
                          background: "#F8F7F4", borderRadius: 16, padding: 12,
                          display: "flex", alignItems: "center", gap: 8, marginTop: 4,
                        }}>
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M9 12l2 2 4-4M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                              stroke="#16A34A" strokeWidth="1.5" strokeLinecap="round"/>
                          </svg>
                          <span style={{ fontSize: 12, color: "#166534", fontWeight: 500 }}>
                            {keyItems.length} item{keyItems.length > 1 ? "s" : ""} recorded ·{" "}
                            {keyItems.reduce((acc, k) => acc + (k.qty ?? 1), 0)} total keys
                          </span>
                        </div>
                      </div>
                    )}
                  </>
                )}

                {/* EDIT MODE */}
                {editingKeys && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                    {editableKeys.map((item, i) => (
                      <div
                        key={i}
                        className="w-full overflow-hidden"
                        style={{
                        background: "white", borderRadius: 16, border: "2px solid rgba(154,136,253,0.2)",
                        padding: 16,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                      }}
                      >
                        {/* Icon */}
                        <div style={{
                          width: 40, height: 40, background: "#EDE9FF", borderRadius: 12,
                          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                        }}>
                          {getKeyHandoverIcon(item.item)}
                        </div>

                        {/* Item name */}
                        <input
                          type="text"
                          value={item.item}
                          onChange={e => {
                            const next = [...editableKeys];
                            next[i] = { ...next[i], item: e.target.value };
                            setEditableKeys(next);
                          }}
                          style={{
                            flex: 1,
                            minWidth: 0,
                            fontSize: 16,
                            fontWeight: 600,
                            color: "#1a1a2e",
                            background: "transparent", border: "none", outline: "none",
                          }}
                          className="flex-1 min-w-0"
                        />

                        {/* Qty controls */}
                        <div
                          className="flex items-center gap-2 flex-shrink-0"
                          style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editableKeys];
                              next[i] = { ...next[i], qty: Math.max(0, next[i].qty - 1) };
                              setEditableKeys(next);
                            }}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 9999,
                              background: "#F3F3F8",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 18,
                              fontWeight: 700,
                              color: "#1a1a2e",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            −
                          </button>
                          <span
                            className="flex-shrink-0"
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: "#9A88FD",
                              width: 24,
                              textAlign: "center",
                            }}
                          >
                            {item.qty}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              const next = [...editableKeys];
                              next[i] = { ...next[i], qty: next[i].qty + 1 };
                              setEditableKeys(next);
                            }}
                            className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center active:scale-95 transition-transform flex-shrink-0"
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: 9999,
                              background: "#EDE9FF",
                              border: "none",
                              cursor: "pointer",
                              fontSize: 18,
                              fontWeight: 700,
                              color: "#9A88FD",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            +
                          </button>
                        </div>

                        {/* Delete item */}
                        <button
                          type="button"
                          onClick={() => {
                            setEditableKeys(prev => prev.filter((_, idx) => idx !== i));
                          }}
                          style={{
                            width: 32, height: 32, borderRadius: 10, background: "#FEF2F2",
                            border: "none", cursor: "pointer", flexShrink: 0,
                            display: "flex", alignItems: "center", justifyContent: "center",
                          }}
                        >
                          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                            <path d="M18 6L6 18M6 6l12 12" stroke="#EF4444" strokeWidth="1.8" strokeLinecap="round"/>
                          </svg>
                        </button>
                      </div>
                    ))}

                    {/* Add item button */}
                    <button
                      type="button"
                      onClick={() => setEditableKeys(prev => [...prev, { item: "New Key", qty: 1 }])}
                      style={{
                        width: "100%", padding: 12, border: "2px dashed rgba(154,136,253,0.3)",
                        borderRadius: 16, background: "transparent", cursor: "pointer",
                        fontSize: 13, fontWeight: 600, color: "#9A88FD",
                        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                      }}
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                        <path d="M12 5v14M5 12h14" stroke="#9A88FD" strokeWidth="2" strokeLinecap="round"/>
                      </svg>
                      Add item
                    </button>
                  </div>
                )}

              </div>
            );
          })()}

          {/* ── ROOM CONTENT ── */}
          {activeReviewRoom !== "keys" && (() => {
            const room = liveRooms.find((r) => r.id === activeReviewRoom);
            if (!room) return null;
            const roomPhotos = photos.filter((p) => p.room_id === room.id);
            const hasDamages = roomPhotos.some((p) => p.damage_tags.length > 0);

            return (
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 160px" }}>

                {/* Room header */}
                {(() => {
                  const conditionColorMap: Record<string, string> = {
                    Excellent: "#4CAF50",
                    Good: "#8BC34A",
                    Fair: "#FF9800",
                    "Needs Attention": "#F44336",
                  };
                  const cond = room.condition ?? null;
                  const condColor = cond ? conditionColorMap[cond] ?? "#9ca3af" : null;
                  return (
                    <div style={{
                      display: "flex", alignItems: "center", gap: 10,
                      marginBottom: 16,
                    }}>
                      <div style={{
                        width: 10, height: 10, borderRadius: "50%",
                        background: condColor ?? (roomPhotos.length === 0 ? "#ddd" : hasDamages ? "#FF6E40" : "#cafe87"),
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
                      {cond && (
                        <span style={{
                          marginLeft: "auto",
                          fontSize: 11,
                          fontWeight: 700,
                          color: condColor ?? "#555",
                          textTransform: "uppercase",
                          letterSpacing: 0.5,
                        }}>
                          {cond}
                        </span>
                      )}
                    </div>
                  );
                })()}

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
                        <div style={{ position: "relative", marginBottom: 8, width: "100%", aspectRatio: "4/3", borderRadius: 12, overflow: "hidden" }}>
                          <Image
                            src={photo.url}
                            alt=""
                            fill
                            sizes="(max-width: 768px) 100vw, 50vw"
                            style={{ objectFit: "cover", borderRadius: 12 }}
                          />

                          {/* Delete button top-right */}
                          <button
                            type="button"
                            onClick={() => handleDeletePhoto(photo.id, photo.url)}
                            style={{
                              position: "absolute", top: 6, right: 6,
                              width: 26, height: 26, borderRadius: "50%",
                              border: "none", cursor: "pointer",
                              background: "rgba(0,0,0,0.55)",
                              color: "white", fontSize: 15, fontWeight: 700,
                              display: "flex", alignItems: "center", justifyContent: "center",
                            }}
                          >
                            ×
                          </button>

                          {/* Damage tags overlay — bottom of photo */}
                          {photo.damage_tags.length > 0 && (
                            <div style={{
                              position: "absolute", bottom: 0, left: 0, right: 0,
                              background: "linear-gradient(transparent, rgba(0,0,0,0.65))",
                              padding: "14px 8px 6px",
                              borderRadius: "0 0 12px 12px",
                              display: "flex", flexWrap: "wrap", gap: 4,
                            }}>
                              {photo.damage_tags.map((tag) => (
                                <span key={tag} style={{
                                  fontSize: 10, fontWeight: 800,
                                  padding: "2px 7px", borderRadius: 100,
                                  background: "rgba(239,68,68,0.85)",
                                  color: "white", textTransform: "uppercase",
                                  letterSpacing: 0.3,
                                }}>
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

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
                            fontSize: 16,
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
                        const roomIndex = liveRooms.findIndex((r) => r.id === activeReviewRoom);
                        if (roomIndex >= 0) setActiveRoom(roomIndex);
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

            {showCompletenessWarning && completenessIssues.length > 0 && (
              <div
                style={{
                  background: "#FFF8F0",
                  border: "1px solid #FF8A65",
                  borderRadius: 12,
                  padding: 16,
                  margin: "12px 16px",
                }}
              >
                <p style={{ fontWeight: 700, color: "#FF8A65", marginBottom: 8 }}>
                  Incomplete Inspection
                </p>
                {completenessIssues.map((issue, i) => (
                  <p key={i} style={{ fontSize: 13, color: "#555", margin: "4px 0" }}>
                    {issue}
                  </p>
                ))}
                <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  {!hasBlockingIssues && (
                    <button
                      type="button"
                      onClick={() => {
                        setShowCompletenessWarning(false);
                        void openProGateForReport();
                      }}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        background: "#FF8A65",
                        color: "white",
                        border: "none",
                        fontWeight: 700,
                        fontSize: 14,
                      }}
                    >
                      Generate anyway
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCompletenessWarning(false)}
                    style={{
                      flex: 1,
                      padding: "10px",
                      borderRadius: 10,
                      background: "#f0f0f0",
                      color: "#333",
                      border: "none",
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    Complete inspection
                  </button>
                </div>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                if (isCheckout && completenessIssues.length > 0) {
                  setShowCompletenessWarning(true);
                } else {
                  void openProGateForReport();
                }
              }}
              disabled={generating || navigating || openingCreditModal}
              style={{
                width: "100%", height: 52, borderRadius: 14, border: "none",
                background: (generating || navigating || openingCreditModal)
                  ? "#e5e7eb"
                  : "linear-gradient(135deg, #9A88FD, #7B65FC)",
                color: (generating || navigating || openingCreditModal) ? "#9ca3af" : "white",
                fontFamily: "Poppins, sans-serif",
                fontWeight: 800, fontSize: 15,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                cursor: (generating || navigating || openingCreditModal) ? "default" : "pointer",
              }}
            >
              {openingCreditModal ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: "50%",
                    border: "2px solid #9ca3af", borderTopColor: "transparent",
                    animation: "spin 0.8s linear infinite",
                  }} />
                  Loading…
                </>
              ) : navigating ? (
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

      {/* Checkout credit confirmation modal */}
      {showCreditConfirm && (
        <CheckoutCreditConfirmModal
          creditsBalance={liveCredits ?? 0}
          creditCost={creditCost}
          inspectionType={inspectionType === "check-in" ? "check-in" : "check-out"}
          onConfirm={async () => {
            setShowCreditConfirm(false);
            await handleGenerateReport();
          }}
          onCancel={() => setShowCreditConfirm(false)}
        />
      )}

      {showProGate && (
        <ProGateSheet
          state={gateState}
          balance={gateBalance}
          plan={gatePlan}
          cost={gateCost}
          actionLabel={gateActionLabel}
          onClose={() => setShowProGate(false)}
          onConfirm={async () => {
            setShowProGate(false);
            await handleGenerateReport();
          }}
        />
      )}

      {abandonPortalMounted &&
        showAbandonConfirm &&
        createPortal(
          <div className="fixed inset-0 z-[9999] flex items-center justify-center px-5">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
              onClick={() => setShowAbandonConfirm(false)}
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="relative z-10 w-full max-w-sm rounded-3xl bg-white p-6"
            >
              <h3 className="mb-2 text-lg font-black text-gray-900">
                {isCheckout ? "Abandon check-out?" : "Abandon check-in?"}
              </h3>
              <p className="mb-6 text-sm leading-relaxed text-gray-500">
                Your progress will be saved as a draft. You can resume this{" "}
                {isCheckout ? "check-out" : "check-in"} from the property page.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowAbandonConfirm(false);
                  navigateToProperty();
                }}
                className="mb-3 w-full rounded-2xl bg-gray-900 py-3.5 text-sm font-bold text-white"
              >
                Yes, leave
              </button>
              <button
                type="button"
                onClick={() => setShowAbandonConfirm(false)}
                className="w-full py-2 text-sm text-gray-400"
              >
                Continue {isCheckout ? "check-out" : "check-in"}
              </button>
            </motion.div>
          </div>,
          document.body
        )}
    </>
  );
}
