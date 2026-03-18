'use client'
import { useRef, useState, useEffect } from 'react'
import { X, RotateCcw, Check, Loader2 } from 'lucide-react'

interface Props {
  existingUrl?: string | null
  onSave: (dataUrl: string) => Promise<void>
  onClose: () => void
}

export function InspectorSignaturePad({ existingUrl, onSave, onClose }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [hasDrawn, setHasDrawn] = useState(false)
  const [isDrawing, setIsDrawing] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    canvas.width = rect.width * window.devicePixelRatio
    canvas.height = rect.height * window.devicePixelRatio
    const ctx = canvas.getContext('2d')!
    ctx.scale(window.devicePixelRatio, window.devicePixelRatio)
    ctx.strokeStyle = '#1A1A2E'
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
  }, [])

  function getPos(e: React.TouchEvent | React.MouseEvent, canvas: HTMLCanvasElement) {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return {
      x: (e as React.MouseEvent).clientX - rect.left,
      y: (e as React.MouseEvent).clientY - rect.top,
    }
  }

  function startDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setIsDrawing(true)
    setHasDrawn(true)
  }

  function draw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    if (!isDrawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  function endDraw(e: React.TouchEvent | React.MouseEvent) {
    e.preventDefault()
    setIsDrawing(false)
  }

  function clearPad() {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasDrawn(false)
  }

  async function handleSave() {
    if (!hasDrawn || !canvasRef.current) return
    setSaving(true)
    const dataUrl = canvasRef.current.toDataURL('image/png')
    await onSave(dataUrl)
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ paddingBottom: '64px' }}>

      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#1A1A2E]/60" onClick={onClose} />

      {/* Sheet */}
      <div className="relative w-full max-w-[430px] bg-white rounded-t-3xl
        flex flex-col overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4
          border-b border-[#F3F3F8]">
          <div>
            <div className="text-[16px] font-bold text-[#1A1A2E]">
              Inspector signature
            </div>
            <div className="text-[12px] text-[#9B9BA8] mt-0.5">
              Draw your signature below
            </div>
          </div>
          <button onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#F3F3F8] flex items-center
              justify-center">
            <X size={16} color="#6B7280" />
          </button>
        </div>

        {/* Canvas area */}
        <div className="px-5 pt-4 pb-2 flex-1">
          <div className="relative border-2 border-dashed rounded-2xl
            bg-[#FAFAFE] overflow-hidden"
            style={{ height: 200, borderColor: 'rgba(154,136,253,0.3)' }}>
            <canvas
              ref={canvasRef}
              className="w-full h-full touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={endDraw}
              onMouseLeave={endDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={endDraw}
            />
            {!hasDrawn && (
              <div className="absolute inset-0 flex flex-col items-center
                justify-center pointer-events-none gap-2">
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                  <path d="M17 3a2.83 2.83 0 114 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                    stroke="#C4C4C4" strokeWidth="1.5" strokeLinecap="round"/>
                </svg>
                <span className="text-[13px] text-[#C4C4C4]">
                  Sign here with your finger
                </span>
              </div>
            )}
          </div>
          {/* Signature line */}
          <div className="flex items-center gap-2 mt-3 px-2">
            <div className="flex-1 h-px bg-gray-200" />
            <span className="text-[11px] text-gray-400">signature</span>
            <div className="flex-1 h-px bg-gray-200" />
          </div>
        </div>

        {/* Existing signature hint */}
        {existingUrl && !hasDrawn && (
          <div className="mx-5 mb-2 bg-[#EDE9FF] rounded-xl px-3 py-2
            flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-[#9A88FD]" />
            <span className="text-[11px] text-[#9A88FD] font-medium">
              You have a saved signature. Draw to replace it.
            </span>
          </div>
        )}

        {/* Action buttons — sticky */}
        <div className="px-5 py-4 flex gap-2 border-t border-[#F3F3F8]
          bg-white flex-shrink-0">
          <button
            onClick={clearPad}
            disabled={!hasDrawn}
            className="flex items-center gap-1.5 bg-[#F3F3F8] text-[#6B7280]
              rounded-xl px-4 py-3 text-[13px] font-semibold flex-shrink-0
              disabled:opacity-40">
            <RotateCcw size={14} />
            Clear
          </button>
          <button
            onClick={handleSave}
            disabled={!hasDrawn || saving}
            className="flex-1 bg-[#9A88FD] text-white rounded-xl py-3
              text-[14px] font-bold flex items-center justify-center gap-2
              disabled:opacity-40">
            {saving
              ? <Loader2 size={15} className="animate-spin" />
              : <><Check size={15} /> Save signature</>
            }
          </button>
        </div>

      </div>
    </div>
  )
}
