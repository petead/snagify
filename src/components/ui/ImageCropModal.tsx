"use client"
import { useState, useCallback } from "react"
import Cropper from "react-easy-crop"
import { getCroppedImage, type CropArea } from "@/lib/cropImage"

interface ImageCropModalProps {
  imageSrc: string
  shape: "circle" | "square"
  aspectRatio?: number
  title?: string
  onConfirm: (croppedFile: File) => void
  onCancel: () => void
}

export function ImageCropModal({
  imageSrc,
  shape,
  aspectRatio = 1,
  title,
  onConfirm,
  onCancel,
}: ImageCropModalProps) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedArea, setCroppedArea] = useState<CropArea | null>(null)
  const [loading, setLoading] = useState(false)

  const onCropComplete = useCallback((_: unknown, croppedAreaPixels: CropArea) => {
    setCroppedArea(croppedAreaPixels)
  }, [])

  async function handleConfirm() {
    if (!croppedArea) return
    setLoading(true)
    try {
      const file = await getCroppedImage(imageSrc, croppedArea, shape)
      onConfirm(file)
    } catch (err) {
      console.error("Crop failed:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-black/80">
        <button
          onClick={onCancel}
          className="text-white/70 text-sm font-medium hover:text-white transition-colors"
        >
          Cancel
        </button>
        <span className="text-white text-sm font-semibold">
          {title || (shape === "circle" ? "Crop Profile Photo" : "Crop Logo")}
        </span>
        <button
          onClick={handleConfirm}
          disabled={loading}
          className="text-[#9A88FD] text-sm font-semibold hover:opacity-80 
            disabled:opacity-40 transition-opacity"
        >
          {loading ? "Saving..." : "Use Photo"}
        </button>
      </div>

      {/* Cropper area */}
      <div className="relative flex-1">
        <Cropper
          image={imageSrc}
          crop={crop}
          zoom={zoom}
          aspect={aspectRatio}
          cropShape={shape === "circle" ? "round" : "rect"}
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
          style={{
            containerStyle: { background: "#000" },
            cropAreaStyle: {
              border: "2px solid rgba(255,255,255,0.8)",
            },
          }}
        />
      </div>

      {/* Zoom slider */}
      <div className="bg-black/80 px-6 py-4 flex items-center gap-4">
        <span className="text-white/40 text-xs">–</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className="flex-1 accent-[#9A88FD]"
        />
        <span className="text-white/40 text-xs">+</span>
        <span className="text-white/50 text-xs min-w-[40px] text-right">
          {Math.round(zoom * 100)}%
        </span>
      </div>

      {/* Hint */}
      <div className="bg-black/80 pb-6 text-center">
        <p className="text-white/30 text-xs">
          Pinch or scroll to zoom · Drag to reposition
        </p>
      </div>
    </div>
  )
}
