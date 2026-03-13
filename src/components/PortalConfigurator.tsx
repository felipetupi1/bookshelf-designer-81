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
import { Plus, Minus, RotateCcw, ShoppingCart, ChevronDown, DoorOpen, Monitor, Flame, HelpCircle } from "lucide-react"
import type { ShelfConfig } from "@/lib/types"
import { calculateBookshelf } from "@/lib/bookshelf-calculator"
import { PortalSchematic } from "./PortalSchematic"
import { Portal3DView, type Portal3DViewRef } from "./Portal3DView"
import { FinishPreviewModal } from "./FinishPreviewModal"
import { FinishPreviewChips } from "./FinishPreviewChips"
import { FloatingPreview } from "./FloatingPreview"
import { createShopifyCheckout } from "@/lib/shopify-checkout"

const MIN_MODULE_WIDTH = 7.25

const FINISH_OPTIONS = [
  { id: "White/White", label: "White", price: 41.6, color1: "#f5f5f5", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null },
  { id: "Maple/Maple", label: "Maple", price: 49.21, color1: "#E8D4B8", color2: "#E8D4B8", comingSoon: false, previewImage: "/images/finishes/maple1.jpeg" },
  { id: "Black/Black", label: "Black", price: 54.59, color1: "#1a1a1a", color2: "#1a1a1a", comingSoon: true, previewImage: null as string | null },
  { id: "Oak/White", label: "Oak/White", price: 60.18, color1: "#D4A574", color2: "#f5f5f5", comingSoon: false, previewImage: null as string | null },
  { id: "Maple/Black", label: "Maple/Black", price: 65.1, color1: "#E8D4B8", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/maple-black.jpeg" },
  { id: "Oak/Oak", label: "White Oak", price: 68.15, color1: "#D4A574", color2: "#D4A574", comingSoon: false, previewImage: "/images/finishes/oak.jpg" },
  { id: "Walnut/Walnut", label: "Walnut", price: 76.2, color1: "#5D432C", color2: "#5D432C", comingSoon: false, previewImage: "/images/finishes/walnut.jpg" },
  { id: "Oak/Black", label: "Oak/Black", price: 77.99, color1: "#D4A574", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/oak-black.jpeg" },
]

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  const eighths = Math.round(fraction * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const fractionMap: { [key: number]: string } = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" }
  return `${whole} ${fractionMap[eighths]}"`
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

interface SizePreset { label: string; w: number; h: number }

const SIZE_PRESETS: Record<string, SizePreset[]> = {
  door: [
    { label: '24"×80"', w: 24, h: 80 }, { label: '28"×80"', w: 28, h: 80 }, { label: '32"×80"', w: 32, h: 80 }, { label: '36"×80"', w: 36, h: 80 },
    { label: '24"×84"', w: 24, h: 84 }, { label: '28"×84"', w: 28, h: 84 }, { label: '32"×84"', w: 32, h: 84 }, { label: '36"×84"', w: 36, h: 84 },
    { label: '24"×96"', w: 24, h: 96 }, { label: '28"×96"', w: 28, h: 96 }, { label: '32"×96"', w: 32, h: 96 }, { label: '36"×96"', w: 36, h: 96 },
  ],
  window: [
    { label: '30"×36"', w: 30, h: 36 }, { label: '30"×48"', w: 30, h: 48 }, { label: '30"×60"', w: 30, h: 60 }, { label: '30"×72"', w: 30, h: 72 },
    { label: '36"×36"', w: 36, h: 36 }, { label: '36"×48"', w: 36, h: 48 }, { label: '36"×60"', w: 36, h: 60 }, { label: '36"×72"', w: 36, h: 72 },
    { label: '48"×36"', w: 48, h: 36 }, { label: '48"×48"', w: 48, h: 48 }, { label: '48"×60"', w: 48, h: 60 }, { label: '48"×72"', w: 48, h: 72 },
  ],
  tv: [
    { label: '32"', w: 32, h: 18 }, { label: '43"', w: 43, h: 24 }, { label: '55"', w: 55, h: 31 },
    { label: '65"', w: 65, h: 37 }, { label: '75"', w: 75, h: 42 }, { label: '85"', w: 85, h: 48 },
  ],
  fireplace: [
    { label: '36"×36"', w: 36, h: 36 }, { label: '42"×36"', w: 42, h: 36 }, { label: '48"×40"', w: 48, h: 40 },
    { label: '54"×40"', w: 54, h: 40 }, { label: '60"×42"', w: 60, h: 42 },
  ],
}

function ConfigSection({ step, title, subtitle, children, defaultOpen = false }: {
  step: number; title: string; subtitle?: string; children: React.ReactNode; defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-b border-border last:border-b-0">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between py-5 px-1 text-left group">
        <div className="flex items-center gap-3">
          <span className="flex items-center justify-center w-7 h-7 rounded-full bg-accent text-accent-foreground text-xs font-bold">{step}</span>
          <div>
            <span className="text-sm font-semibold text-foreground tracking-wide">{title}</span>
            {subtitle && <span className="block text-xs text-muted-foreground mt-0.5">{subtitle}</span>}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-[2000px] opacity-100 pb-5 px-1" : "max-h-0 opacity-0"}`}>
        {children}
      </div>
    </div>
  )
}

type ObjectPreset = "door" | "window" | "tv" | "fireplace" | "other"

const PRESET_ICONS: { id: ObjectPreset; label: string; icon: React.ElementType }[] = [
  { id: "door", label: "Door", icon: DoorOpen },
  { id: "window", label: "Window", icon: () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="w-5 h-5">
      <rect x="3" y="3" width="18" height="18" rx="1" /><line x1="12" y1="3" x2="12" y2="21" /><line x1="3" y1="12" x2="21" y2="12" />
    </svg>
  )},
  { id: "tv", label: "TV", icon: Monitor },
  { id: "fireplace", label: "Fireplace", icon: Flame },
  { id: "other", label: "Other", icon: HelpCircle },
]

function defaultShelvesForHeight(wallHeight: number): ShelfConfig[] {
  const count = Math.max(1, Math.min(8, Math.floor(wallHeight / 15)))
  return Array(count).fill(null).map(() => ({ height: 14 as const, depth: 10 as const }))
}

interface PortalConfiguratorProps {
  onTypeChange: (type: string) => void
}

export function PortalConfigurator({ onTypeChange }: PortalConfiguratorProps) {
  const [wallWidth, setWallWidth] = useState(100)
  const [wallHeight, setWallHeight] = useState(96)
  const [objectWidth, setObjectWidth] = useState(36)
  const [objectHeight, setObjectHeight] = useState(82)
  const [floorToObject, setFloorToObject] = useState(0)
  const [rightGap, setRightGap] = useState(32)

  const leftGap = wallWidth - objectWidth - rightGap
  const topSectionHeight = wallHeight - floorToObject - objectHeight
  const objectTop = floorToObject + objectHeight

  const hasLeft = leftGap >= MIN_MODULE_WIDTH
  const hasRight = rightGap > 0 && rightGap >= MIN_MODULE_WIDTH
  const hasCenter = objectWidth >= MIN_MODULE_WIDTH

  const [objectType, setObjectType] = useState<ObjectPreset>("door")
  const [selectedPresetSize, setSelectedPresetSize] = useState<string | null>(null)

  const [globalShelves, setGlobalShelves] = useState<ShelfConfig[]>(() => defaultShelvesForHeight(96))

  // Compute absolute row positions from global shelves
  const rowPositions = useMemo(() => {
    const rows: { index: number; boardY: number; moduleY: number; topBoardY: number; nextY: number }[] = []
    let y = 0
    for (let i = 0; i < globalShelves.length; i++) {
      const shelf = globalShelves[i]
      const boardY = y
      const moduleY = y + 0.75
      const topBoardY = moduleY + shelf.height
      const nextY = topBoardY + 0.75
      if (nextY > wallHeight + 0.01) break
      rows.push({ index: i, boardY, moduleY, topBoardY, nextY })
      y = nextY
    }
    return rows
  }, [globalShelves, wallHeight])

  // Determine which rows go to which zone
  const { sideRowIndices, bottomRowIndices, topRowIndices } = useMemo(() => {
    const sideRowIndices: number[] = []
    const bottomRowIndices: number[] = []
    const topRowIndices: number[] = []
    rowPositions.forEach((row) => {
      sideRowIndices.push(row.index)
      // Bottom: row fully below object
      if (row.topBoardY + 0.75 <= floorToObject) {
        bottomRowIndices.push(row.index)
      }
      // Top: row fully above object
      if (row.moduleY >= objectTop) {
        topRowIndices.push(row.index)
      }
    })
    return { sideRowIndices, bottomRowIndices, topRowIndices }
  }, [rowPositions, floorToObject, objectTop])

  // Extract shelf configs for each zone (for calculateBookshelf)
  const sideShelves = sideRowIndices.map(i => globalShelves[i])
  const bottomShelves = bottomRowIndices.map(i => globalShelves[i])
  const topShelvesFiltered = topRowIndices.map(i => globalShelves[i])

  const [selectedFinish, setSelectedFinish] = useState("Oak/Oak")
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; finishName: string; imageSrc: string }>({
    isOpen: false, finishName: "", imageSrc: "",
  })
  const portal3DRef = useRef<Portal3DViewRef>(null)
  const mainPreviewRef = useRef<HTMLDivElement>(null)

  const showFloorToObject = objectType === "tv" || objectType === "window" || objectType === "other"

  function applyPreset(preset: ObjectPreset) {
    setObjectType(preset)
    setSelectedPresetSize(null)
    switch (preset) {
      case "door": setObjectWidth(36); setObjectHeight(82); setFloorToObject(0); setRightGap(Math.round((wallWidth - 36) / 2)); break
      case "window": setFloorToObject(36); setRightGap(Math.round((wallWidth - objectWidth) / 2)); break
      case "tv": setObjectWidth(43); setObjectHeight(26); setFloorToObject(30); setRightGap(Math.round((wallWidth - 43) / 2)); setSelectedPresetSize('43"'); break
      case "fireplace": setFloorToObject(0); setRightGap(Math.round((wallWidth - objectWidth) / 2)); break
      default: break
    }
  }

  function applySizePreset(preset: SizePreset) {
    const maxW = wallWidth - 4
    const w = Math.min(preset.w, maxW)
    const h = Math.min(preset.h, wallHeight - 14)
    setObjectWidth(w)
    setObjectHeight(h)
    setSelectedPresetSize(preset.label)
    if (objectType === "window" || objectType === "tv" || objectType === "fireplace") {
      setRightGap(Math.round((wallWidth - w) / 2))
    }
    if (floorToObject + h > wallHeight - 14) {
      setFloorToObject(Math.max(0, wallHeight - h - 14))
    }
  }

  useEffect(() => {
    const maxL2 = wallWidth - MIN_MODULE_WIDTH
    if (objectWidth > maxL2) setObjectWidth(Math.max(1, maxL2))
    const maxH2 = wallHeight - floorToObject - 12
    if (objectHeight > maxH2 && maxH2 > 0) setObjectHeight(maxH2)
    const maxH1 = wallHeight - objectHeight - 12
    if (floorToObject > maxH1 && maxH1 >= 0) setFloorToObject(Math.max(0, maxH1))
    const maxW1 = wallWidth - objectWidth
    if (rightGap > maxW1) setRightGap(Math.max(0, maxW1))
  }, [wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, rightGap])

  // Calculate modules for each zone
  const leftResult = useMemo(() => {
    if (!hasLeft || leftGap < 25) return null
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: leftGap, shelves: sideShelves, finish: selectedFinish }) } catch { return null }
  }, [hasLeft, leftGap, sideShelves, selectedFinish])

  const rightResult = useMemo(() => {
    if (!hasRight || rightGap < 25) return null
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: rightGap, shelves: sideShelves, finish: selectedFinish }) } catch { return null }
  }, [hasRight, rightGap, sideShelves, selectedFinish])

  const bottomResult = useMemo(() => {
    if (!hasCenter || bottomShelves.length === 0 || objectWidth < 25) return null
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: objectWidth, shelves: bottomShelves, finish: selectedFinish }) } catch { return null }
  }, [hasCenter, objectWidth, bottomShelves, selectedFinish])

  const topResult = useMemo(() => {
    if (!hasCenter || topShelvesFiltered.length === 0 || objectWidth < 25) return null
    try { return calculateBookshelf({ type: "bookshelf", totalWidth: objectWidth, shelves: topShelvesFiltered, finish: selectedFinish }) } catch { return null }
  }, [hasCenter, objectWidth, topShelvesFiltered, selectedFinish])

  const { totalPrice, totalArea } = useMemo(() => {
    const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
    let area = 0
    if (hasLeft) area += leftGap * wallHeight
    if (hasRight) area += rightGap * wallHeight
    if (hasCenter && bottomShelves.length > 0) area += objectWidth * floorToObject
    if (hasCenter && topShelvesFiltered.length > 0) area += objectWidth * topSectionHeight
    area = area / 144
    const price = area * (finishOption?.price || 0)
    return { totalPrice: price, totalArea: area }
  }, [hasLeft, hasRight, hasCenter, leftGap, rightGap, objectWidth, wallHeight, topSectionHeight, floorToObject, selectedFinish, bottomShelves.length, topShelvesFiltered.length])

  // Build per-row module arrays for left/right (indexed by global row index)
  // and per-zone module arrays for bottom/top
  const leftModules = leftResult?.shelves.map(s => s.modules)
  const rightModules = rightResult?.shelves.map(s => s.modules)
  const bottomModules = bottomResult?.shelves.map(s => s.modules)
  const topModules = topResult?.shelves.map(s => s.modules)

  const globalOps = {
    add: () => { if (globalShelves.length < 8) setGlobalShelves([...globalShelves, { height: 14, depth: (globalShelves[globalShelves.length - 1]?.depth || 10) as 7 | 10 | 13 }]) },
    remove: () => { if (globalShelves.length > 1) setGlobalShelves(globalShelves.slice(0, -1)) },
    update: (index: number, field: "height" | "depth", value: number) => {
      const newShelves = [...globalShelves]
      newShelves[index] = { ...newShelves[index], [field]: value }
      setGlobalShelves(field === "depth" ? enforceDepthConstraints(newShelves, index) : newShelves)
    },
  }

  async function handleAddToCart() {
    setIsAddingToCart(true)
    const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
    let imageDataUrl: string | null = null
    try { if (portal3DRef.current) imageDataUrl = await portal3DRef.current.captureImage() } catch { /* */ }

    // Consolidate SKUs from all zones
    const skuMap = new Map<string, { type: string; quantity: number }>()
    for (const res of [leftResult, rightResult, bottomResult, topResult]) {
      if (!res) continue
      for (const sku of res.allSkus) {
        const existing = skuMap.get(sku.name)
        if (existing) existing.quantity += sku.totalQuantity
        else skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
      }
    }
    const skus = Array.from(skuMap.entries()).map(([name, d]) => ({ name, type: d.type, totalQuantity: d.quantity })).sort((a, b) => a.type.localeCompare(b.type))

    const payload = {
      type: "pbs-checkout",
      price: totalPrice.toFixed(2),
      config: {
        bookshelfType: "portal",
        finish: finishOption?.label || selectedFinish,
        totalArea: totalArea.toFixed(2),
        pricePerSqFt: finishOption?.price.toFixed(2) || "0.00",
        dimensions: { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, rightGap, leftGap, topHeight: topSectionHeight },
        shelves: globalShelves,
        skus,
      },
      imageDataUrl,
    }

    try {
      const checkoutUrl = await createShopifyCheckout({ price: totalPrice.toFixed(2), config: payload.config, imageDataUrl })
      window.open(checkoutUrl, '_blank')
    } catch (err) {
      console.error('Checkout error:', err)
      alert('Failed to create checkout. Please try again.')
    }
    setIsAddingToCart(false)
  }

  function handleReset() {
    setWallWidth(100); setWallHeight(96); setObjectWidth(36); setObjectHeight(82)
    setFloorToObject(0); setRightGap(32); setObjectType("door"); setSelectedPresetSize(null)
    setGlobalShelves(defaultShelvesForHeight(96))
    setSelectedFinish("Oak/Oak")
  }

  const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)

  const currentPresets = SIZE_PRESETS[objectType]
  const maxL2 = wallWidth - MIN_MODULE_WIDTH
  const maxH2 = Math.max(1, wallHeight - floorToObject - 12)
  const maxH1 = Math.max(0, wallHeight - objectHeight - 12)
  const maxW1 = Math.max(0, wallWidth - objectWidth)

  const fittingRows = rowPositions.length
  const zoneFitSummary = [
    hasLeft ? `Left: ${fittingRows} rows` : null,
    hasRight ? `Right: ${fittingRows} rows` : null,
    hasCenter && bottomRowIndices.length > 0 ? `Below: ${bottomRowIndices.length} rows` : null,
    hasCenter && topRowIndices.length > 0 ? `Above: ${topRowIndices.length} rows` : null,
  ].filter(Boolean).join(" · ")

  return (
    <div className="w-full min-h-screen configurator-root">

      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row configurator-layout">
        <div ref={mainPreviewRef} className="lg:sticky lg:top-0 lg:h-screen lg:w-[60%] xl:w-[65%] flex-shrink-0 bg-secondary/30 configurator-preview">
          <div className="relative h-full min-h-[50vh] lg:min-h-0 pt-[3px] px-1 lg:p-6">
            <FinishPreviewChips
              finishes={FINISH_OPTIONS}
              onChipClick={(name, src) => setPreviewModal({ isOpen: true, finishName: name, imageSrc: src })}
            />

            <div className="absolute top-6 right-6 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Wall Space</div>
              <div className="text-sm font-semibold text-foreground leading-tight">{toFraction(wallWidth)} × {toFraction(wallHeight)}</div>
            </div>

            <Portal3DView
              ref={portal3DRef}
              wallWidth={wallWidth} wallHeight={wallHeight}
              objectWidth={objectWidth} objectHeight={objectHeight}
              floorToObject={floorToObject} rightGap={rightGap}
              leftGap={leftGap} topHeight={topSectionHeight}
              shelves={sideShelves}
              leftModules={leftModules} rightModules={rightModules}
              topModules={topModules} bottomModules={bottomModules}
              finish={selectedFinish} isMobile={false} hideTooltip
            />
          </div>
        </div>

        <FloatingPreview mainPreviewRef={mainPreviewRef}>
          {(isMini) => (
            <Portal3DView
              wallWidth={wallWidth} wallHeight={wallHeight}
              objectWidth={objectWidth} objectHeight={objectHeight}
              floorToObject={floorToObject} rightGap={rightGap}
              leftGap={leftGap} topHeight={topSectionHeight}
              shelves={sideShelves}
              leftModules={leftModules} rightModules={rightModules}
              topModules={topModules} bottomModules={bottomModules}
              finish={selectedFinish} isMobile={isMini} hideTooltip
            />
          )}
        </FloatingPreview>

        <div className="lg:w-[40%] xl:w-[35%] flex-shrink-0 configurator-config">
          <div className="p-4 md:p-6 lg:p-8 space-y-0 configurator-config-inner">
            <ConfigSection step={1} title="Type" subtitle="Portal" defaultOpen={true}>
              <div className="grid grid-cols-6 gap-2">
                {(["rack", "bookshelf", "corner", "portal", "cathedral", "usurround"] as const).map(type => (
                  <button key={type} onClick={() => type === "portal" ? undefined : onTypeChange(type)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${type === "portal" ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"}`}>
                    <img src={TYPE_ICONS[type]} alt={type} className="h-10 w-10 object-contain" />
                    <span className="text-[10px] font-medium text-foreground capitalize">{type === "rack" ? "Horiz." : type === "cathedral" ? "Cathed." : type === "portal" ? "Portal" : type === "usurround" ? "U-Model" : type}</span>
                    {type === "portal" && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </ConfigSection>

            <ConfigSection step={2} title="Wall Space" subtitle={`${toFraction(wallWidth)} × ${toFraction(wallHeight)}`} defaultOpen={true}>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">W — Total Width</Label>
                  <Slider value={[wallWidth]} onValueChange={([v]) => setWallWidth(v)} min={25} max={200} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span className="font-medium text-foreground">{wallWidth}"</span><span>200"</span></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">H — Total Height</Label>
                  <Slider value={[wallHeight]} onValueChange={([v]) => setWallHeight(v)} min={25} max={200} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span className="font-medium text-foreground">{wallHeight}"</span><span>200"</span></div>
                </div>
              </div>
            </ConfigSection>

            <ConfigSection step={3} title="Object Type" subtitle={objectType} defaultOpen={true}>
              <div className="space-y-4">
                <div className="grid grid-cols-5 gap-2">
                  {PRESET_ICONS.map(preset => {
                    const Icon = preset.icon
                    return (
                      <button key={preset.id} onClick={() => applyPreset(preset.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all border ${objectType === preset.id ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"}`}>
                        <Icon className="h-5 w-5" /><span className="text-[10px] font-medium text-foreground">{preset.label}</span>
                      </button>
                    )
                  })}
                </div>

                {currentPresets && (
                  <div className="space-y-2">
                    <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Standard Sizes</span>
                    <div className={`grid gap-1.5 ${objectType === "tv" ? "grid-cols-3" : "grid-cols-4"}`}>
                      {currentPresets.map(p => (
                        <button key={p.label} onClick={() => applySizePreset(p)}
                          className={`text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${selectedPresetSize === p.label ? "border-accent bg-accent/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40"}`}>
                          {p.label}
                        </button>
                      ))}
                      <button onClick={() => setSelectedPresetSize(null)}
                        className={`text-[10px] font-medium px-2 py-1.5 rounded-lg border transition-all ${selectedPresetSize === null ? "border-accent bg-accent/10 text-foreground" : "border-border bg-card text-muted-foreground hover:border-accent/40"}`}>
                        Custom
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </ConfigSection>

            <ConfigSection step={4} title="Object Dimensions" subtitle={`${objectWidth}" × ${objectHeight}"`} defaultOpen={true}>
              <div className="space-y-3">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">L2 — Object Width</Label>
                  <Slider value={[objectWidth]} onValueChange={([v]) => setObjectWidth(v)} min={1} max={maxL2} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>1"</span><span className="font-medium text-foreground">{objectWidth}"</span><span>{maxL2}"</span></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">H2 — Object Height</Label>
                  <Slider value={[objectHeight]} onValueChange={([v]) => setObjectHeight(v)} min={1} max={maxH2} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>1"</span><span className="font-medium text-foreground">{objectHeight}"</span><span>{maxH2}"</span></div>
                </div>
                {showFloorToObject && (
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">H1 — Height from Floor to Bottom of {objectType === "tv" ? "TV" : objectType === "window" ? "Window" : "Object"}</Label>
                  <Slider value={[floorToObject]} onValueChange={([v]) => setFloorToObject(v)} min={0} max={maxH1} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0"</span><span className="font-medium text-foreground">{floorToObject}"</span><span>{maxH1}"</span></div>
                </div>
                )}
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">W1 — Right Gap</Label>
                  <Slider value={[rightGap]} onValueChange={([v]) => setRightGap(v)} min={0} max={maxW1} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>0"</span><span className="font-medium text-foreground">{rightGap}"</span><span>{maxW1}"</span></div>
                </div>
                <div className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
                  <span className="text-xs text-muted-foreground">Left Gap (auto)</span>
                  <span className="text-sm font-semibold text-foreground">{leftGap}"</span>
                </div>
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2 space-y-1">
                  <p className="text-[10px] text-muted-foreground">A 2" safety margin is automatically applied between the object and all surrounding shelves.</p>
                  <p className="text-[10px] text-muted-foreground italic">Always deduct 1" from your total width measurement to account for wall imperfections.</p>
                </div>
                {!hasLeft && leftGap > 0 && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Left column too narrow (min {MIN_MODULE_WIDTH}").</div>
                )}
                {!hasRight && rightGap > 0 && rightGap < MIN_MODULE_WIDTH && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">Right column too narrow (min {MIN_MODULE_WIDTH}").</div>
                )}
              </div>
            </ConfigSection>

            <ConfigSection step={5} title="Schematic" subtitle="Live diagram" defaultOpen={true}>
              <PortalSchematic wallWidth={wallWidth} wallHeight={wallHeight} objectWidth={objectWidth} objectHeight={objectHeight} floorToObject={floorToObject} rightGap={rightGap} leftGap={leftGap} topHeight={topSectionHeight} />
            </ConfigSection>

            <ConfigSection step={6} title="Shelves" subtitle={`${globalShelves.length} shelves · ${fittingRows} fit`} defaultOpen={true}>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Shelf Configuration</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={globalOps.remove} disabled={globalShelves.length <= 1}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-semibold w-5 text-center text-foreground">{globalShelves.length}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={globalOps.add} disabled={globalShelves.length >= 8}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                {[...globalShelves].reverse().map((shelf, revIndex) => {
                  const index = globalShelves.length - 1 - revIndex
                  const rowPos = rowPositions.find(r => r.index === index)
                  const fits = !!rowPos
                  return (
                    <div key={index} className={!fits ? "opacity-40" : ""}>
                      <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                        <span className="text-xs font-medium text-muted-foreground w-12">Shelf {index + 1}</span>
                        <Select value={shelf.height.toString()} onValueChange={(v) => globalOps.update(index, "height", Number.parseInt(v))}>
                          <SelectTrigger className="w-14 h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{[12, 14].map(h => <SelectItem key={h} value={h.toString()}>{h}"</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground uppercase">H</span>
                        <Select value={shelf.depth.toString()} onValueChange={(v) => globalOps.update(index, "depth", Number.parseInt(v))}>
                          <SelectTrigger className="w-14 h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{getAvailableDepths(globalShelves, index).map(d => <SelectItem key={d} value={d.toString()}>{d}"</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground uppercase">D</span>
                        {!fits && <span className="text-[10px] text-destructive ml-auto">Won't fit</span>}
                      </div>
                      {index > 0 && shelf.depth < globalShelves[index - 1].depth && (
                        <div className="text-[10px] text-muted-foreground italic pl-3 mt-1">↑ Transition board will be added here</div>
                      )}
                    </div>
                  )
                })}
                <div className="bg-muted/50 border border-border rounded-lg px-3 py-2.5 space-y-1">
                  <p className="text-[10px] font-semibold text-foreground">Aligned rows across wall:</p>
                  <p className="text-[10px] text-muted-foreground">{zoneFitSummary || "No zones available"}</p>
                  <p className="text-[10px] text-muted-foreground italic">Shelves are horizontally aligned — the object creates a gap in the center column.</p>
                </div>
              </div>
            </ConfigSection>

            <ConfigSection step={7} title="Finish" subtitle={finishOption?.label} defaultOpen={true}>
              <div className="grid grid-cols-4 gap-2">
                {FINISH_OPTIONS.map(finish => (
                  <button key={finish.id} onClick={() => !finish.comingSoon && setSelectedFinish(finish.id)} disabled={finish.comingSoon}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${selectedFinish === finish.id ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"} ${finish.comingSoon ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    {finish.comingSoon && <div className="absolute -top-1 -right-1 bg-muted-foreground text-background text-[8px] font-bold px-1.5 py-0.5 rounded-full">Sold out</div>}
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-border shadow-sm">
                      {finish.id.includes("/") && finish.color1 !== finish.color2 ? (
                        <div className="flex w-full h-full"><div className="w-1/2 h-full" style={{ backgroundColor: finish.color1 }} /><div className="w-1/2 h-full" style={{ backgroundColor: finish.color2 }} /></div>
                      ) : (<div className="w-full h-full" style={{ backgroundColor: finish.color1 }} />)}
                    </div>
                    <span className="text-[10px] font-medium text-foreground leading-tight text-center">{finish.label.replace("/", " / ")}</span>
                    {selectedFinish === finish.id && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </ConfigSection>

            <div className="sm:hidden pt-4 space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-display font-bold text-foreground">${totalPrice.toFixed(2)}</span>
              </div>
              <Button onClick={handleAddToCart} disabled={isAddingToCart} className="w-full h-12 rounded-xl text-base font-semibold gap-2">
                <ShoppingCart className="h-4 w-4" />{isAddingToCart ? "Processing..." : "Add to Cart"}
              </Button>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </div>

      <FinishPreviewModal isOpen={previewModal.isOpen} onClose={() => setPreviewModal({ isOpen: false, finishName: "", imageSrc: "" })} finishName={previewModal.finishName} imageSrc={previewModal.imageSrc} />
    </div>
  )
}
