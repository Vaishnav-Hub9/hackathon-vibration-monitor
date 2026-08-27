/**
 * MechanicalScene — React Three Fiber scene for the 3D Mechanical Digital Twin.
 *
 * Renders the physical mechanical assembly with:
 *   - Cotton spindle with animated yarn wrapping
 *   - Drive shaft (co-axial rotation with spindle)
 *   - Ball bearing block (inner race rotates with shaft)
 *   - Motor coupling
 *   - SmartBearing sensor device (highlighted with glow)
 *   - Cotton thread feeding from supply to spindle
 *   - Static labels on the base plate (not on rotating parts)
 */
import { useRef, useMemo, useEffect, type RefObject } from 'react';
import { useFrame } from '@react-three/fiber';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Html } from '@react-three/drei';
import * as THREE from 'three';
import { engine } from '@/simulation/engineRef';
import { useDigitalTwinStore } from '@/simulation/store';

export type MechanicalCameraPreset = 'overview' | 'front' | 'top' | 'bearing' | 'drive';

export const MECHANICAL_CAMERA_PRESETS: Record<MechanicalCameraPreset, {
  position: [number, number, number];
  target: [number, number, number];
}> = {
  overview: { position: [4.2, 2.8, 6.8], target: [0, -0.45, 0] },
  front: { position: [0.35, 1.25, 7.2], target: [0, -0.45, 0] },
  top: { position: [4.6, 6.4, 3.7], target: [0, -0.55, 0] },
  bearing: { position: [2.35, -0.15, 2.8], target: [0, -0.55, 0] },
  drive: { position: [6.7, 1.45, 1.1], target: [0.55, -0.8, 0] },
};

// ── Static Label (only on non-rotating parts) ───────────────────────────────

function StaticLabel({ text, color = '#F59E0B', sub, position }: {
  text: string; color?: string; sub?: string; position: [number, number, number];
}) {
  return (
    <Html position={position} center distanceFactor={8} style={{ pointerEvents: 'none' }}>
      <div className="flex flex-col items-center">
        <div
          className="px-2 py-0.5 rounded text-[9px] font-bold font-mono whitespace-nowrap border"
          style={{
            color,
            background: `${color}15`,
            borderColor: `${color}40`,
            textShadow: `0 0 8px ${color}60`,
          }}
        >
          {text}
        </div>
        {sub && (
          <div className="text-[8px] text-slate-500 mt-0.5 whitespace-nowrap">{sub}</div>
        )}
      </div>
    </Html>
  );
}

// ── Cotton Thread (animated from supply roll to spindle) ─────────────────────

function CottonThread() {
  const threadMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const supplyRef = useRef<THREE.Group>(null);
  const guideRef = useRef<THREE.Group>(null);

  const threadGeometry = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-0.8, 0.3, 1.8),
      new THREE.Vector3(-0.5, 0.8, 1.2),
      new THREE.Vector3(-0.2, 1.2, 0.6),
      new THREE.Vector3(0, 1.4, 0.2),
      new THREE.Vector3(0, 1.0, 0),
    ]);
    return new THREE.TubeGeometry(curve, 20, 0.008, 6, false);
  }, []);

  useFrame((_, delta) => {
    const snap = engine.getMechanicalSnapshot();
    const rotationRate = snap.spindleRPM > 0 ? (snap.spindleRPM / 60) * Math.PI * 2 : 0;
    if (supplyRef.current) supplyRef.current.rotation.y += rotationRate * delta * 0.14;
    if (guideRef.current) guideRef.current.rotation.z += rotationRate * delta * 0.24;
    if (!threadMatRef.current) return;
    const pulse = snap.isRunning ? 0.8 + Math.sin(Date.now() * 0.005) * 0.15 : 0.5;
    threadMatRef.current.opacity = pulse;
  });

  return (
    <group>
      {/* Thread from supply to spindle */}
      <mesh geometry={threadGeometry}>
        <meshStandardMaterial
          ref={threadMatRef}
          color="#f5f0e0"
          roughness={0.9}
          metalness={0}
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Supply roll of cotton */}
      <group ref={supplyRef} position={[-0.8, 0.5, 1.8]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.25, 0.25, 0.15, 24]} />
          <meshStandardMaterial color="#f5f0e0" roughness={0.85} metalness={0} />
        </mesh>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.08, 0.08, 0.16, 12]} />
          <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.1} />
        </mesh>
      </group>

      {/* Guide pulley */}
      <group ref={guideRef} position={[-0.5, 0.9, 1.2]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.06, 0.015, 8, 16]} />
          <meshStandardMaterial color="#9CA3AF" roughness={0.2} metalness={0.9} />
        </mesh>
      </group>
    </group>
  );
}

