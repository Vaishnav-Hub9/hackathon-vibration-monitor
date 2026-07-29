import { useState, useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { machinesApi } from '@/lib/api';

export type LiveSensor = {
  id: string;
  machineId: string;
  location: string;
  healthScore: number;
  vibrationRMS: number;
  temperature: number;
  anomalyScore: number;
  acousticLevel: number;
  status: string;
  vibDelta: number;
  tempDelta: number;
};

export function useLiveSensors(machineId?: string) {
  const [sensors, setSensors] = useState<LiveSensor[]>([]);

  useEffect(() => {
    let isMounted = true;
    const fetchInitialData = async () => {
      try {
        if (machineId) {
          const res = await machinesApi.getSpindles(machineId);
          if (isMounted) setSensors(res.data.data);
        } else {
          // If no machineId, we might want to fetch spindles from a few key machines for the dashboard feed
          const mRes = await machinesApi.getAll();
          const machines = mRes.data.data.slice(0, 3);
          let allSpindles: LiveSensor[] = [];
          for (const m of machines) {
            const sRes = await machinesApi.getSpindles(m.id);
            allSpindles = [...allSpindles, ...sRes.data.data];
          }
          if (isMounted) setSensors(allSpindles.slice(0, 6)); // Dashboard shows up to 6
        }
      } catch (err) {
        console.error(err);
      }
    };
    
    fetchInitialData();
    const socket = getSocket();
    
    // If no machineId, subscribe to a few to get some live feed on dashboard
    const subscribeTo = machineId ? [machineId] : ['M001', 'M002', 'M003'];
    
    subscribeTo.forEach(id => {
      socket.emit('subscribe:machine', { machineId: id });
    });

    const handleSensorUpdate = (data: any) => {
      setSensors(prev => {
         const existingIdx = prev.findIndex(s => s.id === data.spindleId && s.machineId === data.machineId);
         const status = data.anomalyFlag ? 'critical' : (data.vibrationRMS > 1.5 ? 'warning' : 'healthy');
         
         const newSensor: LiveSensor = {
            id: data.spindleId,
            machineId: data.machineId,
            location: data.spindleId,
            healthScore: data.healthScore,
            vibrationRMS: data.vibrationRMS,
            temperature: data.temperature,
            anomalyScore: data.bpfoScore,
            acousticLevel: 0.3,
            status,
            vibDelta: existingIdx >= 0 ? +(data.vibrationRMS - prev[existingIdx].vibrationRMS).toFixed(3) : 0,
            tempDelta: existingIdx >= 0 ? +(data.temperature - prev[existingIdx].temperature).toFixed(1) : 0,
         };
         
         if (existingIdx >= 0) {
           const updated = [...prev];
           updated[existingIdx] = newSensor;
           return updated;
         } else {
           // For dashboard limit
           if (!machineId && prev.length >= 6) {
              return [newSensor, ...prev.slice(0, 5)];
           }
           return [...prev, newSensor];
         }
      });
    };

    socket.on('sensor:update', handleSensorUpdate);

    return () => {
      isMounted = false;
      socket.off('sensor:update', handleSensorUpdate);
      subscribeTo.forEach(id => {
        socket.emit('unsubscribe:machine', { machineId: id });
      });
    };
  }, [machineId]);

  return sensors;
}
