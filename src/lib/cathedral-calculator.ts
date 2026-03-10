import type { ShelfConfig } from "./types"
import { calculateBookshelf } from "./bookshelf-calculator"

export type SlopeDirection = "left" | "right" | "both"

const MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]
const MAX_GAP = 23
const MIN_MODULE_WIDTH = 7.25

export function availableWidthAtHeight(W: number, H: number, H1: number, y: number): number {
  if (y <= 0) return W
  if (y >= H1) return 0
  if (y <= H) return W
  return W * (H1 - y) / (H1 - H)
}

export interface CathedralShelfRow {
  rowIndex: number
  yPosition: number
  availableWidth: number
  shelves: ShelfConfig[]
}

export function computeCathedralRows(W: number, H: number, H1: number, shelves: ShelfConfig[], _direction: SlopeDirection): CathedralShelfRow[] {
  const rows: CathedralShelfRow[] = []
  let currentY = 0
  for (let i = 0; i < shelves.length; i++) {
    const shelf = shelves[i]
    if (i > 0 && shelf.depth < shelves[i - 1].depth) currentY += 0.75
    const rowTopY = currentY + shelf.height + 0.75
    const aw = availableWidthAtHeight(W, H, H1, rowTopY)
    if (aw < MIN_MODULE_WIDTH) break
    rows.push({ rowIndex: i, yPosition: currentY, availableWidth: Math.min(aw, W), shelves: [shelf] })
    currentY = rowTopY
  }
  return rows
}

function calculateModulesForWidth(totalWidth: number, startModuleIndex: number): { modules: Array<{ width: number }>; nextModuleIndex: number } {
  const moduleWidths: number[] = []
  let idx = startModuleIndex
  moduleWidths.push(MODULE_WIDTHS[idx])
  idx = (idx + 1) % MODULE_WIDTHS.length
  moduleWidths.push(MODULE_WIDTHS[idx])
  idx = (idx + 1) % MODULE_WIDTHS.length
  let currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
  let freeSpace = totalWidth - currentWidth
  let maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  while (freeSpace > maxAllowedFreeSpace) {
    moduleWidths.push(MODULE_WIDTHS[idx])
    idx = (idx + 1) % MODULE_WIDTHS.length
    currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
    freeSpace = totalWidth - currentWidth
    maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  }
  return { modules: moduleWidths.map(w => ({ width: w })), nextModuleIndex: idx }
}

export function calculateCathedral(W: number, H: number, H1: number, shelves: ShelfConfig[], direction: SlopeDirection, finish: string) {
  const rows = computeCathedralRows(W, H, H1, shelves, direction)
  let moduleIndex = 0
  const modulesPerRow: Array<Array<{ width: number }>> = []
  for (const row of rows) {
    const { modules, nextModuleIndex } = calculateModulesForWidth(row.availableWidth, moduleIndex)
    modulesPerRow.push(modules)
    moduleIndex = nextModuleIndex
  }
  const rowResults = rows.map((row) => {
    try {
      const result = calculateBookshelf({ type: "bookshelf", totalWidth: row.availableWidth, shelves: row.shelves, finish })
      return { row, result }
    } catch {
      return { row, result: null }
    }
  })
  const skuMap = new Map<string, { type: string; quantity: number }>()
  for (const { result } of rowResults) {
    if (!result) continue
    for (const sku of result.allSkus) {
      const existing = skuMap.get(sku.name)
      if (existing) existing.quantity += sku.totalQuantity
      else skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
    }
  }
  const allSkus = Array.from(skuMap.entries()).map(([name, d]) => ({ name, type: d.type, totalQuantity: d.quantity })).sort((a, b) => a.type.localeCompare(b.type))
  let transitionArea = 0
  for (let i = 1; i < rows.length; i++) {
    const prevDepth = rows[i - 1].shelves[0]?.depth || 0
    const currDepth = rows[i].shelves[0]?.depth || 0
    if (currDepth < prevDepth) transitionArea += (rows[i - 1].availableWidth * 0.75) / 144
  }
  const totalArea = rows.reduce((sum, row) => {
    const shelfHeight = row.shelves[0].height
    return sum + (row.availableWidth * shelfHeight) / 144
  }, 0) + transitionArea
  const totalModules = modulesPerRow.reduce((sum, mods) => sum + mods.length, 0)
  return { rows, rowResults, allSkus, totalArea, totalModules, modulesPerRow }
}
