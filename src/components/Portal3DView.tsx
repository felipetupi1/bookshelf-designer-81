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

/** Renders a single zone (column of shelves) at a given position */
function ShelfZone({ shelves, modules, zoneWidth, internalFinish, frameFinish, position }: {
  shelves: { height: number; depth: number }[]
  modules?: Array<Array<{ width: number }>>
  zoneWidth: number
  internalFinish: string
  frameFinish: string
  position: [number, number, number]
}) {
  const maxDepth = shelves.length > 0 ? Math.max(...shelves.map(s => s.depth)) : 7

  const elements = useMemo(() => {
    const els: JSX.Element[] = []
    if (shelves.length === 0) return els

    let y = 0
    shelves.forEach((shelf, i) => {
      const zOffset = -(maxDepth - shelf.depth)

      // Bottom board (only for first shelf)
      if (i === 0) {
        els.push(
          <Board key={`b-bot-${i}`} position={[0, y, -shelf.depth / 2]} width={zoneWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
        )
      }

      // Transition board when depth decreases
      if (i > 0 && shelf.depth < shelves[i - 1].depth) {
        y += 0.75
        els.push(
          <Board key={`b-trans-${i}`} position={[0, y, -shelf.depth / 2]} width={zoneWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
        )
      }

      const moduleStartY = y + 0.75

      // Top board for this shelf
      y += shelf.height + 0.75
      els.push(
        <Board key={`b-top-${i}`} position={[0, y, -shelf.depth / 2]} width={zoneWidth} depth={shelf.depth} finish={internalFinish} zOffset={zOffset} />
      )

      // Modules
      const shelfModules = modules?.[i] || []
      const totalModW = shelfModules.reduce((s, m) => s + m.width, 0)
      const numSpaces = shelfModules.length - 1
      const spaceW = numSpaces > 0 ? (zoneWidth - totalModW) / numSpaces : 0

      let mx = -zoneWidth / 2
      shelfModules.forEach((mod, mi) => {
        els.push(
          <ModuleBox
            key={`mod-${i}-${mi}`}
            position={[mx + mod.width / 2, moduleStartY, 0]}
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
    })
    return els
  }, [shelves, modules, zoneWidth, maxDepth, internalFinish, frameFinish])

  return <group position={position}>{elements}</group>
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

function PortalScene({ props, internalFinish, frameFinish }: {
  props: Portal3DViewProps; internalFinish: string; frameFinish: string
}) {
  const { wallWidth, wallHeight, objectWidth, objectHeight, floorToObject, leftGap, rightGap, topHeight,
    leftShelves, rightShelves, topShelves, bottomShelves,
    leftModules, rightModules, topModules, bottomModules } = props

  // Center of the object horizontally
  const objectCenterX = -wallWidth / 2 + leftGap + objectWidth / 2

  // Left zone: from left wall edge, width = leftGap, full wallHeight, starts at y=0
  const leftX = -wallWidth / 2 + leftGap / 2

  // Right zone: from right side of object to right wall edge
  const rightX = -wallWidth / 2 + leftGap + objectWidth + rightGap / 2

  // Bottom zone: below the object, width = objectWidth
  const bottomX = objectCenterX
  const bottomY = 0

  // Top zone: above the object
  const topX = objectCenterX
  const topY = floorToObject + objectHeight

  // Object rectangle (blank space) - rendered as a translucent box
  const objY = floorToObject + objectHeight / 2
  const avgDepth = 7 // reference depth for the object placeholder

  return (
    <group>
      {/* Left shelf zone */}
      {leftShelves.length > 0 && (
        <ShelfZone
          shelves={leftShelves}
          modules={leftModules}
          zoneWidth={leftGap}
          internalFinish={internalFinish}
          frameFinish={frameFinish}
          position={[leftX, 0, 0]}
        />
      )}

      {/* Right shelf zone */}
      {rightShelves.length > 0 && (
        <ShelfZone
          shelves={rightShelves}
          modules={rightModules}
          zoneWidth={rightGap}
          internalFinish={internalFinish}
          frameFinish={frameFinish}
          position={[rightX, 0, 0]}
        />
      )}

      {/* Bottom shelf zone */}
      {bottomShelves.length > 0 && (
        <ShelfZone
          shelves={bottomShelves}
          modules={bottomModules}
          zoneWidth={objectWidth}
          internalFinish={internalFinish}
          frameFinish={frameFinish}
          position={[bottomX, bottomY, 0]}
        />
      )}

      {/* Top shelf zone */}
      {topShelves.length > 0 && (
        <ShelfZone
          shelves={topShelves}
          modules={topModules}
          zoneWidth={objectWidth}
          internalFinish={internalFinish}
          frameFinish={frameFinish}
          position={[topX, topY, 0]}
        />
      )}

      {/* Object placeholder (translucent rectangle) */}
      <mesh position={[objectCenterX, objY, -avgDepth / 2]}>
        <boxGeometry args={[objectWidth, objectHeight, 1]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.15} side={THREE.DoubleSide} />
      </mesh>
      {/* Object border wireframe */}
      <lineSegments position={[objectCenterX, objY, -avgDepth / 2 + 0.6]}>
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

    const allShelves = [...props.leftShelves, ...props.rightShelves, ...props.topShelves, ...props.bottomShelves]
    const maxDepth = allShelves.length > 0 ? Math.max(...allShelves.map(s => s.depth)) : 7
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
