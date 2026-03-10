import type { ShelfConfig, BookshelfResult } from "./types"
import { calculateBookshelf } from "./bookshelf-calculator"

export interface USurroundConfig {
  w1: number; w: number; w2: number
  shelvesLeft: ShelfConfig[]; shelvesFront: ShelfConfig[]; shelvesRight: ShelfConfig[]
  finish: string
}

export interface USurroundResult {
  leftResult: BookshelfResult; frontResult: BookshelfResult; rightResult: BookshelfResult
  allSkus: { name: string; type: string; totalQuantity: number }[]
  totalModules: number; totalArea: number
}

export function calculateUSurround(config: USurroundConfig): USurroundResult {
  const leftResult = calculateBookshelf({ type: "bookshelf", totalWidth: config.w1, shelves: config.shelvesLeft, finish: config.finish })
  const frontResult = calculateBookshelf({ type: "bookshelf", totalWidth: config.w, shelves: config.shelvesFront, finish: config.finish })
  const rightResult = calculateBookshelf({ type: "bookshelf", totalWidth: config.w2, shelves: config.shelvesRight, finish: config.finish })
  const skuMap = new Map<string, { type: string; quantity: number }>()
  for (const result of [leftResult, frontResult, rightResult]) {
    for (const sku of result.allSkus) {
      const existing = skuMap.get(sku.name)
      if (existing) existing.quantity += sku.totalQuantity
      else skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
    }
  }
  const allSkus = Array.from(skuMap.entries()).map(([name, data]) => ({ name, type: data.type, totalQuantity: data.quantity })).sort((a, b) => a.type.localeCompare(b.type))
  const totalModules = leftResult.totalModules + frontResult.totalModules + rightResult.totalModules
  return { leftResult, frontResult, rightResult, allSkus, totalModules, totalArea: 0 }
}
