interface PortalSchematicProps {
  wallWidth: number
  wallHeight: number
  objectWidth: number
  objectHeight: number
  floorToObject: number
  rightGap: number
  leftGap: number
  topHeight: number
}

const MIN_MODULE_WIDTH = 7.25

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

export function PortalSchematic({
  wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, rightGap, leftGap, topHeight,
}: PortalSchematicProps) {
  const padding = 40
  const maxSvgWidth = 400
  const scale = Math.min((maxSvgWidth - padding * 2) / wallWidth, (300 - padding * 2) / wallHeight)

  const w = wallWidth * scale
  const h = wallHeight * scale
  const svgWidth = w + padding * 2
  const svgHeight = h + padding * 2 + 16

  const wallX = padding
  const wallY = padding

  const hasLeft = leftGap >= MIN_MODULE_WIDTH
  const hasRight = rightGap > 0 && rightGap >= MIN_MODULE_WIDTH
  const hasTop = topHeight > 12
  const hasBottom = floorToObject > 0

  const leftColW = leftGap * scale
  const rightColW = rightGap * scale
  const objW = objectWidth * scale
  const objH = objectHeight * scale
  const objX = wallX + leftGap * scale
  const objY = wallY + h - floorToObject * scale - objH
  const topSectionH = topHeight * scale
  const bottomH = floorToObject * scale

  const cutoutW = (objectWidth + 2) * scale
  const cutoutH = (objectHeight + 2) * scale
  const cutoutX = wallX + (leftGap - 1) * scale
  const cutoutY = wallY + h - floorToObject * scale - cutoutH

  const drawShelfLines = (zoneX: number, zoneY: number, zoneW: number, zoneH: number, count: number) => {
    const lines: JSX.Element[] = []
    if (count <= 0 || zoneH <= 0) return lines
    const spacing = zoneH / (count + 1)
    for (let i = 1; i <= count; i++) {
      const ly = zoneY + spacing * i
      lines.push(
        <line key={`shelf-${zoneX}-${zoneY}-${i}`} x1={zoneX + 2} y1={ly} x2={zoneX + zoneW - 2} y2={ly} stroke="currentColor" strokeWidth={0.7} opacity={0.35} />
      )
    }
    return lines
  }

  return (
    <div className="w-full flex justify-center">
      <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full max-w-[400px] text-foreground" style={{ aspectRatio: `${svgWidth}/${svgHeight}` }}>
        <rect x={wallX} y={wallY} width={w} height={h} fill="none" stroke="currentColor" strokeWidth={1.5} />

        {hasLeft && (
          <rect x={wallX} y={wallY} width={leftColW} height={h} fill="currentColor" opacity={0.06} rx={1} />
        )}
        {hasRight && (
          <rect x={wallX + w - rightColW} y={wallY} width={rightColW} height={h} fill="currentColor" opacity={0.06} rx={1} />
        )}
        {hasTop && (
          <rect x={objX} y={wallY} width={objW} height={topSectionH} fill="currentColor" opacity={0.06} rx={1} />
        )}
        {hasBottom && (
          <rect x={objX} y={wallY + h - bottomH} width={objW} height={bottomH} fill="currentColor" opacity={0.08} rx={1} />
        )}

        {hasLeft && drawShelfLines(wallX, wallY, leftColW, h, 4)}
        {hasRight && drawShelfLines(wallX + w - rightColW, wallY, rightColW, h, 4)}
        {hasTop && drawShelfLines(objX, wallY, objW, topSectionH, 1)}
        {hasBottom && drawShelfLines(objX, wallY + h - bottomH, objW, bottomH, Math.max(1, Math.floor(floorToObject / 15)))}

        <rect x={cutoutX} y={cutoutY} width={cutoutW} height={cutoutH} fill="hsl(var(--muted))" stroke="currentColor" strokeWidth={1} opacity={0.15} rx={2} />
        <rect x={cutoutX} y={cutoutY} width={cutoutW} height={cutoutH} fill="none" stroke="currentColor" strokeWidth={0.8} rx={2} opacity={0.5} />

        <rect x={objX} y={objY} width={objW} height={objH} fill="hsl(var(--muted))" stroke="currentColor" strokeWidth={1} strokeDasharray="4,3" rx={2} />
        <text x={objX + objW / 2} y={objY + objH / 2 + 3} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.5} fontWeight={500}>
          OBJECT
        </text>

        {cutoutH > 20 && (
          <text x={cutoutX + cutoutW / 2} y={cutoutY - 3} textAnchor="middle" fontSize={6} fill="currentColor" opacity={0.35} fontWeight={400}>
            cutout {objectWidth + 2}" × {objectHeight + 2}"
          </text>
        )}

        {hasBottom && bottomH > 15 && (
          <text x={objX + objW / 2} y={wallY + h - bottomH / 2 + 3} textAnchor="middle" fontSize={7} fill="currentColor" opacity={0.4} fontWeight={500}>
            BOTTOM
          </text>
        )}

        <DimensionLine x1={wallX} y1={wallY + h} x2={wallX + w} y2={wallY + h} label={`W: ${wallWidth}"`} offset={20} side="inside" />
        <DimensionLine x1={wallX} y1={wallY} x2={wallX} y2={wallY + h} label={`H: ${wallHeight}"`} offset={24} side="outside" />
        <DimensionLine x1={objX} y1={objY + objH} x2={objX + objW} y2={objY + objH} label={`L2: ${objectWidth}"`} offset={12} side="inside" />
        <DimensionLine x1={objX + objW} y1={objY} x2={objX + objW} y2={objY + objH} label={`H2: ${objectHeight}"`} offset={12} side="inside" />

        {floorToObject > 0 && (
          <DimensionLine x1={objX} y1={objY + objH} x2={objX} y2={wallY + h} label={`H1: ${floorToObject}"`} offset={16} side="outside" />
        )}
        {rightGap > 0 && (
          <DimensionLine x1={objX + objW} y1={objY} x2={wallX + w} y2={objY} label={`W1: ${rightGap}"`} offset={16} side="outside" />
        )}
        {leftGap > 0 && (
          <DimensionLine x1={wallX} y1={objY} x2={objX} y2={objY} label={`Left: ${leftGap}"`} offset={16} side="outside" />
        )}

        <text x={svgWidth / 2} y={svgHeight - 4} textAnchor="middle" fontSize={7} fill="currentColor" opacity={0.4} fontWeight={400}>
          {leftGap} + {objectWidth} + {rightGap} = {leftGap + objectWidth + rightGap}" (W={wallWidth}")
        </text>
      </svg>
    </div>
  )
}
