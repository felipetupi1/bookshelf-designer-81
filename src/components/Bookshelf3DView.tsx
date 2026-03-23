import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree, useLoader } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"

interface Shelf {
  height: number
  depth: number
}

interface Bookshelf3DViewProps {
  style: "rack" | "bookshelf" | "corner"
  width: number
  width2?: number
  shelves: Shelf[]
  shelves2?: Shelf[]
  finish: string
  modules?: Array<Array<{ width: number }>>
  modules2?: Array<Array<{ width: number }>>
  cornerVariant?: "outside" | "inside"
  isMobile?: boolean
  hideTooltip?: boolean
}

export interface Bookshelf3DViewRef {
  captureImage: () => Promise<string>
}

const getWoodColor = (finish: string): string => {
  const colorMap: Record<string, string> = {
    White: "#F5F5F5",
    Maple: "#E8D4B8",
    Black: "#1A1A1A",
    Oak: "#D4A574",
    Walnut: "#5D432C",
  }
  return colorMap[finish] || colorMap.Oak
}

const getTextureUrl = (finish: string): string | null => {
  const textureMap: Record<string, string> = {
    Maple: "/images/finishes/maple1.jpeg",
    Oak: "/images/finishes/oak1.jpeg",
    Walnut: "/images/finishes/walnut1.jpeg",
    Black: "/images/finishes/valchromat.png",
  }
  return textureMap[finish] || null
}

function WoodMaterial({
  finish,
  isFrame = false,
}: { finish: string; isFrame?: boolean }) {
  const textureUrl = getTextureUrl(finish)
  const texture = useLoader(
    THREE.TextureLoader,
    textureUrl || "/images/finishes/OAK6.png"
  )

  const clonedTexture = useMemo(() => {
    const t = texture.clone()
    t.wrapS = THREE.RepeatWrapping
    t.wrapT = THREE.RepeatWrapping
    t.repeat.set(1, 1)
    t.rotation = 0
    t.needsUpdate = true
    return t
  }, [texture])

  if (!textureUrl) {
    const color = getWoodColor(finish)
    return (
      <meshStandardMaterial
        color={color}
        roughness={isFrame ? 0.7 : 0.8}
        metalness={0.0}
        side={THREE.DoubleSide}
        envMapIntensity={0.3}
      />
    )
  }

  return (
    <meshStandardMaterial
      map={clonedTexture}
      roughness={isFrame ? 0.6 : 0.7}
      metalness={0.0}
      side={THREE.DoubleSide}
      envMapIntensity={0.3}
    />
  )
}

