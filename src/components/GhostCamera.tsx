"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { getVideoCaptureDimensions } from "@/lib/getImageDimensions";

const ZOOM_PRESETS = [
  { label: "0.5×", value: 0.5 },
  { label: "1×", value: 1 },
  { label: "2×", value: 2 },
  { label: "3×", value: 3 },
] as const;

/** Same list as InspectionClient PhotoCard */
const DAMAGE_TAGS = [
  "scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak",
];

export type GhostPhoto = {
  id: string;
  url: string;
  width?: number | null;
  height?: number | null;
  /** Zoom factor saved at check-in capture (for ghost mode auto-match). */
  zoom_level?: number | null;
  storage_path?: string | null;
  damage_tags?: string[];
  ai_analysis?: string | null;
};

/** height / width (e.g. 1920/1440 ≈ 1.33 portrait); fallback 4:3 when DB has no dimensions. */
function aspectRatioFromPhoto(ph: GhostPhoto | null | undefined): number {
  const w = ph?.width;
  const h = ph?.height;
  if (w && h && w > 0 && h > 0) return h / w;
  return 4 / 3;
}

export interface GhostCameraProps {
  checkinPhotos: GhostPhoto[];
  onPhotoTaken: (
    blob: Blob,
    linkedCheckinPhotoId: string | null,
    isAdditional: boolean,
    damageTags: string[],
    /** Live camera zoom at shutter (saved on check-out photo row). */
    captureZoom?: number
  ) => void;
  onClose: () => void;
  roomName: string;
  isCheckout: boolean;
  initialCoveredIds?: string[];
}

