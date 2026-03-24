import { useState, useEffect, useRef } from "react"
import { createPortal } from "react-dom"

interface FloatingPreviewProps {
  mainPreviewRef: React.RefObject<HTMLDivElement>
}

export function FloatingPreview({ mainPreviewRef }: FloatingPreviewProps) {
  const [isMainVisible, setIsMainVisible] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener("resize", check)
    return () => window.removeEventListener("resize", check)
  }, [])

  useEffect(() => {
    const el = mainPreviewRef.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => setIsMainVisible(entry.isIntersecting),
      { threshold: 0.1 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [mainPreviewRef])

  // Capture screenshots when mini preview is visible
  useEffect(() => {
    if (isMainVisible || !isMobile) {
      if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null }
      return
    }

    const capture = () => {
      const canvas = mainPreviewRef.current?.querySelector("canvas")
      if (!canvas) return
      try {
        setScreenshot(canvas.toDataURL("image/jpeg", 0.6))
      } catch { /* cross-origin or empty canvas */ }
    }

    capture() // immediate first capture
    intervalRef.current = setInterval(capture, 500)
    return () => { if (intervalRef.current) clearInterval(intervalRef.current) }
  }, [isMainVisible, isMobile, mainPreviewRef])

  if (isMainVisible || !isMobile || !screenshot) return null

  return createPortal(
    <div
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        width: 180,
        height: 160,
        borderRadius: 8,
        boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      <img
        src={screenshot}
        alt="3D Preview"
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
    </div>,
    document.body
  )
}
