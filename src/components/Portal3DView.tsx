import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

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
  shelves: { height: number; depth: number }[]
  leftModules?: Array<Array<{ width: number }>>
  rightModules?: Array<Array<{ width: number }>>
  topModules?: Array<Array<{ width: number }>>
  bottomModules?: Array<Array<{ width: number }>>
  finish: string
  isMobile?: boolean
  hideTooltip?: boolean
}

// ─── CONSTANTS ───
const MODULE_WIDTHS = [7.25, 9.5, 11.75, 14, 16.25, 18.5, 20.75, 23]
const MAX_GAP = 23
const MIN_COL = 25
const BOARD_T = 0.75
const SAFETY = 2

// ─── MATERIAL HELPERS ───
const WOOD_COLORS: Record<string, string> = {
  White: "#F5F5F5", Maple: "#E8D4B8", Black: "#1A1A1A", Oak: "#D4A574", Walnut: "#5D432C",
}
const TEXTURE_URLS: Record<string, string> = {
  Maple: "/images/finishes/maple1.jpeg", Oak: "/images/finishes/oak1.jpeg", Walnut: "/images/finishes/walnut1.jpeg", Black: "/images/finishes/valchromat.png",
}

function WoodMaterial({ finish, isFrame = false }: { finish: string; isFrame?: boolean }) {
  const url = TEXTURE_URLS[finish] || null
  const texture = useLoader(THREE.TextureLoader, url || "/images/finishes/OAK6.png")
  const tex = useMemo(() => {
    const t = texture.clone()
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 1)
    t.rotation = 0
    t.needsUpdate = true
    return t
  }, [texture])
  if (!url) return <meshStandardMaterial color={WOOD_COLORS[finish] || WOOD_COLORS.Oak} roughness={isFrame ? 0.7 : 0.8} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.3} />
  return <meshStandardMaterial map={tex} roughness={isFrame ? 0.6 : 0.7} metalness={0} side={THREE.DoubleSide} envMapIntensity={0.3} />
}

// ─── 3D PRIMITIVES ───
function Board({ pos, w, d, finish, zOff = 0 }: { pos: [number, number, number]; w: number; d: number; finish: string; zOff?: number }) {
  const geo = useMemo(() => new THREE.BoxGeometry(Math.max(w, 0.01), BOARD_T, d), [w, d])
  if (w <= 0) return null
  return (
    <mesh position={[pos[0], pos[1] + BOARD_T / 2, pos[2] + zOff]} castShadow receiveShadow geometry={geo}>
      <WoodMaterial finish={finish} />
    </mesh>
  )
}

function SidePanel({ x, h, d, finish }: { x: number; h: number; d: number; finish: string }) {
  return (
    <mesh position={[x, h / 2, -d / 2]} castShadow receiveShadow>
      <boxGeometry args={[BOARD_T, h, d]} />
      <WoodMaterial finish={finish} isFrame />
    </mesh>
  )
}

function Baguete({ position, height, finish, zOff = 0 }: { position: [number, number, number]; height: number; finish: string; zOff?: number }) {
  return (
    <mesh position={[position[0], position[1], position[2] + zOff]} castShadow receiveShadow>
      <boxGeometry args={[BOARD_T, height, 0.5]} />
      <WoodMaterial finish={finish} isFrame />
    </mesh>
  )
}

