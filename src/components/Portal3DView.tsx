import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

export interface Portal3DViewRef {
  captureImage: () => Promise<string>
}

// Props interface — kept compatible with what PortalConfigurator passes
interface Portal3DViewProps {
  wallWidth: number
  wallHeight: number
  objectWidth: number
  objectHeight: number
  floorToObject: number
  rightGap: number
  leftGap: number
  topHeight: number
  shelves: { height: number; depth: number }[]
  // These are accepted but IGNORED — modules are self-computed from MODULE_WIDTHS
  leftModules?: Array<Array<{ width: number }>>
  rightModules?: Array<Array<{ width: number }>>
  topModules?: Array<Array<{ width: number }>>
  bottomModules?: Array<Array<{ width: number }>>
  finish: string
  isMobile?: boolean
  hideTooltip?: boolean
}

// ─── MODULE WIDTH SEQUENCE ───
const MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]
const MAX_GAP = 23
const MIN_COLUMN_WIDTH = 25

/** Compute modules for the FULL wall width as one continuous sequence, then split into left/center/right */
function computeFullRowModules(
  wallWidth: number, leftGap: number, objectWidth: number, rightGap: number,
  floorToObject: number, objectTop: number, shelfBottomY: number, shelfTopY: number,
  startModuleIndex: number
): {
  left: { width: number }[]; center: { width: number }[]; right: { width: number }[];
  nextIndex: number
} {
  if (wallWidth < MIN_COLUMN_WIDTH) return { left: [], center: [], right: [], nextIndex: startModuleIndex }

  // Step 1: Fill the full wallWidth with modules from smallest first
  const moduleWidths: number[] = []
  let idx = startModuleIndex
  // Start with first two
  moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
  moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++

  let currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
  let freeSpace = wallWidth - currentWidth
  let maxAllowed = MAX_GAP * (moduleWidths.length - 1)
  while (freeSpace > maxAllowed) {
    moduleWidths.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
    currentWidth = moduleWidths.reduce((s, w) => s + w, 0)
    freeSpace = wallWidth - currentWidth
    maxAllowed = MAX_GAP * (moduleWidths.length - 1)
  }
  // Remove if exceeds
  while (moduleWidths.length > 1 && moduleWidths.reduce((s, w) => s + w, 0) > wallWidth) {
    moduleWidths.pop(); idx--
  }
  if (moduleWidths.length === 1 && moduleWidths[0] > wallWidth) {
    return { left: [], center: [], right: [], nextIndex: startModuleIndex }
  }

  // Step 2: Calculate positions across wallWidth (left edge = 0)
  const totalModW = moduleWidths.reduce((s, w) => s + w, 0)
  const remainingSpace = wallWidth - totalModW
  const gap = moduleWidths.length > 1 ? remainingSpace / (moduleWidths.length - 1) : 0

  // Step 3: Determine object zone boundaries (relative to wall left = 0)
  const objectLeftEdge = leftGap
  const objectRightEdge = leftGap + objectWidth
  const overlapsObject = shelfBottomY < objectTop && shelfTopY > floorToObject

  // Step 4: Assign each module to left, center (skipped if overlapping), or right
  const left: { width: number }[] = []
  const center: { width: number }[] = []
  const right: { width: number }[] = []
  let x = 0
  for (const w of moduleWidths) {
    const modLeft = x
    const modRight = x + w
    const modCenter = (modLeft + modRight) / 2

    if (modRight <= objectLeftEdge) {
      // Fully in left zone
      if (leftGap >= MIN_COLUMN_WIDTH) left.push({ width: w })
    } else if (modLeft >= objectRightEdge) {
      // Fully in right zone
      if (rightGap >= MIN_COLUMN_WIDTH) right.push({ width: w })
    } else {
      // In object zone — render only if not overlapping object vertically
      if (!overlapsObject && objectWidth >= MIN_COLUMN_WIDTH) {
        center.push({ width: w })
      }
      // If overlapping, skip (but sequence continues)
    }
    x += w + gap
  }

  return { left, center, right, nextIndex: idx % MODULE_WIDTHS.length }
}

