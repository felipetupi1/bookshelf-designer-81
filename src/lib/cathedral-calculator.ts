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

function calculateModulesForWidthSequenced(totalWidth: number, startModuleIndex: number): { modules: Array<{ width: number }>; nextModuleIndex: number } {
  const moduleWidths: number[] = []
  let idx = startModuleIndex
  moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length])
  idx++
  moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length])
  idx++
  let currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
  let freeSpace = totalWidth - currentWidth
  let maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  while (freeSpace > maxAllowedFreeSpace) {
    moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length])
    idx++
    currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
    freeSpace = totalWidth - currentWidth
    maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  }
  return { modules: moduleWidths.map(w => ({ width: w })), nextModuleIndex: idx % MODULE_WIDTHS.length }
}

function calculateModulesForWidth(totalWidth: number): Array<{ width: number }> {
  // For each row, start a fresh module sequence fitting smallest-first
  // Pick modules from the sequence that fit within totalWidth
  if (totalWidth < MIN_MODULE_WIDTH) return []

  const moduleWidths: number[] = []
  let idx = 0

  // Add first module
  moduleWidths.push(MODULE_WIDTHS[idx])
  idx++

  // Keep adding modules while they fit (total module width <= totalWidth)
  // and while the remaining free space exceeds the max allowed gaps
  let currentWidth = moduleWidths.reduce((s, w) => s + w, 0)

  // Check if we need more modules: free space between modules can't exceed MAX_GAP per gap
  while (idx < MODULE_WIDTHS.length) {
    const nextWidth = MODULE_WIDTHS[idx]
    const newTotal = currentWidth + nextWidth
    // Don't add if total modules would exceed available width
    if (newTotal > totalWidth) break

    const numGaps = moduleWidths.length // after adding, gaps = modules.length - 1 + 1 = current length
    const freeAfter = totalWidth - newTotal
    const maxAllowed = MAX_GAP * numGaps

    moduleWidths.push(nextWidth)
    currentWidth = newTotal
    idx++

    // If remaining free space fits within allowed gaps, we have enough modules
    if (freeAfter <= maxAllowed) break
  }

  // If only 1 module and there's too much free space, try adding a second from start
  if (moduleWidths.length === 1) {
    const freeSpace = totalWidth - currentWidth
    if (freeSpace > MAX_GAP && idx < MODULE_WIDTHS.length) {
      moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length])
    }
  }

  // Remove last module if total exceeds available width
  while (moduleWidths.reduce((s, w) => s + w, 0) > totalWidth && moduleWidths.length > 1) {
    moduleWidths.pop()
  }

  return moduleWidths.map(w => ({ width: w }))
}

export function calculateCathedral(W: number, H: number, H1: number, shelves: ShelfConfig[], direction: SlopeDirection, finish: string) {
  const rows = computeCathedralRows(W, H, H1, shelves, direction)
  const modulesPerRow: Array<Array<{ width: number }>> = []
  // Find the max width (base width) - rows at full width share a continuous module sequence
  const baseWidth = rows.length > 0 ? Math.max(...rows.map(r => r.availableWidth)) : W
  let carryIdx = 0
  for (const row of rows) {
    if (Math.abs(row.availableWidth - baseWidth) < 0.01) {
      // Full-width row: use carried sequence like standard bookshelf
      const result = calculateModulesForWidthSequenced(row.availableWidth, carryIdx)
      modulesPerRow.push(result.modules)
      carryIdx = result.nextModuleIndex
    } else {
      // Narrower row: fresh module set
      modulesPerRow.push(calculateModulesForWidth(row.availableWidth))
    }
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
