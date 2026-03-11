// Placeholder - Cathedral Configurator
// This component needs the Cathedral3DView which is being created
import type React from "react"
import { useState, useMemo, useRef } from "react"
import { Cathedral3DView, type Cathedral3DViewRef } from "./Cathedral3DView"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus, RotateCcw, ShoppingCart, ChevronDown } from "lucide-react"
import type { ShelfConfig } from "@/lib/types"
import type { SlopeDirection } from "@/lib/cathedral-calculator"
import { computeCathedralRows, calculateCathedral } from "@/lib/cathedral-calculator"
import { CathedralSchematic } from "./CathedralSchematic"
import { FinishPreviewModal } from "./FinishPreviewModal"

import iconHorizontal from "@/assets/icons/Horizontal.png"
import iconBookshelf from "@/assets/icons/Vertical_Bookshelf.png"
import iconCorner from "@/assets/icons/Corner.png"
import iconPortal from "@/assets/icons/Portal.png"
import iconCathedral from "@/assets/icons/Cathedral.png"
import iconUModel from "@/assets/icons/U-Model.png"

const TYPE_ICONS: Record<string, string> = {
  rack: iconHorizontal, bookshelf: iconBookshelf, corner: iconCorner,
  portal: iconPortal, cathedral: iconCathedral, usurround: iconUModel,
}

const FINISH_OPTIONS = [
  { id: "White/White", label: "White/White", price: 41.6, color1: "#f5f5f5", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null },
  { id: "Maple/Maple", label: "Maple/Maple", price: 49.21, color1: "#E8D4B8", color2: "#E8D4B8", comingSoon: false, previewImage: "/images/finishes/maple.jpeg" },
  { id: "Black/Black", label: "Black/Black", price: 54.59, color1: "#1a1a1a", color2: "#1a1a1a", comingSoon: false, previewImage: null as string | null },
  { id: "Oak/White", label: "Oak/White", price: 60.18, color1: "#D4A574", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null },
  { id: "Maple/Black", label: "Maple/Black", price: 65.1, color1: "#E8D4B8", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/maple-black.jpeg" },
  { id: "Oak/Oak", label: "Oak/Oak", price: 68.15, color1: "#D4A574", color2: "#D4A574", comingSoon: false, previewImage: "/images/finishes/oak.jpg" },
  { id: "Walnut/Walnut", label: "Walnut/Walnut", price: 76.2, color1: "#5D432C", color2: "#5D432C", comingSoon: false, previewImage: "/images/finishes/walnut.jpg" },
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
  for (let i = changedIndex - 1; i >= 0; i--) { if (result[i].depth < newDepth) result[i].depth = newDepth as 7 | 10 | 13 }
  for (let i = changedIndex + 1; i < result.length; i++) { if (result[i].depth > newDepth) result[i].depth = newDepth as 7 | 10 | 13 }
  return result
}

function getAvailableDepths(shelves: ShelfConfig[], index: number): number[] {
  const maxAllowed = index > 0 ? shelves[index - 1].depth : 13
  return [7, 10, 13].filter(d => d <= maxAllowed)
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

const DIRECTION_OPTIONS: { id: SlopeDirection; label: string; icon: React.ReactNode }[] = [
  {
    id: "left", label: "Left",
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="28" x2="28" y2="28" /><line x1="4" y1="28" x2="4" y2="20" />
        <line x1="28" y1="28" x2="28" y2="4" /><line x1="4" y1="20" x2="28" y2="4" />
      </svg>
    ),
  },
  {
    id: "right", label: "Right",
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="28" x2="28" y2="28" /><line x1="4" y1="28" x2="4" y2="4" />
        <line x1="28" y1="28" x2="28" y2="20" /><line x1="4" y1="4" x2="28" y2="20" />
      </svg>
    ),
  },
  {
    id: "both", label: "Both",
    icon: (
      <svg viewBox="0 0 32 32" className="h-7 w-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="28" x2="28" y2="28" /><line x1="4" y1="28" x2="4" y2="20" />
        <line x1="28" y1="28" x2="28" y2="20" /><line x1="4" y1="20" x2="16" y2="4" />
        <line x1="28" y1="20" x2="16" y2="4" />
      </svg>
    ),
  },
]

interface CathedralConfiguratorProps { onTypeChange: (type: string) => void }

