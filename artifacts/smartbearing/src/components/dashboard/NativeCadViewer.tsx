import { Component, Suspense, useMemo, useRef, useState, type ReactNode } from 'react';
import { Canvas, useFrame, useLoader } from '@react-three/fiber';
import { OrbitControls, ContactShadows, Bounds } from '@react-three/drei';
import * as THREE from 'three';
import { Eye, EyeOff } from 'lucide-react';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

export interface CadPart {
  url: string;
  name: string;
  color: string;
}

export interface PartLive {
  temperature: number;
  vibration: number;
  health: number;
  anomaly: number;
}

// A loader failure (corrupt/HTML file served as a model) must never blank the
// whole page — show a graceful message instead.
class CadErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div className="w-full h-full flex items-center justify-center text-slate-400 text-sm px-6 text-center">
          Couldn't load the CAD model — check the files in public/models/.
        </div>
      );
    }
    return this.props.children;
  }
}

// Maps the trained model's fault classes onto the named CAD parts so the
// viewer can point at the exact broken component. The 6 classes match
// label_encoder.pkl: Healthy, Imbalance, Misalignment, Ball, Inner Race, Outer Race.
export const faultLabelToPart = (label?: string | null): string | null => {
  if (!label || label === 'Healthy') return null;
  if (label === 'Inner Race') return 'Inner Race';
  if (label === 'Outer Race') return 'Outer Race';
  if (label === 'Ball') return 'Rolling Element';
  // Imbalance / Misalignment are rotor-shaft faults — no single bearing part.
  return null;
};

interface NativeCadViewerProps {
  parts: CadPart[];
  live?: Record<string, PartLive>;
  autoRotate?: boolean;
  /** Live ML fault label — the matching part pulses red + gets a FAULT badge. */
  faultLabel?: string | null;
}

export const healthTone = (health: number) =>
  health >= 70 ? '#10B981' : health >= 40 ? '#F59E0B' : '#EF4444';

// Heat-map the part's base color toward amber/red as its health drops, so the
// CAD geometry visually "reads" the live sensor stream from each part.
const WARM_COLOR = new THREE.Color('#F59E0B');
const HOT_COLOR = new THREE.Color('#EF4444');