function Board({
  position,
  width,
  depth,
  finish,
  zOffset = 0,
  hasBaguetes = false,
  frameFinish,
}: {
  position: [number, number, number]
  width: number
  depth: number
  finish: string
  zOffset?: number
  hasBaguetes?: boolean
  frameFinish?: string
}) {
  const thickness = 0.75
  const bagueteThickness = 0.5
  const bagueteWidth = 0.75

  const centralBoardWidth = hasBaguetes ? width - bagueteThickness * 2 : width
  const centralBoardDepth = hasBaguetes ? depth - bagueteThickness : depth

  const geometry = useMemo(() => {
    const geom = new THREE.BoxGeometry(centralBoardWidth, thickness, centralBoardDepth)
    return geom
  }, [centralBoardWidth, centralBoardDepth])

  const boardZ = hasBaguetes ? -bagueteThickness / 2 : 0

  return (
    <group>
      <mesh
        position={[position[0], position[1] + thickness / 2, position[2] + zOffset + boardZ]}
        castShadow
        receiveShadow
        geometry={geometry}
      >
        <WoodMaterial finish={finish} isFrame={false} />
      </mesh>

      {hasBaguetes && frameFinish && (
        <>
          <mesh
            position={[position[0], position[1] + thickness, position[2] + zOffset + depth / 2 - bagueteThickness / 2]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[width, bagueteWidth, bagueteThickness]} />
            <WoodMaterial finish={frameFinish} isFrame={true} />
          </mesh>

          <mesh
            position={[
              position[0] - width / 2 + bagueteThickness / 2,
              position[1] + thickness,
              position[2] + zOffset + boardZ,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[bagueteThickness, bagueteWidth, centralBoardDepth]} />
            <WoodMaterial finish={frameFinish} isFrame={true} />
          </mesh>

          <mesh
            position={[
              position[0] + width / 2 - bagueteThickness / 2,
              position[1] + thickness,
              position[2] + zOffset + boardZ,
            ]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[bagueteThickness, bagueteWidth, centralBoardDepth]} />
            <WoodMaterial finish={frameFinish} isFrame={true} />
          </mesh>
        </>
      )}
    </group>
  )
}

function Baguete({
  position,
  height,
  finish,
  zOffset = 0,
}: {
  position: [number, number, number]
  height: number
  finish: string
  zOffset?: number
}) {
  const width = 0.75
  const thickness = 0.5

  return (
    <mesh position={[position[0], position[1], position[2] + zOffset]} castShadow receiveShadow>
      <boxGeometry args={[width, height, thickness]} />
      <WoodMaterial finish={finish} isFrame={true} />
    </mesh>
  )
}

function ModuleBox({
  position,
  width,
  height,
  depth,
  internalFinish,
  frameFinish,
  backFinish,
  zOffset = 0,
}: {
  position: [number, number, number]
  width: number
  height: number
  depth: number
  internalFinish: string
  frameFinish: string
  backFinish?: string
  zOffset?: number
}) {
  const sideThickness = 0.75
  const backThickness = 0.75
  const bagueteHeight = height + 0.625
  const bagueteOffset = -0.3125

  const sideZ = -depth / 2
  const backZ = -depth - backThickness / 2

  return (
    <group position={position}>
      <mesh
        position={[-width / 2 + sideThickness / 2, height / 2, sideZ + zOffset]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideThickness, height, depth]} />
        <WoodMaterial finish={internalFinish} />
      </mesh>

      <mesh
        position={[width / 2 - sideThickness / 2, height / 2, sideZ + zOffset]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[sideThickness, height, depth]} />
        <WoodMaterial finish={internalFinish} />
      </mesh>

      <mesh
        position={[0, height / 2 + bagueteOffset, backZ + zOffset]}
        castShadow
        receiveShadow
      >
        <boxGeometry args={[width - sideThickness * 2, bagueteHeight, backThickness]} />
        <WoodMaterial finish={backFinish ?? internalFinish} />
      </mesh>

      <Baguete
        position={[-width / 2 + sideThickness / 2, bagueteHeight / 2 + bagueteOffset, 0]}
        height={bagueteHeight}
        finish={frameFinish}
        zOffset={zOffset}
      />

      <Baguete
        position={[width / 2 - sideThickness / 2, bagueteHeight / 2 + bagueteOffset, 0]}
        height={bagueteHeight}
        finish={frameFinish}
        zOffset={zOffset}
      />
    </group>
  )
}

