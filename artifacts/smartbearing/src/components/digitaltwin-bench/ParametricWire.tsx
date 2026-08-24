/**
 * ParametricWire — generates a 3D tube geometry along a cubic Bezier curve
 * that models gravity-induced wire sag between two3D anchor points.
 *
 * The curve uses Catmull-Rom-style control points where P1 and P2 are
 * displaced downward to simulate the effect of gravity on a loose wire.
 * The wire color pulses when current flows (motor active).
 */
import { useMemo } from 'react';
import * as THREE from 'three';
import { engine } from '@/simulation/engineRef';

interface ParametricWireProps {
  startPin: [number, number, number];
  endPin: [number, number, number];
  wireColor: string;
  sagFactor?: number;
  thickness?: number;
  label?: string;
  showLabel?: boolean;
}

export default function ParametricWire({
  startPin,
  endPin,
  wireColor,
  sagFactor = 0.45,
  thickness = 0.025,
  label,
  showLabel = false,
}: ParametricWireProps) {


  const wireGeometry = useMemo(() => {
    const p0 = new THREE.Vector3(...startPin);
    const p3 = new THREE.Vector3(...endPin);

    // Control points: P1 and P2 sit at the lowest Y, creating the catenary sag
    const lowestY = Math.min(p0.y, p3.y) - sagFactor;
    const p1 = new THREE.Vector3(p0.x, lowestY, p0.z);
    const p2 = new THREE.Vector3(p3.x, lowestY, p3.z);

    const curve = new THREE.CubicBezierCurve3(p0, p1, p2, p3);
    return new THREE.TubeGeometry(curve, 64, thickness, 8, false);
  }, [startPin, endPin, sagFactor, thickness]);

  const isActive = engine.snapshot(performance.now()).motor.rpm > 0;

  return (
    <group>
      <mesh geometry={wireGeometry}>
        <meshStandardMaterial
          color={wireColor}
          roughness={0.2}
          metalness={0.1}
          emissive={isActive ? wireColor : '#000000'}
          emissiveIntensity={isActive ? 0.15 : 0}
        />
      </mesh>

      {/* Wire end caps — small spheres at anchor points */}
      <mesh position={startPin}>
        <sphereGeometry args={[thickness * 1.8, 8, 8]} />
        <meshStandardMaterial color={wireColor} roughness={0.3} metalness={0.5} />
      </mesh>
      <mesh position={endPin}>
        <sphereGeometry args={[thickness * 1.8, 8, 8]} />
        <meshStandardMaterial color={wireColor} roughness={0.3} metalness={0.5} />
      </mesh>
    </group>
  );
}

/**
 * WireBundle — renders a set of parametric wires for the full bench wiring.
 * Pin coordinates are world-space positions matching the component models.
 */
export function WireBundle({ showLabels = false }: { showLabels?: boolean }) {
  return (
    <group>
      {/* Arduino D9 → L298N ENA (PWM) */}
      <ParametricWire
        startPin={[1.4, 0.35, -0.75]}
        endPin={[-0.4, 0.35, -1.45]}
        wireColor="#F59E0B"
        sagFactor={0.3}
        label="D9→ENA"
        showLabel={showLabels}
      />

      {/* Arduino D10 → L298N IN1 */}
      <ParametricWire
        startPin={[1.6, 0.35, -0.75]}
        endPin={[-0.1, 0.35, -1.55]}
        wireColor="#10B981"
        sagFactor={0.25}
        label="D10→IN1"
        showLabel={showLabels}
      />

      {/* Arduino D11 → L298N IN2 */}
      <ParametricWire
        startPin={[1.8, 0.35, -0.75]}
        endPin={[0.2, 0.35, -1.55]}
        wireColor="#3B82F6"
        sagFactor={0.25}
        label="D11→IN2"
        showLabel={showLabels}
      />

      {/* L298N OUT1 → Motor terminal 1 */}
      <ParametricWire
        startPin={[1.75, 0.35, -1.25]}
        endPin={[3.0, 0.2, -0.1]}
        wireColor="#10B981"
        sagFactor={0.4}
        thickness={0.035}
        label="OUT1→M+"
        showLabel={showLabels}
      />

      {/* L298N OUT2 → Motor terminal 2 */}
      <ParametricWire
        startPin={[1.75, 0.35, -0.95]}
        endPin={[3.0, 0.2, 0.1]}
        wireColor="#3B82F6"
        sagFactor={0.4}
        thickness={0.035}
        label="OUT2→M-"
        showLabel={showLabels}
      />

      {/* Tachometer OUT → Arduino D2 (INT0) */}
      <ParametricWire
        startPin={[4.0, 0.3, -0.5]}
        endPin={[-0.9, 0.35, -0.75]}
        wireColor="#A855F7"
        sagFactor={0.35}
        label="TACH→D2"
        showLabel={showLabels}
      />

      {/* Arduino D5 → DS18B20 DATA */}
      <ParametricWire
        startPin={[-0.3, 0.35, -0.75]}
        endPin={[-1.5, 0.3, 0.5]}
        wireColor="#EF4444"
        sagFactor={0.2}
        label="D5→DQ"
        showLabel={showLabels}
      />

      {/* 12V Supply → L298N */}
      <ParametricWire
        startPin={[-3.0, 0.3, -0.6]}
        endPin={[-1.1, 0.35, -1.35]}
        wireColor="#F97316"
        sagFactor={0.5}
        thickness={0.03}
        label="12V→L298N"
        showLabel={showLabels}
      />

      {/* GND bus (all components share ground) */}
      <ParametricWire
        startPin={[-3.0, 0.1, -0.3]}
        endPin={[-1.1, 0.1, -1.25]}
        wireColor="#6B7280"
        sagFactor={0.15}
        thickness={0.02}
        label="GND"
        showLabel={showLabels}
      />
    </group>
  );
}
