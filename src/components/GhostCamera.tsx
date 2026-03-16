"use client";

import React, { useState, useEffect, useRef } from "react";

export type GhostPhoto = {
  id: string;
  url: string;
  storage_path?: string | null;
  damage_tags?: string[];
  ai_analysis?: string | null;
};

export interface GhostCameraProps {
  checkinPhotos: GhostPhoto[];
  onPhotoTaken: (blob: Blob, activeGhostUrl?: string | null) => void;
  onClose: () => void;
  roomName: string;
  isCheckout: boolean;
}

export default function GhostCamera({
  checkinPhotos,
  onPhotoTaken,
  onClose,
  roomName,
  isCheckout,
}: GhostCameraProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [ghostOpacity, setGhostOpacity] = useState(0.35);
  const [activeGhostIndex, setActiveGhostIndex] = useState(0);
  const [capturing, setCapturing] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);

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
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    const ctx = canvas.getContext("2d");
    ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(
      (blob) => {
        if (blob) {
          const activeGhost = checkinPhotos[activeGhostIndex];
          onPhotoTaken(blob, activeGhost?.url ?? null);
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

        {activeGhost && ghostOpacity > 0 && (
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
        )}

        {activeGhost && (
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
                onClick={() => setActiveGhostIndex(idx)}
                style={{
                  flexShrink: 0,
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
                <img
                  src={photo.url}
                  alt=""
                  style={{ width: "100%", height: "100%", objectFit: "cover" }}
                />
              </button>
            ))}
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
              border: "4px solid white",
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

        {cameraError && (
          <p style={{ color: "#FF8A65", fontSize: 12, textAlign: "center", margin: 0 }}>
            {cameraError}
          </p>
        )}
      </div>
    </div>
  );
}