function heatColor(base: string, health: number): string {
  const c = new THREE.Color(base);
  if (health >= 70) return `#${c.getHexString()}`;
  
  const t = clamp((70 - health) / 70, 0, 1);
  c.lerp(WARM_COLOR, Math.min(1, t * 1.4));
  if (health < 40) {
    c.lerp(HOT_COLOR, clamp((40 - health) / 40, 0, 1));
  }
  return `#${c.getHexString()}`;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

const glowIntensity = (health: number) => (health < 40 ? 0.55 : health < 70 ? 0.22 : 0.05);

/**
 * Renders real CAD exports (STL/GLB) placed in the app's public/models folder
 * as a multi-part assembly — each part gets its own material color and a
 * toggle chip so the model can be dismantled piece-by-piece (Iron-Man style).
 * When `live` readings are supplied, each part's color heat-maps to its
 * health and the legend chips stream the current temperature / vibration.
 */
export default function NativeCadViewer({ parts, live, autoRotate = false, faultLabel = null }: NativeCadViewerProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

  // The faulty part name resolved from the live ML verdict — pulses red in 3D.
  const faultPart = useMemo(() => faultLabelToPart(faultLabel), [faultLabel]);

  const visible = parts.filter((p) => !hidden.has(p.url));

  const togglePart = (url: string) => {
    // Never hide the last visible part — Bounds with zero geometry would push
    // the camera to NaN and blank the canvas.
    const part = parts.find((p) => p.url === url);
    if (part && !hidden.has(url) && visible.length === 1) return;
    setHidden((prev) => {
      const next = new Set(prev);
      if (next.has(url)) next.delete(url);
      else next.add(url);
      return next;
    });
  };

  return (
    <div className="relative w-full h-full">
      <CadErrorBoundary>
        <Canvas
          camera={{ position: [5, 4, 7], fov: 42 }}
          style={{ background: 'radial-gradient(ellipse at center, #16213e 0%, #0a0e1a 70%)' }}
        >
          <ambientLight intensity={0.55} />
          <directionalLight position={[6, 10, 6]} intensity={1.4} />
          <directionalLight position={[-6, -4, -6]} intensity={0.35} color="#3b82f6" />
          <Suspense fallback={null}>
            {/* Fit ONCE on mount — `observe` refits the camera whenever the
                bounding box recomputes, which made the model appear to
                glitch/zoom in and out on live-data re-renders. */}
            {visible.length > 0 && (
              <Bounds fit clip margin={1.25}>
                {visible.map((p) => (
                  <PartMesh
                    key={p.url}
                    part={p}
                    live={live?.[p.url]}
                    fault={faultPart !== null && p.name === faultPart}
                  />
                ))}
              </Bounds>
            )}
          </Suspense>
          <ContactShadows position={[0, -1.6, 0]} opacity={0.5} scale={10} blur={2.6} far={4} />
          <OrbitControls
            makeDefault
            enablePan={false}
            minDistance={0.5}
            maxDistance={60}
            autoRotate={autoRotate}
            autoRotateSpeed={1.1}
          />
        </Canvas>
      </CadErrorBoundary>

      {/* Part legend / visibility toggles with live streaming values */}
      {parts.length > 1 && (
        <div className="absolute top-3 right-3 flex flex-col gap-1.5 w-[190px]">
          {parts.map((p) => {
            const off = hidden.has(p.url);
            const lv = live?.[p.url];
            const tone = lv ? healthTone(lv.health) : p.color;
            return (
              <button
                key={p.url}
                onClick={() => togglePart(p.url)}
                className={`rounded-lg border text-[11px] font-medium backdrop-blur-sm transition-all px-2.5 py-1.5 ${
                  off
                    ? 'border-navy bg-[#0A0E1A]/70 text-slate-500 opacity-60'
                    : faultPart !== null && p.name === faultPart
                      ? 'border-[#EF4444]/60 bg-[#EF4444]/15 text-red-300'
                      : 'border-navy bg-[#0A0E1A]/85 text-slate-200 hover:border-slate-500 hover:bg-[#0F1629]'
                }`}
                title={off ? `Show ${p.name}` : `Hide ${p.name}`}
              >
                <div className="flex items-center gap-2 w-full">
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0 animate-pulse"
                    style={{ backgroundColor: off ? '#334155' : tone }}
                  />
                  <span className="truncate">{p.name}</span>
                  {faultPart !== null && p.name === faultPart && !off && (
                    <span className="ml-auto flex-shrink-0 text-[8px] font-bold tracking-wider px-1.5 py-0.5 rounded bg-[#EF4444] text-white animate-pulse">
                      FAULT
                    </span>
                  )}
                  {faultPart !== null && p.name === faultPart && off ? null : off ? (
                    <EyeOff className="w-3 h-3 ml-auto flex-shrink-0" />
                  ) : (
                    <Eye className="w-3 h-3 ml-auto flex-shrink-0" />
                  )}
                </div>
                {lv && !off && (
                  <div className="flex items-center gap-1.5 font-mono-data text-[9px] mt-1 pl-4">
                    <span style={{ color: lv.temperature > 70 ? '#EA580C' : lv.temperature > 62 ? '#F59E0B' : '#94A3B8' }}>
                      {lv.temperature.toFixed(1)}°C
                    </span>
                    <span className="text-slate-600">·</span>
                    <span style={{ color: lv.vibration > 2 ? '#EA580C' : lv.vibration > 1.2 ? '#F59E0B' : '#94A3B8' }}>
                      {lv.vibration.toFixed(2)}g
                    </span>
                    <span className="ml-auto font-bold" style={{ color: tone }}>
                      {Math.round(lv.health)}%
                    </span>
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// Select the loader by extension in the parent so each branch calls exactly
// one unconditional hook (a single Model component with a conditional
// useLoader violates the Rules of Hooks and would fire both loaders).
function PartMesh({ part, live, fault }: { part: CadPart; live?: PartLive; fault?: boolean }) {
  return /\.stl$/i.test(part.url) ? (
    <StlModel url={part.url} color={part.color} live={live} fault={fault} />
  ) : (
    <GltfModel url={part.url} color={part.color} live={live} fault={fault} />
  );
}

// Pulses the faulty part's red glow so the eye is drawn to the broken
// component while the fault is live.
function useFaultPulse(fault: boolean | undefined, baseGlow: number) {
  const matRef = useRef<THREE.MeshStandardMaterial>(null);
  useFrame(({ clock }) => {
    const m = matRef.current;
    if (!m) return;
    if (fault) {
      m.emissiveIntensity = 0.7 + Math.sin(clock.elapsedTime * 7) * 0.45;
    } else {
      m.emissiveIntensity = baseGlow;
    }
  });
  return matRef;
}

function StlModel({ url, color, live, fault }: { url: string; color: string; live?: PartLive; fault?: boolean }) {
  const geometry = useLoader(STLLoader, url);
  geometry.computeVertexNormals();
  const health = live?.health ?? 100;
  const matColor = useMemo(() => heatColor(color, health), [color, health]);
  const emissive = useMemo(() => glowIntensity(health), [health]);
  const matRef = useFaultPulse(fault, emissive);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        ref={matRef}
        color={matColor}
        emissive="#ff2d2d"
        emissiveIntensity={emissive}
        metalness={0.8}
        roughness={0.28}
      />
    </mesh>
  );
}

function GltfModel({ url, color, live, fault }: { url: string; color: string; live?: PartLive; fault?: boolean }) {
  const gltf = useLoader(GLTFLoader, url);
  const health = live?.health ?? 100;
  const matColor = useMemo(() => heatColor(color, health), [color, health]);
  const emissive = useMemo(() => glowIntensity(health), [health]);
  const matRef = useFaultPulse(fault, emissive);
  return (
    <primitive
      object={gltf.scene}
      onUpdate={(obj: THREE.Object3D) => {
        obj.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            child.castShadow = true;
            const m = child.material as THREE.MeshStandardMaterial;
            if (m && m.isMeshStandardMaterial) {
              m.color.set(matColor);
              m.emissive.set('#ff2d2d');
              matRef.current = m;
            }
          }
        });
      }}
    />
  );
}
