import { useState, useEffect, useRef, ReactNode } from "react"
import { createPortal } from "react-dom"
import { Maximize2, X } from "lucide-react"

interface FloatingPreviewProps {
  /** Ref to the main 3D preview container div */
  mainPreviewRef: React.RefObject<HTMLDivElement>
  /** Render function for the 3D view — receives isMini flag */
  children: (isMini: boolean) => ReactNode
}

export function FloatingPreview({ mainPreviewRef, children }: FloatingPreviewProps) {
  const [isMainVisible, setIsMainVisible] = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 1024)
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

  // Don't render if main is visible
  if (isMainVisible) return null

  const floatingContent = (
    <>
      {/* Floating mini preview */}
      {!isExpanded && (
        <div
          onClick={() => setIsExpanded(true)}
          className={`fixed z-50 cursor-pointer transition-all duration-300 animate-fade-in ${
            isMobile
              ? "bottom-0 left-0 right-0 h-[200px] rounded-t-2xl"
              : "bottom-4 right-4 w-[280px] h-[220px] rounded-xl"
          } bg-card border border-border shadow-2xl overflow-hidden`}
        >
          <div className="absolute inset-0">
            {children(true)}
          </div>
          <button
            className="absolute top-2 right-2 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            onClick={(e) => { e.stopPropagation(); setIsExpanded(true) }}
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

      {/* Expanded modal overlay */}
      {isExpanded && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm animate-fade-in" onClick={() => setIsExpanded(false)}>
          <div
            className={`absolute bg-card border border-border shadow-2xl overflow-hidden ${
              isMobile
                ? "inset-2 rounded-2xl"
                : "inset-8 rounded-2xl"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute inset-0">
              {children(false)}
            </div>
            <button
              onClick={() => setIsExpanded(false)}
              className="absolute top-3 right-3 z-10 bg-card/80 backdrop-blur-sm border border-border rounded-md p-1.5 text-muted-foreground hover:text-foreground transition-colors shadow-sm"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )

  return createPortal(floatingContent, document.body)
}
