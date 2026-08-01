import { Component, Suspense, useMemo, useState, type ReactNode } from 'react';
import { Canvas, useLoader } from '@react-three/fiber';
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

interface NativeCadViewerProps {
  parts: CadPart[];
  live?: Record<string, PartLive>;
  autoRotate?: boolean;
}

export const healthTone = (health: number) =>
  health >= 70 ? '#10B981' : health >= 40 ? '#F59E0B' : '#EF4444';

// Heat-map the part's base color toward amber/red as its health drops, so the
// CAD geometry visually "reads" the live sensor stream from each part.
function heatColor(base: string, health: number): string {
  const c = new THREE.Color(base);
  if (health >= 70) return `#${c.getHexString()}`;
  const warm = new THREE.Color('#F59E0B');
  const hot = new THREE.Color('#EF4444');
  const t = clamp((70 - health) / 70, 0, 1);
  c.lerp(warm, Math.min(1, t * 1.4));
  if (health < 40) {
    c.lerp(hot, clamp((40 - health) / 40, 0, 1));
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
export default function NativeCadViewer({ parts, live, autoRotate = true }: NativeCadViewerProps) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());

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
            {visible.length > 0 && (
              <Bounds fit clip observe margin={1.25}>
                {visible.map((p) => (
                  <PartMesh key={p.url} part={p} live={live?.[p.url]} />
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
                  {off ? (
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
function PartMesh({ part, live }: { part: CadPart; live?: PartLive }) {
  return /\.stl$/i.test(part.url) ? (
    <StlModel url={part.url} color={part.color} live={live} />
  ) : (
    <GltfModel url={part.url} color={part.color} live={live} />
  );
}

function StlModel({ url, color, live }: { url: string; color: string; live?: PartLive }) {
  const geometry = useLoader(STLLoader, url);
  geometry.computeVertexNormals();
  const health = live?.health ?? 100;
  const matColor = useMemo(() => heatColor(color, health), [color, health]);
  const emissive = useMemo(() => glowIntensity(health), [health]);
  return (
    <mesh geometry={geometry} castShadow>
      <meshStandardMaterial
        color={matColor}
        emissive="#ff2d2d"
        emissiveIntensity={emissive}
        metalness={0.8}
        roughness={0.28}
      />
    </mesh>
  );
}

function GltfModel({ url, color, live }: { url: string; color: string; live?: PartLive }) {
  const gltf = useLoader(GLTFLoader, url);
  const health = live?.health ?? 100;
  const matColor = useMemo(() => heatColor(color, health), [color, health]);
  const emissive = useMemo(() => glowIntensity(health), [health]);
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
              m.emissiveIntensity = emissive;
            }
          }
        });
      }}
    />
  );
}
