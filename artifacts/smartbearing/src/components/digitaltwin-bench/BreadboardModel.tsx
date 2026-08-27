/**
 * Breadboard3D — procedural model of a 830-point solderless breadboard.
 *
 * Shows the center divide, power rails, and connection points where
 * the DS18B20 and pull-up resistor are mounted.
 */
// Text removed - labels via HTML overlay
import { useMemo } from 'react';

const BOARD_W = 4.5;
const BOARD_D = 1.6;
const BOARD_H = 0.12;
const ROWS = 30;
const COLS = 5;

interface BreadboardModelProps {
  position?: [number, number, number];
}

export default function BreadboardModel({ position = [0, 0, 0] }: BreadboardModelProps) {
  // Pre-compute row positions for the connection holes
  const holes = useMemo(() => {
    const result: { x: number; z: number; rail?: string }[] = [];
    const startX = -BOARD_W / 2 + 0.3;
    const rowSpacing = (BOARD_W - 0.6) / (ROWS - 1);

    // Power rails (top and bottom)
    for (let i = 0; i < ROWS; i++) {
      const x = startX + i * rowSpacing;
      result.push({ x, z: -BOARD_D / 2 + 0.1, rail: '+' });
      result.push({ x, z: -BOARD_D / 2 + 0.22, rail: '-' });
      result.push({ x, z: BOARD_D / 2 - 0.1, rail: '+' });
      result.push({ x, z: BOARD_D / 2 - 0.22, rail: '-' });
    }

    // Main area holes
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = startX + r * rowSpacing;
        const z = -0.35 + c * 0.175;
        result.push({ x, z });
      }
    }
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const x = startX + r * rowSpacing;
        const z = 0.1 + c * 0.175;
        result.push({ x, z });
      }
    }
    return result;
  }, []);

  return (
    <group position={position}>
      {/* Board body */}
      <mesh castShadow>
        <boxGeometry args={[BOARD_W, BOARD_H, BOARD_D]} />
        <meshStandardMaterial color="#fafaf5" roughness={0.7} metalness={0.0} />
      </mesh>

      {/* Center divider channel */}
      <mesh position={[0, BOARD_H / 2 + 0.005, 0]}>
        <boxGeometry args={[BOARD_W - 0.4, 0.01, 0.15]} />
        <meshStandardMaterial color="#e0e0d8" roughness={0.95} />
      </mesh>

      {/* Power rail stripes */}
      <mesh position={[0, BOARD_H / 2 + 0.002, -BOARD_D / 2 + 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W - 0.3, 0.04]} />
        <meshStandardMaterial color="#EF4444" />
      </mesh>
      <mesh position={[0, BOARD_H / 2 + 0.002, -BOARD_D / 2 + 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W - 0.3, 0.04]} />
        <meshStandardMaterial color="#3B82F6" />
      </mesh>
      <mesh position={[0, BOARD_H / 2 + 0.002, BOARD_D / 2 - 0.1]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W - 0.3, 0.04]} />
        <meshStandardMaterial color="#EF4444" />
      </mesh>
      <mesh position={[0, BOARD_H / 2 + 0.002, BOARD_D / 2 - 0.22]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[BOARD_W - 0.3, 0.04]} />
        <meshStandardMaterial color="#3B82F6" />
      </mesh>

      {/* Connection holes */}
      {holes.map((h, i) => (
        <mesh key={i} position={[h.x, BOARD_H / 2 + 0.003, h.z]}>
          <cylinderGeometry args={[0.015, 0.015, 0.01, 8]} />
          <meshStandardMaterial
            color={h.rail === '+' ? '#C0C0C0' : h.rail === '-' ? '#C0C0C0' : '#888'}
            metalness={0.7}
            roughness={0.3}
          />
        </mesh>
      ))}

      {/* 4.7kΩ pull-up resistor (between D5 and 5V) */}
      <group position={[-0.5, BOARD_H / 2 + 0.1, 0.35]}>
        {/* Resistor body */}
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <capsuleGeometry args={[0.03, 0.18, 6, 12]} />
          <meshStandardMaterial color="#C4A882" roughness={0.6} />
        </mesh>
        {/* Color bands */}
        {[-0.06, -0.02, 0.02, 0.06].map((x, i) => {
          const colors = ['#964B00', '#964B00', ['#C0C0C0', '#FFD700'][i === 3 ? 1 : 0], '#FFD700'];
          return (
            <mesh key={i} position={[x, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.032, 0.032, 0.008, 12]} />
              <meshStandardMaterial color={colors[i]} />
            </mesh>
          );
        })}
        
      </group>

      {/* Board label */}
      
    </group>
  );
}
