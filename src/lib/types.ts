export interface ShelfConfig {
  height: 12 | 14
  depth: 7 | 10 | 13
}

export type BookshelfType = "rack" | "bookshelf" | "corner"

export interface BookshelfConfig {
  type: BookshelfType
  totalWidth: number
  width2?: number
  shelves: ShelfConfig[]
  shelves2?: ShelfConfig[]
  finish: string
}

export interface ModuleConfig {
  width: number
  height: 12 | 14
  depth: 7 | 10 | 13
}

export interface SKU {
  name: string
  type: string
  quantity: number
}

export interface BoardResult {
  width: number
  depth: 7 | 10 | 13
  quantity: number
  shelfIndex: number
  skus: SKU[]
}

export interface ShelfResult {
  height: 12 | 14
  depth: 7 | 10 | 13
  modules: {
    width: number
    skus: SKU[]
  }[]
}

export interface BookshelfResult {
  config: BookshelfConfig
  totalHeight: number
  totalModules: number
  boards: BoardResult[]
  shelves: ShelfResult[]
  allSkus: {
    name: string
    type: string
    totalQuantity: number
  }[]
}
