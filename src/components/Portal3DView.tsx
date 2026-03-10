import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

export interface Portal3DViewRef {
  captureImage: () => Promise<string>
}

const MIN_MODULE_WIDTH = 7.25

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

interface RowData {
  index: number
  shelf: { height: number; depth: number }
  boardY: number      // Y of the bottom board (absolute)
  moduleY: number     // Y where modules start
  topBoardY: number   // Y of the top board
  nextY: number       // Y for next row start
  inBottom: boolean   // row fits below object
  inTop: boolean      // row fits above object
}

function renderColumnModules(
  modules: { width: number }[] | undefined,
  colWidth: number,
  moduleY: number,
  shelf: { height: number; depth: number },
  maxDepth: number,
  internalFinish: string,
  frameFinish: string,
  colX: number,
  keyPrefix: string,
) {
  if (!modules || modules.length === 0) return null
  const zOffset = -(maxDepth - shelf.depth)
  const totalModW = modules.reduce((s, m) => s + m.width, 0)
  const numSpaces = modules.length - 1
  const spaceW = numSpaces > 0 ? (colWidth - totalModW) / numSpaces : 0

  const els: JSX.Element[] = []
  let mx = colX - colWidth / 2
  modules.forEach((mod, mi) => {
    els.push(
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
    mx += mod.width + spaceW
  })
  return <>{els}</>
}

function PortalScene({ props, internalFinish, frameFinish }: {
  props: Portal3DViewProps; internalFinish: string; frameFinish: string
}) {
  const { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, leftGap, rightGap,
    shelves, leftModules, rightModules, topModules, bottomModules } = props

  const objectTop = floorToObject + objectHeight
  const hasLeft = leftGap >= MIN_MODULE_WIDTH
  const hasRight = rightGap >= MIN_MODULE_WIDTH
  const hasCenter = objectWidth >= MIN_MODULE_WIDTH

  // Column X positions (centered on wall)
  const leftX = -wallWidth / 2 + leftGap / 2
  const rightX = -wallWidth / 2 + leftGap + objectWidth + rightGap / 2
  const centerX = -wallWidth / 2 + leftGap + objectWidth / 2

  const maxDepth = shelves.length > 0 ? Math.max(...shelves.map(s => s.depth)) : 7

  // Compute absolute row positions
  const rows: RowData[] = useMemo(() => {
    const result: RowData[] = []
    let y = 0
    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i]
      const boardY = y
      const moduleY = y + 0.75
      const topBoardY = moduleY + shelf.height
      const nextY = topBoardY + 0.75

      if (nextY > wallHeight + 0.01) break // doesn't fit

      // Row is "in bottom" if entire row (including top board) fits below object
      // Must match configurator: topBoardY + 0.75 <= floorToObject === nextY <= floorToObject
      const inBottom = nextY <= floorToObject
      // Row is "in top" if modules start at or above object top
      // Must match configurator: moduleY >= objectTop
      const inTop = moduleY >= objectTop

      result.push({ index: i, shelf, boardY, moduleY, topBoardY, nextY, inBottom, inTop })
      y = nextY
    }
    return result
  }, [shelves, wallHeight, floorToObject, objectTop])

  // Track center-bottom and center-top row indices for module mapping
  const { bottomIndices, topIndices } = useMemo(() => {
    const bottomIndices: number[] = []
    const topIndices: number[] = []
    rows.forEach((row, ri) => {
      if (row.inBottom) bottomIndices.push(ri)
      if (row.inTop) topIndices.push(ri)
    })
    return { bottomIndices, topIndices }
  }, [rows])

  // Object placeholder position
  const objY = floorToObject + objectHeight / 2
  const objCenterX = centerX

  return (
    <group>
      {rows.map((row, ri) => {
        const { shelf, boardY, moduleY, topBoardY } = row
        const zOffset = -(maxDepth - shelf.depth)

        return (
          <group key={ri}>
            {/* LEFT COLUMN */}
            {hasLeft && (
              <group>
                {ri === 0 && (
                  <Board position={[leftX, boardY, -shelf.depth / 2]} width={leftGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                )}
                <Board position={[leftX, topBoardY, -shelf.depth / 2]} width={leftGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                {renderColumnModules(leftModules?.[ri], leftGap, moduleY, shelf, maxDepth, internalFinish, frameFinish, leftX, `l-${ri}`)}
              </group>
            )}

            {/* RIGHT COLUMN */}
            {hasRight && (
              <group>
                {ri === 0 && (
                  <Board position={[rightX, boardY, -shelf.depth / 2]} width={rightGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                )}
                <Board position={[rightX, topBoardY, -shelf.depth / 2]} width={rightGap} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                {renderColumnModules(rightModules?.[ri], rightGap, moduleY, shelf, maxDepth, internalFinish, frameFinish, rightX, `r-${ri}`)}
              </group>
            )}

            {/* CENTER COLUMN - below object */}
            {hasCenter && row.inBottom && (
              <group>
                {bottomIndices[0] === ri && (
                  <Board position={[centerX, boardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                )}
                <Board position={[centerX, topBoardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                {renderColumnModules(
                  bottomModules?.[bottomIndices.indexOf(ri)],
                  objectWidth, moduleY, shelf, maxDepth, internalFinish, frameFinish, centerX, `cb-${ri}`
                )}
              </group>
            )}

            {/* CENTER COLUMN - above object */}
            {hasCenter && row.inTop && (
              <group>
                {topIndices[0] === ri && (
                  <Board position={[centerX, boardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                )}
                <Board position={[centerX, topBoardY, -shelf.depth / 2]} width={objectWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
                {renderColumnModules(
                  topModules?.[topIndices.indexOf(ri)],
                  objectWidth, moduleY, shelf, maxDepth, internalFinish, frameFinish, centerX, `ct-${ri}`
                )}
              </group>
            )}
          </group>
        )
      })}

      {/* Object placeholder */}
      <mesh position={[objCenterX, objY, -maxDepth / 2]}>
        <boxGeometry args={[objectWidth, objectHeight, 1]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      <lineSegments position={[objCenterX, objY, -maxDepth / 2 + 0.6]}>
        <edgesGeometry args={[new THREE.BoxGeometry(objectWidth, objectHeight, 0.1)]} />
        <lineBasicMaterial color="#666666" />
      </lineSegments>
    </group>
  )
}

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
