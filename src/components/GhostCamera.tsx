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

/** height / width; fallback 4:3 when DB has no dimensions (legacy photos). */
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
            width: { ideal: 3840 },
            height: { ideal: 2160 },
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
  }, []);

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
    <div className="fixed inset-0 z-[999] flex flex-col bg-black">
      {/* TOP BAR */}
      <div className="flex shrink-0 items-center justify-between px-4 pb-3 pt-12">
        <button
          type="button"
          onClick={handleClose}
          className="cursor-pointer border-none bg-transparent p-1 text-2xl text-white"
        >
          ✕
        </button>
        <div className="text-center">
          <p className="m-0 text-sm font-bold text-white" style={{ fontFamily: "Poppins, sans-serif" }}>
            {roomName}
          </p>
          <p className="mb-0 mt-0.5 text-[11px] font-semibold uppercase tracking-wide text-[#FF8A65]">
            Check-out
          </p>
        </div>
        <div className="w-8" />
      </div>

      {/* CAMERA AREA — fills space between top bar and bottom controls */}
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <AnimatePresence>
          {autoZoomApplied &&
            activeGhost &&
            activeGhost.zoom_level != null &&
            Math.abs(Number(activeGhost.zoom_level) - 1) > 0.05 && (
              <motion.div
                key="auto-zoom-badge"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="absolute left-1/2 top-4 z-30 -translate-x-1/2 rounded-full bg-black/60 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur-sm"
              >
                Zoom matched to check-in: {Number(activeGhost.zoom_level).toFixed(2)}×
              </motion.div>
            )}
        </AnimatePresence>

        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          className="absolute inset-0 z-0 h-full w-full object-cover"
        />

        {activeGhost && ghostOpacity > 0 && !isAdditionalMode && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={activeGhost.url}
              alt=""
              className="pointer-events-none absolute inset-0 z-[1] h-full w-full object-cover"
              style={{ opacity: ghostOpacity }}
            />
          </>
        )}

        {activeGhost && !isAdditionalMode && (
          <div
            className="absolute left-3 top-4 z-[5] rounded-lg px-2.5 py-1"
            style={{ background: "rgba(0,0,0,0.55)" }}
          >
            <p className="m-0 text-[11px] font-semibold text-white/70">👻 Entry photo</p>
          </div>
        )}
        {isAdditionalMode && (
          <div
            className="absolute left-3 top-4 z-[5] rounded-lg px-2.5 py-1"
            style={{ background: "rgba(255,138,101,0.7)" }}
          >
            <p className="m-0 text-[11px] font-semibold text-white">📸 New finding — no entry reference</p>
          </div>
        )}

        {checkinPhotos.length === 0 && (
          <div
            className="absolute left-3 top-4 z-[5] rounded-lg px-2.5 py-1"
            style={{ background: "rgba(0,0,0,0.45)" }}
          >
            <p className="m-0 text-[11px] font-semibold text-white/50">No entry photos for this room</p>
          </div>
        )}

        {(showZoomBar || showTorchBtn) && (
          <div
            className={`pointer-events-auto absolute bottom-4 left-0 right-0 z-20 flex items-center px-4 ${
              showZoomBar && showTorchBtn
                ? "justify-between"
                : showTorchBtn
                  ? "justify-end"
                  : "justify-start"
            }`}
          >
            {showZoomBar && (
              <div className="flex items-center gap-1.5 rounded-full bg-black/40 px-2 py-1.5 backdrop-blur-sm">
                {zoomPresets.map((preset) => (
                  <motion.button
                    key={preset.label}
                    type="button"
                    onClick={() => void applyZoom(preset.value)}
                    animate={{
                      backgroundColor:
                        Math.abs(currentZoom - preset.value) < 0.1
                          ? "rgba(255,255,255,0.25)"
                          : "transparent",
                      scale: Math.abs(currentZoom - preset.value) < 0.1 ? 1.1 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 400, damping: 25 }}
                    className="rounded-full px-2.5 py-1"
                  >
                    <span
                      className={`text-xs font-bold ${
                        Math.abs(currentZoom - preset.value) < 0.1 ? "text-yellow-300" : "text-white/70"
                      }`}
                    >
                      {preset.label}
                    </span>
                  </motion.button>
                ))}
              </div>
            )}
            {showTorchBtn && (
              <motion.button
                type="button"
                onClick={() => void toggleTorch()}
                animate={{
                  backgroundColor: torchOn ? "rgba(254,222,128,0.3)" : "rgba(0,0,0,0.4)",
                }}
                className="flex h-10 w-10 items-center justify-center rounded-full backdrop-blur-sm"
                whileTap={{ scale: 0.9 }}
                aria-label={torchOn ? "Turn flash off" : "Turn flash on"}
              >
                <svg
                  width="18"
                  height="18"
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
          </div>
        )}

        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* BOTTOM CONTROLS */}
      <div
        className="flex shrink-0 flex-col gap-3 px-6 pb-10 pt-4"
        style={{ background: "rgba(0,0,0,0.85)" }}
      >
        {checkinPhotos.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ fontSize: 16 }}>👻</span>
            <input
              type="range"
              min={0}
              max={0.7}
              step={0.05}
              value={ghostOpacity}
              onChange={(e) => setGhostOpacity(parseFloat(e.target.value))}
              style={{ flex: 1, accentColor: "#9A88FD" }}
            />
            <span
              style={{
                color: "rgba(255,255,255,0.6)",
                fontSize: 12,
                minWidth: 36,
                textAlign: "right",
              }}
            >
              {Math.round(ghostOpacity * 100)}%
            </span>
          </div>
        )}

        {checkinPhotos.length > 0 && (
          <>
            {(() => {
              const coveredCount = coveredCheckinIds.size;
              const totalRequired = checkinPhotos.length;
              const allCovered = coveredCount >= totalRequired;
              return (
                <div
                  style={{
                    padding: "4px 12px",
                    borderRadius: 20,
                    background: allCovered ? "rgba(34,197,94,0.2)" : "rgba(255,138,101,0.2)",
                    marginBottom: 8,
                    alignSelf: "center",
                  }}
                >
                  <p
                    style={{
                      color: allCovered ? "#22c55e" : "#FF8A65",
                      fontSize: 12,
                      fontWeight: 700,
                      margin: 0,
                    }}
                  >
                    {allCovered
                      ? `✓ All ${totalRequired} entry photos covered`
                      : `${coveredCount}/${totalRequired} entry photos covered`}
                  </p>
                </div>
              );
            })()}
            {checkinPhotos.length > 1 && (
              <div
                style={{
                  display: "flex",
                  gap: 8,
                  overflowX: "auto",
                  paddingBottom: 4,
                }}
              >
                {checkinPhotos.map((photo, idx) => (
                  <button
                    key={photo.id}
                    type="button"
                    onClick={() => {
                      setActiveGhostIndex(idx);
                    }}
                    style={{
                      flexShrink: 0,
                      position: "relative",
                      width: 52,
                      height: 52,
                      borderRadius: 8,
                      overflow: "hidden",
                      padding: 0,
                      border:
                        idx === activeGhostIndex
                          ? "2.5px solid #9A88FD"
                          : "2.5px solid transparent",
                      opacity: idx === activeGhostIndex ? 1 : 0.55,
                      cursor: "pointer",
                    }}
                  >
                    <Image
                      src={photo.url}
                      alt=""
                      fill
                      sizes="52px"
                      style={{ objectFit: "cover" }}
                    />
                    {coveredCheckinIds.has(photo.id) && (
                      <div
                        style={{
                          position: "absolute",
                          inset: 0,
                          background: "rgba(34,197,94,0.45)",
                          borderRadius: 8,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <span style={{ color: "white", fontSize: 18, fontWeight: 800 }}>✓</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        {isCheckout && (
          <div style={{ marginBottom: 4 }}>
            <p
              style={{
                color: "rgba(255,255,255,0.45)",
                fontSize: 10,
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: 0.6,
                margin: "0 0 8px",
              }}
            >
              Damage tags
            </p>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
              }}
            >
              {DAMAGE_TAGS.map((tag) => {
                const on = selectedTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      padding: "6px 10px",
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
              <div className="flex items-center gap-1.5 mt-1.5">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" aria-hidden>
                  <circle cx="12" cy="12" r="10" stroke="#D97706" strokeWidth="1.8" />
                  <path
                    d="M12 8v4M12 16h.01"
                    stroke="#D97706"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
                <span className="text-[10px] text-[#D97706] font-medium">
                  Pre-filled from check-in · tap to remove if resolved
                </span>
              </div>
            )}
          </div>
        )}

        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            position: "relative",
          }}
        >
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
        </div>

        {isCheckout && (
          <button
            type="button"
            onClick={() => {
              setGhostOpacity(0);
              setIsAdditionalMode(true);
              setSelectedTags([]);
              setPrepopulatedHintVisible(false);
            }}
            style={{
              marginTop: 8,
              padding: "8px 20px",
              borderRadius: 20,
              border: "1.5px solid rgba(255,138,101,0.6)",
              background: "transparent",
              color: "#FF8A65",
              fontSize: 13,
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ＋ New finding
          </button>
        )}

        {cameraError && (
          <p style={{ color: "#FF8A65", fontSize: 12, textAlign: "center", margin: 0 }}>
            {cameraError}
          </p>
        )}
      </div>
    </div>
  );
}
