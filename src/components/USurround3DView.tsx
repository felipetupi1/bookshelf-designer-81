import { Suspense, useMemo, useImperativeHandle, forwardRef, useEffect, useRef, useState } from "react"
import { Canvas, useThree } from "@react-three/fiber"
import { OrbitControls, Environment, ContactShadows } from "@react-three/drei"
import * as THREE from "three"
import { Bookshelf3D } from "./Bookshelf3DView"

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

function CanvasCapture({ onReady }: { onReady: (fn: () => Promise<string>) => void }) {
  const { gl, scene, camera } = useThree()
  useMemo(() => {
    onReady(async () => new Promise((resolve) => {
      requestAnimationFrame(() => { gl.render(scene, camera); resolve(gl.domElement.toDataURL("image/png")) })
    }))
  }, [gl, scene, camera, onReady])
  return null
}

function CameraController({ w1, w, w2, totalHeight, maxDepth, isMobile, resetKey }: {
  w1: number; w: number; w2: number; totalHeight: number; maxDepth: number; isMobile?: boolean; resetKey: number
}) {
  const { camera, controls } = useThree()
  const ctrlRef = useRef(controls)
  useEffect(() => { ctrlRef.current = controls }, [controls])
  useEffect(() => {
    const H = totalHeight
    const backZ = Math.max(w1, w2)
    const totalWidth = w + maxDepth * 2
    const spread = Math.max(totalWidth, backZ + maxDepth)
    const pad = isMobile ? 0.8 : 1.8
    const dist = Math.max(spread, H) * pad

    // Camera at front-top looking into the open U (opening faces +Z)
    const targetPos = new THREE.Vector3(0, H * 0.7, dist * 0.8)
    const lookAt = new THREE.Vector3(0, H / 2, -backZ / 3)

    const start = camera.position.clone()
    const t0 = Date.now()
    const anim = () => {
      const p = Math.min((Date.now() - t0) / 600, 1)
      const e = 1 - Math.pow(1 - p, 3)
      camera.position.lerpVectors(start, targetPos, e)
      if (ctrlRef.current && "target" in ctrlRef.current) {
        const c = ctrlRef.current as any; c.target.copy(lookAt); c.update()
      }
      if (p < 1) requestAnimationFrame(anim)
    }
    anim()
  }, [resetKey, camera, isMobile, w1, w, w2, totalHeight, maxDepth])
  return null
}

function USurroundScene({ props, intF, frameF, backF }: { props: USurround3DViewProps; intF: string; frameF: string; backF: string }) {
  const { w1, w, w2, shelvesLeft, shelvesFront, shelvesRight, modulesLeft, modulesFront, modulesRight } = props
  const backZ = Math.max(w1, w2)
  const backArmDepth = Math.max(...shelvesFront.map(s => s.depth))

  return (
    <group>
      {/* Back arm */}
      <group position={[0, 0, -backZ + backArmDepth]}>
        <Bookshelf3D
          style="bookshelf" width={w} shelves={shelvesFront} finish={intF} frameFinish={frameF} backFinish={backF}
          modules={modulesFront}
        />
      </group>

      {/* Left arm */}
      <group position={[-w / 2, 0, -backZ + w1 / 2]} rotation={[0, Math.PI / 2, 0]}>
        <Bookshelf3D
          style="bookshelf" width={w1} shelves={shelvesLeft} finish={intF} frameFinish={frameF} backFinish={backF}
          modules={modulesLeft}
        />
      </group>

      {/* Right arm */}
      <group position={[w / 2, 0, -backZ + w2 / 2]} rotation={[0, -Math.PI / 2, 0]}>
        <Bookshelf3D
          style="bookshelf" width={w2} shelves={shelvesRight} finish={intF} frameFinish={frameF} backFinish={backF}
          modules={modulesRight}
        />
      </group>
    </group>
  )
}

export const USurround3DView = forwardRef<USurround3DViewRef, USurround3DViewProps>(
  function USurround3DView(props, ref) {
    const { w1, w, w2, shelvesLeft, shelvesFront, shelvesRight, finish, isMobile, hideTooltip } = props
    const parts = finish.includes("/") ? finish.split("/").map(s => s.trim()) : null
    const isTwoToneBlack = parts && parts[1] === "Black"
    const intF = isTwoToneBlack ? parts[0] : parts ? parts[1] : finish
    const frameF = isTwoToneBlack ? "Black" : parts ? parts[0] : finish
    const backF = parts ? parts[0] : finish
    const [resetCount, setResetCount] = useState(0)

    let captureFn: (() => Promise<string>) | null = null
    useImperativeHandle(ref, () => ({
      captureImage: async () => { if (captureFn) return await captureFn(); throw new Error("Canvas not ready") },
    }))

    const totalHeight = shelvesLeft.reduce((sum, s) => sum + s.height + 0.75, 0)
    const maxDepth = Math.max(
      ...shelvesLeft.map(s => s.depth),
      ...shelvesFront.map(s => s.depth),
      ...shelvesRight.map(s => s.depth),
    )
    const spread = w1 + w2 + w + maxDepth * 2
    const camDist = Math.max(spread * 1.2, totalHeight * 1.2, maxDepth * 5)

    return (
      <div className={`relative w-full overflow-hidden rounded-lg border-2 border-border bg-gradient-to-b from-secondary to-muted ${isMobile ? "h-[35vh]" : "min-h-[500px] aspect-[4/3]"}`}>
        <Canvas
          camera={{ position: [0, totalHeight * 0.5, camDist], fov: 60 }}
          shadows
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.0, preserveDrawingBuffer: true }}
        >
          <Suspense fallback={null}>
            <CanvasCapture onReady={(fn) => { captureFn = fn }} />
            <CameraController w1={w1} w={w} w2={w2} totalHeight={totalHeight} maxDepth={maxDepth} isMobile={isMobile} resetKey={resetCount} />
            <ambientLight intensity={0.6} />
            <directionalLight position={[15, 20, 10]} intensity={1.2} castShadow shadow-mapSize-width={4096} shadow-mapSize-height={4096} shadow-bias={-0.00001} />
            <directionalLight position={[-10, 10, -8]} intensity={0.4} />
            <pointLight position={[0, totalHeight * 0.7, maxDepth * 1.5]} intensity={0.8} distance={maxDepth * 4} />
            <USurroundScene props={props} intF={intF} frameF={frameF} backF={backF} />
            <Environment preset="studio" environmentIntensity={0.5} />
            <ContactShadows position={[0, -0.1, 0]} opacity={0.3} scale={spread * 1.2} blur={2.8} far={totalHeight * 1.5} resolution={1024} />
            <OrbitControls enableZoom enablePan enableRotate minDistance={20} maxDistance={500} target={[0, totalHeight / 2, 0]} enableDamping dampingFactor={0.05} rotateSpeed={0.5} zoomSpeed={0.5} />
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
