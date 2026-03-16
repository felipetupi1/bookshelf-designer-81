import type React from "react"
import iconHorizontal from "@/assets/icons/Horizontal.png"
import iconBookshelf from "@/assets/icons/Vertical_Bookshelf.png"
import iconCorner from "@/assets/icons/Corner.png"
import iconPortal from "@/assets/icons/Portal.png"
import iconCathedral from "@/assets/icons/Cathedral.png"
import iconUModel from "@/assets/icons/U-Model.png"

const TYPE_ICONS: Record<string, string> = {
  rack: iconHorizontal,
  bookshelf: iconBookshelf,
  corner: iconCorner,
  portal: iconPortal,
  cathedral: iconCathedral,
  usurround: iconUModel,
}
import { useState, useEffect, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus, RotateCcw, ShoppingCart, ChevronDown } from "lucide-react"
import type { BookshelfConfig, ShelfConfig, BookshelfType, BookshelfResult } from "@/lib/types"
import { calculateBookshelf } from "@/lib/bookshelf-calculator"
import { Bookshelf3DView, type Bookshelf3DViewRef } from "./Bookshelf3DView"
import { FinishPreviewModal } from "./FinishPreviewModal"
import { FinishPreviewChips } from "./FinishPreviewChips"
import { FloatingPreview } from "./FloatingPreview"
import { createShopifyCheckout } from "@/lib/shopify-checkout"
import { PortalConfigurator } from "./PortalConfigurator"
import { CathedralConfigurator } from "./CathedralConfigurator"
import { USurroundConfigurator } from "./USurroundConfigurator"

const FINISH_OPTIONS = [
  {
    id: "White/White", label: "White", price: 41.6,
    color1: "#f5f5f5", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null,
  },
  {
    id: "Maple/Maple", label: "Maple", price: 49.21,
    color1: "#E8D4B8", color2: "#E8D4B8", comingSoon: false, previewImage: "/images/finishes/maple1.jpeg",
  },
  {
    id: "Black/Black", label: "Black", price: 54.59,
    color1: "#1a1a1a", color2: "#1a1a1a", comingSoon: true, previewImage: null as string | null,
  },
  {
    id: "Oak/White", label: "White Oak / White", price: 60.18,
    color1: "#D4A574", color2: "#f5f5f5", comingSoon: false, previewImage: null as string | null,
  },
  {
    id: "Maple/Black", label: "Maple/Black", price: 65.1,
    color1: "#E8D4B8", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/maple-black.jpeg",
  },
  {
    id: "Oak/Oak", label: "White Oak", price: 68.15,
    color1: "#D4A574", color2: "#D4A574", comingSoon: false, previewImage: "/images/finishes/oak.jpg",
  },
  {
    id: "Walnut/Walnut", label: "Walnut", price: 76.2,
    color1: "#5D432C", color2: "#5D432C", comingSoon: false, previewImage: "/images/finishes/walnut.jpg",
  },
  {
    id: "Oak/Black", label: "White Oak / Black", price: 77.99,
    color1: "#D4A574", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/oak-black.jpeg",
  },
]

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  const eighths = Math.round(fraction * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const fractionMap: { [key: number]: string } = {
    1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8",
  }
  return `${whole} ${fractionMap[eighths]}"`
}

function toFeetAndInches(inches: number): string {
  const feet = Math.floor(inches / 12)
  const remainingInches = inches % 12
  if (feet === 0) return toFraction(remainingInches)
  if (remainingInches === 0) return `${feet}'`
  return `${feet}' ${toFraction(remainingInches)}`
}

type MainType = "rack" | "bookshelf" | "corner" | "portal" | "cathedral" | "usurround"

function calculateTotalHeight(shelves: ShelfConfig[]): number {
  const sumOfSides = shelves.reduce((sum, shelf) => sum + shelf.height, 0)
  const depthGroups = new Set(shelves.map((s) => s.depth))
  const numberOfSets = depthGroups.size
  const numberOfShelves = shelves.length
  const additionalHeight = 0.75 * (numberOfShelves + numberOfSets)
  let transitions = 0
  for (let i = 1; i < shelves.length; i++) {
    if (shelves[i].depth < shelves[i - 1].depth) transitions++
  }
  return sumOfSides + additionalHeight + 0.75 * transitions
}