export function Bookshelf3D({
  width,
  shelves,
  finish,
  modules,
  frameFinish,
  backFinish,
}: Bookshelf3DViewProps & { frameFinish?: string; backFinish?: string }) {
  const maxDepth = Math.max(...shelves.map((s) => s.depth))
  const showBaguetes = frameFinish && frameFinish !== finish

  const renderData = useMemo(() => {
    const boardPositions: Array<{ y: number; depth: number; zOffset: number }> = []
    const transitionBoards: Array<{ y: number; depth: number; zOffset: number }> = []
    const moduleStartYs: number[] = []

    let y = 0

    for (let i = 0; i < shelves.length; i++) {
      const shelf = shelves[i]
      const zOffset = -(maxDepth - shelf.depth)

      if (i === 0) {
        boardPositions.push({ y, depth: shelf.depth, zOffset })
      }

      if (i > 0 && shelf.depth < shelves[i - 1].depth) {
        const transZOffset = -(maxDepth - shelf.depth)
        transitionBoards.push({ y, depth: shelf.depth, zOffset: transZOffset })
        y += 0.75
        boardPositions.push({ y, depth: shelf.depth, zOffset })
      } else if (i > 0 && shelf.depth !== shelves[i - 1].depth) {
        boardPositions.push({ y, depth: shelf.depth, zOffset })
      }

      moduleStartYs.push(y + 0.75)

      y += shelf.height + 0.75

      boardPositions.push({ y, depth: shelf.depth, zOffset })
    }

    return { boardPositions, transitionBoards, moduleStartYs }
  }, [shelves, maxDepth])

  const moduleElements = useMemo(() => {
    const elements: JSX.Element[] = []

    shelves.forEach((shelf, shelfIndex) => {
      const shelfZOffset = -(maxDepth - shelf.depth)
      const shelfModuleWidths = modules?.[shelfIndex]?.map((m) => m.width) || []
      const totalModuleWidth = shelfModuleWidths.reduce((sum, w) => sum + w, 0)
      const numSpaces = shelfModuleWidths.length - 1
      const totalSpaceWidth = width - totalModuleWidth
      const spaceWidth = numSpaces > 0 ? totalSpaceWidth / numSpaces : 0

      let xOffset = -width / 2
      const groupPositionY = renderData.moduleStartYs[shelfIndex] || 0

      shelfModuleWidths.forEach((moduleWidth, moduleIndex) => {
        const pos: [number, number, number] = [xOffset + moduleWidth / 2, groupPositionY, 0]
        elements.push(
          <ModuleBox
            key={`${shelfIndex}-${moduleIndex}-${finish}-${frameFinish || finish}`}
            position={pos}
            width={moduleWidth}
            height={shelf.height}
            depth={shelf.depth}
            internalFinish={finish}
            frameFinish={frameFinish || finish}
            backFinish={backFinish}
            zOffset={shelfZOffset}
          />,
        )
        xOffset += moduleWidth + spaceWidth
      })
    })

    return elements
  }, [shelves, maxDepth, modules, width, finish, frameFinish, backFinish, renderData])

  return (
    <group>
      {renderData.boardPositions.map((board, index) => (
        <Board
          key={`board-${index}-${finish}-${frameFinish || finish}`}
          position={[0, board.y, -board.depth / 2]}
          width={width}
          depth={board.depth}
          finish={finish}
          zOffset={board.zOffset}
          hasBaguetes={!!showBaguetes}
          frameFinish={finish}
        />
      ))}
      {renderData.transitionBoards.map((tb, index) => (
        <Board
          key={`transition-${index}-${finish}-${frameFinish || finish}`}
          position={[0, tb.y, -tb.depth / 2]}
          width={width}
          depth={tb.depth}
          finish={finish}
          zOffset={tb.zOffset}
          hasBaguetes={!!showBaguetes}
          frameFinish={finish}
        />
      ))}
      {moduleElements}
    </group>
  )
}