export default function GhostCamera({
  checkinPhotos,
  onPhotoTaken,
  onClose,
  roomName,
  isCheckout,
  initialCoveredIds = [],
}: GhostCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [currentZoom, setCurrentZoom] = useState(1);
  const [hasTorch, setHasTorch] = useState(false);
  const [torchOn, setTorchOn] = useState(false);
  const [zoomCapabilities, setZoomCapabilities] = useState({
    hasZoom: false,
    min: 1,
    max: 1,
  });
  const [ghostOpacity, setGhostOpacity] = useState(0.35);
  const [activeGhostIndex, setActiveGhostIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [coveredCheckinIds, setCoveredCheckinIds] = useState<Set<string>>(
    () => new Set(initialCoveredIds)
  );
  const [isAdditionalMode, setIsAdditionalMode] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [prepopulatedHintVisible, setPrepopulatedHintVisible] = useState(false);
  const [autoZoomApplied, setAutoZoomApplied] = useState(false);

  /** Display + capture: match active entry photo (or 4:3 in “New finding”). */
  const targetAspectRatio = useMemo(() => {
    if (isAdditionalMode) return 4 / 3;
    const ph = checkinPhotos[activeGhostIndex];
    return aspectRatioFromPhoto(ph ?? null);
  }, [isAdditionalMode, activeGhostIndex, checkinPhotos]);

  const activeGhostId = checkinPhotos[activeGhostIndex]?.id;
  const activeGhostZoomLevel = checkinPhotos[activeGhostIndex]?.zoom_level;

  /** Native resolution hints for getUserMedia — match active check-in photo (or defaults). */
  const { photoW, photoH } = useMemo(() => {
    const activePhoto = checkinPhotos[activeGhostIndex] ?? checkinPhotos[0];
    const w = activePhoto?.width;
    const h = activePhoto?.height;
    return {
      photoW: w && w > 0 ? w : 1440,
      photoH: h && h > 0 ? h : 1920,
    };
  }, [checkinPhotos, activeGhostIndex]);

  /** Sync tags from the active check-in ghost photo (entry photo strip / index). */
  useEffect(() => {
    if (!isCheckout) return;
    if (isAdditionalMode) return;
    if (checkinPhotos.length === 0) {
      setSelectedTags([]);
      setPrepopulatedHintVisible(false);
      return;
    }
    const ph = checkinPhotos[activeGhostIndex];
    if (ph?.damage_tags && ph.damage_tags.length > 0) {
      setSelectedTags([...ph.damage_tags]);
      setPrepopulatedHintVisible(true);
    } else {
      setSelectedTags([]);
      setPrepopulatedHintVisible(false);
    }
  }, [isCheckout, isAdditionalMode, activeGhostIndex, checkinPhotos]);

  const zoomPresets = useMemo(() => {
    const { min, max, hasZoom } = zoomCapabilities;
    if (!hasZoom) {
      return [{ label: "1×" as const, value: 1 }];
    }
    const availableZooms = ZOOM_PRESETS.filter((p) => p.value >= min && p.value <= max);
    return availableZooms.length > 0 ? [...availableZooms] : [{ label: "1×" as const, value: 1 }];
  }, [zoomCapabilities]);

  const applyZoom = useCallback(async (value: number) => {
    const track = trackRef.current;
    if (!track) return;
    try {
      const caps = track.getCapabilities() as MediaTrackCapabilities & {
        zoom?: { min?: number; max?: number };
      };
      if (!("zoom" in caps) || caps.zoom == null) return;
      const zMin = caps.zoom.min ?? 1;
      const zMax = caps.zoom.max ?? 1;
      const clamped = Math.min(Math.max(value, zMin), zMax);
      await track.applyConstraints({
        advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
      });
      setCurrentZoom(clamped);
    } catch (e) {
      console.warn("[GhostCamera] Zoom not supported:", e);
    }
  }, []);

  const toggleTorch = useCallback(async () => {
    const track = trackRef.current;
    if (!track || !hasTorch) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet],
      });
      setTorchOn(next);
    } catch (e) {
      console.warn("[GhostCamera] Torch not supported:", e);
    }
  }, [hasTorch, torchOn]);

  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const mediaConstraints: MediaStreamConstraints = {
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: photoW },
            height: { ideal: photoH },
            aspectRatio: { ideal: photoH / photoW },
          },
          audio: false,
        };

        let mediaStream: MediaStream;
        try {
          mediaStream = await navigator.mediaDevices.getUserMedia(mediaConstraints);
        } catch {
          mediaStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: "environment" } },
            audio: false,
          });
        }
        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        setStream(mediaStream);

        const vt = mediaStream.getVideoTracks()[0];
        trackRef.current = vt ?? null;
        setCurrentZoom(1);
        setTorchOn(false);
        try {
          const capabilities = vt?.getCapabilities?.() as MediaTrackCapabilities & {
            zoom?: { min?: number; max?: number };
            torch?: boolean;
          };
          if (vt && capabilities) {
            const hasZoom = "zoom" in capabilities && capabilities.zoom != null;
            const zoomMin = capabilities.zoom?.min ?? 1;
            const zoomMax = capabilities.zoom?.max ?? 1;
            setZoomCapabilities({ hasZoom, min: zoomMin, max: zoomMax });
            setHasTorch(capabilities.torch === true);
          } else {
            setZoomCapabilities({ hasZoom: false, min: 1, max: 1 });
            setHasTorch(false);
          }
        } catch (capErr) {
          console.warn("[GhostCamera] getCapabilities failed:", capErr);
          setZoomCapabilities({ hasZoom: false, min: 1, max: 1 });
          setHasTorch(false);
        }

        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        if (mounted) setCameraError("Camera access denied. Please allow camera permissions.");
      }
    };
    void startCamera();
    return () => {
      mounted = false;
      const t = trackRef.current;
      if (t) {
        t.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }).catch(() => {});
      }
      streamRef.current?.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
      trackRef.current = null;
      setStream(null);
    };
  }, [photoW, photoH]);

  /** Match live camera zoom to check-in photo when ghost is selected. */
  useEffect(() => {
    if (!stream || isAdditionalMode || !activeGhostId) return;

    let cancelled = false;
    let hideBadgeTimer: ReturnType<typeof setTimeout> | undefined;

    const applyInitialZoom = async () => {
      const track = stream.getVideoTracks()[0] ?? trackRef.current;
      if (!track) return;
      trackRef.current = track;

      const targetZoom = activeGhostZoomLevel ?? 1;

      try {
        const caps = track.getCapabilities() as MediaTrackCapabilities & {
          zoom?: { min?: number; max?: number };
        };
        if (!("zoom" in caps) || caps.zoom == null) return;

        const zMin = caps.zoom.min ?? 1;
        const zMax = caps.zoom.max ?? 1;
        const clamped = Math.min(Math.max(targetZoom, zMin), zMax);
        await track.applyConstraints({
          advanced: [{ zoom: clamped } as MediaTrackConstraintSet],
        });
        if (cancelled) return;
        setCurrentZoom(clamped);
        if (Math.abs(clamped - 1) > 0.05) {
          setAutoZoomApplied(true);
          hideBadgeTimer = setTimeout(() => setAutoZoomApplied(false), 2500);
        } else {
          setAutoZoomApplied(false);
        }
      } catch (e) {
        console.warn("Auto-zoom failed:", e);
      }
    };

    void applyInitialZoom();

    return () => {
      cancelled = true;
      if (hideBadgeTimer) clearTimeout(hideBadgeTimer);
    };
  }, [stream, isAdditionalMode, activeGhostId, activeGhostZoomLevel]);

  const handleShutter = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const { width: nativeW, height: nativeH } = getVideoCaptureDimensions(video);
    if (!nativeW || !nativeH) {
      console.error("[GhostCamera] Video frame dimensions unavailable — cannot capture");
      setCapturing(false);
      return;
    }

    const nativeRatio = nativeH / nativeW;
    const aspect = targetAspectRatio;

    let cropW = nativeW;
    let cropH = nativeH;
    let offsetX = 0;
    let offsetY = 0;

    if (nativeRatio > aspect) {
      cropH = Math.round(nativeW * aspect);
      offsetY = Math.round((nativeH - cropH) / 2);
    } else if (nativeRatio < aspect) {
      cropW = Math.round(nativeH / aspect);
      offsetX = Math.round((nativeW - cropW) / 2);
    }

    canvas.width = cropW;
    canvas.height = cropH;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, offsetX, offsetY, cropW, cropH, 0, 0, cropW, cropH);

    const tagsSnapshot = [...selectedTags];

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const linkedId = isAdditionalMode
            ? null
            : (checkinPhotos[activeGhostIndex]?.id ?? null);
          onPhotoTaken(blob, linkedId, isAdditionalMode, tagsSnapshot, currentZoom);
          if (linkedId) {
            setCoveredCheckinIds((prev) => new Set(Array.from(prev).concat(linkedId)));
          }
          if (isAdditionalMode) {
            setIsAdditionalMode(false);
            setGhostOpacity(0.35);
          }
          // Keep selectedTags for next capture (same ghost); effect updates when index changes
        }
        setCapturing(false);
      },
      "image/jpeg",
      0.92
    );
  };

  const handleClose = () => {
    const t = trackRef.current;
    if (t) {
      t.applyConstraints({ advanced: [{ torch: false } as MediaTrackConstraintSet] }).catch(() => {});
    }
    streamRef.current?.getTracks().forEach((tr) => tr.stop());
    streamRef.current = null;
    trackRef.current = null;
    setStream(null);
    setTorchOn(false);
    onClose();
  };

  const activeGhost = checkinPhotos[activeGhostIndex] ?? null;

  const showZoomBar = isCheckout && stream && zoomPresets.length > 1;
  const showTorchBtn = isCheckout && stream && hasTorch;

  const toggleTag = (tag: string) => {
    setPrepopulatedHintVisible(false);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div className="fixed inset-0 z-[999] overflow-hidden bg-black">
      {/* Ratio-locked viewport — video + ghost share identical pixels */}
      {(() => {
        const ph = isAdditionalMode
          ? null
          : (checkinPhotos[activeGhostIndex] ?? checkinPhotos[0] ?? null);
        const pW = ph?.width ?? 1440;
        const pH = ph?.height ?? 1920;
        const cssRatio = `${pW} / ${pH}`;

        return (
          <div className="absolute inset-0 flex items-start justify-center bg-black">
            <div
              style={{
                position: "relative",
                width: "100%",
                aspectRatio: cssRatio,
                maxWidth: "100%",
                maxHeight: "100%",
                overflow: "hidden",
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  zIndex: 0,
                }}
              />

              {activeGhost && ghostOpacity > 0 && !isAdditionalMode && (
                <>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={activeGhost.url}
                    alt=""
                    style={{
                      position: "absolute",
                      inset: 0,
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      opacity: ghostOpacity,
                      pointerEvents: "none",
                      zIndex: 1,
                    }}
                  />
                </>
              )}

              {activeGhost && !isAdditionalMode && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    right: 12,
                    zIndex: 5,
                    background: "rgba(0,0,0,0.55)",
                    borderRadius: 8,
                    padding: "4px 10px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.7)",
                    }}
                  >
                    👻 Entry photo
                  </p>
                </div>
              )}
              {isAdditionalMode && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 5,
                    background: "rgba(255,138,101,0.7)",
                    borderRadius: 8,
                    padding: "4px 10px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: 11, fontWeight: 600, color: "white" }}>📸 New finding</p>
                </div>
              )}
              {checkinPhotos.length === 0 && (
                <div
                  style={{
                    position: "absolute",
                    top: 12,
                    left: 12,
                    zIndex: 5,
                    background: "rgba(0,0,0,0.45)",
                    borderRadius: 8,
                    padding: "4px 10px",
                  }}
                >
                  <p
                    style={{
                      margin: 0,
                      fontSize: 11,
                      fontWeight: 600,
                      color: "rgba(255,255,255,0.5)",
                    }}
                  >
                    No entry photos for this room
                  </p>
                </div>
              )}

              <AnimatePresence>
                {autoZoomApplied &&
                  activeGhost?.zoom_level != null &&
                  Math.abs(Number(activeGhost.zoom_level) - 1) > 0.05 && (
                    <motion.div
                      key="auto-zoom-badge"
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      style={{
                        position: "absolute",
                        top: 12,
                        left: "50%",
                        transform: "translateX(-50%)",
                        zIndex: 6,
                        borderRadius: 9999,
                        background: "rgba(0,0,0,0.6)",
                        padding: "6px 12px",
                        fontSize: 12,
                        fontWeight: 600,
                        color: "white",
                        backdropFilter: "blur(8px)",
                      }}
                    >
                      Zoom matched: {Number(activeGhost.zoom_level).toFixed(1)}×
                    </motion.div>
                  )}
              </AnimatePresence>

              {/* Ghost opacity slider — overlaid on bottom of video */}
              {checkinPhotos.length > 0 && (
                <div className="absolute bottom-3 left-4 right-4 z-20 flex items-center gap-2">
                  <span style={{ fontSize: 13 }}>👻</span>
                  <input
                    type="range"
                    min={0}
                    max={0.7}
                    step={0.05}
                    value={ghostOpacity}
                    onChange={(e) => setGhostOpacity(parseFloat(e.target.value))}
                    style={{ flex: 1, accentColor: "#9A88FD", height: 2 }}
                  />
                  <span
                    style={{
                      color: "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      minWidth: 30,
                      textAlign: "right",
                    }}
                  >
                    {Math.round(ghostOpacity * 100)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* ── LAYER 2: TOP BAR overlay ── */}
      <div
        className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between px-4"
        style={{
          paddingTop: "env(safe-area-inset-top, 12px)",
          paddingBottom: 8,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%)",
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-black/40 text-base text-white backdrop-blur-sm"
        >
          ✕
        </button>

        <p className="text-sm font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
          {roomName}
        </p>

        <div className="w-8" aria-hidden />
      </div>

      {/* ── LEFT COLUMN OVERLAY: Flash on top, zoom presets vertical ── */}
      {(showZoomBar || showTorchBtn) && (
        <div
          className="pointer-events-auto absolute left-3 z-20 flex flex-col items-center gap-2"
          style={{ top: "25%" }}
        >
          {showTorchBtn && (
            <motion.button
              type="button"
              onClick={() => void toggleTorch()}
              animate={{
                backgroundColor: torchOn ? "rgba(254,222,128,0.35)" : "rgba(0,0,0,0.45)",
              }}
              className="mb-1 flex h-9 w-9 items-center justify-center rounded-full backdrop-blur-sm"
              whileTap={{ scale: 0.9 }}
              aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill={torchOn ? "#FEDE80" : "none"}
                stroke={torchOn ? "#FEDE80" : "white"}
                strokeWidth="2"
                strokeLinecap="round"
              >
                <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
              </svg>
            </motion.button>
          )}

          {showZoomBar && (
            <div
              className="flex flex-col items-center gap-1 rounded-2xl px-1.5 py-2"
              style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
            >
              {[...zoomPresets].reverse().map((preset) => {
                const active = Math.abs(currentZoom - preset.value) < 0.1;
                return (
                  <motion.button
                    key={preset.label}
                    type="button"
                    onClick={() => void applyZoom(preset.value)}
                    animate={{
                      backgroundColor: active ? "rgba(255,255,255,0.2)" : "transparent",
                      scale: active ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="flex h-8 w-8 items-center justify-center rounded-full"
                  >
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 700,
                        color: active ? "#FEDE80" : "rgba(255,255,255,0.7)",
                        writingMode: "horizontal-tb",
                      }}
                    >
                      {preset.label}
                    </span>
                  </motion.button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── LAYER 6: BOTTOM CONTROLS overlay ── */}
      <div
        className="absolute bottom-0 left-0 right-0 z-20 flex flex-col gap-3 px-5 pb-10 pt-4"
        style={{
          background: "linear-gradient(to top, rgba(0,0,0,0.88) 70%, transparent 100%)",
        }}
      >
        {checkinPhotos.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {checkinPhotos.map((photo, idx) => (
              <button
                key={photo.id}
                type="button"
                onClick={() => setActiveGhostIndex(idx)}
                style={{
                  flexShrink: 0,
                  position: "relative",
                  width: 48,
                  height: 48,
                  borderRadius: 8,
                  overflow: "hidden",
                  padding: 0,
                  border:
                    idx === activeGhostIndex ? "2.5px solid #9A88FD" : "2.5px solid transparent",
                  opacity: idx === activeGhostIndex ? 1 : 0.5,
                  cursor: "pointer",
                }}
              >
                <Image src={photo.url} alt="" fill sizes="48px" style={{ objectFit: "cover" }} />
                {coveredCheckinIds.has(photo.id) && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(34,197,94,0.45)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <span style={{ color: "white", fontSize: 16, fontWeight: 800 }}>✓</span>
                  </div>
                )}
              </button>
            ))}
          </div>
        )}

        {isCheckout && (
          <div>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                margin: "0 0 6px",
              }}
            >
              Damage tags
            </p>
            <div className="flex flex-wrap gap-1.5">
              {DAMAGE_TAGS.map((tag) => {
                const on = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 20,
                      border: on ? "1.5px solid #9A88FD" : "1.5px solid rgba(255,255,255,0.2)",
                      background: on ? "rgba(154,136,253,0.25)" : "rgba(255,255,255,0.06)",
                      color: on ? "#e9e4ff" : "rgba(255,255,255,0.65)",
                      fontSize: 11,
                      fontWeight: 700,
                      textTransform: "capitalize",
                      cursor: "pointer",
                    }}
                  >
                    {tag}
                  </button>
                );
              })}
            </div>
            {prepopulatedHintVisible && selectedTags.length > 0 && !isAdditionalMode && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="1.8" />
                  <path
                    d="M12 8v4M12 16h.01"
                    stroke="#D97706"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[10px] font-medium text-[#D97706]">
                  Pre-filled from check-in · tap to remove if resolved
                </span>
              </div>
            )}
          </div>
        )}

        <div className="flex items-center justify-between">
          {isCheckout ? (
            <button
              type="button"
              onClick={() => {
                setGhostOpacity(0);
                setIsAdditionalMode(true);
                setSelectedTags([]);
                setPrepopulatedHintVisible(false);
              }}
              style={{
                padding: "6px 14px",
                borderRadius: 20,
                border: "1.5px solid rgba(255,138,101,0.6)",
                background: "transparent",
                color: "#FF8A65",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              ＋ New
            </button>
          ) : (
            <div style={{ width: 72 }} aria-hidden />
          )}

          <button
            type="button"
            onClick={handleShutter}
            disabled={capturing}
            style={{
              width: 72,
              height: 72,
              borderRadius: "50%",
              border: isAdditionalMode ? "4px solid #FF8A65" : "4px solid white",
              background: capturing ? "#9A88FD" : "rgba(255,255,255,0.15)",
              cursor: capturing ? "default" : "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
              transition: "all 0.15s",
            }}
          >
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: capturing ? "#9A88FD" : "white",
                transition: "all 0.15s",
              }}
            />
          </button>

          {checkinPhotos.length > 0
            ? (() => {
                const covered = coveredCheckinIds.size;
                const total = checkinPhotos.length;
                const all = covered >= total;
                return (
                  <div
                    style={{
                      padding: "6px 10px",
                      borderRadius: 20,
                      background: all ? "rgba(34,197,94,0.2)" : "rgba(255,138,101,0.2)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <p
                      style={{
                        margin: 0,
                        fontSize: 11,
                        fontWeight: 700,
                        color: all ? "#22c55e" : "#FF8A65",
                      }}
                    >
                      {all ? `✓ ${total}/${total}` : `${covered}/${total}`}
                    </p>
                  </div>
                );
              })()
            : (
                <div style={{ width: 72 }} aria-hidden />
              )}
        </div>

        {cameraError && (
          <p className="m-0 text-center text-xs" style={{ color: "#FF8A65" }}>
            {cameraError}
          </p>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
