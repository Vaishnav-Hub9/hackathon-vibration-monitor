import { useRef, useState, useEffect, type RefObject } from 'react';
import { Canvas, useFrame, type ThreeEvent } from '@react-three/fiber';
import { OrbitControls, Html, ContactShadows, Environment, Lightformer, useCursor, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import type { LiveSensor } from '@/hooks/useLandingSensors';

export interface BearingSceneProps {
  sensors: LiveSensor[];
  autoRotate: boolean;
  exploded: boolean;
  rpm: number;
  showLabels: boolean;
  selected: SelectedPart;
  onSelect: (part: SelectedPart) => void;
  /** Iron-Man mode: when set, the camera frames this exploded part ("Ball Element" = the ball plate). */
  focusKey?: string | null;
}

export type SelectedPart = { name: string; sensor?: LiveSensor } | null;

const STATUS_COLOR: Record<string, string> = {
  healthy: '#10B981',
  warning: '#F59E0B',
  critical: '#EA580C',
};

/* Home (assembled) label positions */
const PART_POS: Record<string, [number, number, number]> = {
  'Outer Race': [0, 2.0, 0],
  'Inner Race': [0, -1.85, 0],
  Cage: [3.0, 0.35, 0],
  Shaft: [-2.9, 0, 0],
};

/* Full Iron-Man-style exploded separation — every part flies to its own 3D space.
   Assembled = a tight, complete bearing. Exploded = the center goes completely
   empty and each component claims its own slot in space, like a suit breaking
   apart into plates. */
/* Keep the exploded spread inside the central zone so the corner overlays
   (FFT panel, telemetry card) never sit on top of the parts. */

/* Real raceway geometry (units):
   - outer race torus R=2.25 tube=0.34 → raceway inner edge at 2.25-0.34 = 1.91
   - inner race torus R=1.18 tube=0.30 → raceway outer edge at 1.18+0.30 = 1.48
   - raceway gap = 1.91 - 1.48 = 0.43 — the balls must fit inside this slot.
   Balls: radius 0.20 (diameter 0.40 < 0.43) on pitch radius 1.70 (the exact
   center of the gap: (1.48+1.91)/2 = 1.695). Each ball spans 1.50..1.90 with
   ~0.01-0.02 clearance to both races, so the train rolls inside the raceways
   instead of slicing into the rings. */
const BALL_RADIUS = 0.2;
const BALL_PITCH = 1.7;
/* Fixed ball-train size. The socket feed ROTATES sensor ids every tick, so
   geometry must never depend on sensor count/id — meshes are keyed by slot
   index and placed with this constant, otherwise balls remount (z resets to
   0) and the whole ring jumps on every feed update = the glitch. */
const BALL_SLOTS = 8;
const EXPLODED_POS: Record<string, [number, number, number]> = {
  'Outer Race': [0, 2.55, 1.9],
  'Inner Race': [0, -2.45, 1.7],
  Cage: [-2.75, 0.55, 1.6],
  Shaft: [2.75, -0.25, 1.6],
};

/* Signature tilts so parts read as separate suit-plates */
const EXPLODED_ROT: Record<string, [number, number, number]> = {
  'Outer Race': [0.4, 0, 0.32],
  'Inner Race': [-0.36, 0, -0.28],
  Cage: [-0.65, 0, 0],
  Shaft: [0, 0, Math.PI / 2],
};

const PART_INFO: Record<string, string> = {
  'Outer Race': 'BPFO fault zone · static ring',
  'Inner Race': 'BPFI fault zone · rotation-critical',
  Cage: 'Ball retainer · wear indicator',
  Shaft: 'Torque input · rotor coupling',
};

/* Labels sit OUTSIDE each part's ring, offset along its flight direction */
const LABEL_OFFSET: Record<string, [number, number, number]> = {
  'Outer Race': [0, 0.95, 0.3],
  'Inner Race': [0, -0.95, 0.3],
  Cage: [-1.05, 0.15, 0.3],
  Shaft: [1.05, 0.15, 0.3],
};

function PartLabel({ label, selected, onSelect }: { label: string; selected: boolean; onSelect: (name: string) => void }) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const hot = hovered || selected;
  return (
    <group
      onPointerOver={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e: ThreeEvent<PointerEvent>) => {
        e.stopPropagation();
        onSelect(label);
      }}
    >
      {label === 'Outer Race' && (
        <mesh castShadow receiveShadow>
          <torusGeometry args={[2.25, 0.34, 28, 96]} />
          <meshStandardMaterial
            color={hot ? '#F59E0B' : '#9AA7BD'}
            metalness={0.85}
            roughness={0.22}
            emissive={hot ? '#F59E0B' : '#000000'}
            emissiveIntensity={hot ? 0.5 : 0}
          />
        </mesh>
      )}
      {label === 'Inner Race' && (
        <mesh castShadow receiveShadow>
          <torusGeometry args={[1.18, 0.3, 24, 96]} />
          <meshStandardMaterial
            color={hot ? '#F59E0B' : '#8B96AC'}
            metalness={0.9}
            roughness={0.18}
            emissive={hot ? '#F59E0B' : '#000000'}
            emissiveIntensity={hot ? 0.5 : 0}
          />
        </mesh>
      )}
      {label === 'Cage' && (
        <>
          {/* Two thin side rails cradling the ball train (a real retainer
              sits at the ball pitch circle, not a wire through the balls) */}
          {[0.24, -0.24].map((z) => (
            <mesh key={z} castShadow position={[0, 0, z]}>
              <torusGeometry args={[BALL_PITCH, 0.04, 10, 80]} />
            <meshStandardMaterial
              color={hot ? '#FBBF24' : '#9AA7BD'}
              metalness={0.85}
              roughness={0.3}
              emissive={hot ? '#F59E0B' : '#000000'}
              emissiveIntensity={hot ? 0.5 : 0}
            />
            </mesh>
          ))}
          {/* Pocket posts between the balls, locking them in the retainer.
              Same neutral steel as the rails at rest — no more red/amber
              struts cluttering the exploded view. */}
          {Array.from({ length: 8 }, (_, i) => {
            const a = ((i + 0.5) / 8) * Math.PI * 2;
            return (
              <mesh key={i} castShadow position={[Math.cos(a) * BALL_PITCH, Math.sin(a) * BALL_PITCH, 0]}>
                <boxGeometry args={[0.07, 0.07, 0.48]} />
                <meshStandardMaterial
                  color={hot ? '#FBBF24' : '#9AA7BD'}
                  metalness={0.85}
                  roughness={0.3}
                  emissive={hot ? '#F59E0B' : '#000000'}
                  emissiveIntensity={hot ? 0.5 : 0}
                />
              </mesh>
            );
          })}
        </>
      )}
      {label === 'Shaft' && (
        <>
          <mesh castShadow>
            <cylinderGeometry args={[0.5, 0.5, 1.2, 32]} />
            <meshStandardMaterial
              color={hot ? '#F59E0B' : '#6B7280'}
              metalness={0.9}
              roughness={0.25}
              emissive={hot ? '#F59E0B' : '#000000'}
              emissiveIntensity={hot ? 0.5 : 0}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, -0.7]}>
            <cylinderGeometry args={[0.32, 0.32, 1.2, 24]} />
            <meshStandardMaterial
              color={hot ? '#F59E0B' : '#4B5563'}
              metalness={0.8}
              roughness={0.4}
              emissive={hot ? '#F59E0B' : '#000000'}
              emissiveIntensity={hot ? 0.5 : 0}
            />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.7]}>
            <cylinderGeometry args={[0.32, 0.32, 1.2, 24]} />
            <meshStandardMaterial
              color={hot ? '#F59E0B' : '#4B5563'}
              metalness={0.8}
              roughness={0.4}
              emissive={hot ? '#F59E0B' : '#000000'}
              emissiveIntensity={hot ? 0.5 : 0}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

