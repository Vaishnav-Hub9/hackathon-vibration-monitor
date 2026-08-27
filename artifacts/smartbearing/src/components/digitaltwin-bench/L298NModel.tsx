/**
 * L298N3D — procedural model of the L298N dual H-bridge motor driver.
 *
 * Shows the heat sink, terminal blocks, enable jumper, and status LEDs.
 * The heat sink color shifts from blue→yellow→red as the motor current increases.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '@/simulation/engineRef';
import { useDigitalTwinStore } from '@/simulation/store';

const BOARD_W = 1.8;
const BOARD_D = 1.4;
const BOARD_H = 0.08;

interface L298NModelProps {
  position?: [number, number, number];
  selected?: boolean;
}

export default function L298NModel({ position = [0, 0, 0], selected }: L298NModelProps) {
  const heatSinkRef = useRef<THREE.MeshStandardMaterial>(null);
  const ledRef = useRef<THREE.MeshStandardMaterial>(null);
  const setSelected = useDigitalTwinStore((s) => s.setSelectedComponent);
  const isSelected = selected ?? false;

  useFrame(() => {
    const motor = engine.snapshot(performance.now()).motor;
    // Heat sink color: current-dependent thermal glow
    if (heatSinkRef.current) {
      const current = Math.min(1, motor.current / 2);
      const r = 0.3 + current * 0.7;
      const g = 0.3 + (1 - current) * 0.3;
      const b = 0.3 + (1 - current) * 0.5;
      heatSinkRef.current.color.setRGB(r, g, b);
      heatSinkRef.current.emissive.setRGB(current * 0.3, 0, 0);
      heatSinkRef.current.emissiveIntensity = current * 0.5;
    }
    // Status LED: ON when motor is spinning
    if (ledRef.current) {
      const active = motor.rpm > 0;
      ledRef.current.emissive.set(active ? '#10B981' : '#000000');
      ledRef.current.emissiveIntensity = active ? 2 : 0;
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : 'l298n'); }}>
      {/* PCB */}
      <mesh castShadow>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_D]} />
        <meshStandardMaterial color="#2a3a9e" roughness={0.5} metalness={0.2} />
      </mesh>

      {/* Heat sink — tall finned block */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[0.9, 0.5, 0.8]} />
        <meshStandardMaterial
          ref={heatSinkRef}
          color="#888888"
          roughness={0.3}
          metalness={0.8}
          emissive="#000000"
          emissiveIntensity={0}
        />
      </mesh>
      {/* Heat sink fins */}
      {Array.from({ length: 5 }).map((_, i) => (
        <mesh key={i} position={[-0.36 + i * 0.18, 0.35, 0]}>
          <boxGeometry args={[0.02, 0.5, 0.8]} />
          <meshStandardMaterial color="#666" roughness={0.4} metalness={0.9} />
        </mesh>
      ))}

      {/* Screw terminal blocks — input (12V, GND, 5V) */}
      <group position={[-BOARD_W / 2 + 0.15, 0.12, 0]}>
        {[0, 0.25, 0.5].map((z, i) => (
          <group key={i} position={[0, 0, -0.25 + z]}>
            <mesh>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color="#222" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
        {/* Labels */}
        
        
        
      </group>

      {/* Output terminal blocks (OUT1, OUT2) */}
      <group position={[BOARD_W / 2 - 0.15, 0.12, 0]}>
        {[0, 0.3].map((z, i) => (
          <group key={i} position={[0, 0, -0.15 + z]}>
            <mesh>
              <boxGeometry args={[0.2, 0.2, 0.2]} />
              <meshStandardMaterial color="#222" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.12, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.06, 12]} />
              <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
            </mesh>
          </group>
        ))}
        
        
      </group>

      {/* ENA jumper (removable for PWM control) */}
      <mesh position={[-0.5, 0.12, -BOARD_D / 2 + 0.15]}>
        <boxGeometry args={[0.12, 0.1, 0.08]} />
        <meshStandardMaterial color="#F59E0B" roughness={0.4} metalness={0.5} />
      </mesh>
      

      {/* IN1, IN2 pin headers */}
      {[
        { pos: [0.2, 0.12, -BOARD_D / 2 - 0.06] as [number, number, number], label: 'IN1' },
        { pos: [0.5, 0.12, -BOARD_D / 2 - 0.06] as [number, number, number], label: 'IN2' },
      ].map(({ pos, label }) => (
        <group key={label} position={pos}>
          <mesh>
            <boxGeometry args={[0.06, 0.22, 0.06]} />
            <meshStandardMaterial color="#C0C0C0" metalness={0.9} roughness={0.2} />
          </mesh>
          
        </group>
      ))}

      {/* Status LED */}
      <mesh position={[BOARD_W / 2 - 0.2, 0.12, -BOARD_D / 2 + 0.15]}>
        <sphereGeometry args={[0.035, 10, 10]} />
        <meshStandardMaterial
          ref={ledRef}
          color="#10B981"
          emissive="#10B981"
          emissiveIntensity={0}
        />
      </mesh>

      {/* L298N chip */}
      <mesh position={[0, BOARD_H / 2 + 0.05, 0]}>
        <boxGeometry args={[0.5, 0.04, 0.3]} />
        <meshStandardMaterial color="#111" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* Board label */}
      

      {/* Selection highlight */}
      {selected && (
        <mesh position={[0, -0.03, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.1, 1.3, 48]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
