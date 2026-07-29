import { Component, type ReactNode, useState, useEffect } from 'react';
import { useRef } from 'react';

// Lazy-load Three.js components only when WebGL is confirmed available
let ThreeCanvas: React.ComponentType<React.ComponentProps<'canvas'>> | null = null;

function checkWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    return !!ctx;
  } catch {
    return false;
  }
}

function CSSBearingFallback() {
  return (
    <div
      style={{
        width: '100%',
        height: '400px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        position: 'relative',
      }}
    >
      <style>{`
        @keyframes bearingRotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes bearingRotateRev { from { transform: rotate(0deg); } to { transform: rotate(-360deg); } }
        @keyframes ballOrbit { from { transform: rotate(0deg) translateX(88px) rotate(0deg); } to { transform: rotate(360deg) translateX(88px) rotate(-360deg); } }
        @keyframes amberGlow { 0%,100% { box-shadow: 0 0 30px rgba(245,158,11,0.25), 0 0 60px rgba(245,158,11,0.08); } 50% { box-shadow: 0 0 50px rgba(245,158,11,0.45), 0 0 100px rgba(245,158,11,0.15); } }
      `}</style>

      <div style={{ position: 'relative', width: '240px', height: '240px', animation: 'amberGlow 3s ease-in-out infinite' }}>
        {/* Outer race */}
        <div style={{
          position: 'absolute', inset: 0, borderRadius: '50%',
          border: '18px solid #4B5563',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.6), 0 0 2px rgba(255,255,255,0.05)',
          animation: 'bearingRotate 10s linear infinite',
          background: 'conic-gradient(from 0deg, #374151, #6B7280, #374151, #6B7280, #374151)',
        }} />
        {/* Cage */}
        <div style={{
          position: 'absolute', inset: '20px', borderRadius: '50%',
          border: '3px solid #F59E0B',
          opacity: 0.8,
          animation: 'bearingRotateRev 7s linear infinite',
        }} />
        {/* Inner race */}
        <div style={{
          position: 'absolute', inset: '58px', borderRadius: '50%',
          border: '14px solid #374151',
          boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.7)',
          background: 'conic-gradient(from 0deg, #374151, #4B5563, #374151, #4B5563, #374151)',
          animation: 'bearingRotate 5s linear infinite',
        }} />
        {/* Hub */}
        <div style={{
          position: 'absolute', inset: '95px', borderRadius: '50%',
          background: 'radial-gradient(circle at 35% 35%, #1E2D4A, #0A0E1A)',
          border: '1px solid #1E2D4A',
        }} />
        {/* Steel balls */}
        {Array.from({ length: 8 }, (_, i) => (
          <div key={i} style={{
            position: 'absolute',
            top: '50%', left: '50%',
            width: '18px', height: '18px',
            marginTop: '-9px', marginLeft: '-9px',
            animation: `ballOrbit 5.5s linear infinite`,
            animationDelay: `${-(i / 8) * 5.5}s`,
          }}>
            <div style={{
              width: '18px', height: '18px', borderRadius: '50%',
              background: 'radial-gradient(circle at 35% 30%, #E5E7EB, #6B7280)',
              boxShadow: '0 2px 6px rgba(0,0,0,0.6), inset 0 1px 2px rgba(255,255,255,0.2)',
            }} />
          </div>
        ))}

        {/* Part labels */}
        <div style={{ position: 'absolute', top: '-22px', left: '50%', transform: 'translateX(-50%)', color: '#94A3B8', fontSize: '9px', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>OUTER RACE</div>
        <div style={{ position: 'absolute', bottom: '-22px', left: '50%', transform: 'translateX(-50%)', color: '#94A3B8', fontSize: '9px', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>INNER RACE</div>
        <div style={{ position: 'absolute', top: '50%', right: '-48px', transform: 'translateY(-50%)', color: '#F59E0B', fontSize: '9px', letterSpacing: '0.1em' }}>CAGE</div>
        <div style={{ position: 'absolute', top: '50%', left: '-68px', transform: 'translateY(-50%)', color: '#94A3B8', fontSize: '9px', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>BALL ELEMENT</div>
      </div>
    </div>
  );
}

function ThreeJSBearing() {
  const groupRef = useRef<import('three').Group>(null);
  const ballsRef = useRef<import('three').Group>(null);

  // Dynamically import to avoid any module-level errors
  const [R3F, setR3F] = useState<{ Canvas: any; useFrame: any } | null>(null);
  const [Drei, setDrei] = useState<{ OrbitControls: any } | null>(null);
  const [Three, setThree] = useState<typeof import('three') | null>(null);

  useEffect(() => {
    Promise.all([
      import('@react-three/fiber'),
      import('@react-three/drei'),
      import('three'),
    ]).then(([r3f, drei, three]) => {
      setR3F({ Canvas: r3f.Canvas, useFrame: r3f.useFrame });
      setDrei({ OrbitControls: drei.OrbitControls });
      setThree(three);
    }).catch(() => {});
  }, []);

  if (!R3F || !Drei || !Three) return <CSSBearingFallback />;

  const { Canvas } = R3F;
  const { OrbitControls } = Drei;

  function BearingGeometry() {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    R3F!.useFrame((state: any) => {
      if (groupRef.current) {
        groupRef.current.rotation.y += 0.005;
        groupRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.3) * 0.05;
      }
      if (ballsRef.current) {
        ballsRef.current.rotation.z += 0.008;
      }
    });

    const balls = Array.from({ length: 8 }, (_, i) => {
      const angle = (i / 8) * Math.PI * 2;
      return { x: Math.cos(angle) * 1.5, y: Math.sin(angle) * 1.5 };
    });

    return (
      <group ref={groupRef}>
        <mesh><torusGeometry args={[2, 0.3, 16, 100]} /><meshStandardMaterial color="#6B7280" metalness={0.8} roughness={0.2} /></mesh>
        <mesh><torusGeometry args={[1, 0.3, 16, 100]} /><meshStandardMaterial color="#6B7280" metalness={0.8} roughness={0.2} /></mesh>
        <mesh><torusGeometry args={[1.5, 0.05, 8, 100]} /><meshStandardMaterial color="#F59E0B" metalness={0.6} roughness={0.3} /></mesh>
        <group ref={ballsRef}>
          {balls.map((pos, i) => (
            <mesh key={i} position={[pos.x, pos.y, 0]}>
              <sphereGeometry args={[0.25, 16, 16]} />
              <meshStandardMaterial color="#9CA3AF" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
        <pointLight color="#F59E0B" intensity={2} distance={5} />
      </group>
    );
  }

  return (
    <div style={{ width: '100%', height: '400px' }}>
      <Canvas camera={{ position: [0, 0, 6], fov: 50 }} style={{ background: 'transparent' }}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} color="#ffffff" />
        <directionalLight position={[-5, -2, -3]} intensity={0.3} color="#3B82F6" />
        <BearingGeometry />
        <OrbitControls enableZoom={false} enablePan={false} dampingFactor={0.05} enableDamping />
      </Canvas>
    </div>
  );
}

class BearingErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <CSSBearingFallback />;
    return this.props.children;
  }
}

export default function BearingModel() {
  const [webGLAvailable] = useState(() => checkWebGL());

  if (!webGLAvailable) return <CSSBearingFallback />;

  return (
    <BearingErrorBoundary>
      <ThreeJSBearing />
    </BearingErrorBoundary>
  );
}