function Balls({
  sensors,
  exploded,
  rpm,
  selected,
  onSelect,
}: {
  sensors: LiveSensor[];
  exploded: boolean;
  rpm: number;
  selected: SelectedPart;
  onSelect: (part: SelectedPart) => void;
}) {
  const ballsRef = useRef<THREE.Group>(null);
  const meshRefs = useRef<(THREE.Mesh | null)[]>([]);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  useFrame((_, delta) => {
    const g = ballsRef.current;
    if (!g) return;
    // Ring spins ONLY when assembled — when exploded the train holds perfectly
    // still. Continuous rotation at close camera range reads as glitchy
    // zooming in/out, so the exploded view must be rock-solid static.
    if (!exploded) {
      const speed = (rpm / 15000) * 1.4 + 0.08;
      g.rotation.z += speed * delta * 0.9;
    }
    // Each ball flies to its own slot. When exploded, the whole ball train
    // lifts out as ONE clean ring in front of the assembly — a single radius
    // on a single z-plane — so it reads as a coherent suit-plate like the
    // races, never a scattered cloud of floating orbs. Safety comes from
    // IN-PLANE torus-hole clearance, not z-separation: at radius 1.7 (the
    // pitch circle) the rotating ring stays inside every torus hole at ALL
    // angles — outer race hole 1.91 (nearest approach 2.55−1.7 = 0.85),
    // inner race hole 0.88 (nearest 0.75), cage hole 1.66 (cage center is
    // 2.80 from origin → nearest 1.10), shaft (cylinder r 0.5 + ball 0.2 =
    // 0.7 < 1.06). The z=2.5 plate keeps the train visually in front of the
    // parts, which read as separate plates behind it.
    // Angle is a pure function of the SLOT INDEX with a fixed slot count —
    // never sensors.length — so the ring geometry is rock-stable no matter
    // how the live feed churns.
    meshRefs.current.forEach((m, i) => {
      if (!m) return;
      // Phase-shift the ring when exploded so no ball sits exactly on the
      // 45°/135° corner diagonals (keeps the corner chips clear of the ring)
      const a = (i / BALL_SLOTS) * Math.PI * 2 + (exploded ? Math.PI / 8 : 0);
      const targetR = BALL_PITCH;
      const targetZ = exploded ? 2.5 : 0;
      const r = THREE.MathUtils.damp(m.userData.r ?? BALL_PITCH, targetR, 6, delta);
      const z = THREE.MathUtils.damp(m.userData.z ?? 0, targetZ, 6, delta);
      m.userData.r = r;
      m.userData.z = z;
      m.position.set(Math.cos(a) * r, Math.sin(a) * r, z);
    });
  });

  const selectedId = selected?.sensor?.id;

  return (
    <group ref={ballsRef}>
      {/* Key by SLOT INDEX ONLY — never by sensor id. The feed rotates ids
          every tick; an id-keyed mesh unmounts/remounts, its z damp resets
          to 0, and the ball visibly re-fly-ins = the glitch you kept seeing.
          With index keys the meshes live forever and telemetry just updates
          in place. */}
      {Array.from({ length: BALL_SLOTS }, (_, i) => {
        const s = sensors[i];
        if (!s) return null;
        const active = hoverIdx === i || selectedId === s.id;
        const color = STATUS_COLOR[s.status] || STATUS_COLOR.healthy;
        return (
          <mesh
            key={i}
            ref={(m) => {
              meshRefs.current[i] = m;
            }}
            onPointerOver={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              setHoverIdx(i);
            }}
            onPointerOut={() => setHoverIdx(null)}
            onClick={(e: ThreeEvent<PointerEvent>) => {
              e.stopPropagation();
              onSelect(selectedId === s.id ? null : { name: 'Ball Element', sensor: s });
            }}
            // NOTE: no scale-on-hover — inflating a ball would push it past the
            // raceway edges (radius 0.20 → 0.27 at 1.35x pokes 0.06 into the
            // outer race). Highlight via a camera-facing glow ring instead.
          >
            <sphereGeometry args={[BALL_RADIUS, 24, 24]} />
            {/* REAL polished-steel balls — the resting body carries ZERO status
                color (no green/yellow/orange glow at all, matching the races).
                Live health is surfaced only on hover/selection: the ball turns
                white, a status-colored glow ring wraps it, and the SN tooltip
                shows the numbers. At rest the train reads as one clean steel
                ball set — not colored candy. */}
            <meshStandardMaterial
              color={active ? '#ffffff' : '#D3DBE6'}
              emissive={active ? color : '#262E3C'}
              emissiveIntensity={active ? 0.55 : 0.3}
              metalness={0.7}
              roughness={0.2}
              envMapIntensity={1.4}
            />
            {active && (
              <Billboard>
                <mesh position={[0, 0, 0.02]}>
                  <torusGeometry args={[0.3, 0.02, 10, 48]} />
                  <meshBasicMaterial color={color} transparent opacity={0.9} />
                </mesh>
              </Billboard>
            )}
            {selectedId === s.id && (
              <Html center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none', transform: 'translateY(-30px)' }}>
                <div className="bg-[#0A0E1A]/95 border border-amber/40 rounded-lg px-2.5 py-1.5 font-mono-data text-[10px] text-white whitespace-nowrap shadow-xl">
                  <span style={{ color }}>●</span> {s.id}
                  <div className="text-slate-400">{s.location}</div>
                  <div className="text-amber">{s.healthScore}% · {s.accel_z.toFixed(2)}g</div>
                </div>
              </Html>
            )}
          </mesh>
        );
      })}
    </group>
  );
}