// ── SmartBearing Sensor Device (our product!) ────────────────────────────────

function SmartBearingDevice() {
  const glowRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    const snap = engine.getMechanicalSnapshot();
    if (glowRef.current) {
      const active = snap.isRunning;
      const pulse = active ? 0.5 + Math.sin(Date.now() * 0.003) * 0.3 : 0.2;
      glowRef.current.emissiveIntensity = pulse;
    }
    if (ringRef.current) {
      const scale = 1 + Math.sin(Date.now() * 0.004) * 0.08;
      ringRef.current.scale.setScalar(scale);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity = snap.isRunning ? 0.4 : 0.15;
    }
  });

  return (
    <group position={[0.5, 0.15, 0.5]}>
      <mesh castShadow>
        <boxGeometry args={[0.25, 0.03, 0.18]} />
        <meshStandardMaterial color="#1a6b3a" roughness={0.5} metalness={0.2} />
      </mesh>
      <mesh position={[0, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.015, 0.06]} />
        <meshStandardMaterial color="#111" roughness={0.3} metalness={0.7} />
      </mesh>
      <mesh position={[0.08, 0.02, 0]}>
        <boxGeometry args={[0.08, 0.005, 0.02]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.2} metalness={0.9} />
      </mesh>
      <mesh position={[-0.08, 0.02, 0.04]}>
        <sphereGeometry args={[0.012, 8, 8]} />
        <meshStandardMaterial
          ref={glowRef}
          color="#10B981"
          emissive="#10B981"
          emissiveIntensity={0.5}
        />
      </mesh>
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[0.2, 0.01, 0.14]} />
        <meshStandardMaterial color="#333" roughness={0.9} metalness={0} transparent opacity={0.6} />
      </mesh>
      <mesh ref={ringRef} position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.2, 0.005, 8, 32]} />
        <meshBasicMaterial color="#10B981" transparent opacity={0.3} />
      </mesh>
    </group>
  );
}

// ── Ball Bearing Model ──────────────────────────────────────────────────────

