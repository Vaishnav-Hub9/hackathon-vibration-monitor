import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Environment, Lightformer } from '@react-three/drei';
import * as THREE from 'three';
import { computeDefectFrequencies, DEFAULT_BEARING } from '@/lib/defectFrequencies';

export type FaultType = 'healthy' | 'outer' | 'inner' | 'ball' | 'imbalance' | 'misalignment';

export const FAULT_LABELS: Record<FaultType, string> = {
  healthy: 'Healthy',
  outer: 'Outer Race',
  inner: 'Inner Race',
  ball: 'Ball Defect',
  imbalance: 'Imbalance',
  misalignment: 'Misalignment',
};

export const FAULT_COLORS: Record<FaultType, string> = {
  healthy: '#10B981',
  outer: '#FF1100',
  inner: '#FF1100',
  ball: '#FF1100',
  imbalance: '#F59E0B',
  misalignment: '#F59E0B',
};

/** Which sub-mesh carries the damage for each fault — drives the emissive pulse. */
const FAULT_TARGET: Record<FaultType, 'outer' | 'inner' | 'ball' | 'shaft' | null> = {
  healthy: null,
  outer: 'outer',
  inner: 'inner',
  ball: 'ball',
  imbalance: 'shaft',
  misalignment: 'shaft',
};

/* Real raceway geometry — matches the ML model's 6205-class training bearing. */
const BALLS = 9;
const BALL_RADIUS = 0.2;
const BALL_PITCH = 1.7;
const OUTER_R = 2.25;
const OUTER_TUBE = 0.34;
const INNER_R = 1.18;
const INNER_TUBE = 0.3;

export function faultFrequencyHz(rpm: number, fault: FaultType): number {
  const df = computeDefectFrequencies(rpm, DEFAULT_BEARING);
  switch (fault) {
    case 'outer': return df.bpfo;
    case 'inner': return df.bpfi;
    case 'ball': return df.bsf;
    case 'imbalance': return df.fr;
    case 'misalignment': return df.fr * 2;
    default: return 0;
  }
}

interface BearingRigProps {
  rpm: number;
  fault: FaultType;
  severity: number; // 0–100
}