function ModuleBox({ pos, w, h, d, intF, frameF, sideF, bagueteF, zOff = 0 }: {
  pos: [number, number, number]; w: number; h: number; d: number; intF: string; frameF: string; sideF?: string; bagueteF?: string; zOff?: number
}) {
  const bH = h + 0.625
  const bOff = -0.3125
  const actualSideF = sideF || intF
  const actualBagueteF = bagueteF || frameF
  return (
    <group position={pos}>
      {/* left side */}
      <mesh position={[-w / 2 + BOARD_T / 2, h / 2, -d / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_T, h, d]} />
        <WoodMaterial finish={actualSideF} />
      </mesh>
      {/* right side */}
      <mesh position={[w / 2 - BOARD_T / 2, h / 2, -d / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[BOARD_T, h, d]} />
        <WoodMaterial finish={actualSideF} />
      </mesh>
      {/* back */}
      <mesh position={[0, h / 2 + bOff, -d - BOARD_T / 2 + zOff]} castShadow receiveShadow>
        <boxGeometry args={[w - BOARD_T * 2, bH, BOARD_T]} />
        <WoodMaterial finish={intF} />
      </mesh>
      {/* baguetes */}
      <Baguete position={[-w / 2 + BOARD_T / 2, bH / 2 + bOff, 0]} height={bH} finish={actualBagueteF} zOff={zOff} />
      <Baguete position={[w / 2 - BOARD_T / 2, bH / 2 + bOff, 0]} height={bH} finish={actualBagueteF} zOff={zOff} />
    </group>
  )
}

// ─── MODULE CALCULATION ───
function calcModulesForWidth(totalW: number, startIdx: number): { widths: number[]; nextIdx: number } {
  if (totalW < MODULE_WIDTHS[0]) return { widths: [], nextIdx: startIdx }
  const ws: number[] = []
  let idx = startIdx
  ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
  ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
  let sum = ws.reduce((a, b) => a + b, 0)
  while (totalW - sum > MAX_GAP * (ws.length - 1)) {
    ws.push(MODULE_WIDTHS[idx % MODULE_WIDTHS.length]); idx++
    sum = ws.reduce((a, b) => a + b, 0)
  }
  while (ws.length > 1 && ws.reduce((a, b) => a + b, 0) > totalW) { ws.pop(); idx-- }
  if (ws.length === 1 && ws[0] > totalW) return { widths: [], nextIdx: startIdx }
  return { widths: ws, nextIdx: idx % MODULE_WIDTHS.length }
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
  const ctrlRef = useRef(controls)
  useEffect(() => { ctrlRef.current = controls }, [controls])
  useEffect(() => {
    const fov = 60, fovR = (fov * Math.PI) / 180, ar = window.innerWidth / window.innerHeight
    const dW = wallWidth / 2 / Math.tan(fovR / 2) / ar
    const dH = wallHeight / 2 / Math.tan(fovR / 2)
    const pad = isMobile ? 0.8 : 1.8
    const dist = Math.max(dW, dH, maxDepth * 2.5) * pad
    const yOff = isMobile ? -0.8 : 0
    const tgt = new THREE.Vector3(0, wallHeight * 0.5 + yOff, dist)
    const look = new THREE.Vector3(0, wallHeight / 2 + yOff, 0)
    const start = camera.position.clone()
    const t0 = Date.now()
    const anim = () => {
      const p = Math.min((Date.now() - t0) / 600, 1)
      const e = 1 - Math.pow(1 - p, 3)
      camera.position.lerpVectors(start, tgt, e)
      if (ctrlRef.current && "target" in ctrlRef.current) {
        const c = ctrlRef.current as any; c.target.copy(look); c.update()
      }
      if (p < 1) requestAnimationFrame(anim)
    }
    anim()
  }, [resetKey, camera, isMobile]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}

// ─── MAIN SCENE ───
function PortalScene({ props, intF, frameF, sideF, boardF, bagueteF }: { props: Portal3DViewProps; intF: string; frameF: string; sideF: string; boardF: string; bagueteF: string }) {
  const { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, leftGap, rightGap, shelves } = props
  const maxDepth = shelves.length > 0 ? Math.max(...shelves.map(s => s.depth)) : 7
  const defDepth = shelves.length > 0 ? shelves[0].depth : maxDepth

  // Scene coords: wall centered at x=0
  const wL = -wallWidth / 2

  // Object zone in wall-relative coords (0..wallWidth)
  const objL = leftGap
  const objR = leftGap + objectWidth
  const objBot = floorToObject
  const objTop = floorToObject + objectHeight
  // Object zone with safety margin
  const safeBot = objBot - SAFETY
  const safeTop = objTop + SAFETY

  const hasLeft = leftGap >= MIN_COL
  const hasRight = rightGap >= MIN_COL

  // ─── Compute shelf row Y positions ───
  const rows = useMemo(() => {
    const r: { y: number; shelf: { height: number; depth: number } }[] = []
    let y = 0
    for (const s of shelves) {
      const next = y + s.height + BOARD_T
      if (next > wallHeight + 0.01) break
      r.push({ y, shelf: s })
      y = next
    }
    return r
  }, [shelves, wallHeight])

  const lastTop = rows.length > 0 ? rows[rows.length - 1].y + BOARD_T + rows[rows.length - 1].shelf.height : wallHeight

  // ─── Compute modules per row ───
  const rowModules = useMemo(() => {
    const result: { positions: { x: number; w: number }[]; zone: "left" | "right" | "center" | "skip" }[][] = []
    let seqIdx = 0
    for (const row of rows) {
      const { widths, nextIdx } = calcModulesForWidth(wallWidth, seqIdx)
      seqIdx = nextIdx
      const totalModW = widths.reduce((a, b) => a + b, 0)
      const gap = widths.length > 1 ? (wallWidth - totalModW) / (widths.length - 1) : 0

      const moduleY = row.y + BOARD_T
      const rowTop = row.y + row.shelf.height + BOARD_T
      const rowOverlapsObj = moduleY < safeTop && rowTop > safeBot

      const mods: { positions: { x: number; w: number }[]; zone: string }[] = []
      let x = 0
      for (const w of widths) {
        const modL = x
        const modR = x + w
        if (rowOverlapsObj) {
          // Row overlaps object: only render in left/right zones if they're wide enough
          if (modR <= objL) {
            if (hasLeft) mods.push({ positions: [{ x: modL, w }], zone: "left" })
          } else if (modL >= objR) {
            if (hasRight) mods.push({ positions: [{ x: modL, w }], zone: "right" })
          }
          // center zone: skip entirely
        } else {
          // Row does NOT overlap object: render all modules across full width
          mods.push({ positions: [{ x: modL, w }], zone: "full" })
        }
        x += w + gap
      }
      result.push(mods as any)
    }
    return result
  }, [rows, wallWidth, objL, objR, safeBot, safeTop, hasLeft, hasRight, objectWidth])

  return (
    <group>
      {/* ══════ OUTER FRAME ══════ */}
      {/* Bottom board — split if object reaches floor */}
      {objBot <= BOARD_T ? (
        <>
          {hasLeft && <Board pos={[wL + leftGap / 2, 0, -defDepth / 2]} w={leftGap} d={defDepth} finish={boardF} zOff={-(maxDepth - defDepth)} />}
          {hasRight && <Board pos={[wL + objR + rightGap / 2, 0, -defDepth / 2]} w={rightGap} d={defDepth} finish={boardF} zOff={-(maxDepth - defDepth)} />}
        </>
      ) : (
        <Board pos={[0, 0, -defDepth / 2]} w={wallWidth} d={defDepth} finish={boardF} zOff={-(maxDepth - defDepth)} />
      )}
      {/* Top board — full wallWidth at wallHeight */}
      <Board pos={[0, lastTop, -defDepth / 2]} w={wallWidth} d={defDepth} finish={boardF} zOff={-(maxDepth - defDepth)} />
      {/* Left side panel — only if leftGap >= 25" */}
      {hasLeft && <SidePanel x={wL + BOARD_T / 2} h={lastTop + BOARD_T} d={maxDepth} finish={sideF} />}
      {/* Right side panel — only if rightGap >= 25" */}
      {hasRight && <SidePanel x={wL + wallWidth - BOARD_T / 2} h={lastTop + BOARD_T} d={maxDepth} finish={sideF} />}


      {/* ══════ SHELF ROWS ══════ */}
      {rows.map((row, ri) => {
        const { y: rowY, shelf } = row
        const moduleY = rowY + BOARD_T
        const topBoardY = moduleY + shelf.height
        const zOff = -(maxDepth - shelf.depth)

        // Does this board Y overlap the object zone?
        const boardInObj = (by: number) => by < objTop && (by + BOARD_T) > objBot
        const rowOverlapsObj = moduleY < safeTop && topBoardY > safeBot

        // Render a horizontal shelf board, splitting if it intersects the object zone
  const renderShelfBoard = (by: number) => {
          if (!boardInObj(by)) {
            // Full width
            return <Board pos={[0, by, -shelf.depth / 2]} w={wallWidth} d={shelf.depth} finish={boardF} zOff={zOff} />
          }
          // Split into left and right portions, skipping object zone
          return (
            <>
              {hasLeft && <Board pos={[wL + leftGap / 2, by, -shelf.depth / 2]} w={leftGap} d={shelf.depth} finish={boardF} zOff={zOff} />}
              {hasRight && <Board pos={[wL + objR + rightGap / 2, by, -shelf.depth / 2]} w={rightGap} d={shelf.depth} finish={boardF} zOff={zOff} />}
            </>
          )
        }

        return (
          <group key={ri}>
            {/* Bottom board of this row (skip row 0, already rendered as outer frame) */}
            {ri > 0 && renderShelfBoard(rowY)}
            {/* Top board of this row */}
            {renderShelfBoard(topBoardY)}

            {/* Modules — only skip center zone modules when row overlaps object */}
            {rowModules[ri]?.map((mod: any, mi: number) => {
              const { x: modX, w: modW } = mod.positions[0]
              // Only skip modules in the object/center zone when the row actually overlaps the object vertically
              if (rowOverlapsObj && mod.zone === "center") return null
              return (
                <ModuleBox
                  key={`m${ri}-${mi}`}
                  pos={[wL + modX + modW / 2, moduleY, 0]}
                  w={modW} h={shelf.height} d={shelf.depth}
                  intF={intF} frameF={frameF}
                  sideF={sideF} bagueteF={bagueteF}
                  zOff={zOff}
                />
              )
            })}
          </group>
        )
      })}

      {/* ══════ OBJECT PLACEHOLDER ══════ */}
      <mesh position={[wL + objL + objectWidth / 2, floorToObject + objectHeight / 2, -maxDepth / 2]}>
        <boxGeometry args={[objectWidth, objectHeight, 1]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[wL + objL + objectWidth / 2, floorToObject + objectHeight / 2, -maxDepth / 2 + 0.6]}>
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
    const [intF, frameF] = finish.includes("/") ? finish.split("/") : [finish, finish]
    const isWhiteCombo = frameF === "White" && intF !== "White" && intF !== frameF
    const sideF = isWhiteCombo ? frameF : intF
    const boardF = isWhiteCombo ? frameF : intF
    const bagueteF = isWhiteCombo ? intF : frameF
    const [resetCount, setResetCount] = useState(0)

    let captureFn: (() => Promise<string>) | null = null
    useImperativeHandle(ref, () => ({
      captureImage: async () => { if (captureFn) return await captureFn(); throw new Error("Canvas not ready") },
    }))

    const maxDepth = props.shelves.length > 0 ? Math.max(...props.shelves.map(s => s.depth)) : 7
    const camDist = Math.max(wallWidth * 1.2, wallHeight * 1.2, maxDepth * 5)

    return (
      <div className={`relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${isMobile ? "aspect-square" : "min-h-[500px] aspect-[4/3]"}`}>
        <Canvas
          camera={{ position: [0, wallHeight * 0.5, camDist], fov: 60 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <CanvasCapture onReady={(fn) => { captureFn = fn }} />
            <CameraController wallWidth={wallWidth} wallHeight={wallHeight} maxDepth={maxDepth} isMobile={isMobile} resetKey={resetCount} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.00001} shadow-camera-left={-wallWidth} shadow-camera-right={wallWidth} shadow-camera-top={wallHeight} shadow-camera-bottom={-5} />
            <directionalLight position={[-10, 10, -8]} intensity={0.4} />
            <pointLight position={[0, wallHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />
            <PortalScene props={props} intF={intF} frameF={frameF} />
            <Environment preset="studio" environmentIntensity={0.5} />
            <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={wallWidth * 1.8} blur={2.8} far={wallHeight * 1.5} resolution={1024} />
            <OrbitControls enableZoom enablePan enableRotate minDistance={20} maxDistance={300} target={[0, wallHeight / 2, 0]} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.5} />
          </Suspense>
        </Canvas>
        <button onClick={() => setResetCount(c => c + 1)} className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm" title="Reset camera view">⟳ Reset View</button>
        {!hideTooltip && (
          <div className="absolute bottom-4 left-4 bg-foreground/70 text-primary-foreground px-3 py-2 rounded-md text-xs">Click and drag to rotate • Right-click to pan</div>
        )}
      </div>
    )
  }
)