function BallBearing({ rotationRef }: { rotationRef: React.RefObject<THREE.Group | null> }) {
  const innerRaceRef = useRef<THREE.Mesh>(null);
  const ballsGroupRef = useRef<THREE.Group>(null);

  const BALL_COUNT = 9;
  const PITCH_R = 0.22;

  const ballAngles = useMemo(
    () => Array.from({ length: BALL_COUNT }, (_, i) => (i / BALL_COUNT) * Math.PI * 2),
    [],
  );

  useFrame(() => {
    if (!rotationRef.current || !ballsGroupRef.current || !innerRaceRef.current) return;
    const angle = rotationRef.current.rotation.y;
    innerRaceRef.current.rotation.y = angle;
    ballsGroupRef.current.rotation.y = angle * 0.5;
  });

  return (
    <group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PITCH_R, 0.05, 16, 48]} />
        <meshStandardMaterial color="#5a6577" roughness={0.25} metalness={0.92} />
      </mesh>
      <mesh ref={innerRaceRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[PITCH_R - 0.05, 0.035, 16, 48]} />
        <meshStandardMaterial color="#7a8597" roughness={0.2} metalness={0.95} />
      </mesh>
      <group ref={ballsGroupRef}>
        {ballAngles.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * PITCH_R, 0, Math.sin(a) * PITCH_R]}>
            <sphereGeometry args={[0.038, 16, 16]} />
            <meshStandardMaterial color="#c0c8d4" roughness={0.1} metalness={0.98} />
          </mesh>
        ))}
      </group>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.38, 0.38, 0.18, 32]} />
        <meshStandardMaterial color="#3a4557" roughness={0.4} metalness={0.8} />
      </mesh>
      {[-0.095, 0.095].map((z) => (
        <mesh key={z} position={[0, z, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.39, 0.39, 0.01, 32]} />
          <meshStandardMaterial color="#2a3547" roughness={0.5} metalness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ── Cotton Spindle ──────────────────────────────────────────────────────────

function CottonSpindle() {
  const yarnLayers = useMemo(() => {
    return Array.from({ length: 8 }, (_, i) => ({
      y: 0.25 + i * 0.08,
      radiusBottom: 0.06 + i * 0.008,
      radiusTop: 0.04 + i * 0.005,
    }));
  }, []);

  const yarnWrap = useMemo(() => {
    const points = Array.from({ length: 96 }, (_, i) => {
      const progress = i / 95;
      const angle = progress * Math.PI * 2 * 3.5;
      const radius = THREE.MathUtils.lerp(0.14, 0.052, progress);
      return new THREE.Vector3(
        Math.cos(angle) * radius,
        0.18 + progress * 0.94,
        Math.sin(angle) * radius,
      );
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, 0.011, 6, false);
  }, []);

  return (
    <group>
      <mesh position={[0, 0.6, 0]}>
        <cylinderGeometry args={[0.04, 0.12, 0.9, 24]} />
        <meshStandardMaterial color="#d4c4a8" roughness={0.7} metalness={0.1} />
      </mesh>
      <mesh position={[0, 1.1, 0]}>
        <coneGeometry args={[0.025, 0.15, 12]} />
        <meshStandardMaterial color="#e8dcc8" roughness={0.6} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.1, 0]}>
        <cylinderGeometry args={[0.15, 0.15, 0.08, 24]} />
        <meshStandardMaterial color="#8a7a62" roughness={0.5} metalness={0.3} />
      </mesh>
      <group>
        {yarnLayers.map((layer, i) => (
          <mesh key={i} position={[0, layer.y, 0]}>
            <cylinderGeometry args={[layer.radiusTop, layer.radiusBottom, 0.06, 20]} />
            <meshStandardMaterial
              color={i % 2 === 0 ? '#f5f0e0' : '#ede5d0'}
              roughness={0.92}
              metalness={0}
              transparent
              opacity={0.85}
            />
          </mesh>
        ))}
        <mesh geometry={yarnWrap}>
          <meshStandardMaterial color="#fff7df" roughness={0.8} metalness={0} emissive="#b9a77e" emissiveIntensity={0.08} />
        </mesh>
      </group>
      <mesh position={[0, 1.15, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.03, 0.005, 8, 16]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.2} metalness={0.9} />
      </mesh>
    </group>
  );
}

// ── Drive Shaft ─────────────────────────────────────────────────────────────

function DriveShaft({ rotationRef }: { rotationRef: React.RefObject<THREE.Group | null> }) {
  const shaftMeshRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!rotationRef.current || !shaftMeshRef.current) return;
    shaftMeshRef.current.rotation.y = rotationRef.current.rotation.y;
  });

  return (
    <mesh ref={shaftMeshRef}>
      <cylinderGeometry args={[0.04, 0.04, 3.2, 16]} />
      <meshStandardMaterial color="#a0a8b4" roughness={0.15} metalness={0.95} />
    </mesh>
  );
}

// ── Motor Coupling ──────────────────────────────────────────────────────────

