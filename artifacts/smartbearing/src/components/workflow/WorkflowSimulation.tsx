import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment, Lightformer, Line, Html, Sparkles } from '@react-three/drei';
import * as THREE from 'three';

/* ────────────────────────────────────────────────────────────────────────────
   WorkflowSimulation — the full telemetry pipeline rendered as one live 3D
   scene.  Progress (0–100) walks the eye through five stages:
     0–20%  acoustic wave capture       → sine-wave particles converge on a mic
     20–40% thermal sensing             → heat-gradient rings into a temp node
     40–60% electrical & spindle vib    → voltage pulses + vibration rings
     60–80% ML inference                → data streams into a glowing NN node
     80–100% dashboard dispatch         → JSON payload cubes fly to the dashboard
   Every stage is activated by the progress prop and driven in useFrame.
   ──────────────────────────────────────────────────────────────────────────── */

interface SimProps {
  progress: number; // 0–100
}

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/* ── Stage 0 · Acoustic capture: sine-wave particles converge on a mic cone ── */
function AcousticCapture({ progress }: { progress: number }) {
  const particles = useRef<THREE.Mesh[]>([]);
  const seeds = useMemo(
    () =>
      Array.from({ length: 42 }, (_, i) => ({
        lane: (i % 6) - 2.5,
        speed: 0.35 + Math.random() * 0.5,
        phase: Math.random() * Math.PI * 2,
      })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const active = progress >= 0;
    particles.current.forEach((m, i) => {
      if (!m) return;
      const s = seeds[i];
      // sine-wave wobble as particles travel toward the mic (-x)
      const u = (t * s.speed + s.phase) % 1;
      const x = -3 + u * 5;
      const y = s.lane + Math.sin(u * Math.PI * 4 + t * 3) * 0.5;
      const z = Math.cos(u * Math.PI * 3 + t * 2.4) * 0.35;
      m.position.set(x, y, z);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = active ? (0.15 + 0.85 * Math.sin(u * Math.PI)) * (0.4 + 0.6 * clamp(progress / 10)) : 0;
      m.visible = active && mat.opacity > 0.02;
      m.scale.setScalar(0.08 + 0.05 * Math.sin(u * Math.PI));
    });
  });

  return (
    <group position={[-2.4, 0, 0]}>
      {/* mic cone */}
      <mesh rotation={[0, 0, -Math.PI / 2]}>
        <coneGeometry args={[0.5, 0.9, 24]} />
        <meshStandardMaterial color="#1E2D4A" metalness={0.8} roughness={0.3} emissive="#00F0FF" emissiveIntensity={0.25} />
      </mesh>
      <mesh position={[-0.55, 0, 0]} rotation={[0, 0, -Math.PI / 2]}>
        <cylinderGeometry args={[0.22, 0.22, 0.7, 16]} />
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
      <Html position={[-0.8, 0.9, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="text-[9px] font-mono-data uppercase tracking-widest text-[#00F0FF] whitespace-nowrap drop-shadow-[0_0_6px_rgba(0,240,255,0.8)]">
          Stage 1 · Acoustic
        </div>
      </Html>
    </group>
  );
}

/* ── Stage 1 · Thermal: expanding heat-gradient rings into a temp sensor ── */
function ThermalSensing({ progress }: { progress: number }) {
  const rings = useRef<THREE.Mesh[]>([]);
  const ringCount = 4;

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = clamp((progress - 15) / 10);
    rings.current.forEach((m, i) => {
      if (!m) return;
      const ph = (t * 0.45 + i / ringCount) % 1;
      const mat = m.material as THREE.MeshBasicMaterial;
      m.scale.setScalar(0.3 + ph * 2.6);
      mat.opacity = k * (1 - ph) * 0.55;
      m.visible = k > 0.02;
    });
  });

  return (
    <group position={[-0.7, 0.4, 0]}>
      {Array.from({ length: ringCount }, (_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) rings.current[i] = m;
          }}
        >
          <ringGeometry args={[0.4, 0.46, 32]} />
          <meshBasicMaterial color="#EA580C" transparent opacity={0} side={THREE.DoubleSide} />
        </mesh>
      ))}
      <mesh>
        <cylinderGeometry args={[0.18, 0.18, 0.4, 16]} />
        <meshStandardMaterial color="#1E2D4A" metalness={0.8} roughness={0.3} emissive="#EA580C" emissiveIntensity={0.3} />
      </mesh>
      <Html position={[0, 0.75, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="text-[9px] font-mono-data uppercase tracking-widest text-[#EA580C] whitespace-nowrap drop-shadow-[0_0_6px_rgba(234,88,12,0.8)]">
          Stage 2 · Thermal
        </div>
      </Html>
    </group>
  );
}

