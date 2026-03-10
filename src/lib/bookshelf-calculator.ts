import type { BookshelfConfig, BookshelfResult, BoardResult, ShelfResult, SKU } from "./types"

const MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]
const MAX_BOARD_WIDTH = 50
const MIN_BOARD_WIDTH = 25
const MAX_GAP = 23

export function calculateBookshelf(config: BookshelfConfig): BookshelfResult {
  if (config.type === "corner") {
    return calculateCornerBookshelf(config)
  }
  return calculateStraightBookshelf(config)
}

function calculateCornerBookshelf(config: BookshelfConfig): BookshelfResult {
  const width2 = config.width2 || 50
  const shelves2 = config.shelves2 || config.shelves
  const section1 = calculateStraightBookshelf({ ...config })
  const section2 = calculateStraightBookshelf({ ...config, totalWidth: width2, shelves: shelves2 })
  const combinedBoards = [
    ...section1.boards,
    ...section2.boards.map(b => ({ ...b, shelfIndex: b.shelfIndex + section1.boards.length })),
  ]
  const combinedShelves = section1.shelves.map((shelf, i) => ({
    ...shelf,
    modules: [...shelf.modules, ...(section2.shelves[i]?.modules || [])],
  }))
  const allSkus = consolidateSkusFromResults(section1, section2)
  return {
    config,
    totalHeight: section1.totalHeight,
    totalModules: section1.totalModules + section2.totalModules,
    boards: combinedBoards,
    shelves: combinedShelves,
    allSkus,
  }
}

function consolidateSkusFromResults(r1: BookshelfResult, r2: BookshelfResult) {
  const skuMap = new Map<string, { type: string; quantity: number }>()
  for (const sku of [...r1.allSkus, ...r2.allSkus]) {
    const existing = skuMap.get(sku.name)
    if (existing) {
      existing.quantity += sku.totalQuantity
    } else {
      skuMap.set(sku.name, { type: sku.type, quantity: sku.totalQuantity })
    }
  }
  return Array.from(skuMap.entries())
    .map(([name, data]) => ({ name, type: data.type, totalQuantity: data.quantity }))
    .sort((a, b) => a.type.localeCompare(b.type))
}

function calculateStraightBookshelf(config: BookshelfConfig): BookshelfResult {
  validateConfig(config)
  const boards = calculateBoardsByLevels(config.totalWidth, config.shelves)
  const transitionBoards = calculateTransitionBoards(config.totalWidth, config.shelves)
  const allBoards = [...boards, ...transitionBoards]
  const shelfGroups = new Map<string, number[]>()
  for (let i = 0; i < config.shelves.length; i++) {
    const shelf = config.shelves[i]
    const key = `${shelf.height}-${shelf.depth}`
    const indices = shelfGroups.get(key) || []
    indices.push(i)
    shelfGroups.set(key, indices)
  }
  const groupModuleIndex = new Map<string, number>()
  const shelves: ShelfResult[] = []
  for (let i = 0; i < config.shelves.length; i++) {
    const shelf = config.shelves[i]
    const groupKey = `${shelf.height}-${shelf.depth}`
    const currentModuleIndex = groupModuleIndex.get(groupKey) || 0
    const result = calculateShelfModules(config.totalWidth, shelf.height, shelf.depth, i, currentModuleIndex)
    shelves.push(result.shelf)
    let nextIndex = result.nextModuleIndex
    if (nextIndex >= MODULE_WIDTHS.length) nextIndex = 0
    groupModuleIndex.set(groupKey, nextIndex)
  }
  const totalHeight = config.shelves.reduce((sum, shelf) => sum + shelf.height, 0)
  const totalModules = shelves.reduce((sum, shelf) => sum + shelf.modules.length, 0)
  const allSkus = consolidateSkus(allBoards, shelves)
  return { config, totalHeight, totalModules, boards: allBoards, shelves, allSkus }
}

function validateConfig(config: BookshelfConfig): void {
  if (config.totalWidth < MIN_BOARD_WIDTH) throw new Error(`Minimum width is ${MIN_BOARD_WIDTH}"`)
  if (config.shelves.length === 0) throw new Error("At least one shelf is required")
}

function calculateBoardsByLevels(width: number, shelves: BookshelfConfig["shelves"]): BoardResult[] {
  const boards: BoardResult[] = []
  const depthSets = new Map<number, number>()
  for (const shelf of shelves) {
    const count = depthSets.get(shelf.depth) || 0
    depthSets.set(shelf.depth, count + 1)
  }
  const boardsPerLevel = Math.ceil(width / MAX_BOARD_WIDTH)
  const boardWidth = width / boardsPerLevel
  let levelCounter = 0
  for (const [depth, shelfCount] of depthSets.entries()) {
    const numLevels = shelfCount + 1
    const totalBoardsForSet = numLevels * boardsPerLevel
    for (let i = 0; i < totalBoardsForSet; i++) {
      boards.push({
        width: boardWidth, depth: depth as 7 | 10 | 13, quantity: 1,
        shelfIndex: levelCounter++, skus: getBoardSkus(boardWidth, depth as 7 | 10 | 13),
      })
    }
  }
  return boards
}

