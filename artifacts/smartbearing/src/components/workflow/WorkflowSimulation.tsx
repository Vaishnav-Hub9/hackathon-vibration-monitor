import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, Line, Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────────────────
   WorkflowSimulation — the full telemetry pipeline as one organized 3D scene.

   Structure (a left→right conveyor, one pedestal per stage):
      x = -5.2   Stage 1 · Acoustic capture   (mic + converging wave particles)
      x = -2.6   Stage 2 · Thermal sensing    (heat rings + temp node)
      x =  0     Stage 3 · Vibration+Electrical (spindle, vibration rings, pulses)
      x =  2.6   Stage 4 · ML inference       (NN shell + data streams)
      x =  5.2   Stage 5 · Dashboard dispatch (panel + payload cubes)

   Modes:
     sweep — the page's auto-sim (or a manual bench run) drives `progress`
             0→100; each stage lights up as the sweep crosses its threshold.
     live  — the Manual Test Bench is the source of truth: every stage stays
             active and its particles/heat-waves/pulses scale with the tuned
             acoustic / vibration / severity / temperature intensity.
   ──────────────────────────────────────────────────────────────────────────── */

export interface LiveIntensity {
  on: boolean;
  acoustic: number;   // 0–1    (quiet → loud)
  rms: number;        // g      (0.1–3)
  severity: number;   // 0–1    (5–100% fault severity)
  temperature: number;// °C     (20–85)
}

export type SimMode = 'sweep' | 'live';

interface SimProps {
  progress: number; // 0–100
  mode?: SimMode;
  live?: LiveIntensity;
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

const STAGE_X = [-5.2, -2.6, 0, 2.6, 5.2];
const PATH_POINTS: [number, number, number][] = STAGE_X.map((x) => [x, 0.55, 0]);

const DEFAULT_LIVE: LiveIntensity = { on: true, acoustic: 0.4, rms: 1.2, severity: 0.65, temperature: 42 };

/* ── Shared pedestal under each stage ─────────────────────────────────────── */
function Pedestal({ x, color, label }: { x: number; color: string; label: string }) {
  return (
    <group position={[x, 0, 0]}>
      <mesh position={[0, 0.05, 0]}>
        <cylinderGeometry args={[1.05, 1.2, 0.1, 32]} />
        <meshStandardMaterial color="#0F1629" metalness={0.7} roughness={0.4} emissive={color} emissiveIntensity={0.12} />
      </mesh>
      <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.78, 0.9, 40]} />
        <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} />
      </mesh>
      <Html position={[0, 2.0, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div
          className="text-[9px] font-mono-data uppercase tracking-widest whitespace-nowrap drop-shadow-[0_0_6px_rgba(0,0,0,0.9)]"
          style={{ color }}
        >
          {label}
        </div>
      </Html>
    </group>
  );
}

/* ── Data packets traveling the highway ────────────────────────────────────── */
function Packets({ progress, mode }: { progress: number; mode: SimMode }) {
  const refs = useRef<THREE.Mesh[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: 10 }, (_, i) => ({
        speed: 0.18 + Math.random() * 0.22,
        phase: i / 10,
        stage: Math.min(4, Math.floor((i / 10) * 5)),
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    refs.current.forEach((m, i) => {
      if (!m) return;
      const s = seeds[i];
      const threshold = s.stage * 20;
      const on = mode === 'live' || progress >= threshold;
      const u = (t * s.speed + s.phase) % 1;
      const x = PATH_POINTS[0][0] + u * (PATH_POINTS[4][0] - PATH_POINTS[0][0]);
      m.position.set(x, 0.55 + Math.sin(u * Math.PI * 2) * 0.06, 0);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = on ? (0.25 + 0.75 * Math.sin(u * Math.PI)) * (mode === 'live' ? 0.9 : 0.5 + 0.5 * clamp(progress / 10)) : 0;
      m.visible = on && mat.opacity > 0.02;
      m.scale.setScalar(0.07 + 0.03 * Math.sin(u * Math.PI));
    });
  });

  return (
    <group>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) refs.current[i] = m;
          }}
        >
          <sphereGeometry args={[1, 10, 10]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
    </group>
  );
}

