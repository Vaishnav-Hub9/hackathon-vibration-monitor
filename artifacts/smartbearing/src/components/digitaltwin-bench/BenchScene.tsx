/**
 * BenchScene — the top-level React Three Fiber scene for the SmartBearing
 * physical bench digital twin.
 */
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import ArduinoModel from './ArduinoModel';
import L298NModel from './L298NModel';
import DCMotorModel from './DCMotorModel';
import BreadboardModel from './BreadboardModel';
import { DS18B20Model, TachometerModule } from './SensorModels';
import { WireBundle } from './ParametricWire';
import { useDigitalTwinStore } from '@/simulation/store';

export default function BenchScene() {
  const selectedComponent = useDigitalTwinStore((s) => s.selectedComponent);
  const showWireLabels = useDigitalTwinStore((s) => s.showWireLabels);
  const setSelected = useDigitalTwinStore((s) => s.setSelectedComponent);

  return (
    <Canvas
      camera={{ position: [4, 5, 11], fov: 45 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ background: '#0a0e1a', width: '100%', height: '100%' }}
    >
      <ambientLight intensity={1.8} />
      <directionalLight position={[8, 10, 8]} intensity={2.5} color="#ffffff" castShadow />
      <directionalLight position={[-6, 4, -4]} intensity={1.2} color="#60A5FA" />
      <directionalLight position={[0, -2, 6]} intensity={0.8} color="#F59E0B" />
      <pointLight position={[0.5, 3, 2]} intensity={3} color="#ffffff" distance={15} />
      <hemisphereLight args={['#87CEEB', '#8B7355', 1.0]} />

      {/* Hardware components */}
      <ArduinoModel position={[-1.5, 0.15, 0]} selected={selectedComponent === 'arduino'} />
      <BreadboardModel position={[-1.5, 0.12, 1.4]} />
      <DS18B20Model position={[-1.8, 0.35, 1.4]} />
      <L298NModel position={[0.8, 0.15, 0]} selected={selectedComponent === 'l298n'} />
      <DCMotorModel position={[2.8, 0.3, 0.3]} selected={selectedComponent === 'motor'} />
      <TachometerModule position={[3.2, 0.35, -0.4]} />

      {/* Parametric wires */}
      <WireBundle showLabels={showWireLabels} />

      {/* Ground plane */}
      <ContactShadows position={[0, -0.02, 0.5]} opacity={0.5} scale={14} blur={2.5} far={6} color="#000000" />

      {/* Workbench */}
      <mesh position={[0.5, -0.05, 0.5]} receiveShadow>
        <boxGeometry args={[10, 0.08, 6]} />
        <meshStandardMaterial color="#8B7355" roughness={0.7} metalness={0.05} />
      </mesh>

      {/* Click-away deselect */}
      <mesh position={[0.5, -0.5, 0.5]} visible={false} onClick={(e) => { e.stopPropagation(); setSelected(null); }}>
        <boxGeometry args={[30, 0.01, 20]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>

      <OrbitControls enablePan minDistance={3} maxDistance={25} autoRotate autoRotateSpeed={0.3} target={[0.5, 0.2, 0.3]} />
    </Canvas>
  );
}