// ─── MATERIAL HELPERS ───
const getWoodColor = (finish: string): string => {
  const colorMap: Record<string, string> = {
    White: "#F5F5F5", Maple: "#E8D4B8", Black: "#1A1A1A", Oak: "#D4A574", Walnut: "#5D432C",
  }
  return colorMap[finish] || colorMap.Oak
}

const getTextureUrl = (finish: string): string | null => {
  const textureMap: Record<string, string> = {
    Maple: "/images/finishes/maple.jpg", Oak: "/images/finishes/oak.jpg", Walnut: "/images/finishes/walnut.jpg",
  }
  return textureMap[finish] || null
}

function WoodMaterial({ finish, isFrame = false }: { finish: string; isFrame?: boolean }) {
  const textureUrl = getTextureUrl(finish)
  const texture = useLoader(THREE.TextureLoader, textureUrl || "/images/finishes/oak.jpg")
  const clonedTexture = useMemo(() => {
    const t = texture.clone()
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 1)
    t.needsUpdate = true
    return t
  }, [texture])

  if (!textureUrl) {
    return <meshStandardMaterial color={getWoodColor(finish)} roughness={isFrame ? 0.7 : 0.8} metalness={0.0} side={THREE.DoubleSide} envMapIntensity={0.3} />
  }
  return <meshStandardMaterial map={clonedTexture} roughness={isFrame ? 0.6 : 0.7} metalness={0.0} side={THREE.DoubleSide} envMapIntensity={0.3} />
}

// ─── 3D PRIMITIVES ───
function Board({ position, width, depth, finish, zOffset = 0 }: {
  position: [number, number, number]; width: number; depth: number; finish: string; zOffset?: number
}) {
  const thickness = 0.75
  const geometry = useMemo(() => new THREE.BoxGeometry(width, thickness, depth), [width, depth])
  return (
    <mesh position={[position[0], position[1] + thickness / 2, position[2] + zOffset]} castShadow receiveShadow geometry={geometry}>
      <WoodMaterial finish={finish} />
    </mesh>
  )
}

function Baguete({ position, height, finish, zOffset = 0 }: {
  position: [number, number, number]; height: number; finish: string; zOffset?: number
}) {
  return (
    <mesh position={[position[0], position[1], position[2] + zOffset]} castShadow receiveShadow>
      <boxGeometry args={[0.75, height, 0.5]} />
      <WoodMaterial finish={finish} isFrame />
    </mesh>
  )
}

function ModuleBox({ position, width, height, depth, internalFinish, frameFinish, zOffset = 0 }: {
  position: [number, number, number]; width: number; height: number; depth: number
  internalFinish: string; frameFinish: string; zOffset?: number
}) {
  const sideThickness = 0.75
  const backThickness = 0.75
  const bagueteHeight = height + 0.625
  const bagueteOffset = -0.3125
  const sideZ = -depth / 2
  const backZ = -depth - backThickness / 2

  return (
    <group position={position}>
      <mesh position={[-width / 2 + sideThickness / 2, height / 2, sideZ + zOffset]} castShadow receiveShadow>
        <boxGeometry args={[sideThickness, height, depth]} />
        <WoodMaterial finish={internalFinish} />
      </mesh>
      <mesh position={[width / 2 - sideThickness / 2, height / 2, sideZ + zOffset]} castShadow receiveShadow>
        <boxGeometry args={[sideThickness, height, depth]} />
        <WoodMaterial finish={internalFinish} />
      </mesh>
      <mesh position={[0, height / 2 + bagueteOffset, backZ + zOffset]} castShadow receiveShadow>
        <boxGeometry args={[width - sideThickness * 2, bagueteHeight, backThickness]} />
        <WoodMaterial finish={internalFinish} />
      </mesh>
      <Baguete position={[-width / 2 + sideThickness / 2, bagueteHeight / 2 + bagueteOffset, 0]} height={bagueteHeight} finish={frameFinish} zOffset={zOffset} />
      <Baguete position={[width / 2 - sideThickness / 2, bagueteHeight / 2 + bagueteOffset, 0]} height={bagueteHeight} finish={frameFinish} zOffset={zOffset} />
    </group>
  )
}

