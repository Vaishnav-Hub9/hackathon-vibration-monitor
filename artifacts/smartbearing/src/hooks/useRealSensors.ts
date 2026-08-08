import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { sensorNodes } from '@/data/mockData';
import type { LiveSensor } from './useLiveSensors';

/**
 * Real sensor feed for the dashboard, driven by the smartphone capture PWA.
 *
 * Unlike useLiveSensors (which seeds from the machines API), this hook starts
 * from the mockData fallback so the dashboard renders immediately, then streams
 * live `sensor:update` events from the backend over the existing Socket.io
 * connection. It accepts BOTH the smartphone payload shape
 * (nodeId / vibrationRMS / status / source: 'smartphone') and the simulator's
 * legacy shape (spindleId / accel_z / anomalyFlag) so the fleet dashboard
 * keeps working whether or not the simulator is running.
 */

type SensorUpdate = Record<string, any>;

function toLiveSensor(data: SensorUpdate, prev?: LiveSensor): LiveSensor {
  const vibrationRMS =
    data.vibrationRMS ?? data.accel_z ?? prev?.accel_z ?? 0;
  const temperature = data.temperature ?? prev?.temperature ?? 0;
  const healthScore = data.healthScore ?? prev?.healthScore ?? 100;

  const status =
    data.status ??
    (data.anomalyFlag ? 'critical' : vibrationRMS > 3 ? 'critical' : vibrationRMS > 1.5 ? 'warning' : 'healthy');

  const id = data.nodeId ?? data.spindleId ?? prev?.id ?? '';
  return {
    id,
    machineId: data.machineId ?? prev?.machineId ?? '',
    location: data.nodeId ?? data.spindleId ?? id,
    healthScore,
    accel_x: data.accel_x ?? 0,
    accel_y: data.accel_y ?? 0,
    accel_z: +(+vibrationRMS).toFixed(3),
    rpm: data.rpm ?? 0,
    temperature: +(+temperature).toFixed(1),
    anomalyScore: data.anomalyScore ?? data.bpfoScore ?? prev?.anomalyScore ?? 0,
    acousticLevel: data.acousticLevel ?? data.acousticRMS ?? prev?.acousticLevel ?? 0,
    status,
    mlLabel: data.mlLabel,
    mlConfidence: data.mlConfidence,
    vibDelta: prev ? +(vibrationRMS - prev.accel_z).toFixed(3) : 0,
    tempDelta: prev ? +(temperature - prev.temperature).toFixed(1) : 0,
  };
}

export function useRealSensors(machineId?: string) {
  const [sensors, setSensors] = useState<LiveSensor[]>(() =>
    sensorNodes.map((s) => ({
      id: s.id,
      machineId: s.machineId,
      location: s.location,
      healthScore: s.healthScore,
      accel_x: 0,
      accel_y: 0,
      accel_z: s.vibrationRMS,
      rpm: 0,
      temperature: s.temperature,
      anomalyScore: s.anomalyScore,
      acousticLevel: s.acousticLevel,
      status: s.status,
      vibDelta: 0,
      tempDelta: 0,
    })),
  );
  const [isLive, setIsLive] = useState(false);

  useEffect(() => {
    const socket = getSocket();

    // The backend broadcasts simulator readings only to machine rooms
    // (io.to(`machine:${id}`)), while smartphone captures additionally go to
    // the 'fleet' room (auto-joined). Subscribe to the seeded machines so the
    // dashboard feed receives BOTH simulator and phone updates live.
    const subscribeTo = machineId ? [machineId] : ['M001', 'M002', 'M003'];
    subscribeTo.forEach((id) => socket.emit('subscribe:machine', { machineId: id }));

    const onConnect = () => setIsLive(true);
    const onDisconnect = () => setIsLive(false);

    const onSensorUpdate = (data: SensorUpdate) => {
      setSensors((prev) => {
        const id = data.nodeId ?? data.spindleId;
        const idx = prev.findIndex((s) => s.id === id && s.machineId === data.machineId);
        const next = toLiveSensor(data, idx >= 0 ? prev[idx] : undefined);
        if (idx >= 0) {
          const updated = [...prev];
          updated[idx] = next;
          return updated;
        }
        // Cap the fleet feed like the legacy hook (dashboard shows up to 6)
        if (!machineId && prev.length >= 6) {
          return [next, ...prev.slice(0, 5)];
        }
        return [...prev, next];
      });
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('sensor:update', onSensorUpdate);
    if (socket.connected) setIsLive(true);

    return () => {
      subscribeTo.forEach((id) => socket.emit('unsubscribe:machine', { machineId: id }));
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('sensor:update', onSensorUpdate);
    };
  }, [machineId]);

  return { sensors, isLive };
}