export function CathedralConfigurator({ onTypeChange }: CathedralConfiguratorProps) {
  const [W, setW] = useState(100)
  const [H, setH] = useState(60)
  const [H1, setH1] = useState(96)
  const [direction, setDirection] = useState<SlopeDirection>("left")
  const [shelves, setShelves] = useState<ShelfConfig[]>([
    { height: 14, depth: 13 }, { height: 14, depth: 13 },
    { height: 14, depth: 13 }, { height: 14, depth: 13 }, { height: 14, depth: 13 },
  ])
  const [selectedFinish, setSelectedFinish] = useState("Oak/Oak")
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; finishName: string; imageSrc: string }>({ isOpen: false, finishName: "", imageSrc: "" })
  const cathedral3DRef = useRef<Cathedral3DViewRef>(null)

  const cathedralData = useMemo(() => {
    try { return calculateCathedral(W, H, H1, shelves, direction, selectedFinish) } catch { return null }
  }, [W, H, H1, shelves, direction, selectedFinish])

  const rows = cathedralData?.rows || []

  const modulesPerRow = cathedralData?.modulesPerRow || []

  const { totalPrice, totalArea } = useMemo(() => {
    const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
    const area = cathedralData?.totalArea || 0
    return { totalPrice: area * (finishOption?.price || 0), totalArea: area }
  }, [cathedralData, selectedFinish])

  const shelfYPositions = useMemo(() => {
    const positions: number[] = []; let y = 0
    for (const shelf of shelves) { y += shelf.height + 0.75; positions.push(y) }
    return positions
  }, [shelves])

  const heightDiffTooSmall = H1 - H < 14

  const addShelf = () => { if (shelves.length < 12) setShelves([...shelves, { height: 14, depth: (shelves[shelves.length - 1]?.depth || 13) as 7 | 10 | 13 }]) }
  const removeShelf = () => { if (shelves.length > 1) setShelves(shelves.slice(0, -1)) }
  const updateShelf = (index: number, field: "height" | "depth", value: number) => {
    const newShelves = [...shelves]; newShelves[index] = { ...newShelves[index], [field]: value }
    setShelves(field === "depth" ? enforceDepthConstraints(newShelves, index) : newShelves)
  }

  async function handleAddToCart() {
    if (!cathedralData) return
    setIsAddingToCart(true)
    const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
    const payload = {
      type: "pbs-checkout", price: totalPrice.toFixed(2),
      config: { totalArea: totalArea.toFixed(2), W, H, H1, direction, finish: finishOption?.label || selectedFinish, bookshelfType: "cathedral", shelves, rows: rows.length, skus: cathedralData.allSkus },
    }
    const isInIframe = window.self !== window.top
    if (isInIframe) window.parent.postMessage(payload, "*")
    else { console.log("Checkout payload:", payload); alert(`Order total: $${totalPrice.toFixed(2)}`) }
    setIsAddingToCart(false)
  }

  function handleReset() {
    setW(100); setH(60); setH1(96); setDirection("left")
    setShelves([{ height: 14, depth: 13 }, { height: 14, depth: 13 }, { height: 14, depth: 13 }, { height: 14, depth: 13 }, { height: 14, depth: 13 }])
    setSelectedFinish("Maple/Maple")
  }

  const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)

  return (
    <div className="w-full min-h-screen configurator-root">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border configurator-header">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 md:px-8 h-14">
          <div>
            <h1 className="font-display text-lg font-bold text-foreground tracking-tight leading-none">Perfect Bookshelf</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Cathedral Shelving System</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors" title="Reset"><RotateCcw className="h-4 w-4" /></button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-display font-bold text-foreground text-lg">${totalPrice.toFixed(2)}</span>
            </div>
            <Button onClick={handleAddToCart} disabled={isAddingToCart || !cathedralData} size="sm" className="rounded-full px-5 gap-2">
              <ShoppingCart className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isAddingToCart ? "Processing..." : "Add to Cart"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row configurator-layout">
        <div className="lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[60%] xl:w-[65%] flex-shrink-0 bg-secondary/30 configurator-preview">
          <div className="relative h-full min-h-[50vh] lg:min-h-0 p-4 lg:p-6">
            <div className="absolute top-6 right-6 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cathedral</div>
              <div className="text-sm font-semibold text-foreground leading-tight">{toFraction(W)} × {toFraction(H)}–{toFraction(H1)}</div>
            </div>

            <div className="flex items-center justify-center h-full">
              <Cathedral3DView
                ref={cathedral3DRef}
                W={W} H={H} H1={H1}
                direction={direction}
                rows={rows}
                modulesPerRow={modulesPerRow}
                finish={selectedFinish}
              />
            </div>

          </div>
        </div>

        <div className="lg:w-[40%] xl:w-[35%] flex-shrink-0 configurator-config">
          <div className="p-4 md:p-6 lg:p-8 space-y-0 configurator-config-inner">
            <ConfigSection step={1} title="Type" subtitle="Cathedral" defaultOpen={true}>
              <div className="grid grid-cols-6 gap-2">
                {(["rack", "bookshelf", "corner", "portal", "cathedral", "usurround"] as const).map(type => (
                  <button key={type} onClick={() => type === "cathedral" ? undefined : onTypeChange(type)}
                    className={`relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all border ${type === "cathedral" ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"}`}>
                    <img src={TYPE_ICONS[type]} alt={type} className="h-10 w-10 object-contain" />
                    <span className="text-[10px] font-medium text-foreground capitalize">{type === "rack" ? "Horiz." : type === "portal" ? "Portal" : type === "cathedral" ? "Cathed." : type === "usurround" ? "U-Model" : type}</span>
                    {type === "cathedral" && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </ConfigSection>

            <ConfigSection step={2} title="Slope Direction" subtitle={direction} defaultOpen={true}>
              <div className="grid grid-cols-3 gap-2">
                {DIRECTION_OPTIONS.map(opt => (
                  <button key={opt.id} onClick={() => setDirection(opt.id)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl transition-all border ${direction === opt.id ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"}`}>
                    {opt.icon}<span className="text-[11px] font-medium text-foreground">{opt.label}</span>
                  </button>
                ))}
              </div>
            </ConfigSection>

            <ConfigSection step={3} title="Dimensions" subtitle={`${W}" × ${H}"–${H1}"`} defaultOpen={true}>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">W — Total Base Width</Label>
                  <Slider value={[W]} onValueChange={([v]) => setW(v)} min={25} max={200} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span className="font-medium text-foreground">{W}"</span><span>200"</span></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">H — Low Side Height</Label>
                  <Slider value={[H]} onValueChange={([v]) => { setH(v); if (H1 <= v) setH1(v + 1) }} min={25} max={200} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span className="font-medium text-foreground">{H}"</span><span>200"</span></div>
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">H1 — Peak / Tall Side Height</Label>
                  <Slider value={[H1]} onValueChange={([v]) => setH1(v)} min={H + 1} max={300} step={1} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>{H + 1}"</span><span className="font-medium text-foreground">{H1}"</span><span>300"</span></div>
                </div>
                {heightDiffTooSmall && (
                  <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
                    The height difference is too small — please increase H1.
                  </div>
                )}
              </div>
            </ConfigSection>

            <div className="py-4 px-1">
              <CathedralSchematic W={W} H={H} H1={H1} direction={direction} shelfYPositions={shelfYPositions} />
            </div>

            <ConfigSection step={4} title="Shelves" subtitle={`${shelves.length} shelves · ${rows.length} fit`} defaultOpen={true}>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-foreground uppercase tracking-wider">Shelf Rows</span>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={removeShelf} disabled={shelves.length <= 1}><Minus className="h-3 w-3" /></Button>
                    <span className="text-sm font-semibold w-5 text-center text-foreground">{shelves.length}</span>
                    <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={addShelf} disabled={shelves.length >= 12}><Plus className="h-3 w-3" /></Button>
                  </div>
                </div>
                {[...shelves].reverse().map((shelf, revIndex) => {
                  const index = shelves.length - 1 - revIndex
                  const fitsInSlope = index < rows.length
                  return (
                    <div key={index}>
                      <div className={`flex items-center gap-2 rounded-lg px-3 py-2 ${fitsInSlope ? "bg-secondary/50" : "bg-destructive/10 opacity-50"}`}>
                        <span className="text-xs font-medium text-muted-foreground w-16">Row {index + 1} {!fitsInSlope && "✗"}</span>
                        <Select value={shelf.height.toString()} onValueChange={(v) => updateShelf(index, "height", Number.parseInt(v))}>
                          <SelectTrigger className="w-14 h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{[12, 14].map(h => <SelectItem key={h} value={h.toString()}>{h}"</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground uppercase">H</span>
                        <Select value={shelf.depth.toString()} onValueChange={(v) => updateShelf(index, "depth", Number.parseInt(v))}>
                          <SelectTrigger className="w-14 h-7 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                          <SelectContent>{getAvailableDepths(shelves, index).map(d => <SelectItem key={d} value={d.toString()}>{d}"</SelectItem>)}</SelectContent>
                        </Select>
                        <span className="text-[10px] text-muted-foreground uppercase">D</span>
                        {fitsInSlope && <span className="text-[10px] text-muted-foreground ml-auto">W: {Math.round(rows[index].availableWidth)}"</span>}
                      </div>
                    </div>
                  )
                })}
                {rows.length < shelves.length && <p className="text-[10px] text-muted-foreground italic">{shelves.length - rows.length} row(s) excluded.</p>}
              </div>
            </ConfigSection>

            <ConfigSection step={5} title="Finish" subtitle={finishOption?.label} defaultOpen={true}>
              <div className="grid grid-cols-4 gap-2">
                {FINISH_OPTIONS.map(finish => (
                  <button key={finish.id} onClick={() => !finish.comingSoon && setSelectedFinish(finish.id)} disabled={finish.comingSoon}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${selectedFinish === finish.id ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"} ${finish.comingSoon ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    {finish.comingSoon && <div className="absolute -top-1 -right-1 bg-muted-foreground text-background text-[8px] font-bold px-1.5 py-0.5 rounded-full">Soon</div>}
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
              <Button onClick={handleAddToCart} disabled={isAddingToCart || !cathedralData} className="w-full h-12 rounded-xl text-base font-semibold gap-2">
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