function MotorCoupling({ rotationRef }: { rotationRef: React.RefObject<THREE.Group | null> }) {
  const couplingRef = useRef<THREE.Mesh>(null);

  useFrame(() => {
    if (!rotationRef.current || !couplingRef.current) return;
    couplingRef.current.rotation.y = rotationRef.current.rotation.y;
  });

  return (
    <group>
      <mesh ref={couplingRef} position={[0, -1.8, 0]}>
        <cylinderGeometry args={[0.1, 0.1, 0.3, 16]} />
        <meshStandardMaterial color="#2d3748" roughness={0.4} metalness={0.85} />
      </mesh>
      {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((a, i) => (
        <mesh key={i} position={[Math.cos(a) * 0.07, -1.8, Math.sin(a) * 0.07]}>
          <sphereGeometry args={[0.015, 8, 8]} />
          <meshStandardMaterial color="#9CA3AF" roughness={0.2} metalness={0.9} />
        </mesh>
      ))}
    </group>
  );
}

// ── Base Plate with Static Labels ───────────────────────────────────────────

function BasePlate() {
  const showLabels = useDigitalTwinStore((s) => s.showMechLabels);
  return (
    <group>
      <mesh position={[0, -2.1, 0]} receiveShadow>
        <boxGeometry args={[3.5, 0.1, 2]} />
        <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.7} />
      </mesh>
      <mesh position={[0, -1.9, 0]}>
        <boxGeometry args={[0.8, 0.3, 0.5]} />
        <meshStandardMaterial color="#3a4557" roughness={0.5} metalness={0.8} />
      </mesh>
      <mesh position={[0, -1.85, 0.7]}>
        <boxGeometry args={[0.6, 0.2, 0.8]} />
        <meshStandardMaterial color="#3a4557" roughness={0.5} metalness={0.8} />
      </mesh>
      {[
        [-1.5, -2.04, -0.8], [1.5, -2.04, -0.8],
        [-1.5, -2.04, 0.8], [1.5, -2.04, 0.8],
      ].map(([x, y, z], i) => (
        <mesh key={i} position={[x, y, z]}>
          <cylinderGeometry args={[0.04, 0.04, 0.08, 8]} />
          <meshStandardMaterial color="#8a8a8a" roughness={0.3} metalness={0.9} />
        </mesh>
      ))}

      {/* Static labels on the base plate — toggleable */}
      {showLabels && (
        <>
          <StaticLabel text="Cotton Spindle" color="#d4c4a8" sub="Active winding" position={[0.4, 0.5, 0]} />
          <StaticLabel text="Drive Shaft" color="#a0a8b4" sub="Co-axial rotation" position={[0.5, -1.0, 0]} />
          <StaticLabel text="Ball Bearing Block" color="#60A5FA" sub="6205 deep-groove" position={[0.5, -0.5, 0.4]} />
          <StaticLabel text="Motor Coupling" color="#9CA3AF" sub="DC motor connection" position={[0.5, -1.8, 0.3]} />
          <StaticLabel text="Cotton Supply" color="#f5f0e0" sub="Raw yarn feed" position={[-0.8, 1.0, 1.8]} />
          <StaticLabel text="Guide" color="#9CA3AF" position={[-0.5, 1.2, 1.2]} />
          <StaticLabel text="⚡ SmartBearing" color="#10B981" sub="MEMS Vibration + Acoustic" position={[0.5, 0.5, 0.8]} />
        </>
      )}
    </group>
  );
}

// ── Camera Director ──────────────────────────────────────────────────────────