function BearingRig(props: BearingSceneProps) {
  const { sensors, exploded, showLabels, selected, onSelect } = props;
  const outerRef = useRef<THREE.Group>(null);
  const innerRef = useRef<THREE.Group>(null);
  const cageRef = useRef<THREE.Group>(null);
  const shaftRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    const refs: Record<string, RefObject<THREE.Group | null>> = { outer: outerRef, inner: innerRef, cage: cageRef, shaft: shaftRef };
    const keys: Record<string, string> = { outer: 'Outer Race', inner: 'Inner Race', cage: 'Cage', shaft: 'Shaft' };
    Object.entries(refs).forEach(([k, ref]) => {
      const g = ref.current;
      if (!g) return;
      const target = exploded ? EXPLODED_POS[keys[k]] : [0, 0, 0];
      g.position.x = THREE.MathUtils.damp(g.position.x, target[0], 6, delta);
      g.position.y = THREE.MathUtils.damp(g.position.y, target[1], 6, delta);
      g.position.z = THREE.MathUtils.damp(g.position.z, target[2], 6, delta);
      const rot = exploded ? EXPLODED_ROT[keys[k]] : [0, 0, 0];
      g.rotation.x = THREE.MathUtils.damp(g.rotation.x, rot[0], 6, delta);
      g.rotation.y = THREE.MathUtils.damp(g.rotation.y, rot[1], 6, delta);
      g.rotation.z = THREE.MathUtils.damp(g.rotation.z, rot[2], 6, delta);
    });
  });

  const selectPart = (name: string) => {
    const next: SelectedPart = selected?.name === name ? null : { name };
    onSelect(next);
  };

  const labelPos = (name: string): [number, number, number] => {
    const base = exploded ? EXPLODED_POS[name] : PART_POS[name];
    const off = exploded ? LABEL_OFFSET[name] : [0, 0.9, 0];
    return [base[0] + off[0], base[1] + off[1], base[2] + off[2]];
  };

  return (
    <>
      <group>
        {/* Shaft */}
        <group ref={shaftRef}>
          <PartLabel label="Shaft" selected={selected?.name === 'Shaft'} onSelect={selectPart} />
        </group>

        {/* Outer race */}
        <group ref={outerRef}>
          <PartLabel label="Outer Race" selected={selected?.name === 'Outer Race'} onSelect={selectPart} />
        </group>

        {/* Inner race */}
        <group ref={innerRef}>
          <PartLabel label="Inner Race" selected={selected?.name === 'Inner Race'} onSelect={selectPart} />
        </group>

        {/* Cage */}
        <group ref={cageRef}>
          <PartLabel label="Cage" selected={selected?.name === 'Cage'} onSelect={selectPart} />
        </group>

        {/* Balls */}
        <Balls sensors={sensors} exploded={exploded} rpm={props.rpm} selected={selected} onSelect={onSelect} />
      </group>

      {/* Selected part tooltip (races/cage/shaft) */}
      {showLabels && selected && !selected.sensor && (() => {
        const pos = labelPos(selected.name);
        return (
          <Html position={pos} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className="bg-[#0A0E1A]/95 border border-amber/40 rounded-lg px-3 py-2 font-mono-data text-[11px] text-white shadow-xl">
              <div className="text-amber font-bold mb-0.5">{selected.name}</div>
              <div className="text-slate-400">{PART_INFO[selected.name] || ''}</div>
            </div>
          </Html>
        );
      })()}

      {/* Static labels toggle */}
      {showLabels &&
        !selected &&
        (['Outer Race', 'Inner Race', 'Cage', 'Shaft'] as const).map((name) => (
          <Html key={name} position={labelPos(name)} center distanceFactor={9} zIndexRange={[10, 0]} style={{ pointerEvents: 'none' }}>
            <div className="text-[9px] tracking-[0.15em] text-slate-400 uppercase font-bold">{name}</div>
          </Html>
        ))}
    </>
  );
}