function calculateTransitionBoards(width: number, shelves: BookshelfConfig["shelves"]): BoardResult[] {
  const transitionBoards: BoardResult[] = []
  const boardsPerLevel = Math.ceil(width / MAX_BOARD_WIDTH)
  const boardWidth = width / boardsPerLevel
  for (let i = 1; i < shelves.length; i++) {
    if (shelves[i].depth < shelves[i - 1].depth) {
      for (let b = 0; b < boardsPerLevel; b++) {
        transitionBoards.push({
          width: boardWidth, depth: shelves[i].depth as 7 | 10 | 13, quantity: 1,
          shelfIndex: i, skus: getBoardSkus(boardWidth, shelves[i].depth as 7 | 10 | 13),
        })
      }
    }
  }
  return transitionBoards
}

function getBoardSkus(width: number, depth: 7 | 10 | 13): SKU[] {
  const boardHeight = depth === 7 ? 6.5 : depth === 10 ? 9.5 : 12.5
  const pranchaWidth = width - 1
  return [
    { name: `Prancha ${pranchaWidth.toFixed(2)}" x ${depth}"`, type: "Prancha", quantity: 1 },
    { name: `Side Baguete ${boardHeight}" x 0.5"`, type: "Side Baguete", quantity: 2 },
    { name: `Front Baguete ${width.toFixed(2)}" x 0.5"`, type: "Front Baguete", quantity: 1 },
  ]
}

function calculateShelfModules(
  totalWidth: number, height: 12 | 14, depth: 7 | 10 | 13,
  shelfIndex: number, startModuleIndex: number,
): { shelf: ShelfResult; nextModuleIndex: number } {
  const moduleWidths: number[] = []
  let currentModuleIndex = startModuleIndex
  moduleWidths.push(MODULE_WIDTHS[currentModuleIndex])
  currentModuleIndex++
  if (currentModuleIndex >= MODULE_WIDTHS.length) currentModuleIndex = 0
  moduleWidths.push(MODULE_WIDTHS[currentModuleIndex])
  currentModuleIndex++
  if (currentModuleIndex >= MODULE_WIDTHS.length) currentModuleIndex = 0
  let currentWidth = moduleWidths.reduce((sum, w) => sum + w, 0)
  let freeSpace = totalWidth - currentWidth
  let maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  while (freeSpace > maxAllowedFreeSpace) {
    moduleWidths.push(MODULE_WIDTHS[currentModuleIndex])
    currentModuleIndex++
    if (currentModuleIndex >= MODULE_WIDTHS.length) currentModuleIndex = 0
    currentWidth = moduleWidths.reduce((sum, w) => sum + w, 0)
    freeSpace = totalWidth - currentWidth
    maxAllowedFreeSpace = MAX_GAP * (moduleWidths.length - 1)
  }
  const modules = moduleWidths.map((width) => ({ width, skus: getModuleSkus(width, height, depth) }))
  return { shelf: { height, depth, modules }, nextModuleIndex: currentModuleIndex }
}

function getModuleSkus(width: number, height: 12 | 14, depth: 7 | 10 | 13): SKU[] {
  const backHeight = height + 0.625
  const bagueteHeight = height + 0.625
  return [
    { name: `Back ${width}" x ${backHeight}"`, type: "Back", quantity: 1 },
    { name: `Side ${depth}" x ${height}"`, type: "Side", quantity: 2 },
    { name: `Baguete ${bagueteHeight}" x 0.75"`, type: "Baguete", quantity: 2 },
  ]
}

function consolidateSkus(boards: BoardResult[], shelves: ShelfResult[]): { name: string; type: string; totalQuantity: number }[] {
  const skuMap = new Map<string, { type: string; quantity: number }>()
  for (const board of boards) {
    for (const sku of board.skus) {
      const totalQty = sku.quantity * board.quantity
      const existing = skuMap.get(sku.name)
      if (existing) existing.quantity += totalQty
      else skuMap.set(sku.name, { type: sku.type, quantity: totalQty })
    }
  }
  for (const shelf of shelves) {
    for (const module of shelf.modules) {
      for (const sku of module.skus) {
        const existing = skuMap.get(sku.name)
        if (existing) existing.quantity += sku.quantity
        else skuMap.set(sku.name, { type: sku.type, quantity: sku.quantity })
      }
    }
  }
  return Array.from(skuMap.entries())
    .map(([name, data]) => ({ name, type: data.type, totalQuantity: data.quantity }))
    .sort((a, b) => a.type.localeCompare(b.type))
}