/* ── Stage 1 · Acoustic capture: particle density/speed follows loudness ───── */
function AcousticCapture({ progress, mode, live }: { progress: number; mode: SimMode; live: LiveIntensity }) {
  const particles = useRef<THREE.Mesh[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: 30 }, (_, i) => ({
        lane: (i % 5) - 2,
        speed: 0.4 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    // In live mode the wave is as strong as the acoustic slider; in sweep mode
    // it fades in as the sweep reaches the stage.
    const k = mode === 'live' ? 0.25 + 0.75 * live.acoustic : clamp(progress / 10);
    const speedMul = mode === 'live' ? 0.6 + 0.9 * live.acoustic : 1;
    const sizeMul = mode === 'live' ? 0.5 + 0.5 * live.acoustic : 1;
    particles.current.forEach((m, i) => {
      if (!m) return;
      const s = seeds[i];
      const u = (t * s.speed * speedMul + s.phase) % 1;
      const x = -0.9 + u * 1.8;
      const y = s.lane * 0.32 + Math.sin(u * Math.PI * 4 + t * 3) * 0.4;
      const z = Math.cos(u * Math.PI * 3 + t * 2.4) * 0.3;
      m.position.set(x, y, z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * (0.15 + 0.85 * Math.sin(u * Math.PI));
      m.visible = k > 0.02 && mat.opacity > 0.02;
      m.scale.setScalar((0.06 + 0.04 * sizeMul) + 0.05 * Math.sin(u * Math.PI));
    });
  });

  return (
    <group position={[STAGE_X[0], 0.55, 0]}>
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.45, 0.8, 24]} />
        <meshStandardMaterial color="#1E2D4A" metalness={0.8} roughness={0.3} emissive="#00F0FF" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[-0.5, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.2, 0.2, 0.6, 16]} />
        <meshStandardMaterial color="#8B96AC" metalness={0.85} roughness={0.25} />
      </mesh>
      {seeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) particles.current[i] = m;
          }}
        >
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
      <Pedestal x={0} color="#00F0FF" label="Stage 1 · Acoustic" />
    </group>
  );
}

/* ── Stage 2 · Thermal: heat-ring expansion rate follows temperature ──────── */
function ThermalSensing({ progress, mode, live }: { progress: number; mode: SimMode; live: LiveIntensity }) {
  const rings = useRef<THREE.Mesh[]>([]);
  const ringCount = 4;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const tempK = clamp((live.temperature - 20) / 65);
    const k = mode === 'live' ? 0.25 + 0.75 * tempK : clamp((progress - 15) / 10);
    const rateMul = mode === 'live' ? 0.4 + 0.9 * tempK : 1;
    rings.current.forEach((m, i) => {
      if (!m) return;
      const ph = (t * 0.45 * rateMul + i / ringCount) % 1;
      const mat = m.material as THREE.MeshBasicMaterial;
      m.scale.setScalar(0.3 + ph * 2.2);
      mat.opacity = k * (1 - ph) * (mode === 'live' ? 0.3 + 0.7 * tempK : 0.5);
      m.visible = k > 0.02;
    });
  });

  return (
    <group position={[STAGE_X[1], 0.55, 0]}>
      {Array.from({ length: ringCount }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) rings.current[i] = m;
          }}
        >
          <ringGeometry args={[0.36, 0.42, 32]} />
          <meshBasicMaterial color="#EA580C" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.16, 0.16, 0.36, 16]} />
        <meshStandardMaterial color="#1E2D4A" metalness={0.8} roughness={0.3} emissive="#EA580C" emissiveIntensity={0.35} />
      </mesh>
      <Pedestal x={0} color="#EA580C" label="Stage 2 · Thermal" />
    </group>
  );
}

