/**
 * ArduinoUno3D — procedural 3D model of the Arduino Uno R3.
 */
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { engine } from '@/simulation/engineRef';
import { useDigitalTwinStore } from '@/simulation/store';

const BOARD_W = 2.6;
const BOARD_D = 2.0;
const BOARD_H = 0.06;

const DIGITAL_PINS: { pin: number; pos: [number, number, number] }[] = [
  { pin: 0, pos: [-1.1, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 1, pos: [-0.9, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 2, pos: [-0.7, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 3, pos: [-0.5, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 4, pos: [-0.3, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 5, pos: [-0.1, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 6, pos: [0.1, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 7, pos: [0.3, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 8, pos: [0.5, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 9, pos: [0.7, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 10, pos: [0.9, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 11, pos: [1.1, 0.2, -BOARD_D / 2 - 0.08] },
  { pin: 12, pos: [-1.1, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 13, pos: [-0.9, 0.2, BOARD_D / 2 + 0.08] },
];

const ANALOG_PINS: { pin: number; pos: [number, number, number] }[] = [
  { pin: 14, pos: [0.1, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 15, pos: [0.3, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 16, pos: [0.5, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 17, pos: [0.7, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 18, pos: [0.9, 0.2, BOARD_D / 2 + 0.08] },
  { pin: 19, pos: [1.1, 0.2, BOARD_D / 2 + 0.08] },
];

interface ArduinoModelProps {
  position?: [number, number, number];
  selected?: boolean;
}

export default function ArduinoModel({ position = [0, 0, 0], selected }: ArduinoModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const ledRefs = useRef<(THREE.MeshStandardMaterial | null)[]>([]);
  const setSelected = useDigitalTwinStore((s) => s.setSelectedComponent);
  const isSelected = selected ?? false;

  useFrame(() => {
    const frame = engine.snapshot(performance.now());
    DIGITAL_PINS.forEach((dp, i) => {
      const mat = ledRefs.current[i];
      if (!mat) return;
      const pinState = frame.mcu.pins[dp.pin];
      const isActive = pinState?.digital === 1;
      const isPWM = dp.pin === 9 && frame.motor.dutyCycle > 0;
      mat.emissive.set(isPWM ? '#F59E0B' : isActive ? '#10B981' : '#000000');
      mat.emissiveIntensity = isPWM ? frame.motor.dutyCycle * 2 : isActive ? 1.5 : 0;
    });
  });

  return (
    <group ref={groupRef} position={position} onClick={(e) => { e.stopPropagation(); setSelected(isSelected ? null : 'arduino'); }}>
      {/* PCB */}
      <mesh position={[0, 0, 0]} castShadow>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_D]} />
        <meshStandardMaterial color="#2d7a4a" roughness={0.6} metalness={0.15} />
      </mesh>

      {/* Copper traces */}
      <mesh position={[0, BOARD_H / 2 + 0.001, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W - 0.2, BOARD_D - 0.2]} />
        <meshStandardMaterial color="#3d7a5a" roughness={0.8} transparent opacity={0.4} />
      </mesh>

      {/* ATmega328P chip */}
      <mesh position={[-0.1, BOARD_H / 2 + 0.08, 0]}>
        <boxGeometry args={[0.7, 0.06, 0.35]} />
        <meshStandardMaterial color="#1a1a1a" roughness={0.4} metalness={0.6} />
      </mesh>

      {/* USB connector */}
      <mesh position={[-BOARD_W / 2 - 0.15, 0.12, -0.3]}>
        <boxGeometry args={[0.35, 0.3, 0.5]} />
        <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
      </mesh>

      {/* DC power jack */}
      <mesh position={[-BOARD_W / 2 - 0.12, 0.12, 0.5]}>
        <cylinderGeometry args={[0.14, 0.14, 0.3, 16]} />
        <meshStandardMaterial color="#222" roughness={0.3} metalness={0.7} />
      </mesh>

      {/* Crystal oscillator */}
      <mesh position={[0.5, BOARD_H / 2 + 0.06, -0.3]} rotation={[0, 0, Math.PI / 2]}>
        <capsuleGeometry args={[0.06, 0.2, 8, 16]} />
        <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.8} />
      </mesh>

      {/* Power LED */}
      <mesh position={[BOARD_W / 2 - 0.3, BOARD_H / 2 + 0.02, 0.6]}>
        <sphereGeometry args={[0.04, 12, 12]} />
        <meshStandardMaterial color="#10B981" emissive="#10B981" emissiveIntensity={2} />
      </mesh>

      {/* Digital pin headers */}
      {DIGITAL_PINS.map((dp, i) => (
        <group key={dp.pin} position={dp.pos}>
          <mesh>
            <boxGeometry args={[0.06, 0.25, 0.06]} />
            <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
          </mesh>
          <mesh position={[0, 0.18, 0]}>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial
              ref={(m) => { ledRefs.current[i] = m; }}
              color="#0a0a0a"
              emissive="#000000"
              emissiveIntensity={0}
            />
          </mesh>
        </group>
      ))}

      {/* Analog pin headers */}
      {ANALOG_PINS.map((ap) => (
        <group key={ap.pin} position={ap.pos}>
          <mesh>
            <boxGeometry args={[0.06, 0.25, 0.06]} />
            <meshStandardMaterial color="#C0C0C0" roughness={0.2} metalness={0.9} />
          </mesh>
        </group>
      ))}

      {/* Selection highlight ring */}
      {selected && (
        <mesh position={[0, -0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[1.5, 1.7, 48]} />
          <meshBasicMaterial color="#F59E0B" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}