function enforceDepthConstraints(shelves: ShelfConfig[], changedIndex: number): ShelfConfig[] {
  const result = shelves.map(s => ({ ...s }))
  const newDepth = result[changedIndex].depth
  for (let i = changedIndex - 1; i >= 0; i--) {
    if (result[i].depth < newDepth) result[i].depth = newDepth as 7 | 10 | 13
  }
  for (let i = changedIndex + 1; i < result.length; i++) {
    if (result[i].depth > newDepth) result[i].depth = newDepth as 7 | 10 | 13
  }
  return result
}

function getAvailableDepths(shelves: ShelfConfig[], index: number): number[] {
  const maxAllowed = index > 0 ? shelves[index - 1].depth : 13
  return [7, 10, 13].filter(d => d <= maxAllowed)
}

function safeGetItem(key: string): string | null {
  try { return localStorage.getItem(key) } catch { return null }
}

function safeSetItem(key: string, value: string): void {
  try { localStorage.setItem(key, value) } catch { /* ignore */ }
}

/* ─── Accordion step section ─── */
function ConfigSection({
  step,
  title,
  subtitle,
  children,
  defaultOpen = false,
}: {
  step: number
  title: string
  subtitle?: string
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between py-5 px-1 text-left group"
      >
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold">
            {step}
          </span>
          <div>
            <span className="text-sm font-semibold text-foreground tracking-wide">{title}</span>
            {subtitle && <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>}
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[600px] opacity-100 pb-5 px-1" : "max-h-0 opacity-0"
        }`}
      >
        {children}
      </div>
    </div>
  )
}

export type CornerVariant = "outside" | "inside"

export function BookshelfConfigurator() {
  const defaultWidth = 69.75

  const [mainType, setMainType] = useState<MainType>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) { try { return JSON.parse(saved).mainType || "bookshelf" } catch { return "bookshelf" } }
    return "bookshelf"
  })

  const [cornerVariant, setCornerVariant] = useState<CornerVariant>("outside")

  const [width, setWidth] = useState<number>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) { try { return JSON.parse(saved).width || defaultWidth } catch { return defaultWidth } }
    return defaultWidth
  })

  const [width2, setWidth2] = useState<number>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) { try { return JSON.parse(saved).width2 || 50 } catch { return 50 } }
    return 50
  })

  const [selectedFinish, setSelectedFinish] = useState<string>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) { try { return JSON.parse(saved).selectedFinish || "Oak/Oak" } catch { return "Oak/Oak" } }
    return "Oak/Oak"
  })

  const [shelves, setShelves] = useState<ShelfConfig[]>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) {
      try {
        return JSON.parse(saved).shelves || [
          { height: 14, depth: 13 }, { height: 14, depth: 13 },
          { height: 14, depth: 13 }, { height: 14, depth: 13 },
        ]
      } catch { /* fall through */ }
    }
    return [
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
    ]
  })

  const [shelves2, setShelves2] = useState<ShelfConfig[]>(() => {
    const saved = safeGetItem("bookshelf-config")
    if (saved) {
      try {
        return JSON.parse(saved).shelves2 || [
          { height: 14, depth: 13 }, { height: 14, depth: 13 },
          { height: 14, depth: 13 }, { height: 14, depth: 13 },
        ]
      } catch { /* fall through */ }
    }
    return [
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
    ]
  })

  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [checkoutError, setCheckoutError] = useState<string | null>(null)
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; finishName: string; imageSrc: string }>({
    isOpen: false, finishName: "", imageSrc: "",
  })
  const bookshelf3DRef = useRef<Bookshelf3DViewRef>(null)
  const mainPreviewRef = useRef<HTMLDivElement>(null)
  const bookshelfType: BookshelfType = (mainType === "portal" || mainType === "cathedral" || mainType === "usurround") ? "bookshelf" : mainType

  useEffect(() => {
    const defaults: Record<MainType, number> = { rack: 2, bookshelf: 4, corner: 4, portal: 4, cathedral: 5, usurround: 4 }
    const count = defaults[mainType]
    const newShelves = Array(count).fill(null).map(() => ({ height: 14 as const, depth: 13 as const }))
    setShelves(newShelves)
    setShelves2(newShelves.map(s => ({ ...s })))
  }, [mainType])

  useEffect(() => {
    safeSetItem("bookshelf-config", JSON.stringify({ mainType, width, width2, selectedFinish, shelves, shelves2 }))
    setCheckoutError(null)
  }, [mainType, width, width2, selectedFinish, shelves, shelves2])

  // Emit height to parent iframe for dynamic resizing
  useEffect(() => {
    const emitHeight = () => {
      try {
        window.parent.postMessage({ type: 'pbs-height', height: document.documentElement.scrollHeight }, '*')
      } catch { /* ignore */ }
    }
    emitHeight()
    const observer = new ResizeObserver(emitHeight)
    observer.observe(document.documentElement)
    return () => observer.disconnect()
  }, [])

  // Also emit height when config changes
  useEffect(() => {
    try {
      window.parent.postMessage({ type: 'pbs-height', height: document.documentElement.scrollHeight }, '*')
    } catch { /* ignore */ }
  }, [mainType, width, width2, selectedFinish, shelves, shelves2])

  const totalHeight = calculateTotalHeight(shelves)

  const maxShelfDepth = Math.max(...shelves.map(s => s.depth), ...(mainType === "corner" ? shelves2.map(s => s.depth) : []))

  const { result, totalPrice, totalArea } = useMemo(() => {
    try {
      const isInsideCorner = mainType === "corner" && cornerVariant === "inside"
      const config: BookshelfConfig = {
        type: isInsideCorner ? "bookshelf" : bookshelfType,
        totalWidth: width, shelves, finish: selectedFinish,
        width2: mainType === "corner" && !isInsideCorner ? width2 : undefined,
        shelves2: mainType === "corner" && !isInsideCorner ? shelves2 : undefined,
      }

      let calcResult: BookshelfResult
      if (isInsideCorner) {
        const arm1 = calculateBookshelf({ type: "bookshelf", totalWidth: width, shelves, finish: selectedFinish })
        const arm2 = calculateBookshelf({ type: "bookshelf", totalWidth: width2, shelves: shelves2, finish: selectedFinish })
        const skuMap = new Map<string, { type: string; quantity: number }>()
        for (const sku of [...arm1.allSkus, ...arm2.allSkus]) {
          const existing = skuMap.get(sku.name)
          if (existing) existing.quantity += sku.totalQuantity
          else skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
        }
        const allSkus = Array.from(skuMap.entries())
          .map(([name, data]) => ({ name, type: data.type, totalQuantity: data.quantity }))
          .sort((a, b) => a.type.localeCompare(b.type))
        calcResult = {
          config,
          totalHeight: arm1.totalHeight,
          totalModules: arm1.totalModules + arm2.totalModules,
          boards: [...arm1.boards, ...arm2.boards],
          shelves: [...arm1.shelves, ...arm2.shelves],
          allSkus,
        }
      } else {
        calcResult = calculateBookshelf(config)
      }

      const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)
      let areaInSqFt: number
      if (mainType === "corner") {
        if (cornerVariant === "inside") {
          areaInSqFt = (totalHeight * width + totalHeight * width2) / 144
        } else {
          areaInSqFt = (totalHeight * width + totalHeight * width2 - totalHeight * maxShelfDepth) / 144
        }
      } else {
        areaInSqFt = (totalHeight * width) / 144
      }
      const price = areaInSqFt * (finishOption?.price || 0)
      return { result: calcResult, totalPrice: price, totalArea: areaInSqFt }
    } catch {
      return { result: null, totalPrice: 0, totalArea: 0 }
    }
  }, [bookshelfType, width, width2, shelves, shelves2, selectedFinish, totalHeight, mainType, maxShelfDepth, cornerVariant])

  const corner3DModules = useMemo(() => {
    if (mainType !== "corner") {
      return { arm1: undefined, arm2: undefined }
    }
    try {
      const arm1 = calculateBookshelf({ type: "bookshelf", totalWidth: width, shelves, finish: selectedFinish })
      const arm2 = calculateBookshelf({ type: "bookshelf", totalWidth: width2, shelves: shelves2, finish: selectedFinish })
      return {
        arm1: arm1.shelves.map((s) => s.modules),
        arm2: arm2.shelves.map((s) => s.modules),
      }
    } catch {
      return { arm1: undefined, arm2: undefined }
    }
  }, [mainType, width, width2, shelves, shelves2, selectedFinish])

  const addShelf = () => {
    if (shelves.length < 8) {
      const topDepth = (shelves[shelves.length - 1]?.depth || 13) as 7 | 10 | 13
      const newShelf: ShelfConfig = { height: 14, depth: topDepth }
      setShelves([...shelves, newShelf])
      setShelves2([...shelves, newShelf].map(s => ({ ...s })))
    }
  }
  const removeShelf = () => {
    if (shelves.length > 1) {
      const newShelves = shelves.slice(0, -1)
      setShelves(newShelves)
      setShelves2(newShelves.map(s => ({ ...s })))
    }
  }

  const updateShelf = (index: number, field: "height" | "depth", value: number) => {
    const newShelves = [...shelves]
    newShelves[index] = { ...newShelves[index], [field]: value }
    const finalShelves = field === "depth" ? enforceDepthConstraints(newShelves, index) : newShelves
    setShelves(finalShelves)
    setShelves2(finalShelves.map(s => ({ ...s })))
  }

  const updateShelf2 = updateShelf

  async function handleAddToCart() {
    if (!result) return
    setIsAddingToCart(true)
    const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)
    const finishLabel = finishOption?.label || selectedFinish
    let imageDataUrl: string | null = null
    try { if (bookshelf3DRef.current) imageDataUrl = await bookshelf3DRef.current.captureImage() } catch { /* */ }

    const payload = {
      type: "pbs-checkout",
      price: totalPrice.toFixed(2),
      config: {
        bookshelfType,
        finish: finishLabel,
        totalArea: totalArea.toFixed(2),
        pricePerSqFt: finishOption?.price.toFixed(2) || "0.00",
        dimensions: {
          width,
          ...(mainType === "corner" ? { width2 } : {}),
          height: totalHeight,
        },
        shelves,
        ...(mainType === "corner" ? { shelves2 } : {}),
        skus: result.allSkus,
      },
      imageDataUrl,
    }

    try {
      const checkoutUrl = await createShopifyCheckout({ price: totalPrice.toFixed(2), config: payload.config, imageDataUrl })
      if (window.top) {
        window.top.location.href = checkoutUrl
      } else {
        window.location.href = checkoutUrl
      }
    } catch (err) {
      console.error('Checkout error:', err)
      setCheckoutError('Something went wrong. Please try again or contact us.')
    } finally {
      setIsAddingToCart(false)
    }
  }

  function handleReset() {
    setWidth(70)
    setWidth2(50)
    const defaultShelves: ShelfConfig[] = [
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
      { height: 14, depth: 13 }, { height: 14, depth: 13 },
    ]
    setShelves(defaultShelves)
    setShelves2(defaultShelves.map(s => ({ ...s })))
    setSelectedFinish("Maple/Maple")
    setMainType("bookshelf")
  }

  const finishOption = FINISH_OPTIONS.find((f) => f.id === selectedFinish)

  if (mainType === "portal") {
    return <PortalConfigurator onTypeChange={(t) => setMainType(t as MainType)} />
  }

  if (mainType === "cathedral") {
    return <CathedralConfigurator onTypeChange={(t) => setMainType(t as MainType)} />
  }

  if (mainType === "usurround") {
    return <USurroundConfigurator onTypeChange={(t) => setMainType(t as MainType)} />
  }

  return (
    <div className="w-full configurator-root">

      {/* ─── Main layout ─── */}
      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row configurator-layout">
        {/* 3D Preview — sticky on desktop */}
        <div ref={mainPreviewRef} className="lg:sticky lg:top-0 lg:h-screen lg:w-[60%] xl:w-[65%] flex-shrink-0 bg-secondary/30 configurator-preview">
          <div className="relative h-full min-h-[50vh] lg:min-h-0 pt-[3px] px-1 lg:p-6">
            <FinishPreviewChips
              onSelectFinish={setSelectedFinish}
              selectedFinish={selectedFinish}
            />

            {/* Dimension badge */}
            <div className="absolute top-6 right-6 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Dimensions</div>
              <div className="text-sm font-semibold text-foreground leading-tight">
                {mainType === "corner" ? (
                  <>{toFraction(width)} × {toFraction(width2)} × {toFraction(totalHeight)}</>
                ) : (
                  <>{toFraction(width)} × {toFraction(totalHeight)}</>
                )}
              </div>
            </div>

            {result ? (
              <Bookshelf3DView
                ref={bookshelf3DRef}
                style={bookshelfType}
                width={width}
                width2={mainType === "corner" ? width2 : undefined}
                shelves={shelves}
                shelves2={mainType === "corner" ? shelves2 : undefined}
                finish={selectedFinish}
                modules={mainType === "corner" ? corner3DModules.arm1 : result.shelves.map((s) => s.modules)}
                modules2={mainType === "corner" ? corner3DModules.arm2 : undefined}
                cornerVariant={mainType === "corner" ? cornerVariant : undefined}
                isMobile={false}
                hideTooltip
              />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                Configure your bookshelf to see preview
              </div>
            )}
          </div>
        </div>

        {result && (
          <FloatingPreview mainPreviewRef={mainPreviewRef}>
            {(isMini) => (
              <Bookshelf3DView
                style={bookshelfType}
                width={width}
                width2={mainType === "corner" ? width2 : undefined}
                shelves={shelves}
                shelves2={mainType === "corner" ? shelves2 : undefined}
                finish={selectedFinish}
                modules={mainType === "corner" ? corner3DModules.arm1 : result.shelves.map((s) => s.modules)}
                modules2={mainType === "corner" ? corner3DModules.arm2 : undefined}
                cornerVariant={mainType === "corner" ? cornerVariant : undefined}
                isMobile={isMini}
                hideTooltip
              />
            )}
          </FloatingPreview>
        )}

        {/* Controls panel */}
        <div className="lg:w-[40%] xl:w-[35%] flex-shrink-0 configurator-config">
          <div className="p-4 md:p-6 lg:p-8 space-y-0 configurator-config-inner">
            {/* ─── Step 1: Type ─── */}
            <ConfigSection step={1} title="Type" subtitle="Choose your style" defaultOpen={true}>
               <div className="grid grid-cols-6 gap-2">
                {(["rack", "bookshelf", "corner", "portal", "cathedral", "usurround"] as const).map((type) => (
                  <button
                    key={type}
                    onClick={() => setMainType(type)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${
                      mainType === type
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border bg-card hover:border-accent/40"
                    }`}
                  >
                    <img src={TYPE_ICONS[type]} alt={type} className="h-10 w-10 object-contain" />
                    <span className="text-[10px] font-medium text-foreground capitalize">{type === "rack" ? "Horiz." : type === "portal" ? "Portal" : type === "cathedral" ? "Cathed." : type === "usurround" ? "U-Surr." : type}</span>
                  </button>
                 ))}
               </div>

               {/* Corner sub-selector */}
               {mainType === "corner" && (
                 <div className="mt-3 grid grid-cols-2 gap-2">
                   <button
                     onClick={() => setCornerVariant("outside")}
                     className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all border ${
                       cornerVariant === "outside"
                         ? "border-accent bg-accent/5 shadow-sm"
                         : "border-border bg-card hover:border-accent/40"
                     }`}
                   >
                     <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M5 5 L5 35 L20 35 L20 20 L35 20 L35 5 Z" stroke="currentColor" strokeWidth="2" fill="none" />
                       <line x1="8" y1="12" x2="18" y2="12" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="8" y1="19" x2="18" y2="19" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="8" y1="26" x2="18" y2="26" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="14" x2="32" y2="14" stroke="currentColor" strokeWidth="1.5" />
                     </svg>
                     <span className="text-[10px] font-medium text-foreground">Outside Corner</span>
                   </button>
                   <button
                     onClick={() => setCornerVariant("inside")}
                     className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all border ${
                       cornerVariant === "inside"
                         ? "border-accent bg-accent/5 shadow-sm"
                         : "border-border bg-card hover:border-accent/40"
                     }`}
                   >
                     <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
                       <path d="M5 35 L5 20 L20 20 L20 5 L35 5 L35 35 Z" stroke="currentColor" strokeWidth="2" fill="none" />
                       <line x1="8" y1="24" x2="18" y2="24" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="8" y1="28" x2="18" y2="28" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="8" y1="32" x2="18" y2="32" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="8" x2="32" y2="8" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="14" x2="32" y2="14" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="20" x2="32" y2="20" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="26" x2="32" y2="26" stroke="currentColor" strokeWidth="1.5" />
                       <line x1="22" y1="32" x2="32" y2="32" stroke="currentColor" strokeWidth="1.5" />
                     </svg>
                     <span className="text-[10px] font-medium text-foreground">Inside Corner</span>
                     {cornerVariant === "inside" && (
                       <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
                     )}
                   </button>
                 </div>
               )}
            </ConfigSection>

            {/* ─── Step 2: Width ─── */}
            <ConfigSection step={2} title="Width" subtitle={mainType === "corner" ? `W1: ${toFraction(width)} · W2: ${toFraction(width2)}` : `${toFraction(width)} (${toFeetAndInches(width)})`} defaultOpen={true}>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">{mainType === "corner" ? "Width 1 (main arm)" : "Total Width"}</Label>
                  <Slider value={[width]} onValueChange={([v]) => setWidth(v)} min={25} max={200} step={0.25} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>25"</span>
                    <span>200"</span>
                  </div>
                </div>
                {mainType === "corner" && (
                  <>
                    <div>
                      <Label className="text-xs text-muted-foreground mb-1 block">Width 2 (perpendicular arm)</Label>
                      <Slider value={[width2]} onValueChange={([v]) => setWidth2(v)} min={25} max={200} step={0.25} className="w-full" />
                      <div className="flex justify-between text-xs text-muted-foreground mt-1">
                        <span>25"</span>
                        <span>200"</span>
                      </div>
                    </div>
                <p className="text-[10px] text-muted-foreground">
                  {cornerVariant === "inside"
                    ? "Inside corner — backs meet flush, no overlap deduction."
                    : "Corner depth overlap is automatically handled in pricing and materials."}
                </p>
                  </>
                )}
              </div>
            </ConfigSection>

            {/* ─── Step 3: Shelves ─── */}
            <ConfigSection step={3} title="Shelves" subtitle={`${shelves.length} shelves · ${toFraction(totalHeight)} tall`} defaultOpen={false}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Number of shelves</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={removeShelf} disabled={shelves.length <= 1}>
                      <Minus className="h-3.5 w-3.5" />
                    </Button>
                    <span className="text-base font-semibold w-6 text-center text-foreground">{shelves.length}</span>
                    <Button variant="outline" size="icon" className="h-8 w-8 rounded-full" onClick={addShelf} disabled={shelves.length >= 8}>
                      <Plus className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="space-y-2">
                    {[...shelves].reverse().map((shelf, revIndex) => {
                      const index = shelves.length - 1 - revIndex
                      return (
                      <div key={index}>
                        <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                          <span className="text-xs font-medium text-muted-foreground w-14">Shelf {index + 1}</span>
                          <Select value={shelf.height.toString()} onValueChange={(v) => updateShelf(index, "height", Number.parseInt(v))}>
                            <SelectTrigger className="w-16 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[12, 14].map((h) => (<SelectItem key={h} value={h.toString()}>{h}"</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <span className="text-[10px] text-muted-foreground uppercase">H</span>
                          <Select value={shelf.depth.toString()} onValueChange={(v) => updateShelf(index, "depth", Number.parseInt(v))}>
                            <SelectTrigger className="w-16 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {getAvailableDepths(shelves, index).map((d) => (<SelectItem key={d} value={d.toString()}>{d}"</SelectItem>))}
                            </SelectContent>
                          </Select>
                          <span className="text-[10px] text-muted-foreground uppercase">D</span>
                        </div>
                        {index > 0 && shelf.depth < shelves[index - 1].depth && (
                          <div className="text-[10px] text-muted-foreground italic pl-3 mt-1">↑ Transition board will be added here</div>
                        )}
                      </div>
                      )
                    })}
                  </div>
              </div>
            </ConfigSection>

            {/* ─── Step 4: Finish ─── */}
            <ConfigSection step={4} title="Finish" subtitle={finishOption?.label} defaultOpen={false}>
              <div className="grid grid-cols-4 gap-2">
                {FINISH_OPTIONS.map((finish) => (
                  <button
                    key={finish.id}
                    onClick={() => !finish.comingSoon && setSelectedFinish(finish.id)}
                    disabled={finish.comingSoon}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${
                      selectedFinish === finish.id
                        ? "border-accent bg-accent/5 shadow-sm"
                        : "border-border bg-card hover:border-accent/40"
                    } ${finish.comingSoon ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}
                  >
                    {finish.comingSoon && (
                      <div className="absolute -top-1 -right-1 bg-muted-foreground text-background text-[8px] font-bold px-1.5 py-0.5 rounded-full">
                        Sold out
                      </div>
                    )}
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-border shadow-sm">
                      {finish.id.includes("/") && finish.color1 !== finish.color2 ? (
                        <div className="flex w-full h-full">
                          <div className="w-1/2 h-full" style={{ backgroundColor: finish.color1 }} />
                          <div className="w-1/2 h-full" style={{ backgroundColor: finish.color2 }} />
                        </div>
                      ) : (
                        <div className="w-full h-full" style={{ backgroundColor: finish.color1 }} />
                      )}
                    </div>
                    <span className="text-[10px] font-medium text-foreground leading-tight text-center">
                      {finish.label.replace("/", " / ")}
                    </span>
                    {selectedFinish === finish.id && (
                      <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />
                    )}
                  </button>
                ))}
              </div>
            </ConfigSection>

            {/* ─── Price + Add to Cart (always visible) ─── */}
            <div className="pt-4 space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-display font-bold text-foreground">${totalPrice.toFixed(2)}</span>
              </div>
              {checkoutError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">
                  {checkoutError}{' — '}
                  <a
                    href="https://www.perfectbookshelf.com/pages/contact"
                    target="_top"
                    className="underline font-medium"
                  >
                    Contact us
                  </a>
                </div>
              )}
              <Button
                onClick={handleAddToCart}
                disabled={isAddingToCart || !result}
                className="w-full h-12 rounded-xl text-base font-semibold gap-2"
              >
                <ShoppingCart className="h-4 w-4" />
                {isAddingToCart ? "Processing..." : "Add to Cart"}
              </Button>
            </div>

            {/* spacing at bottom */}
            <div className="h-8" />
          </div>
        </div>
      </div>

      <FinishPreviewModal
        isOpen={previewModal.isOpen}
        onClose={() => setPreviewModal({ isOpen: false, finishName: "", imageSrc: "" })}
        finishName={previewModal.finishName}
        imageSrc={previewModal.imageSrc}
      />
    </div>
  )
}
