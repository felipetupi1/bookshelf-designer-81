import { forwardRef, useImperativeHandle } from "react"

export interface USurround3DViewRef {
  captureImage: () => Promise<string>
}

export interface USurround3DViewProps {
  w1: number; w: number; w2: number
  shelvesLeft: { height: number; depth: number }[]
  shelvesFront: { height: number; depth: number }[]
  shelvesRight: { height: number; depth: number }[]
  modulesLeft?: Array<Array<{ width: number }>>
  modulesFront?: Array<Array<{ width: number }>>
  modulesRight?: Array<Array<{ width: number }>>
  finish: string; isMobile?: boolean; hideTooltip?: boolean
}

export const USurround3DView = forwardRef<USurround3DViewRef, USurround3DViewProps>(
  function USurround3DView(_props, ref) {
    useImperativeHandle(ref, () => ({
      captureImage: async () => { throw new Error("3D view placeholder") },
    }))

    return (
      <div className="relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted min-h-[500px] aspect-[4/3] flex items-center justify-center">
        <p className="text-muted-foreground text-sm">U-Surround 3D View — Loading...</p>
      </div>
    )
  }
)