function CornerBookshelf3D({
  width,
  width2 = 0,
  shelves,
  shelves2,
  finish,
  modules,
  modules2,
  frameFinish,
  backFinish,
}: Bookshelf3DViewProps & { frameFinish?: string; backFinish?: string }) {
  const arm2Shelves = shelves2 || shelves
  const maxDepth2 = Math.max(...arm2Shelves.map((s) => s.depth))

  const arm1X = -width / 2
  const arm2X = maxDepth2
  const arm2Z = -width2 / 2

  return (
    <group>
      <group position={[arm1X, 0, 0]}>
        <Bookshelf3D
          style="bookshelf"
          width={width}
          shelves={shelves}
          finish={finish}
          frameFinish={frameFinish}
          backFinish={backFinish}
          modules={modules}
        />
      </group>
      <group
        position={[arm2X, 0, arm2Z]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <Bookshelf3D
          style="bookshelf"
          width={width2}
          shelves={arm2Shelves}
          finish={finish}
          frameFinish={frameFinish}
          backFinish={backFinish}
          modules={modules2 || modules}
        />
      </group>
    </group>
  )
}

function InsideCornerBookshelf3D({
  width,
  width2 = 0,
  shelves,
  shelves2,
  finish,
  modules,
  modules2,
  frameFinish,
  backFinish,
}: Bookshelf3DViewProps & { frameFinish?: string; backFinish?: string }) {
  const arm2Shelves = shelves2 || shelves

  const maxDepth1 = Math.max(...shelves.map((s) => s.depth))

  const arm1X = 0
  const arm2X = width / 2
  const arm2Z = width2 / 2 - maxDepth1

  return (
    <group>
      <group position={[arm1X, 0, 0]}>
        <Bookshelf3D
          style="bookshelf"
          width={width}
          shelves={shelves}
          finish={finish}
          frameFinish={frameFinish}
          backFinish={backFinish}
          modules={modules}
        />
      </group>
      <group
        position={[arm2X, 0, arm2Z]}
        rotation={[0, -Math.PI / 2, 0]}
      >
        <Bookshelf3D
          style="bookshelf"
          width={width2}
          shelves={arm2Shelves}
          finish={finish}
          frameFinish={frameFinish}
          backFinish={backFinish}
          modules={modules2 || modules}
        />
      </group>
    </group>
  )
}

function CanvasCapture({ onReady }: { onReady: (fn: () => Promise<string>) => void }) {
  const { gl, scene, camera } = useThree()

  useMemo(() => {
    const captureImage = async (): Promise<string> => {
      return new Promise((resolve) => {
        requestAnimationFrame(() => {
          gl.render(scene, camera)
          const dataUrl = gl.domElement.toDataURL("image/png")
          resolve(dataUrl)
        })
      })
    }
    onReady(captureImage)
  }, [gl, scene, camera, onReady])

  return null
}

function CameraController({
  width,
  totalHeight,
  maxDepth,
  isMobile,
  isCorner,
  width2,
  cornerVariant,
  resetKey,
}: { width: number; totalHeight: number; maxDepth: number; isMobile?: boolean; isCorner?: boolean; width2?: number; cornerVariant?: "outside" | "inside"; resetKey: number }) {
  const { camera, controls } = useThree()
  const controlsRef = useRef(controls)

  useEffect(() => {
    controlsRef.current = controls
  }, [controls])

  useEffect(() => {
    const fov = 60
    const fovRadians = (fov * Math.PI) / 180
    const aspectRatio = window.innerWidth / window.innerHeight

    const distanceForWidth = width / 2 / Math.tan(fovRadians / 2) / aspectRatio
    const distanceForHeight = totalHeight / 2 / Math.tan(fovRadians / 2)
    const distanceForDepth = maxDepth * 2.5

    const paddingMultiplier = isMobile ? 0.8 : 1.8
    const optimalDistance = Math.max(distanceForWidth, distanceForHeight, distanceForDepth) * paddingMultiplier

    const targetYOffset = isMobile ? -0.8 : 0

    let targetPosition: THREE.Vector3
    let lookAt: THREE.Vector3

    if (isCorner && cornerVariant === "inside") {
      const W1 = width
      const W2 = width2 || 0
      const H = totalHeight
      const targetX = W1 / 2
      const targetY = H / 2 + targetYOffset
      const targetZ = -(W2 / 2)
      lookAt = new THREE.Vector3(targetX, targetY, targetZ)
      const distance = Math.max(W1, W2, H) * 2.2
      const angleH = 35 * Math.PI / 180
      targetPosition = new THREE.Vector3(
        targetX + distance * Math.sin(angleH),
        targetY + distance * 0.4,
        targetZ + distance * Math.cos(angleH)
      )
    } else if (isCorner) {
      const dist = optimalDistance * 1.1
      const centerX = -width / 4
      const centerZ = -(width2 || 0) / 4
      targetPosition = new THREE.Vector3(
        centerX + dist * 0.7,
        totalHeight * 0.7 + targetYOffset,
        centerZ + dist * 0.7
      )
      lookAt = new THREE.Vector3(centerX, totalHeight * 0.4 + targetYOffset, centerZ)
    } else {
      targetPosition = new THREE.Vector3(0, totalHeight * 0.5 + targetYOffset, optimalDistance)
      lookAt = new THREE.Vector3(0, totalHeight / 2 + targetYOffset, 0)
    }

    const startPosition = camera.position.clone()
    const duration = 600
    const startTime = Date.now()

    const animate = () => {
      const elapsed = Date.now() - startTime
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 3)

      camera.position.lerpVectors(startPosition, targetPosition, eased)

      if (controlsRef.current && "target" in controlsRef.current) {
        const orbitControls = controlsRef.current as any
        orbitControls.target.set(lookAt.x, lookAt.y, lookAt.z)
        orbitControls.update()
      }

      if (progress < 1) {
        requestAnimationFrame(animate)
      }
    }

    animate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, camera, isMobile, isCorner, cornerVariant])

  return null
}

export const Bookshelf3DView = forwardRef<
  Bookshelf3DViewRef,
  Omit<Bookshelf3DViewProps, "frameFinish"> & { hideTooltip?: boolean }