// ─── CANVAS HELPERS ───
function CanvasCapture({ onReady }: { onReady: (fn: () => Promise<string>) => void }) {
  const { gl, scene, camera } = useThree()
  useMemo(() => {
    onReady(async () => new Promise((resolve) => {
      requestAnimationFrame(() => { gl.render(scene, camera); resolve(gl.domElement.toDataURL("image/png")) })
    }))
  }, [gl, scene, camera, onReady])
  return null
}

function CameraController({ wallWidth, wallHeight, maxDepth, isMobile, resetKey }: {
  wallWidth: number; wallHeight: number; maxDepth: number; isMobile?: boolean; resetKey: number
}) {
  const { camera, controls } = useThree()
  const controlsRef = useRef(controls)
  useEffect(() => { controlsRef.current = controls }, [controls])

  useEffect(() => {
    const fov = 60
    const fovRadians = (fov * Math.PI) / 180
    const aspectRatio = window.innerWidth / window.innerHeight
    const distW = wallWidth / 2 / Math.tan(fovRadians / 2) / aspectRatio
    const distH = wallHeight / 2 / Math.tan(fovRadians / 2)
    const distD = maxDepth * 2.5
    const padding = isMobile ? 0.8 : 1.8
    const optimalDist = Math.max(distW, distH, distD) * padding
    const yOff = isMobile ? -0.8 : 0

    const targetPos = new THREE.Vector3(0, wallHeight * 0.5 + yOff, optimalDist)
    const lookAt = new THREE.Vector3(0, wallHeight / 2 + yOff, 0)
    const startPos = camera.position.clone()
    const duration = 600
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)
      camera.position.lerpVectors(startPos, targetPos, eased)
      if (controlsRef.current && "target" in controlsRef.current) {
        const oc = controlsRef.current as any
        oc.target.set(lookAt.x, lookAt.y, lookAt.z)
        oc.update()
      }
      if (progress < 1) requestAnimationFrame(animate)
    }
    animate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, camera, isMobile])

  return null
}

// ─── RENDER MODULES IN A COLUMN ───
function ColumnModules({ modules, colCenterX, colWidth, moduleY, shelf, maxDepth, internalFinish, frameFinish, keyPrefix, align = "center" }: {
  modules: { width: number }[]
  colCenterX: number
  colWidth: number
  moduleY: number
  shelf: { height: number; depth: number }
  maxDepth: number
  internalFinish: string
  frameFinish: string
  keyPrefix: string
  align?: "left" | "right" | "center"
}) {
  const zOffset = -(maxDepth - shelf.depth)
  const totalModW = modules.reduce((s, m) => s + m.width, 0)
  const remainingSpace = colWidth - totalModW
  const gap = modules.length > 1 ? remainingSpace / (modules.length - 1) : 0

  // Calculate starting x based on alignment
  const colLeft = colCenterX - colWidth / 2
  const colRight = colCenterX + colWidth / 2
  let startX: number
  if (modules.length === 1) {
    if (align === "left") startX = colLeft
    else if (align === "right") startX = colRight - modules[0].width
    else startX = colCenterX - modules[0].width / 2
  } else {
    startX = colLeft
  }

  let mx = startX
  return (
    <>
      {modules.map((mod, mi) => {
        const el = (
          <ModuleBox
            key={`${keyPrefix}-${mi}`}
            position={[mx + mod.width / 2, moduleY, 0]}
            width={mod.width}
            height={shelf.height}
            depth={shelf.depth}
            internalFinish={internalFinish}
            frameFinish={frameFinish}
            zOffset={zOffset}
          />
        )
        mx += mod.width + gap
        return el
      })}
    </>
  )
}

