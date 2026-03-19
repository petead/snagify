"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { getVideoCaptureDimensions } from "@/lib/getImageDimensions";

/** Same list as InspectionClient PhotoCard */
const DAMAGE_TAGS = [
  "scratch", "stain", "crack", "damp", "missing", "broken", "hole", "leak",
];

export type GhostPhoto = {
  id: string;
  url: string;
  storage_path?: string | null;
  damage_tags?: string[];
  ai_analysis?: string | null;
};

export interface GhostCameraProps {
  checkinPhotos: GhostPhoto[];
  onPhotoTaken: (
    blob: Blob,
    linkedCheckinPhotoId: string | null,
    isAdditional: boolean,
    damageTags: string[]
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
  const [stream, setStream] = useState<MediaStream | null>(null);
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

  useEffect(() => {
    let mounted = true;
    const startCamera = async () => {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "environment",
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });
        if (!mounted) {
          mediaStream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
          videoRef.current.play().catch(() => {});
        }
      } catch {
        if (mounted) setCameraError("Camera access denied. Please allow camera permissions.");
      }
    };
    startCamera();
    return () => {
      mounted = false;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setStream(null);
    };
  }, []);

  const handleShutter = async () => {
    if (!videoRef.current || !canvasRef.current || capturing) return;
    setCapturing(true);

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const { width: frameW, height: frameH } = getVideoCaptureDimensions(video);
    if (!frameW || !frameH) {
      console.error("[GhostCamera] Video frame dimensions unavailable — cannot capture");
      setCapturing(false);
      return;
    }
    canvas.width = frameW;
    canvas.height = frameH;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, frameW, frameH);

    const tagsSnapshot = [...selectedTags];

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const linkedId = isAdditionalMode
            ? null
            : (checkinPhotos[activeGhostIndex]?.id ?? null);
          onPhotoTaken(blob, linkedId, isAdditionalMode, tagsSnapshot);
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
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setStream(null);
    onClose();
  };

  const activeGhost = checkinPhotos[activeGhostIndex] ?? null;

  const toggleTag = (tag: string) => {
    setPrepopulatedHintVisible(false);
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999,
        background: "#0e0e14",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* TOP BAR */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 16px 8px",
          background: "rgba(0,0,0,0.6)",
          position: "absolute",
          top: 0,
          left: 0,
          right: 0,
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={handleClose}
          style={{
            color: "white",
            background: "none",
            border: "none",
            fontSize: 24,
            cursor: "pointer",
            padding: 4,
          }}
        >
          ✕
        </button>
        <div style={{ textAlign: "center" }}>
          <p
            style={{
              color: "white",
              fontWeight: 700,
              fontSize: 14,
              fontFamily: "Poppins, sans-serif",
              margin: 0,
            }}
          >
            {roomName}
          </p>
          <p
            style={{
              color: "#FF8A65",
              fontSize: 11,
              fontWeight: 600,
              margin: "2px 0 0",
              textTransform: "uppercase",
              letterSpacing: 0.5,
            }}
          >
            Check-out
          </p>
        </div>
        <div style={{ width: 32 }} />
      </div>

      {/* CAMERA + GHOST LAYER */}
      <div style={{ position: "relative", flex: 1, overflow: "hidden" }}>
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
          }}
        />

        {activeGhost && ghostOpacity > 0 && !isAdditionalMode && (
          <>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
            src={activeGhost.url}
            alt="Check-in ghost"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              opacity: ghostOpacity,
              pointerEvents: "none",
              mixBlendMode: "normal",
            }}
          />
          </>
        )}

        {activeGhost && !isAdditionalMode && (
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              background: "rgba(0,0,0,0.55)",
              borderRadius: 8,
              padding: "4px 10px",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.7)", fontSize: 11, fontWeight: 600, margin: 0 }}>
              👻 Entry photo
            </p>
          </div>
        )}
        {isAdditionalMode && (
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              background: "rgba(255,138,101,0.7)",
              borderRadius: 8,
              padding: "4px 10px",
            }}
          >
            <p style={{ color: "white", fontSize: 11, fontWeight: 600, margin: 0 }}>
              📸 New finding — no entry reference
            </p>
          </div>
        )}

        {checkinPhotos.length === 0 && (
          <div
            style={{
              position: "absolute",
              top: 64,
              left: 12,
              background: "rgba(0,0,0,0.45)",
              borderRadius: 8,
              padding: "4px 10px",
            }}
          >
            <p style={{ color: "rgba(255,255,255,0.5)", fontSize: 11, fontWeight: 600, margin: 0 }}>
              No entry photos for this room
            </p>
          </div>
        )}

        <canvas ref={canvasRef} style={{ display: "none" }} />
      </div>

      {/* BOTTOM CONTROLS */}
      <div
        style={{
          background: "rgba(0,0,0,0.85)",
          padding: "12px 16px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
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
