import type { SlopeDirection } from "@/lib/cathedral-calculator"
import { availableWidthAtHeight } from "@/lib/cathedral-calculator"

interface CathedralSchematicProps {
  W: number
  H: number
  H1: number
  direction: SlopeDirection
  shelfYPositions: number[]
}

function DimensionLine({
  x1, y1, x2, y2, label, offset = 16, side = "outside",
}: {
  x1: number; y1: number; x2: number; y2: number; label: string; offset?: number; side?: "outside" | "inside"
}) {
  const isHorizontal = Math.abs(y2 - y1) < 0.5
  const isVertical = Math.abs(x2 - x1) < 0.5
  const tickSize = 4

  if (isHorizontal) {
    const dir = side === "outside" ? -1 : 1
    const lineY = y1 + offset * dir
    const midX = (x1 + x2) / 2
    return (
      <g className="text-foreground">
        <line x1={x1} y1={y1} x2={x1} y2={lineY} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
        <line x1={x2} y1={y2} x2={x2} y2={lineY} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
        <line x1={x1} y1={lineY} x2={x2} y2={lineY} stroke="currentColor" strokeWidth={0.8} />
        <line x1={x1} y1={lineY - tickSize / 2} x2={x1} y2={lineY + tickSize / 2} stroke="currentColor" strokeWidth={0.8} />
        <line x1={x2} y1={lineY - tickSize / 2} x2={x2} y2={lineY + tickSize / 2} stroke="currentColor" strokeWidth={0.8} />
        <text x={midX} y={lineY + (dir > 0 ? 12 : -4)} textAnchor="middle" fontSize={9} fontWeight={600} fill="currentColor">{label}</text>
      </g>
    )
  }

  if (isVertical) {
    const dir = side === "outside" ? -1 : 1
    const lineX = x1 + offset * dir
    const midY = (y1 + y2) / 2
    return (
      <g className="text-foreground">
        <line x1={x1} y1={y1} x2={lineX} y2={y1} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
        <line x1={x2} y1={y2} x2={lineX} y2={y2} stroke="currentColor" strokeWidth={0.5} strokeDasharray="2,2" opacity={0.4} />
        <line x1={lineX} y1={y1} x2={lineX} y2={y2} stroke="currentColor" strokeWidth={0.8} />
        <line x1={lineX - tickSize / 2} y1={y1} x2={lineX + tickSize / 2} y2={y1} stroke="currentColor" strokeWidth={0.8} />
        <line x1={lineX - tickSize / 2} y1={y2} x2={lineX + tickSize / 2} y2={y2} stroke="currentColor" strokeWidth={0.8} />
        <text x={lineX + (dir > 0 ? 4 : -4)} y={midY + 3} textAnchor={dir > 0 ? "start" : "end"} fontSize={9} fontWeight={600} fill="currentColor">{label}</text>
      </g>
    )
  }
  return null
}

export function CathedralSchematic({ W, H, H1, direction, shelfYPositions }: CathedralSchematicProps) {
  const padding = 40
  const maxSvgWidth = 400
  const scale = Math.min((maxSvgWidth - padding * 2) / W, (300 - padding * 2) / H1)

  const w = W * scale
  const h1Scaled = H1 * scale
  const hScaled = H * scale
  const svgWidth = w + padding * 2
  const svgHeight = h1Scaled + padding * 2

  const baseY = padding + h1Scaled
  const baseX = padding

  let outlinePath = ""
  if (direction === "left") {
    const leftTopY = baseY - hScaled
    const rightTopY = baseY - h1Scaled
    outlinePath = `M ${baseX},${baseY} L ${baseX},${leftTopY} L ${baseX + w},${rightTopY} L ${baseX + w},${baseY} Z`
  } else if (direction === "right") {
    const leftTopY = baseY - h1Scaled
    const rightTopY = baseY - hScaled
    outlinePath = `M ${baseX},${baseY} L ${baseX},${leftTopY} L ${baseX + w},${rightTopY} L ${baseX + w},${baseY} Z`
  } else {
    const peakX = baseX + w / 2
    const peakY = baseY - h1Scaled
    const leftTopY = baseY - hScaled
    const rightTopY = baseY - hScaled
    outlinePath = `M ${baseX},${baseY} L ${baseX},${leftTopY} L ${peakX},${peakY} L ${baseX + w},${rightTopY} L ${baseX + w},${baseY} Z`
  }

  const shelfLines = shelfYPositions.map((y, i) => {
    const aw = availableWidthAtHeight(W, H, H1, y)
    if (aw < 7.25) return null
    const lineWidth = aw * scale
    const lineY = baseY - y * scale

    let lineX = baseX
    if (direction === "left") {
      lineX = baseX + w - lineWidth
    } else if (direction === "right") {
      lineX = baseX
    } else {
      lineX = baseX + (w - lineWidth) / 2
    }

    return (
      <line
        key={`shelf-${i}`}
        x1={lineX + 2} y1={lineY}
        x2={lineX + lineWidth - 2} y2={lineY}
        stroke="currentColor" strokeWidth={0.8} opacity={0.4}
      />
    )
  })

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[400px] text-foreground" style={{ aspectRatio: `${svgWidth}/${svgHeight}` }}>
        <path d={outlinePath} fill="currentColor" fillOpacity={0.04} stroke="currentColor" strokeWidth={1.5} />

        {shelfLines}

        <DimensionLine x1={baseX} y1={baseY} x2={baseX + w} y2={baseY} label={`W: ${W}"`} offset={20} side="inside" />

        {direction === "left" ? (
          <DimensionLine x1={baseX} y1={baseY - hScaled} x2={baseX} y2={baseY} label={`H: ${H}"`} offset={24} side="outside" />
        ) : direction === "right" ? (
          <DimensionLine x1={baseX + w} y1={baseY - hScaled} x2={baseX + w} y2={baseY} label={`H: ${H}"`} offset={24} side="inside" />
        ) : (
          <DimensionLine x1={baseX} y1={baseY - hScaled} x2={baseX} y2={baseY} label={`H: ${H}"`} offset={24} side="outside" />
        )}

        {direction === "left" ? (
          <DimensionLine x1={baseX + w} y1={baseY - h1Scaled} x2={baseX + w} y2={baseY} label={`H1: ${H1}"`} offset={24} side="inside" />
        ) : direction === "right" ? (
          <DimensionLine x1={baseX} y1={baseY - h1Scaled} x2={baseX} y2={baseY} label={`H1: ${H1}"`} offset={24} side="outside" />
        ) : (
          <DimensionLine x1={baseX + w / 2} y1={baseY - h1Scaled} x2={baseX + w / 2} y2={baseY} label={`H1: ${H1}"`} offset={20} side="inside" />
        )}
      </svg>
    </div>
  )
}