// ─── MAIN SCENE ───
function PortalScene({ props, internalFinish, frameFinish }: {
  props: Portal3DViewProps; internalFinish: string; frameFinish: string
}) {
  const { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, leftGap, rightGap, shelves } = props

  const objectTop = floorToObject + objectHeight
  const maxDepth = shelves.length > 0 ? Math.max(...shelves.map(s => s.depth)) : 7

  // Wall centered at x=0
  const wallLeft = -wallWidth / 2
  const leftColX = wallLeft + leftGap / 2
  const centerColX = wallLeft + leftGap + objectWidth / 2
  const rightColX = wallLeft + leftGap + objectWidth + rightGap / 2

  const hasLeft = leftGap >= MIN_COLUMN_WIDTH
  const hasRight = rightGap >= MIN_COLUMN_WIDTH
  const hasCenter = objectWidth >= MIN_COLUMN_WIDTH

  // Step 1: Calculate Y positions for every shelf row
  const rows = useMemo(() => {
    const result: { y: number; shelf: { height: number; depth: number } }[] = []
    let y = 0
    for (const shelf of shelves) {
      const nextY = y + shelf.height + 0.75
      if (nextY > wallHeight + 0.01) break
      result.push({ y, shelf })
      y = nextY
    }
    return result
  }, [shelves, wallHeight])

  // Pre-compute modules for each row as ONE continuous sequence across the full wall
  const columnModuleData = useMemo(() => {
    const data: { left: { width: number }[], center: { width: number }[], right: { width: number }[] }[] = []
    let seqIdx = 0
    for (const row of rows) {
      const shelfTopY = row.y + row.shelf.height + 0.75
      const result = computeFullRowModules(
        wallWidth, leftGap, objectWidth, rightGap,
        floorToObject, objectTop, row.y, shelfTopY,
        seqIdx
      )
      seqIdx = result.nextIndex
      data.push({ left: result.left, center: result.center, right: result.right })
    }
    return data
  }, [rows, wallWidth, leftGap, objectWidth, rightGap, floorToObject, objectTop])

  // Check if top-of-object height is enough for center shelves above
  const topSpace = wallHeight - objectTop

  return (
    <group>
      {rows.map((row, ri) => {
        const { y: shelfBottomY, shelf } = row
        const boardY = shelfBottomY
        const moduleY = shelfBottomY + 0.75
        const topBoardY = moduleY + shelf.height
        const zOffset = -(maxDepth - shelf.depth)

        // Does this row overlap the object? (for center column)
        const shelfTop = shelfBottomY + shelf.height
        const overlapsObject = shelfBottomY < objectTop && shelfTop > floorToObject
        // Center visible only if no overlap AND objectWidth >= MIN_COLUMN_WIDTH
        const centerVisible = hasCenter && !overlapsObject

        // Check if the top board of this row aligns with objectTop (for spanning board)
        const topBoardIsObjectTop = Math.abs(topBoardY - objectTop) < 1.0

        return (
          <group key={ri}>
            {hasLeft && (
              <group>
                {ri === 0 && <Board position={[leftColX, boardY, -shelf.depth / 2]} width={leftGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />}
                <Board position={[leftColX, topBoardY, -shelf.depth / 2]} width={leftGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                <ColumnModules modules={columnModuleData[ri].left} colCenterX={leftColX} colWidth={leftGap} moduleY={moduleY} shelf={shelf} maxDepth={maxDepth} internalFinish={internalFinish} frameFinish={frameFinish} keyPrefix={`L${ri}`} align="left" />
              </group>
            )}
            {centerVisible && (
              <group>
                {ri === 0 && <Board position={[centerColX, boardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />}
                <Board position={[centerColX, topBoardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                <ColumnModules modules={columnModuleData[ri].center} colCenterX={centerColX} colWidth={objectWidth} moduleY={moduleY} shelf={shelf} maxDepth={maxDepth} internalFinish={internalFinish} frameFinish={frameFinish} keyPrefix={`C${ri}`} align="center" />
              </group>
            )}
            {/* Board spanning center at object top height — even if center modules are hidden */}
            {!centerVisible && hasCenter && topBoardIsObjectTop && (
              <Board position={[centerColX, topBoardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
            )}
            {hasRight && (
              <group>
                {ri === 0 && <Board position={[rightColX, boardY, -shelf.depth / 2]} width={rightGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />}
                <Board position={[rightColX, topBoardY, -shelf.depth / 2]} width={rightGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                <ColumnModules modules={columnModuleData[ri].right} colCenterX={rightColX} colWidth={rightGap} moduleY={moduleY} shelf={shelf} maxDepth={maxDepth} internalFinish={internalFinish} frameFinish={frameFinish} keyPrefix={`R${ri}`} align="right" />
              </group>
            )}
          </group>
        )
      })}

      {/* ── Board above the object at y = objectTop ── */}
      {hasCenter && (() => {
        // Find the shelf whose top board aligns closest to objectTop
        const bestShelf = rows.length > 0 ? rows[0].shelf : { depth: maxDepth }
        for (const row of rows) {
          const topBoardY = row.y + 0.75 + row.shelf.height
          if (Math.abs(topBoardY - objectTop) < 1.0) {
            // Already rendered by the row loop via the spanning board logic — skip
            return null
          }
        }
        // No row aligns — render an explicit board
        const depth = rows.length > 0 ? rows[0].shelf.depth : maxDepth
        const zOffset = -(maxDepth - depth)
        return <Board position={[centerColX, objectTop, -depth / 2]} width={objectWidth} depth={depth} finish={internalFinish} zOffset={zOffset} />
      })()}

      {/* ── OBJECT PLACEHOLDER (grey box) ── */}
      <mesh position={[centerColX, floorToObject + objectHeight / 2, -maxDepth / 2]}>
        <boxGeometry args={[objectWidth, objectHeight, 1]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[centerColX, floorToObject + objectHeight / 2, -maxDepth / 2 + 0.6]}>
        <edgesGeometry args={[new THREE.BoxGeometry(objectWidth, objectHeight, 0.1)]} />
        <lineBasicMaterial color="#666666" />
      </lineSegments>
    </group>
  )
}

// ─── EXPORTED COMPONENT ───
export const Portal3DView = forwardRef<Portal3DViewRef, Portal3DViewProps>(
  function Portal3DView(props, ref) {
    const { wallWidth, wallHeight, finish, isMobile, hideTooltip } = props
    const [internalFinish, frameFinish] = finish.includes("/") ? finish.split("/") : [finish, finish]
    const [resetCount, setResetCount] = useState(0)

    let captureFunction: (() => Promise<string>) | null = null
    useImperativeHandle(ref, () => ({
      captureImage: async () => {
        if (captureFunction) return await captureFunction()
        throw new Error("Canvas not ready")
      },
    }))

    const maxDepth = props.shelves.length > 0 ? Math.max(...props.shelves.map(s => s.depth)) : 7
    const cameraDistance = Math.max(wallWidth * 1.2, wallHeight * 1.2, maxDepth * 5)

    return (
      <div className={`relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${isMobile ? "aspect-square" : "min-h-[500px] aspect-[4/3]"}`}>
        <Canvas
          camera={{ position: [0, wallHeight * 0.5, cameraDistance], fov: 60 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <CanvasCapture onReady={(fn) => { captureFunction = fn }} />
            <CameraController wallWidth={wallWidth} wallHeight={wallHeight} maxDepth={maxDepth} isMobile={isMobile} resetKey={resetCount} />

            <ambientLight intensity={0.6} />
            <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.00001} shadow-camera-left={-wallWidth} shadow-camera-right={wallWidth} shadow-camera-top={wallHeight} shadow-camera-bottom={-5} />
            <directionalLight position={[-10, 10, -8]} intensity={0.4} />
            <pointLight position={[0, wallHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />

            <PortalScene props={props} internalFinish={internalFinish} frameFinish={frameFinish} />

            <Environment preset="studio" environmentIntensity={0.5} />
            <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={wallWidth * 1.8} blur={2.8} far={wallHeight * 1.5} resolution={1024} />
            <OrbitControls enableZoom enablePan enableRotate minDistance={20} maxDistance={300} target={[0, wallHeight / 2, 0]} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.5} />
          </Suspense>
        </Canvas>

        <button onClick={() => setResetCount(c => c + 1)} className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm" title="Reset camera view">
          ⟳ Reset View
        </button>
        {!hideTooltip && (
          <div className="absolute bottom-4 left-4 bg-foreground/70 text-primary-foreground px-3 py-2 rounded-md text-xs">
            Click and drag to rotate • Right-click to pan
          </div>
        )}
      </div>
    )
  }
)