/* ── Stage 3 · Electrical + spindle vibration: shake/rings follow RMS ─────── */
function VibrationStage({ progress, mode, live }: { progress: number; mode: SimMode; live: LiveIntensity }) {
  const shaftRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh[]>([]);
  const ringRef = useRef<THREE.Mesh[]>([]);
  const wires: [number, number, number][] = useMemo(
    () => [
      [-1.5, -0.35, 0.4],
      [-0.5, -0.2, 0.8],
      [0.5, -0.25, 0.6],
      [1.5, 0.05, 0.95],
    ],
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const rmsK = clamp((live.rms - 0.1) / 2.9);
    const sevK = clamp(live.severity);
    const energy = 0.5 * rmsK + 0.5 * sevK;
    const k = mode === 'live' ? 0.2 + 0.8 * energy : clamp((progress - 35) / 10);
    if (shaftRef.current) shaftRef.current.rotation.z += (0.4 + k * 2.2) * 0.016;

    pulseRef.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * (mode === 'live' ? 0.5 + 0.7 * energy : 0.5) + i / 4) % 1;
      const idx = u * (wires.length - 1);
      const i0 = Math.floor(idx);
      const i1 = Math.min(wires.length - 1, i0 + 1);
      const fr = idx - i0;
      const p0 = wires[i0];
      const p1 = wires[i1];
      m.position.set(p0[0] + (p1[0] - p0[0]) * fr, p0[1] + (p1[1] - p0[1]) * fr, p0[2] + (p1[2] - p0[2]) * fr);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * (0.5 + 0.5 * Math.sin(u * Math.PI * 2));
      m.visible = k > 0.02;
    });

    ringRef.current.forEach((m, i) => {
      if (!m) return;
      const ph = (t * (mode === 'live' ? 0.5 + 0.7 * energy : 0.5) + i / 4) % 1;
      m.scale.setScalar(0.35 + ph * 2.4);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * (1 - ph) * (mode === 'live' ? 0.2 + 0.8 * energy : 0.4);
      m.visible = k > 0.02;
    });
  });

  return (
    <group position={[STAGE_X[2], 0.55, 0]}>
      <group position={[-1.6, -0.55, 0]}>
        <group ref={shaftRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.32, 0.32, 1.4, 20]} />
            <meshStandardMaterial color="#9AA7BD" metalness={0.9} roughness={0.2} emissive="#F59E0B" emissiveIntensity={0.18} />
          </mesh>
        </group>
        {Array.from({ length: 4 }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) ringRef.current[i] = m;
            }}
          >
            <ringGeometry args={[0.45, 0.47, 32]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      <Line points={wires} color="#00F0FF" lineWidth={1.5} transparent opacity={0.35} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) pulseRef.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.05, 8, 8]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
      <Pedestal x={0} color="#F59E0B" label="Stage 3 · Vibration + Electrical" />
    </group>
  );
}

/* ── Stage 4 · ML inference: core energy + streams follow severity ─────────── */
function MLInference({ progress, mode, live }: { progress: number; mode: SimMode; live: LiveIntensity }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const streamRef = useRef<THREE.Mesh[]>([]);
  const streamSeeds = useMemo(
    () => Array.from({ length: 24 }, (_, i) => ({ speed: 0.6 + Math.random() * 0.6, phase: Math.random() * Math.PI * 2 })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sevK = clamp(live.severity);
    const k = mode === 'live' ? 0.3 + 0.7 * sevK : clamp((progress - 55) / 10);
    if (coreRef.current) {
      const mat = coreRef.current.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = 0.4 + k * 2.2 + Math.sin(t * 5) * 0.15 * k;
      coreRef.current.scale.setScalar(1 + Math.sin(t * 4) * 0.05 * k);
    }
    if (shellRef.current) {
      shellRef.current.rotation.y += 0.008;
      shellRef.current.rotation.x += 0.004;
      const mat = shellRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.15 + 0.6 * k;
    }
    streamRef.current.forEach((m, i) => {
      if (!m) return;
      const s = streamSeeds[i];
      const u = (t * s.speed * (mode === 'live' ? 0.5 + 0.8 * sevK : 1) + s.phase) % 1;
      const angle = s.phase + u * Math.PI * 4;
      const r = 2.2 * (1 - u);
      m.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.6, Math.sin(angle * 0.7) * 0.5);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * Math.sin(u * Math.PI) * 0.9;
      m.visible = k > 0.02;
    });
  });

  return (
    <group position={[STAGE_X[3], 0.55, 0]}>
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[0.95, 1]} />
        <meshBasicMaterial color="#00F0FF" wireframe transparent opacity={0.15} />
      </mesh>
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.45, 24, 24]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.2} roughness={0.3} emissive="#F59E0B" emissiveIntensity={0.6} />
      </mesh>
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const p: [number, number, number] = [Math.cos(a) * 0.95, Math.sin(a) * 0.95, 0];
        return <Line key={i} points={[[0, 0, 0], p]} color="#F59E0B" lineWidth={1} transparent opacity={0.5} />;
      })}
      {streamSeeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) streamRef.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.045, 6, 6]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
      <Pedestal x={0} color="#F59E0B" label="Stage 4 · ML Inference" />
    </group>
  );
}