function BearingRig({ rpm, fault, severity }: BearingRigProps) {
  const innerRef = useRef<THREE.Group>(null);
  const ballsRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Group>(null);
  const jitterRef = useRef<THREE.Group>(null);
  const shockRef = useRef<THREE.Mesh>(null);
  const shockMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const outerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const innerMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const shaftMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const ballMatsRef = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const flash = useRef(0);
  const lastPhase = useRef(0);

  useFrame((state, delta) => {
    const t = state.clock.elapsedTime;
    const df = computeDefectFrequencies(rpm, DEFAULT_BEARING);
    const sev = severity / 100;
    const faultFreq = faultFrequencyHz(rpm, fault);
    const active = fault !== 'healthy' && sev > 0.01;
    const glowColor = FAULT_COLORS[fault];

    // ── Rotation: inner ring + shaft spin at RPM; balls orbit at cage speed ──
    const spin = (rpm / 15000) * 1.7 + 0.12;
    if (innerRef.current) innerRef.current.rotation.z += spin * delta;
    if (shaftRef.current) shaftRef.current.rotation.z += spin * delta;
    if (ballsRef.current) ballsRef.current.rotation.z += spin * 0.42 * delta;

    // ── Impact flash: pulse rate synced EXACTLY to the fault frequency ──
    // Phase wraps every 1/faultFreq seconds → a fresh impact spike each wrap.
    if (faultFreq > 0) {
      const phase = (t * faultFreq) % 1;
      if (phase < lastPhase.current) flash.current = 1;
      lastPhase.current = phase;
    } else {
      lastPhase.current = 0;
    }
    flash.current = Math.max(0, flash.current - delta * 3.4);

    // ── Vibration jitter — amplitude scales with severity (faults only) ──
    const amp = active ? sev * (fault === 'imbalance' ? 0.14 : 0.055) : 0;
    if (jitterRef.current) {
      const g = jitterRef.current;
      if (fault === 'imbalance') {
        // circular 1× RPM orbit — classic imbalance wobble
        g.position.x = Math.cos(t * df.fr * Math.PI * 2) * amp;
        g.position.y = Math.sin(t * df.fr * Math.PI * 2) * amp * 0.6;
        g.rotation.z = 0;
      } else if (fault === 'misalignment') {
        // axial tilt at 2× RPM
        g.position.x = Math.sin(t * df.fr * 2 * Math.PI * 2) * amp * 0.5;
        g.position.y = 0;
        g.rotation.z = Math.sin(t * df.fr * 2 * Math.PI * 2) * 0.035 * sev;
      } else {
        g.position.x = Math.sin(t * (faultFreq || 1) * Math.PI * 2) * amp * 0.6 + (Math.random() - 0.5) * amp;
        g.position.y = (Math.random() - 0.5) * amp;
        g.rotation.z = 0;
      }
    }

    // ── Fault highlight: pulse the damaged sub-mesh with the impact flash ──
    const pulse = sev * (0.35 + 0.75 * flash.current);
    const target = FAULT_TARGET[fault];
    const applyGlow = (mat: THREE.MeshStandardMaterial | null, on: boolean) => {
      if (!mat) return;
      mat.emissive.set(glowColor);
      mat.emissiveIntensity = on ? pulse : 0;
    };
    applyGlow(outerMatRef.current, target === 'outer');
    applyGlow(innerMatRef.current, target === 'inner');
    applyGlow(shaftMatRef.current, target === 'shaft');
    ballMatsRef.current.forEach((m, i) => applyGlow(m, target === 'ball' && i === 0));

    // ── Impact shockwave ring at the defect location ──
    if (shockMatRef.current && shockRef.current) {
      const visible = active && flash.current > 0.02;
      shockRef.current.visible = visible;
      if (visible) {
        shockMatRef.current.opacity = flash.current * 0.85;
        const s = 1 + (1 - flash.current) * 3.4;
        shockRef.current.scale.set(s, s, s);
      }
      // defect sits at the fault zone — rotates with the damaged member
      if (fault === 'outer') shockRef.current.position.set(OUTER_R + 0.12, 0, 0);
      else if (fault === 'inner') {
        const a = innerRef.current?.rotation.z ?? 0;
        shockRef.current.position.set(Math.cos(a) * INNER_R, Math.sin(a) * INNER_R, 0);
      } else if (fault === 'ball') {
        const a = ballsRef.current?.rotation.z ?? 0;
        shockRef.current.position.set(Math.cos(a) * BALL_PITCH, Math.sin(a) * BALL_PITCH, 0);
      } else {
        shockRef.current.position.set(0, 0, 0);
      }
    }
  });

  const ballAngles = useMemo(
    () => Array.from({ length: BALLS }, (_, i) => (i / BALLS) * Math.PI * 2),
    [],
  );

  return (
    <group ref={jitterRef}>
      {/* Shaft */}
      <group ref={shaftRef}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.5, 0.5, 2.6, 32]} />
          <meshStandardMaterial ref={shaftMatRef} color="#6B7280" metalness={0.9} roughness={0.25} emissive="#000000" emissiveIntensity={0} />
        </mesh>
      </group>

      {/* Outer race — static ring */}
      <mesh>
        <torusGeometry args={[OUTER_R, OUTER_TUBE, 28, 96]} />
        <meshStandardMaterial ref={outerMatRef} color="#9AA7BD" metalness={0.85} roughness={0.22} emissive="#000000" emissiveIntensity={0} />
      </mesh>
      {/* Outer race defect marker — scales with severity */}
      {fault === 'outer' && (
        <mesh position={[OUTER_R, 0, 0]} scale={0.5 + severity / 100}>
          <boxGeometry args={[0.14, 0.14, 0.14]} />
          <meshStandardMaterial color="#FF1100" emissive="#FF1100" emissiveIntensity={1.2} />
        </mesh>
      )}

      {/* Inner race — spins with the shaft */}
      <group ref={innerRef}>
        <mesh>
          <torusGeometry args={[INNER_R, INNER_TUBE, 24, 96]} />
          <meshStandardMaterial ref={innerMatRef} color="#8B96AC" metalness={0.9} roughness={0.18} emissive="#000000" emissiveIntensity={0} />
        </mesh>
        {fault === 'inner' && (
          <mesh position={[INNER_R, 0, 0]} scale={0.5 + severity / 100}>
            <boxGeometry args={[0.12, 0.12, 0.12]} />
            <meshStandardMaterial color="#FF1100" emissive="#FF1100" emissiveIntensity={1.2} />
          </mesh>
        )}
      </group>

      {/* Cage + balls — orbit at cage speed (≈0.4× RPM) */}
      <group ref={ballsRef}>
        {[-0.24, 0.24].map((z) => (
          <mesh key={z} position={[0, 0, z]}>
            <torusGeometry args={[BALL_PITCH, 0.045, 10, 80]} />
            <meshStandardMaterial color="#B9C4D4" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
        {ballAngles.map((a, i) => (
          <mesh key={i} position={[Math.cos(a) * BALL_PITCH, Math.sin(a) * BALL_PITCH, 0]}>
            <boxGeometry args={[0.07, 0.07, 0.48]} />
            <meshStandardMaterial color="#B9C4D4" metalness={0.85} roughness={0.3} />
          </mesh>
        ))}
        {ballAngles.map((a, i) => (
          <mesh key={`b${i}`} position={[Math.cos(a) * BALL_PITCH, Math.sin(a) * BALL_PITCH, 0]}>
            <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
            <meshStandardMaterial
              ref={(m) => {
                ballMatsRef.current[i] = m;
              }}
              color="#D3DBE6"
              metalness={0.7}
              roughness={0.2}
              emissive="#000000"
              emissiveIntensity={0}
              envMapIntensity={1.4}
            />
          </mesh>
        ))}
        {/* Ball defect marker — scales with severity */}
        {fault === 'ball' && (
          <mesh position={[BALL_PITCH, 0, 0]} scale={0.5 + severity / 100}>
            <sphereGeometry args={[0.075, 12, 12]} />
            <meshStandardMaterial color="#FF1100" emissive="#FF1100" emissiveIntensity={1.4} />
          </mesh>
        )}
      </group>

      {/* Impact shockwave ring */}
      <mesh ref={shockRef} visible={false}>
        <ringGeometry args={[0.16, 0.2, 48]} />
        <meshBasicMaterial ref={shockMatRef} color="#FF1100" transparent opacity={0} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  );
}

interface BearingVisualizer3DProps {
  rpm: number;
  fault: FaultType;
  severity: number;
}

export default function BearingVisualizer3D({ rpm, fault, severity }: BearingVisualizer3DProps) {
  return (
    <Canvas
      dpr={[1, 2]}
      camera={{ position: [0, 1.6, 10.5], fov: 42 }}
      gl={{ antialias: true, alpha: true }}
    >
      <ambientLight intensity={0.45} />
      <directionalLight position={[5, 6, 5]} intensity={1.1} color="#ffffff" />
      <directionalLight position={[-6, -2, -4]} intensity={0.5} color="#3B82F6" />
      <pointLight position={[0, 0, 3.5]} intensity={2.2} color="#F59E0B" distance={9} />

      <BearingRig rpm={rpm} fault={fault} severity={severity} />

      <ContactShadows position={[0, -3.2, 0]} opacity={0.45} scale={16} blur={2.8} far={5} color="#000000" />
      <Environment resolution={64} frames={1}>
        <Lightformer intensity={1.4} color="#F59E0B" position={[4, 3, 4]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.8} color="#60A5FA" position={[-4, -2, 3]} scale={[5, 5, 1]} />
        <Lightformer intensity={0.6} color="#ffffff" position={[0, 4, -2]} scale={[7, 2, 1]} />
      </Environment>
      <OrbitControls enablePan={false} minDistance={4.5} maxDistance={18} autoRotate autoRotateSpeed={0.7} />
    </Canvas>
  );
}
