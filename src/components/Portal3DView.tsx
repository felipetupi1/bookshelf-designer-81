import { forwardRef, useImperativeHandle, useState } from "react"

export interface Portal3DViewRef {
  captureImage: () => Promise<string>
}

interface Portal3DViewProps {
  wallWidth: number
  wallHeight: number
  objectWidth: number
  objectHeight: number
  floorToObject: number
  rightGap: number
  leftGap: number
  topHeight: number
  leftShelves: { height: number; depth: number }[]
  rightShelves: { height: number; depth: number }[]
  topShelves: { height: number; depth: number }[]
  bottomShelves: { height: number; depth: number }[]
  leftModules?: Array<Array<{ width: number }>>
  rightModules?: Array<Array<{ width: number }>>
  topModules?: Array<Array<{ width: number }>>
  bottomModules?: Array<Array<{ width: number }>>
  finish: string
  isMobile?: boolean
  hideTooltip?: boolean
}

export const Portal3DView = forwardRef<Portal3DViewRef, Portal3DViewProps>(
  function Portal3DView(_props, ref) {
    useImperativeHandle(ref, () => ({
      captureImage: async () => { throw new Error("3D view placeholder") },
    }))

    return (
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted min-h-[500px] aspect-[4/3] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">Portal 3D View — Loading...</p>
      </div>
    )
  }
)