/* ── Stage 5 · Dashboard dispatch: payload intensity follows severity ──────── */
function DashboardDispatch({ progress, mode, live }: { progress: number; mode: SimMode; live: LiveIntensity }) {
  const cubes = useRef<THREE.Mesh[]>([]);
  const dashRef = useRef<THREE.Group>(null);
  const cubeSeeds = useMemo(
    () => Array.from({ length: 5 }, (_, i) => ({ speed: 0.55 + Math.random() * 0.4, phase: i / 5, yOff: (i % 3) - 1 })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const sevK = clamp(live.severity);
    const k = mode === 'live' ? 0.3 + 0.7 * sevK : clamp((progress - 75) / 10);
    cubes.current.forEach((m, i) => {
      if (!m) return;
      const s = cubeSeeds[i];
      const u = (t * s.speed + s.phase) % 1;
      const x = 1.6 + u * 1.8;
      const y = s.yOff * 0.3 + Math.sin(u * Math.PI) * 0.2;
      m.position.set(x, y, 0);
      m.rotation.x += 0.04;
      m.rotation.y += 0.03;
      const mat = m.material as THREE.MeshStandardMaterial;
      mat.emissiveIntensity = k * (0.6 + 0.4 * Math.sin(u * Math.PI * 2));
      m.visible = k > 0.02;
    });
    if (dashRef.current) {
      const mat = (dashRef.current.children[0] as THREE.Mesh)?.material as THREE.MeshStandardMaterial;
      if (mat) mat.emissiveIntensity = 0.15 + k * 1.4;
    }
  });

  return (
    <group position={[STAGE_X[4], 0.55, 0]}>
      {cubeSeeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) cubes.current[i] = m;
          }}
        >
          <boxGeometry args={[0.12, 0.12, 0.12]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.6} />
        </mesh>
      ))}
      <group ref={dashRef}>
        <mesh>
          <boxGeometry args={[1.3, 0.8, 0.16]} />
          <meshStandardMaterial color="#0F1629" metalness={0.6} roughness={0.35} emissive="#00F0FF" emissiveIntensity={0.2} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.4 + i * 0.4, 0.13, 0.1]}>
            <boxGeometry args={[0.24, 0.45, 0.02]} />
            <meshStandardMaterial color={['#10B981', '#F59E0B', '#EA580C'][i]} emissive={['#10B981', '#F59E0B', '#EA580C'][i]} emissiveIntensity={0.8} />
          </mesh>
        ))}
      </group>
      <Pedestal x={0} color="#00F0FF" label="Stage 5 · Dashboard" />
    </group>
  );
}

function PipelineScene({ progress, mode = 'live', live = DEFAULT_LIVE }: SimProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 5]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-6, -2, -4]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[2, 1, 3.5]} intensity={1.6} color="#F59E0B" distance={14} />

      {/* Data highway + organized stage nodes */}
      <Line points={PATH_POINTS} color="#00F0FF" lineWidth={1.2} transparent opacity={0.25} />
      <Packets progress={progress} mode={mode} />
      <AcousticCapture progress={progress} mode={mode} live={live} />
      <ThermalSensing progress={progress} mode={mode} live={live} />
      <VibrationStage progress={progress} mode={mode} live={live} />
      <MLInference progress={progress} mode={mode} live={live} />
      <DashboardDispatch progress={progress} mode={mode} live={live} />

      {/* Endpoint markers */}
      <mesh position={[PATH_POINTS[0][0], 0.55, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#00F0FF" />
      </mesh>
      <mesh position={[PATH_POINTS[4][0], 0.55, 0]}>
        <sphereGeometry args={[0.09, 12, 12]} />
        <meshBasicMaterial color="#10B981" />
      </mesh>

      <Sparkles count={60} scale={[12, 3.5, 3.5]} size={2.2} speed={0.4} color="#00F0FF" opacity={0.3} />

      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.4} color="#F59E0B" position={[4, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.8} color="#00F0FF" position={[-4, -2, 3]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.6} color="#ffffff" position={[0, 4, -2]} scale={[7, 2, 1]} />
      </Environment>
      <OrbitControls
        enablePan={false}
        minDistance={7}
        maxDistance={20}
        minPolarAngle={Math.PI / 4}
        maxPolarAngle={Math.PI / 2.1}
        autoRotate
        autoRotateSpeed={0.5}
      />
    </>
  );
}

export default function WorkflowSimulation({ progress, mode = 'live', live = DEFAULT_LIVE }: SimProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 4.2, 13], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <PipelineScene progress={progress} mode={mode} live={live} />
    </Canvas>
  );
}
