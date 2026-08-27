/**
 * DCMotor3D — procedural 3D model of the DC motor with rotor shaft.
 *
 * The shaft spins at the RPM computed by the physics engine. Motor body
 * glows with thermal heatmap based on winding temperature.
 * Includes encoder disk on the shaft for the IR tachometer.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

// Text removed - labels via HTML overlay
import { engine } from '@/simulation/engineRef';
import { useDigitalTwinStore } from '@/simulation/store';

interface DCMotorModelProps {
  position?: [number, number, number];
  selected?: boolean;
}

export default function DCMotorModel({ position = [0, 0, 0], selected }: DCMotorModelProps) {
  const shaftRef = useRef<THREE.Mesh>(null);
  const diskRef = useRef<THREE.Mesh>(null);
  const bodyMatRef = useRef<THREE.MeshStandardMaterial>(null);
  const setSelected = useDigitalTwinStore((s) => s.setSelectedComponent);
  const isSelected = selected ?? false;

  useFrame((_, delta) => {
    const snap = engine.snapshot(performance.now());
    const motor = snap.motor;
    const thermal = snap.thermal;
    // Shaft rotation
    if (shaftRef.current) {
      shaftRef.current.rotation.z += (motor.rpm / 60) * Math.PI * 2 * delta;
    }
    if (diskRef.current) {
      diskRef.current.rotation.z += (motor.rpm / 60) * Math.PI * 2 * delta;
    }

    // Thermal heatmap on motor body
    if (bodyMatRef.current) {
      const tempNorm = Math.min(1, Math.max(0, (thermal.motorTemp - 25) / 80));
      const r = Math.min(1, tempNorm * 2);
      const g = Math.max(0, 1 - tempNorm * 1.5);
      const b = Math.max(0, 0.3 - tempNorm * 0.3);
      bodyMatRef.current.emissive.setRGB(r * 0.25, g * 0.05, b * 0.05);
      bodyMatRef.current.emissiveIntensity = tempNorm > 0.1 ? 0.6 : 0;
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : 'motor'); }}>
      {/* Motor body — cylindrical housing */}
      <mesh rotation={[Math.PI / 2, 0, 0]} castShadow>
        <cylinderGeometry args={[0.35, 0.35, 1.2, 32]} />
        <meshStandardMaterial
          ref={bodyMatRef}
          color="#7a8a9a"
          roughness={0.5}
          metalness={0.7}
          emissive="#000000"
          emissiveIntensity={0}
        />
      </mesh>

      {/* Motor end caps */}
      {[-0.62, 0.62].map((z) => (
        <mesh key={z} position={[0, 0, z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.36, 0.36, 0.04, 32]} />
          <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.8} />
        </mesh>
      ))}

      {/* Shaft — extends through the motor */}
      <mesh ref={shaftRef} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 2.0, 16]} />
        <meshStandardMaterial color="#9CA3AF" roughness={0.15} metalness={0.95} />
      </mesh>

      {/* Encoder slotted disk (for IR tachometer) */}
      <group ref={diskRef}>
        <mesh position={[0, 0, 0.85]}>
          <cylinderGeometry args={[0.22, 0.22, 0.02, 32]} />
          <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.3} />
        </mesh>
        {/* Slot markers */}
        {Array.from({ length: 20 }).map((_, i) => {
          const angle = (i / 20) * Math.PI * 2;
          return (
            <mesh
              key={i}
              position={[Math.cos(angle) * 0.17, Math.sin(angle) * 0.17, 0.86]}
            >
              <boxGeometry args={[0.015, 0.015, 0.02]} />
              <meshStandardMaterial color="#444" roughness={0.5} />
            </mesh>
          );
        })}
      </group>

      {/* Motor terminals (solder tabs) */}
      {[-0.15, 0.15].map((z, i) => (
        <mesh key={i} position={[0.38, 0, z]}>
          <boxGeometry args={[0.08, 0.04, 0.12]} />
          <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
        </mesh>
      ))}

      {/* Mounting bracket */}
      <mesh position={[0, -0.42, 0]}>
        <boxGeometry args={[0.8, 0.06, 0.4]} />
        <meshStandardMaterial color="#2d3748" roughness={0.6} metalness={0.7} />
      </mesh>

      {/* Board label */}
      

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, 0, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.6, 0.75, 48]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