function CameraRig({
  exploded,
  focusKey,
  controlsRef,
}: {
  exploded: boolean;
  focusKey?: string | null;
  controlsRef: RefObject<any>;
}) {
  const desired = useRef<{ pos: THREE.Vector3; target: THREE.Vector3 } | null>(null);
  const settling = useRef(false);
  const lastKey = useRef('');

  const computeDesired = (c: any) => {
    const cam = c.object;
    if (exploded && focusKey) {
      const p =
        focusKey === 'Ball Element'
          ? new THREE.Vector3(0, 0, 2.6)
          : new THREE.Vector3(...(EXPLODED_POS[focusKey] ?? [0, 0, 1.6]));
      // Sit along a diagonal from the part so the plate reads 3D, not flat.
      const dir = p
        .clone()
        .normalize()
        .add(new THREE.Vector3(0.55, 0.4, 0.35))
        .normalize();
      return { pos: p.clone().add(dir.multiplyScalar(5.6)), target: p.clone() };
    }
    const dist = exploded ? 16 : 7.6;
    const dir = cam.position.clone().normalize();
    return { pos: dir.multiplyScalar(dist), target: new THREE.Vector3(0, 0, exploded ? 0.6 : 0) };
  };

  // Re-arm the dolly whenever the focus state changes. OrbitControls mounts
  // asynchronously inside Canvas, so retry until its ref is live.
  useEffect(() => {
    const key = `${exploded}|${focusKey ?? ''}`;
    if (key === lastKey.current) return;
    lastKey.current = key;
    let raf = 0;
    const arm = () => {
      const c = controlsRef.current;
      if (!c) {
        raf = requestAnimationFrame(arm);
        return;
      }
      desired.current = computeDesired(c);
      settling.current = true;
      // If the user grabs the camera mid-settle, hand over immediately —
      // never fight their drag.
      c.addEventListener?.('start', cancelSettle);
    };
    arm();
    return () => {
      cancelAnimationFrame(raf);
      controlsRef.current?.removeEventListener?.('start', cancelSettle);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploded, focusKey]);

  const cancelSettle = () => {
    settling.current = false;
    controlsRef.current?.removeEventListener?.('start', cancelSettle);
  };

  // Ease the camera toward the desired pose, then hand control back to
  // OrbitControls for free orbit. This is a one-directional damp — it can
  // never oscillate, so no zoom in/out glitching.
  useFrame((_, delta) => {
    const c = controlsRef.current;
    if (!c || !settling.current || !desired.current) return;
    const cam = c.object;
    const d = desired.current;
    const k = Math.min(1, delta * 6);
    cam.position.lerp(d.pos, k);
    c.target.lerp(d.target, k);
    if (cam.position.distanceTo(d.pos) < 0.03 && c.target.distanceTo(d.target) < 0.03) {
      cam.position.copy(d.pos);
      c.target.copy(d.target);
      cancelSettle();
    }
    c.update();
  });

  return null;
}

function Scene(props: BearingSceneProps) {
  const controlsRef = useRef<any>(null);
  const handlePointerMissed = () => props.onSelect(null);

  return (
    <>
      <Canvas
        dpr={[1, 2]}
        camera={{ position: [0, 1.65, 11], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
        onPointerMissed={handlePointerMissed}
      >
        <ambientLight intensity={0.45} />
        <directionalLight position={[5, 6, 5]} intensity={1.1} color="#ffffff" castShadow />
        <directionalLight position={[-6, -2, -4]} intensity={0.5} color="#3B82F6" />
        <pointLight position={[0, 0, 3.5]} intensity={2.4} color="#F59E0B" distance={9} />
        <BearingRig {...props} />
        <CameraRig exploded={props.exploded} focusKey={props.focusKey} controlsRef={controlsRef} />
        <ContactShadows position={[0, -3.2, 0]} opacity={0.45} scale={16} blur={2.8} far={5} color="#000000" />
        <Environment resolution={64} frames={1}>
          <Lightformer intensity={1.4} color="#F59E0B" position={[4, 3, 4]} scale={[5, 5, 1]} />
          <Lightformer intensity={0.8} color="#60A5FA" position={[-4, -2, 3]} scale={[5, 5, 1]} />
          <Lightformer intensity={0.6} color="#ffffff" position={[0, 4, -2]} scale={[7, 2, 1]} />
        </Environment>
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          // Damping OFF — the CameraRig eases the camera itself. Two dampers
          // fighting the same camera is what produced the zoom glitching.
          minDistance={4.5}
          maxDistance={20}
          autoRotate={props.autoRotate}
          autoRotateSpeed={1.1}
        />
      </Canvas>
      {/* Reset control */}
      <button
        onClick={() => controlsRef.current?.reset()}
        className="absolute bottom-3 right-3 z-20 bg-[#0F1629]/85 backdrop-blur border border-navy hover:border-amber/50 text-slate-300 hover:text-amber text-[11px] font-mono-data px-2.5 py-1.5 rounded-md transition-colors"
      >
        ⟲ Reset View
      </button>
    </>
  );
}

export default function BearingScene(props: BearingSceneProps) {
  return <Scene {...props} />;
}