function CameraDirector({
  preset,
  controlsRef,
}: {
  preset: MechanicalCameraPreset;
  controlsRef: RefObject<any>;
}) {
  const destination = useRef<{ position: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const settling = useRef(false);
  const wiredControls = useRef<any>(null);

  const cancelSettle = () => {
    settling.current = false;
  };

  useEffect(() => {
    const pose = MECHANICAL_CAMERA_PRESETS[preset];
    destination.current = {
      position: new THREE.Vector3(...pose.position),
      target: new THREE.Vector3(...pose.target),
    };
    settling.current = true;
  }, [preset]);

  useEffect(() => () => {
    wiredControls.current?.removeEventListener?.('start', cancelSettle);
  }, []);

  useFrame((_, delta) => {
    const controls = controlsRef.current;
    if (!controls) return;

    if (wiredControls.current !== controls) {
      wiredControls.current?.removeEventListener?.('start', cancelSettle);
      controls.addEventListener?.('start', cancelSettle);
      wiredControls.current = controls;
    }

    if (!settling.current || !destination.current) return;
    const smoothing = 1 - Math.pow(0.001, delta);
    const camera = controls.object as THREE.Camera;
    camera.position.lerp(destination.current.position, smoothing);
    controls.target.lerp(destination.current.target, smoothing);
    controls.update();

    if (
      camera.position.distanceTo(destination.current.position) < 0.025 &&
      controls.target.distanceTo(destination.current.target) < 0.025
    ) {
      camera.position.copy(destination.current.position);
      controls.target.copy(destination.current.target);
      settling.current = false;
      controls.update();
    }
  });

  return null;
}

// ── Scene Content ───────────────────────────────────────────────────────────

function SceneContent({
  cameraPreset,
  autoRotate,
}: {
  cameraPreset: MechanicalCameraPreset;
  autoRotate: boolean;
}) {
  const rotationRef = useRef<THREE.Group>(null);
  const wobbleRef = useRef<THREE.Group>(null);
  const controlsRef = useRef<any>(null);

  useFrame((_, delta) => {
    if (!rotationRef.current || !wobbleRef.current) return;

    const snap = engine.getMechanicalSnapshot();
    const rotSpeed = (snap.spindleRPM / 60) * Math.PI * 2;
    rotationRef.current.rotation.y += rotSpeed * delta;

    const wobble = snap.shaftWobble * 0.02;
    wobbleRef.current.position.x = Math.sin(rotationRef.current.rotation.y * 3.7) * wobble;
    wobbleRef.current.position.z = Math.cos(rotationRef.current.rotation.y * 2.3) * wobble;
  });

  return (
    <>
      <ambientLight intensity={1.5} />
      <directionalLight position={[8, 10, 8]} intensity={2.5} color="#ffffff" castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={1.2} color="#60A5FA" />
      <directionalLight position={[0, -2, 6]} intensity={0.8} color="#F59E0B" />
      <pointLight position={[0, 3, 2]} intensity={3} color="#ffffff" distance={15} />
      <hemisphereLight args={['#87CEEB', '#8B7355', 0.8]} />

      <group ref={wobbleRef}>
        <group ref={rotationRef} position={[0, 0, 0]}>
           <CottonSpindle />
          <DriveShaft rotationRef={rotationRef} />
          <group position={[0, -0.3, 0]}>
            <BallBearing rotationRef={rotationRef} />
          </group>
          <MotorCoupling rotationRef={rotationRef} />
        </group>
      </group>

       <CottonThread />
      <SmartBearingDevice />
      <BasePlate />

      <ContactShadows position={[0, -2.2, 0]} opacity={0.4} scale={10} blur={2} far={5} color="#000000" />

      <mesh position={[0, -2.25, 0]} receiveShadow>
        <boxGeometry args={[6, 0.06, 4]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.05} />
      </mesh>

      <CameraDirector preset={cameraPreset} controlsRef={controlsRef} />

      <OrbitControls
        ref={controlsRef}
        enablePan
        minDistance={2}
        maxDistance={15}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.2}
        target={[0, -0.5, 0]}
      />
    </>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export default function MechanicalScene({
  cameraPreset = 'overview',
  autoRotate = false,
}: {
  cameraPreset?: MechanicalCameraPreset;
  autoRotate?: boolean;
}) {
  return (
    <Canvas
      camera={{ position: MECHANICAL_CAMERA_PRESETS.overview.position, fov: 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ background: '#0a0e1a', width: '100%', height: '100%' }}
    >
      <SceneContent cameraPreset={cameraPreset} autoRotate={autoRotate} />
    </Canvas>
  );
}
