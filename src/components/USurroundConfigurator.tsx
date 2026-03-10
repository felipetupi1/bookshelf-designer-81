import type React from "react"
import { useState, useMemo, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { Plus, Minus, RotateCcw, ShoppingCart, ChevronDown } from "lucide-react"
import type { ShelfConfig } from "@/lib/types"
import { calculateUSurround } from "@/lib/usurround-calculator"
import { calculateBookshelf } from "@/lib/bookshelf-calculator"
import { USurround3DView, type USurround3DViewRef } from "./USurround3DView"
import { USurroundSchematic } from "./USurroundSchematic"
import { FinishPreviewModal } from "./FinishPreviewModal"

import iconHorizontal from "@/assets/icons/Horizontal.png"
import iconBookshelf from "@/assets/icons/Vertical_Bookshelf.png"
import iconCorner from "@/assets/icons/Corner.png"
import iconPortal from "@/assets/icons/Portal.png"
import iconCathedral from "@/assets/icons/Cathedral.png"
import iconUModel from "@/assets/icons/U-Model.png"

const FINISH_OPTIONS = [
  { id: "White/White", label: "White/White", price: 41.6, color1: "#f5f5f5", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null },
  { id: "Maple/Maple", label: "Maple/Maple", price: 49.21, color1: "#E8D4B8", color2: "#E8D4B8", comingSoon: false, previewImage: "/images/finishes/maple.jpeg" },
  { id: "Black/Black", label: "Black/Black", price: 54.59, color1: "#1a1a1a", color2: "#1a1a1a", comingSoon: false, previewImage: null as string | null },
  { id: "Oak/White", label: "Oak/White", price: 60.18, color1: "#D4A574", color2: "#f5f5f5", comingSoon: true, previewImage: null as string | null },
  { id: "Maple/Black", label: "Maple/Black", price: 65.1, color1: "#E8D4B8", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/maple-black.jpeg" },
  { id: "Oak/Oak", label: "Oak/Oak", price: 68.15, color1: "#D4A574", color2: "#D4A574", comingSoon: false, previewImage: "/images/finishes/oak.jpeg" },
  { id: "Walnut/Walnut", label: "Walnut/Walnut", price: 76.2, color1: "#5D432C", color2: "#5D432C", comingSoon: false, previewImage: "/images/finishes/walnut.jpeg" },
  { id: "Oak/Black", label: "Oak/Black", price: 77.99, color1: "#D4A574", color2: "#1a1a1a", comingSoon: false, previewImage: "/images/finishes/oak-black.jpeg" },
]

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  const eighths = Math.round(fraction * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const fractionMap: Record<number, string> = { 1: "1/8", 2: "1/4", 3: "3/8", 4: "1/2", 5: "5/8", 6: "3/4", 7: "7/8" }
  return `${whole} ${fractionMap[eighths]}"`
}

function toFeetAndInches(inches: number): string {
  const feet = Math.floor(inches / 12)
  const rem = inches % 12
  if (feet === 0) return toFraction(rem)
  if (rem === 0) return `${feet}'`
  return `${feet}' ${toFraction(rem)}`
}

function calculateTotalHeight(shelves: ShelfConfig[]): number {
  const sumOfSides = shelves.reduce((sum, s) => sum + s.height, 0)
  const depthGroups = new Set(shelves.map(s => s.depth))
  const additionalHeight = 0.75 * (shelves.length + depthGroups.size)
  let transitions = 0
  for (let i = 1; i < shelves.length; i++) {
    if (shelves[i].depth < shelves[i - 1].depth) transitions++
  }
  return sumOfSides + additionalHeight + 0.75 * transitions
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
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? "max-h-[800px] opacity-100 pb-5 px-1" : "max-h-0 opacity-0"}`}>
        {children}
      </div>
    </div>
  )
}

function SectionShelfConfig({ label, shelves, onAdd, onRemove, onUpdate }: {
  label: string; shelves: ShelfConfig[]
  onAdd: () => void; onRemove: () => void; onUpdate: (i: number, f: "height" | "depth", v: number) => void
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-foreground uppercase tracking-wider">{label}</span>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={onRemove} disabled={shelves.length <= 1}><Minus className="h-3 w-3" /></Button>
          <span className="text-sm font-semibold w-5 text-center text-foreground">{shelves.length}</span>
          <Button variant="outline" size="icon" className="h-7 w-7 rounded-full" onClick={onAdd} disabled={shelves.length >= 8}><Plus className="h-3 w-3" /></Button>
        </div>
      </div>
      {[...shelves].reverse().map((shelf, revIndex) => {
        const index = shelves.length - 1 - revIndex
        return (
          <div key={index}>
            <div className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
              <span className="text-xs font-medium text-muted-foreground w-14">Shelf {index + 1}</span>
              <Select value={shelf.height.toString()} onValueChange={(v) => onUpdate(index, "height", Number.parseInt(v))}>
                <SelectTrigger className="w-16 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{[12, 14].map(h => <SelectItem key={h} value={h.toString()}>{h}"</SelectItem>)}</SelectContent>
              </Select>
              <span className="text-[10px] text-muted-foreground uppercase">H</span>
              <Select value={shelf.depth.toString()} onValueChange={(v) => onUpdate(index, "depth", Number.parseInt(v))}>
                <SelectTrigger className="w-16 h-8 text-xs rounded-lg"><SelectValue /></SelectTrigger>
                <SelectContent>{getAvailableDepths(shelves, index).map(d => <SelectItem key={d} value={d.toString()}>{d}"</SelectItem>)}</SelectContent>
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
  )
}

export interface USurroundConfiguratorProps {
  onTypeChange: (type: string) => void
}

export function USurroundConfigurator({ onTypeChange }: USurroundConfiguratorProps) {
  const [w1, setW1] = useState(50)
  const [w, setW] = useState(70)
  const [w2, setW2] = useState(50)
  const [selectedFinish, setSelectedFinish] = useState("Oak/Oak")
  const [isAddingToCart, setIsAddingToCart] = useState(false)
  const [previewModal, setPreviewModal] = useState<{ isOpen: boolean; finishName: string; imageSrc: string }>({ isOpen: false, finishName: "", imageSrc: "" })
  const view3DRef = useRef<USurround3DViewRef>(null)

  const defaultShelves = (): ShelfConfig[] => [
    { height: 14, depth: 13 }, { height: 14, depth: 13 },
    { height: 14, depth: 13 }, { height: 14, depth: 13 },
  ]

  const [shelves, setShelves] = useState<ShelfConfig[]>(defaultShelves)
  const shelvesLeft = shelves
  const shelvesFront = shelves
  const shelvesRight = shelves

  const totalHeight = calculateTotalHeight(shelves)

  const shelfOps = {
    add: () => setShelves(prev => {
      if (prev.length >= 8) return prev
      const topDepth = (prev[prev.length - 1]?.depth || 13) as 7 | 10 | 13
      return [...prev, { height: 14, depth: topDepth }]
    }),
    remove: () => setShelves(prev => prev.length > 1 ? prev.slice(0, -1) : prev),
    update: (index: number, field: "height" | "depth", value: number) => {
      setShelves(prev => {
        const next = [...prev]
        next[index] = { ...next[index], [field]: value }
        return field === "depth" ? enforceDepthConstraints(next, index) : next
      })
    },
  }

  const { usurroundResult, totalPrice, totalArea, modulesLeft, modulesFront, modulesRight } = useMemo(() => {
    try {
      const res = calculateUSurround({ w1, w, w2, shelvesLeft, shelvesFront, shelvesRight, finish: selectedFinish })
      const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
      const area = (w1 * totalHeight + w * totalHeight + w2 * totalHeight) / 144
      const price = area * (finishOption?.price || 0)
      const mLeft = res.leftResult.shelves.map(s => s.modules)
      const mFront = res.frontResult.shelves.map(s => s.modules)
      const mRight = res.rightResult.shelves.map(s => s.modules)
      return { usurroundResult: res, totalPrice: price, totalArea: area, modulesLeft: mLeft, modulesFront: mFront, modulesRight: mRight }
    } catch {
      return { usurroundResult: null, totalPrice: 0, totalArea: 0, modulesLeft: undefined, modulesFront: undefined, modulesRight: undefined }
    }
  }, [w1, w, w2, shelvesLeft, shelvesFront, shelvesRight, selectedFinish, totalHeight])

  async function handleAddToCart() {
    if (!usurroundResult) return
    setIsAddingToCart(true)
    const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)
    let imageDataUrl: string | null = null
    try { if (view3DRef.current) imageDataUrl = await view3DRef.current.captureImage() } catch { /* */ }

    const payload = {
      type: "pbs-checkout", price: totalPrice.toFixed(2),
      config: {
        totalArea: totalArea.toFixed(2), pricePerSqFt: finishOption?.price.toFixed(2),
        w1, w, w2, height: totalHeight, modules: usurroundResult.totalModules,
        finish: finishOption?.label || selectedFinish, shelvesLeft, shelvesFront, shelvesRight,
        bookshelfType: "usurround", skus: usurroundResult.allSkus,
      },
      imageDataUrl,
    }

    const isInIframe = window.self !== window.top
    if (isInIframe) window.parent.postMessage(payload, "*")
    else { console.log("Checkout payload:", payload); alert(`Order total: $${totalPrice.toFixed(2)}. Checkout integration pending.`) }
    setIsAddingToCart(false)
  }

  function handleReset() {
    setW1(50); setW(70); setW2(50)
    setShelvesLeft(defaultShelves()); setShelvesFront(defaultShelves()); setShelvesRight(defaultShelves())
    setSelectedFinish("Oak/Oak")
  }

  const finishOption = FINISH_OPTIONS.find(f => f.id === selectedFinish)

  const TYPE_ICONS: Record<string, string> = {
    rack: iconHorizontal, bookshelf: iconBookshelf, corner: iconCorner, portal: iconPortal, cathedral: iconCathedral, usurround: iconUModel,
  }

  return (
    <div className="w-full min-h-screen configurator-root">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur-lg border-b border-border configurator-header">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between px-4 md:px-8 h-14">
          <div>
            <h1 className="font-display text-lg font-bold text-foreground tracking-tight leading-none">Perfect Bookshelf</h1>
            <p className="text-[10px] text-muted-foreground tracking-widest uppercase">Custom Shelving System</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleReset} className="text-muted-foreground hover:text-foreground transition-colors" title="Reset"><RotateCcw className="h-4 w-4" /></button>
            <div className="hidden sm:flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Total:</span>
              <span className="font-display font-bold text-foreground text-lg">${totalPrice.toFixed(2)}</span>
            </div>
            <Button onClick={handleAddToCart} disabled={isAddingToCart || !usurroundResult} size="sm" className="rounded-full px-5 gap-2">
              <ShoppingCart className="h-3.5 w-3.5" /><span className="hidden sm:inline">{isAddingToCart ? "Processing..." : "Add to Cart"}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-[1600px] mx-auto flex flex-col lg:flex-row configurator-layout">
        <div className="lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:w-[60%] xl:w-[65%] flex-shrink-0 bg-secondary/30 configurator-preview">
          <div className="relative h-full min-h-[50vh] lg:min-h-0 p-4 lg:p-6">
            <div className="absolute top-6 left-6 z-10 flex items-center gap-2">
              {FINISH_OPTIONS.filter(f => f.previewImage && !f.comingSoon).map(fin => (
                <button key={fin.id} onClick={() => setPreviewModal({ isOpen: true, finishName: fin.label, imageSrc: fin.previewImage! })} className="group relative" title={fin.label}>
                  <div className="w-8 h-8 rounded-full border-2 border-background shadow-md overflow-hidden hover:scale-110 transition-transform">
                    <img src={fin.previewImage!} alt={fin.label} className="object-cover w-full h-full" />
                  </div>
                </button>
              ))}
            </div>

            <div className="absolute top-6 right-6 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-lg px-3 py-1.5 shadow-sm">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Dimensions</div>
              <div className="text-sm font-semibold text-foreground leading-tight">{toFraction(w1)} × {toFraction(w)} × {toFraction(w2)} × {toFraction(totalHeight)}</div>
            </div>

            {usurroundResult ? (
              <USurround3DView ref={view3DRef} w1={w1} w={w} w2={w2}
                shelvesLeft={shelvesLeft} shelvesFront={shelvesFront} shelvesRight={shelvesRight}
                modulesLeft={modulesLeft} modulesFront={modulesFront} modulesRight={modulesRight}
                finish={selectedFinish} isMobile={false} hideTooltip />
            ) : (
              <div className="flex items-center justify-center h-full text-muted-foreground">Configure your bookshelf to see preview</div>
            )}
          </div>
        </div>

        <div className="lg:w-[40%] xl:w-[35%] flex-shrink-0 configurator-config">
          <div className="p-4 md:p-6 lg:p-8 space-y-0 configurator-config-inner">
            <ConfigSection step={1} title="Type" subtitle="U-Surround" defaultOpen={true}>
              <div className="grid grid-cols-6 gap-2">
                {(["rack", "bookshelf", "corner", "portal", "cathedral"] as const).map(type => (
                  <button key={type} onClick={() => onTypeChange(type)}
                    className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all border border-border bg-card hover:border-accent/40">
                    <img src={TYPE_ICONS[type]} alt={type} className="h-10 w-10 object-contain" />
                    <span className="text-[10px] font-medium text-foreground capitalize">{type === "rack" ? "Horiz." : type === "portal" ? "Portal" : type === "cathedral" ? "Cathed." : type}</span>
                  </button>
                ))}
                <button className="relative flex flex-col items-center gap-2 p-3 rounded-xl transition-all border border-accent bg-accent/5 shadow-sm">
                  <img src={TYPE_ICONS["usurround"]} alt="U-Surround" className="h-10 w-10 object-contain" />
                  <span className="text-[10px] font-medium text-foreground">U-Surr.</span>
                  <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-accent" />
                </button>
              </div>
            </ConfigSection>

            <ConfigSection step={2} title="Dimensions" subtitle={`W1: ${toFraction(w1)} · W: ${toFraction(w)} · W2: ${toFraction(w2)} · H: ${toFraction(totalHeight)}`} defaultOpen={true}>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Left Arm Width (W1)</Label>
                  <Slider value={[w1]} onValueChange={([v]) => setW1(v)} min={25} max={200} step={0.25} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span>{toFeetAndInches(w1)}</span><span>200"</span></div>
                  {w1 === 25 && <p className="text-[10px] text-destructive mt-1">This section is at minimum width</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Front Width (W)</Label>
                  <Slider value={[w]} onValueChange={([v]) => setW(v)} min={25} max={200} step={0.25} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span>{toFeetAndInches(w)}</span><span>200"</span></div>
                  {w === 25 && <p className="text-[10px] text-destructive mt-1">This section is at minimum width</p>}
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground mb-1 block">Right Arm Width (W2)</Label>
                  <Slider value={[w2]} onValueChange={([v]) => setW2(v)} min={25} max={200} step={0.25} className="w-full" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1"><span>25"</span><span>{toFeetAndInches(w2)}</span><span>200"</span></div>
                  {w2 === 25 && <p className="text-[10px] text-destructive mt-1">This section is at minimum width</p>}
                </div>
                <p className="text-[10px] text-muted-foreground italic">Always deduct 1" from each wall measurement to account for wall imperfections.</p>
                <USurroundSchematic w1={w1} w={w} w2={w2} h={totalHeight} />
              </div>
            </ConfigSection>

            <ConfigSection step={3} title="Shelves" subtitle={`L: ${shelvesLeft.length} · F: ${shelvesFront.length} · R: ${shelvesRight.length}`} defaultOpen={true}>
              <div className="space-y-6">
                <SectionShelfConfig label="Left Arm (W1)" shelves={shelvesLeft} onAdd={leftOps.add} onRemove={leftOps.remove} onUpdate={leftOps.update} />
                <SectionShelfConfig label="Front Section (W)" shelves={shelvesFront} onAdd={frontOps.add} onRemove={frontOps.remove} onUpdate={frontOps.update} />
                <SectionShelfConfig label="Right Arm (W2)" shelves={shelvesRight} onAdd={rightOps.add} onRemove={rightOps.remove} onUpdate={rightOps.update} />
              </div>
            </ConfigSection>

            <ConfigSection step={4} title="Finish" subtitle={finishOption?.label} defaultOpen={true}>
              <div className="grid grid-cols-4 gap-2">
                {FINISH_OPTIONS.map(fin => (
                  <button key={fin.id} onClick={() => !fin.comingSoon && setSelectedFinish(fin.id)} disabled={fin.comingSoon}
                    className={`relative flex flex-col items-center gap-1.5 p-2.5 rounded-xl transition-all border ${selectedFinish === fin.id ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:border-accent/40"} ${fin.comingSoon ? "opacity-40 cursor-not-allowed" : "cursor-pointer"}`}>
                    {fin.comingSoon && <div className="absolute -top-1 -right-1 bg-muted-foreground text-background text-[8px] font-bold px-1.5 py-0.5 rounded-full">Soon</div>}
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-border shadow-sm">
                      {fin.id.includes("/") && fin.color1 !== fin.color2 ? (
                        <div className="flex w-full h-full"><div className="w-1/2 h-full" style={{ backgroundColor: fin.color1 }} /><div className="w-1/2 h-full" style={{ backgroundColor: fin.color2 }} /></div>
                      ) : (<div className="w-full h-full" style={{ backgroundColor: fin.color1 }} />)}
                    </div>
                    <span className="text-[10px] font-medium text-foreground leading-tight text-center">{fin.label.replace("/", " / ")}</span>
                    {selectedFinish === fin.id && <div className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-accent" />}
                  </button>
                ))}
              </div>
            </ConfigSection>

            <div className="sm:hidden pt-4 space-y-3">
              <div className="flex items-center justify-between p-4 rounded-xl bg-card border border-border">
                <span className="text-sm text-muted-foreground">Total</span>
                <span className="text-2xl font-display font-bold text-foreground">${totalPrice.toFixed(2)}</span>
              </div>
              <Button onClick={handleAddToCart} disabled={isAddingToCart || !usurroundResult} className="w-full h-12 rounded-xl text-base font-semibold gap-2">
                <ShoppingCart className="h-4 w-4" />{isAddingToCart ? "Processing..." : "Add to Cart"}
              </Button>
            </div>
            <div className="h-8" />
          </div>
        </div>
      </div>

      <FinishPreviewModal isOpen={previewModal.isOpen} onClose={() => setPreviewModal({ isOpen: false, finishName: "", imageSrc: "" })}
        finishName={previewModal.finishName} imageSrc={previewModal.imageSrc} />
    </div>
  )
}
