interface USurroundSchematicProps {
  w1: number
  w: number
  w2: number
  h: number
}

function DimensionLine({
  x1, y1, x2, y2, label, offset = 16, side = "outside",
}: {
  x1: number; y1: number; x2: number; y2: number
  label: string; offset?: number; side?: "outside" | "inside"
}) {
  const dx = x2 - x1
  const dy = y2 - y1
  const len = Math.sqrt(dx * dx + dy * dy)
  if (len < 2) return null

  const nx = -dy / len
  const ny = dx / len
  const dir = side === "outside" ? 1 : -1
  const ox = nx * offset * dir
  const oy = ny * offset * dir
  const tickLen = 5

  return (
    <g>
      <line x1={x1 + ox} y1={y1 + oy} x2={x2 + ox} y2={y2 + oy}
        stroke="currentColor" strokeWidth="1" strokeDasharray="3,2" />
      <line x1={x1} y1={y1} x2={x1 + ox + nx * tickLen * dir} y2={y1 + oy + ny * tickLen * dir}
        stroke="currentColor" strokeWidth="0.75" />
      <line x1={x2} y1={y2} x2={x2 + ox + nx * tickLen * dir} y2={y2 + oy + ny * tickLen * dir}
        stroke="currentColor" strokeWidth="0.75" />
      <text
        x={(x1 + x2) / 2 + ox + nx * 6 * dir}
        y={(y1 + y2) / 2 + oy + ny * 6 * dir}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="9"
        fill="currentColor"
        fontWeight="600"
      >
        {label}
      </text>
    </g>
  )
}

function toFraction(decimal: number): string {
  const whole = Math.floor(decimal)
  const fraction = decimal - whole
  const eighths = Math.round(fraction * 8)
  if (eighths === 0) return `${whole}"`
  if (eighths === 8) return `${whole + 1}"`
  const fractionMap: Record<number, string> = {
    1: "⅛", 2: "¼", 3: "⅜", 4: "½", 5: "⅝", 6: "¾", 7: "⅞",
  }
  return `${whole}${fractionMap[eighths]}"`
}

export function USurroundSchematic({ w1, w, w2, h }: USurroundSchematicProps) {
  const svgW = 260
  const svgH = 200
  const padding = 40

  const totalW = w1 + w + w2
  const totalDepth = Math.max(w1, w2)
  const scaleX = (svgW - padding * 2) / totalW
  const scaleY = (svgH - padding * 2) / totalDepth
  const scale = Math.min(scaleX, scaleY)

  const drawW = totalW * scale
  const drawDepth = Math.max(w1, w2) * scale
  const drawW1 = w1 * scale
  const drawWFront = w * scale
  const drawW2 = w2 * scale
  const thickness = 8

  const startX = (svgW - drawW) / 2
  const startY = padding

  const leftX = startX
  const rightX = startX + drawW1 + drawWFront
  const bottomY = startY + drawDepth
  const frontLeftX = startX + drawW1
  const frontRightX = startX + drawW1 + drawWFront

  const path = `
    M ${leftX} ${startY}
    L ${leftX} ${bottomY}
    L ${rightX + drawW2} ${bottomY}
    L ${rightX + drawW2} ${startY}
    L ${rightX + drawW2 - thickness} ${startY}
    L ${rightX + drawW2 - thickness} ${bottomY - thickness}
    L ${leftX + thickness} ${bottomY - thickness}
    L ${leftX + thickness} ${startY}
    Z
  `

  return (
    <svg width={svgW} height={svgH + 30} viewBox={`0 0 ${svgW} ${svgH + 30}`} className="text-foreground w-full max-w-[260px] mx-auto">
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" />

      <text x={leftX + thickness / 2} y={(startY + bottomY) / 2} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5"
        transform={`rotate(-90, ${leftX + thickness / 2}, ${(startY + bottomY) / 2})`}>
        Left Arm
      </text>
      <text x={(frontLeftX + frontRightX) / 2} y={bottomY - thickness / 2} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5">
        Front
      </text>
      <text x={rightX + drawW2 - thickness / 2} y={(startY + bottomY) / 2} textAnchor="middle" fontSize="8" fill="currentColor" opacity="0.5"
        transform={`rotate(90, ${rightX + drawW2 - thickness / 2}, ${(startY + bottomY) / 2})`}>
        Right Arm
      </text>

      <DimensionLine
        x1={leftX} y1={bottomY} x2={leftX} y2={startY}
        label={`W1: ${toFraction(w1)}`} offset={20} side="outside"
      />

      <DimensionLine
        x1={frontLeftX} y1={bottomY} x2={frontRightX} y2={bottomY}
        label={`W: ${toFraction(w)}`} offset={20} side="outside"
      />

      <DimensionLine
        x1={rightX + drawW2} y1={bottomY} x2={rightX + drawW2} y2={startY}
        label={`W2: ${toFraction(w2)}`} offset={20} side="inside"
      />

      <text x={svgW / 2} y={svgH + 20} textAnchor="middle" fontSize="9" fill="currentColor" fontWeight="600">
        H: {toFraction(h)}
      </text>
    </svg>
  )
}
