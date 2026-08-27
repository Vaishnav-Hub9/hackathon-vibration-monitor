/**
 * DS18B203D + Tachometer3D — procedural models of the OneWire temperature
 * sensor and IR optical tachometer module.
 *
 * The DS18B20 body glows based on the bearing temperature it's measuring.
 * The tachometer shows the IR LED and phototransistor alignment.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
// Text removed - labels via HTML overlay
import { engine } from '@/simulation/engineRef';

// ── DS18B20 Temperature Sensor ──────────────────────────────────────────────

interface DS18B20ModelProps {
  position?: [number, number, number];
}

export function DS18B20Model({ position = [0, 0, 0] }: DS18B20ModelProps) {
  const bodyRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (bodyRef.current) {
      const snap = engine.snapshot(performance.now());
      const tempNorm = Math.min(1, Math.max(0, (snap.thermal.bearingTemp - 25) / 80));
      bodyRef.current.emissive.setRGB(tempNorm * 0.5, 0, 0);
      bodyRef.current.emissiveIntensity = tempNorm * 0.8;
    }
  });

  return (
    <group position={position}>
      {/* TO-92 package body */}
      <mesh castShadow>
        <cylinderGeometry args={[0.1, 0.1, 0.2, 16]} />
        <meshStandardMaterial
          ref={bodyRef}
          color="#222"
          roughness={0.6}
          metalness={0.2}
          emissive="#000000"
          emissiveIntensity={0}
        />
      </mesh>

      {/* Flat face marker */}
      <mesh position={[0.08, 0, 0]}>
        <boxGeometry args={[0.01, 0.18, 0.15]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.7} />
      </mesh>

      {/* Lead wires (3 pins: GND, DATA, VCC) */}
      {[-0.04, 0, 0.04].map((z, i) => (
        <mesh key={i} position={[0, -0.2, z]}>
          <cylinderGeometry args={[0.008, 0.008, 0.25, 8]} />
          <meshStandardMaterial
            color={['#6B7280', '#EF4444', '#EC4899'][i]}
            metalness={0.8}
            roughness={0.2}
          />
        </mesh>
      ))}

      {/* Pin labels */}
      
      
      

      {/* Temperature readout */}
      

      {/* Label */}
      
    </group>
  );
}

// ── IR Tachometer Module (LM393) ────────────────────────────────────────────

interface TachometerModuleProps {
  position?: [number, number, number];
}

export function TachometerModule({ position = [0, 0, 0] }: TachometerModuleProps) {
  const irRef = useRef<THREE.MeshStandardMaterial>(null);

  useFrame(() => {
    if (irRef.current) {
      const snap = engine.snapshot(performance.now());
      const pulse = snap.tachometer.interruptPulse && snap.motor.rpm > 0;
      irRef.current.emissive.set(pulse ? '#FF0000' : '#440000');
      irRef.current.emissiveIntensity = pulse ? 3 : 0.3;
    }
  });

  return (
    <group position={position}>
      {/* Module PCB */}
      <mesh castShadow>
        <boxGeometry args={[0.5, 0.06, 0.4]} />
        <meshStandardMaterial color="#1a5276" roughness={0.7} metalness={0.15} />
      </mesh>

      {/* IR LED (emitter) */}
      <mesh position={[-0.12, 0.06, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
        <meshStandardMaterial
          ref={irRef}
          color="#440000"
          emissive="#440000"
          emissiveIntensity={0.3}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Phototransistor (receiver) — across the slot */}
      <mesh position={[0.12, 0.06, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.08, 12]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.5} metalness={0.3} />
      </mesh>

      {/* U-shaped slot for the encoder disk */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[0.04, 0.12, 0.2]} />
        <meshStandardMaterial color="#222" roughness={0.5} />
      </mesh>

      {/* LM393 comparator chip */}
      <mesh position={[0, 0.04, -0.12]}>
        <boxGeometry args={[0.2, 0.02, 0.1]} />
        <meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Output wire pin */}
      <mesh position={[0.2, 0, 0]}>
        <cylinderGeometry args={[0.008, 0.008, 0.2, 8]} />
        <meshStandardMaterial color="#A855F7" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Label */}
      
      
    </group>
  );
}