>(function Bookshelf3DView({ style, width, width2, shelves, shelves2, finish, modules, modules2, cornerVariant, isMobile, hideTooltip }, ref) {
  const parts = finish.includes("/") ? finish.split("/").map(s => s.trim()) : null
  const internalFinish = parts ? parts[1] : finish // sides + boards = second part
  const frameFinish = parts ? parts[0] : finish    // baguetes = first part
  const backFinish = parts ? parts[0] : finish     // back panel = first part
  const [resetCount, setResetCount] = useState(0)

  let captureFunction: (() => Promise<string>) | null = null

  useImperativeHandle(ref, () => ({
    captureImage: async () => {
      if (captureFunction) {
        return await captureFunction()
      }
      throw new Error("Canvas not ready")
    },
  }))

  const totalHeight = shelves.reduce((sum, shelf) => sum + shelf.height + 0.75, 0)
  const maxDepth = style === "corner"
    ? Math.max(...shelves.map((s) => s.depth), ...((shelves2 || shelves).map((s) => s.depth)))
    : Math.max(...shelves.map((s) => s.depth))

  const effectiveWidth = style === "corner" ? width + (width2 || 0) + 2 : width
  const cameraDistance = Math.max(effectiveWidth * 1.2, totalHeight * 1.2, maxDepth * 5)

  return (
    <div
      className={`relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${
        isMobile ? "h-[35vh]" : "min-h-[500px] aspect-[4/3]"
      }`}
    >
      <Canvas
        camera={{
          position: [0, totalHeight * 0.5, cameraDistance],
          fov: 60,
        }}
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.0,
          preserveDrawingBuffer: true,
        }}
      >
        <Suspense fallback={null}>
          <CanvasCapture
            onReady={(fn) => {
              captureFunction = fn
            }}
          />

          <CameraController width={effectiveWidth} totalHeight={totalHeight} maxDepth={maxDepth} isMobile={isMobile} isCorner={style === "corner"} width2={width2} cornerVariant={cornerVariant} resetKey={resetCount} />

          <ambientLight intensity={0.6} />
          <directionalLight
            position={[15, 20, 10]}
            intensity={1.2}
            castShadow
            shadow-mapSize-width={4096}
            shadow-mapSize-height={4096}
            shadow-bias={-0.00001}
            shadow-camera-left={-width}
            shadow-camera-right={width}
            shadow-camera-top={totalHeight}
            shadow-camera-bottom={-5}
          />
          <directionalLight position={[-10, 10, -8]} intensity={0.4} />
          <pointLight position={[0, totalHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />
          <pointLight position={[0, totalHeight * 0.5, -maxDepth * 0.3]} intensity={0.7} distance={maxDepth * 3} />

          {style === "corner" && cornerVariant === "inside" ? (
            <InsideCornerBookshelf3D
              style={style}
              width={width}
              width2={width2}
              shelves={shelves}
              shelves2={shelves2}
              finish={internalFinish}
              frameFinish={frameFinish}
              backFinish={backFinish}
              modules={modules}
              modules2={modules2}
            />
          ) : style === "corner" ? (
            <CornerBookshelf3D
              style={style}
              width={width}
              width2={width2}
              shelves={shelves}
              shelves2={shelves2}
              finish={internalFinish}
              frameFinish={frameFinish}
              backFinish={backFinish}
              modules={modules}
              modules2={modules2}
            />
          ) : (
            <Bookshelf3D
              style={style}
              width={width}
              shelves={shelves}
              finish={internalFinish}
              frameFinish={frameFinish}
              backFinish={backFinish}
              modules={modules}
            />
          )}

          <Environment preset="studio" environmentIntensity={0.5} />
          <ContactShadows
            position={[0, -0.1, 0]}
            opacity={0.3}
            scale={width * 1.8}
            blur={2.8}
            far={totalHeight * 1.5}
            resolution={1024}
          />

          <OrbitControls
            enableZoom={true}
            enablePan={true}
            enableRotate={true}
            minDistance={20}
            maxDistance={200}
            target={[0, totalHeight / 2, 0]}
            enableDamping={true}
            dampingFactor={0.05}
            rotateSpeed={0.5}
            zoomSpeed={0.5}
          />
        </Suspense>
      </Canvas>

      {/* Reset View button */}
      <button
        onClick={() => setResetCount(c => c + 1)}
        className="absolute bottom-3 right-3 z-10 bg-card/90 backdrop-blur-sm border border-border rounded-md px-2.5 py-1.5 text-[11px] text-muted-foreground hover:text-foreground hover:bg-card transition-colors shadow-sm"
        title="Reset camera view"
      >
        ⟳ Reset View
      </button>
      {!hideTooltip && (
        <div className="absolute bottom-4 left-4 bg-foreground/70 text-primary-foreground px-3 py-2 rounded-md text-xs">
          Click and drag to rotate • Right-click to pan
        </div>
      )}
    </div>
  )
})
