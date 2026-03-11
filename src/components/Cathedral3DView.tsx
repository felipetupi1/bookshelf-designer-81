import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

export interface Cathedral3DViewRef {
  captureImage: () => Promise<string>
}

interface Cathedral3DViewProps {
  W: number; H: number; H1: number
  direction: string
  rows: Array<{ yPosition: number; availableWidth: number; shelves: { height: number; depth: number }[] }>
  modulesPerRow: Array<Array<{ width: number }>>
  finish: string; isMobile?: boolean; hideTooltip?: boolean
}

const getWoodColor = (finish: string): string => {
  const colorMap: Record<string, string> = {
    White: "#F5F5F5", Maple: "#E8D4B8", Black: "#1A1A1A", Oak: "#D4A574", Walnut: "#5D432C",
  }
  return colorMap[finish] || colorMap.Oak
}

const getTextureUrl = (finish: string): string | null => {
  const textureMap: Record<string, string> = {
    Maple: "/images/finishes/maple1.jpeg", Oak: "/images/finishes/oak.jpg", Walnut: "/images/finishes/walnut.jpg",
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
    t.rotation = Math.PI / 2
    t.center.set(0.5, 0.5)
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

function CathedralShelf3D({ rows, modulesPerRow, maxWidth, internalFinish, frameFinish, direction }: {
  rows: Cathedral3DViewProps["rows"]; modulesPerRow: Cathedral3DViewProps["modulesPerRow"]
  maxWidth: number; internalFinish: string; frameFinish: string; direction: string
}) {
  const maxDepth = Math.max(...rows.flatMap(r => r.shelves.map(s => s.depth)), 7)

  const elements = useMemo(() => {
    const els: JSX.Element[] = []

    rows.forEach((row, rowIndex) => {
      const shelf = row.shelves[0]
      if (!shelf) return
      const rowWidth = row.availableWidth
      const zOffset = -(maxDepth - shelf.depth)

      // Compute X offset based on direction so narrower rows align correctly
      let xOffset = 0
      if (direction === "left") {
        xOffset = -(maxWidth - rowWidth) / 2
      } else if (direction === "right") {
        xOffset = (maxWidth - rowWidth) / 2
      }

      // Bottom board for row
      els.push(
        <Board
          key={`board-bottom-${rowIndex}`}
          position={[xOffset, row.yPosition, -shelf.depth / 2]}
          width={rowWidth}
          depth={shelf.depth}
          finish={internalFinish}
          zOffset={zOffset}
        />
      )

      // Top board for row
      const topY = row.yPosition + shelf.height + 0.75
      els.push(
        <Board
          key={`board-top-${rowIndex}`}
          position={[xOffset, topY, -shelf.depth / 2]}
          width={rowWidth}
          depth={shelf.depth}
          finish={internalFinish}
          zOffset={zOffset}
        />
      )

      // Modules for this row
      const rowModules = modulesPerRow[rowIndex] || []
      const totalModuleWidth = rowModules.reduce((s, m) => s + m.width, 0)
      const numSpaces = rowModules.length - 1
      const totalSpace = rowWidth - totalModuleWidth
      const spaceWidth = numSpaces > 0 ? totalSpace / numSpaces : 0

      let mx = -rowWidth / 2 + xOffset
      rowModules.forEach((mod, modIndex) => {
        els.push(
          <ModuleBox
            key={`module-${rowIndex}-${modIndex}`}
            position={[mx + mod.width / 2, row.yPosition + 0.75, 0]}
            width={mod.width}
            height={shelf.height}
            depth={shelf.depth}
            internalFinish={internalFinish}
            frameFinish={frameFinish}
            zOffset={zOffset}
          />
        )
        mx += mod.width + spaceWidth
      })
    })

    return els
  }, [rows, modulesPerRow, maxWidth, maxDepth, internalFinish, frameFinish, direction])

  return <group>{elements}</group>
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

function CameraController({ width, totalHeight, maxDepth, isMobile, resetKey }: {
  width: number; totalHeight: number; maxDepth: number; isMobile?: boolean; resetKey: number
}) {
  const { camera, controls } = useThree()
  const controlsRef = useRef(controls)
  useEffect(() => { controlsRef.current = controls }, [controls])

  useEffect(() => {
    const fov = 60
    const fovRadians = (fov * Math.PI) / 180
    const aspectRatio = window.innerWidth / window.innerHeight
    const distW = width / 2 / Math.tan(fovRadians / 2) / aspectRatio
    const distH = totalHeight / 2 / Math.tan(fovRadians / 2)
    const distD = maxDepth * 2.5
    const padding = isMobile ? 0.8 : 1.8
    const optimalDist = Math.max(distW, distH, distD) * padding
    const yOff = isMobile ? -0.8 : 0

    const targetPos = new THREE.Vector3(0, totalHeight * 0.5 + yOff, optimalDist)
    const lookAt = new THREE.Vector3(0, totalHeight / 2 + yOff, 0)
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

export const Cathedral3DView = forwardRef<Cathedral3DViewRef, Cathedral3DViewProps>(
  function Cathedral3DView({ W, H, H1, direction, rows, modulesPerRow, finish, isMobile, hideTooltip }, ref) {
    const [internalFinish, frameFinish] = finish.includes("/") ? finish.split("/") : [finish, finish]
    const [resetCount, setResetCount] = useState(0)

    let captureFunction: (() => Promise<string>) | null = null
    useImperativeHandle(ref, () => ({
      captureImage: async () => {
        if (captureFunction) return await captureFunction()
        throw new Error("Canvas not ready")
      },
    }))

    const totalHeight = rows.length > 0
      ? rows[rows.length - 1].yPosition + (rows[rows.length - 1].shelves[0]?.height || 14) + 1.5
      : H1
    const maxDepth = Math.max(...rows.flatMap(r => r.shelves.map(s => s.depth)), 7)
    const cameraDistance = Math.max(W * 1.2, totalHeight * 1.2, maxDepth * 5)

    return (
      <div className={`relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${isMobile ? "aspect-square" : "min-h-[500px] aspect-[4/3]"}`}>
        <Canvas
          camera={{ position: [0, totalHeight * 0.5, cameraDistance], fov: 60 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <CanvasCapture onReady={(fn) => { captureFunction = fn }} />
            <CameraController width={W} totalHeight={totalHeight} maxDepth={maxDepth} isMobile={isMobile} resetKey={resetCount} />

            <ambientLight intensity={0.6} />
            <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.00001} shadow-camera-left={-W} shadow-camera-right={W} shadow-camera-top={totalHeight} shadow-camera-bottom={-5} />
            <directionalLight position={[-10, 10, -8]} intensity={0.4} />
            <pointLight position={[0, totalHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />
            <pointLight position={[0, totalHeight * 0.5, -maxDepth * 0.3]} intensity={0.7} distance={maxDepth * 3} />

            <CathedralShelf3D
              rows={rows}
              modulesPerRow={modulesPerRow}
              maxWidth={W}
              internalFinish={internalFinish}
              frameFinish={frameFinish}
              direction={direction}
            />

            <Environment preset="studio" environmentIntensity={0.5} />
            <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={W * 1.8} blur={2.8} far={totalHeight * 1.5} resolution={1024} />
            <OrbitControls enableZoom enablePan enableRotate minDistance={20} maxDistance={300} target={[0, totalHeight / 2, 0]} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.5} />
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
