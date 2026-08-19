import { useState, useEffect, useRef } from 'react';
import { getSocket } from '@/lib/socket';
import { hardwareApi } from '@/lib/api';

export type HardwareReading = {
  rpm: number;
  temperature: number | null;
  motorSpeed: number;
  rpm_mean: number;
  rpm_std: number;
  temp_mean: number;
  temp_rate_of_change: number;
  rpm_temp_ratio: number;
  health_index: number;
  verdict: string;
  colour: string;
  source: 'arduino' | 'simulator';
  timestamp: string;
};

const MAX_POINTS = 120; // 2 minutes at 1 Hz
// Frames arrive at 1 Hz — if nothing arrives for more than this, the rig is
// genuinely offline (motor stopped / USB dropped / serial dead).
const OFFLINE_AFTER_MS = 3500;

/**
 * useHardwareStream — two streams:
 *
 *  - LIVE stream: readings from the physical Arduino ONLY (source === 'arduino').
 *    This is the real-time feedback (the PWM command) — it flatlines and the
 *    page flips OFFLINE within ~3.5 s of the rig going silent.
 *  - DATASET stream: the simulator reference readings ONLY — the rig's own
 *    tach/DS18B20 values are still in-progress (0 RPM / null temp), so mixing
 *    them in makes the analytics panels alternate between good and broken
 *    values every second. Filtering to the dataset keeps the analytics stable.
 */
export function useHardwareStream() {
  const [liveReadings, setLiveReadings] = useState<HardwareReading[]>([]);
  const [datasetReadings, setDatasetReadings] = useState<HardwareReading[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [online, setOnline] = useState(false);
  const [lastSource, setLastSource] = useState<'arduino' | 'simulator' | null>(null);
  const liveBuffer = useRef<HardwareReading[]>([]);
  const datasetBuffer = useRef<HardwareReading[]>([]);
  const lastArduinoAt = useRef(0);

  useEffect(() => {
    let isMounted = true;
    let watchdog: number | undefined;
    const socket = getSocket();

    // Real-time liveness check: flips OFFLINE once no Arduino frame has
    // arrived for OFFLINE_AFTER_MS. Runs every second so the page reacts
    // within ~1 tick of the rig going silent.
    const checkLiveness = () => {
      if (!isMounted) return;
      const alive = Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS;
      setOnline(alive);
      setIsLive(alive && socket.connected);
    };

    const hydrate = async () => {
      try {
        const res = await hardwareApi.getStream();
        if (!isMounted || !res.data?.success) return;
        const data = res.data.data;
        if (Array.isArray(data.readings)) {
          const all = data.readings.slice(-MAX_POINTS);
          const arduino = all.filter((r: HardwareReading) => r.source === 'arduino');
          const dataset = all.filter((r: HardwareReading) => r.source === 'simulator');
          datasetBuffer.current = dataset;
          setDatasetReadings(dataset);
          liveBuffer.current = arduino;
          setLiveReadings(arduino);
          if (arduino.length > 0) lastArduinoAt.current = Date.now();
        }
        if (typeof data.online === 'boolean') setOnline(data.online);
        const latest = data.latest;
        if (latest?.source) setLastSource(latest.source);
      } catch (err) {
        console.error(err);
      }
    };
    hydrate();

    const onConnect = () => {
      if (Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS) setIsLive(true);
    };
    const onDisconnect = () => setIsLive(false);
    const onHardwareUpdate = (data: any) => {
      if (!data || typeof data.rpm !== 'number') return;
      const reading = data as HardwareReading;
      if (reading.source === 'arduino') {
        // Only Arduino frames feed the LIVE stream.
        lastArduinoAt.current = Date.now();
        liveBuffer.current = [...liveBuffer.current, reading].slice(-MAX_POINTS);
        setLiveReadings(liveBuffer.current);
        setOnline(true);
        setIsLive(true);
      } else if (reading.source === 'simulator') {
        // Simulator reference frames feed the analytics/dataset panels.
        datasetBuffer.current = [...datasetBuffer.current, reading].slice(-MAX_POINTS);
        setDatasetReadings(datasetBuffer.current);
      }
      if (reading.source) setLastSource(reading.source);
    };

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);
    socket.on('hardware:update', onHardwareUpdate);
    if (socket.connected && Date.now() - lastArduinoAt.current < OFFLINE_AFTER_MS) setIsLive(true);

    watchdog = window.setInterval(checkLiveness, 1000);

    return () => {
      isMounted = false;
      if (watchdog) window.clearInterval(watchdog);
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
      socket.off('hardware:update', onHardwareUpdate);
    };
  }, []);

  const liveLatest = liveReadings.length > 0 ? liveReadings[liveReadings.length - 1] : null;
  const datasetLatest = datasetReadings.length > 0 ? datasetReadings[datasetReadings.length - 1] : null;

  return { liveReadings, datasetReadings, liveLatest, datasetLatest, isLive, online, lastSource };
}