/* ── Stage 2 · Electrical + spindle vibration: pulses on wires + rings on shaft ── */
function VibrationStage({ progress }: { progress: number }) {
  const shaftRef = useRef<THREE.Group>(null);
  const pulseRef = useRef<THREE.Mesh[]>([]);
  const ringRef = useRef<THREE.Mesh[]>([]);
  const wires: [number, number, number][] = useMemo(
    () => [
      [-2.0, -0.4, 0.5],
      [-0.8, -0.2, 0.9],
      [0.4, -0.3, 0.6],
      [1.6, 0.1, 1.1],
    ],
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = clamp((progress - 35) / 10);
    if (shaftRef.current) shaftRef.current.rotation.z += (0.4 + k * 2.2) * 0.016;

    // voltage pulses travel along the wire
    pulseRef.current.forEach((m, i) => {
      if (!m) return;
      const u = (t * 0.5 + i / 4) % 1;
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

    // vibration rings propagate outward from the spindle
    ringRef.current.forEach((m, i) => {
      if (!m) return;
      const ph = (t * 0.5 + i / 4) % 1;
      m.scale.setScalar(0.4 + ph * 2.8);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * (1 - ph) * 0.4;
      m.visible = k > 0.02;
    });
  });

  return (
    <group>
      {/* spindle + rings */}
      <group position={[-2.4, -0.9, 0]}>
        <group ref={shaftRef}>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.35, 0.35, 1.6, 20]} />
            <meshStandardMaterial color="#9AA7BD" metalness={0.9} roughness={0.2} emissive="#F59E0B" emissiveIntensity={0.15} />
          </mesh>
        </group>
        {Array.from({ length: 4 }, (_, i) => (
          <mesh
            key={i}
            ref={(m) => {
              if (m) ringRef.current[i] = m;
            }}
          >
            <ringGeometry args={[0.5, 0.52, 32]} />
            <meshBasicMaterial color="#F59E0B" transparent opacity={0} side={THREE.DoubleSide} />
          </mesh>
        ))}
      </group>
      {/* wire + pulses */}
      <Line points={wires} color="#00F0FF" lineWidth={1.5} transparent opacity={0.35} />
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) pulseRef.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.06, 8, 8]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
      <Html position={[-0.4, 1.05, 1.2]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="text-[9px] font-mono-data uppercase tracking-widest text-[#F59E0B] whitespace-nowrap drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
          Stage 3 · Vibration + Electrical
        </div>
      </Html>
    </group>
  );
}

/* ── Stage 3 · ML inference: data streams into a glowing neural network node ── */
function MLInference({ progress }: { progress: number }) {
  const coreRef = useRef<THREE.Mesh>(null);
  const shellRef = useRef<THREE.Mesh>(null);
  const streamRef = useRef<THREE.Mesh[]>([]);
  const streamSeeds = useMemo(
    () => Array.from({ length: 30 }, (_, i) => ({ speed: 0.6 + Math.random() * 0.6, phase: Math.random() * Math.PI * 2 })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = clamp((progress - 55) / 10);
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
      const u = (t * s.speed + s.phase) % 1;
      // particles spiral inward toward the core
      const angle = s.phase + u * Math.PI * 4;
      const r = 2.6 * (1 - u);
      m.position.set(Math.cos(angle) * r, Math.sin(angle) * r * 0.6, Math.sin(angle * 0.7) * 0.5);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = k * Math.sin(u * Math.PI) * 0.9;
      m.visible = k > 0.02;
    });
  });

  return (
    <group position={[1.7, 0, 0]}>
      {/* neural network shell */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[1.15, 1]} />
        <meshBasicMaterial color="#00F0FF" wireframe transparent opacity={0.15} />
      </mesh>
      {/* core */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[0.5, 24, 24]} />
        <meshStandardMaterial color="#F59E0B" metalness={0.2} roughness={0.3} emissive="#F59E0B" emissiveIntensity={0.6} />
      </mesh>
      {/* node connections */}
      {Array.from({ length: 6 }, (_, i) => {
        const a = (i / 6) * Math.PI * 2;
        const p: [number, number, number] = [Math.cos(a) * 1.15, Math.sin(a) * 1.15, 0];
        return <Line key={i} points={[[0, 0, 0], p]} color="#F59E0B" lineWidth={1} transparent opacity={0.5} />;
      })}
      {/* data stream */}
      {streamSeeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) streamRef.current[i] = m;
          }}
        >
          <sphereGeometry args={[0.05, 6, 6]} />
          <meshBasicMaterial color="#00F0FF" transparent opacity={0} />
        </mesh>
      ))}
      <Html position={[0, 1.6, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
        <div className="text-[9px] font-mono-data uppercase tracking-widest text-[#F59E0B] whitespace-nowrap drop-shadow-[0_0_6px_rgba(245,158,11,0.8)]">
          Stage 4 · ML Inference
        </div>
      </Html>
    </group>
  );
}

/* ── Stage 4 · Dashboard dispatch: JSON payload cubes fly to a dashboard node ── */
function DashboardDispatch({ progress }: { progress: number }) {
  const cubes = useRef<THREE.Mesh[]>([]);
  const dashRef = useRef<THREE.Group>(null);
  const cubeSeeds = useMemo(
    () => Array.from({ length: 6 }, (_, i) => ({ speed: 0.5 + Math.random() * 0.4, phase: i / 6, yOff: (i % 3) - 1 })),
    [],
  );

  useFrame((state) => {
    const t = state.clock.elapsedTime;
    const k = clamp((progress - 75) / 10);
    cubes.current.forEach((m, i) => {
      if (!m) return;
      const s = cubeSeeds[i];
      const u = (t * s.speed + s.phase) % 1;
      const x = 2.4 + u * 3.2;
      const y = s.yOff * 0.35 + Math.sin(u * Math.PI) * 0.2;
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
    <group>
      {cubeSeeds.map((_, i) => (
        <mesh
          key={i}
          ref={(m) => {
            if (m) cubes.current[i] = m;
          }}
        >
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial color="#00F0FF" emissive="#00F0FF" emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* dashboard node */}
      <group ref={dashRef} position={[6.2, 0, 0]}>
        <mesh>
          <boxGeometry args={[1.5, 0.9, 0.18]} />
          <meshStandardMaterial color="#0F1629" metalness={0.6} roughness={0.35} emissive="#00F0FF" emissiveIntensity={0.2} />
        </mesh>
        {/* KPI bars */}
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[-0.45 + i * 0.45, 0.15, 0.11]}>
            <boxGeometry args={[0.28, 0.5, 0.02]} />
            <meshStandardMaterial color={['#10B981', '#F59E0B', '#EA580C'][i]} emissive={['#10B981', '#F59E0B', '#EA580C'][i]} emissiveIntensity={0.8} />
          </mesh>
        ))}
        <Html position={[0, 0.85, 0]} center distanceFactor={10} zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="text-[9px] font-mono-data uppercase tracking-widest text-[#00F0FF] whitespace-nowrap drop-shadow-[0_0_6px_rgba(0,240,255,0.8)]">
            Stage 5 · Dashboard
          </div>
        </Html>
      </group>
    </group>
  );
}

function PipelineScene({ progress }: SimProps) {
  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[5, 6, 5]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-6, -2, -4]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[2, 1, 3.5]} intensity={1.6} color="#F59E0B" distance={12} />

      <AcousticCapture progress={progress} />
      <ThermalSensing progress={progress} />
      <VibrationStage progress={progress} />
      <MLInference progress={progress} />
      <DashboardDispatch progress={progress} />

      <Sparkles count={70} scale={[11, 4, 4]} size={2.5} speed={0.4} color="#00F0FF" opacity={0.35} />

      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.4} color="#F59E0B" position={[4, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.8} color="#00F0FF" position={[-4, -2, 3]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.6} color="#ffffff" position={[0, 4, -2]} scale={[7, 2, 1]} />
      </Environment>
      <OrbitControls enablePan={false} minDistance={6} maxDistance={18} autoRotate autoRotateSpeed={0.5} />
    </>
  );
}

export default function WorkflowSimulation({ progress }: SimProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.8, 10.5], fov: 45 }}
      gl={{ antialias: true, alpha: true }}
    >
      <PipelineScene progress={progress} />
    </Canvas>
  );
}
