export const factories = [
  { id: 'F001', name: 'Factory Unit A', location: 'Sircilla, Telangana', machines: 5, healthScore: 87 },
  { id: 'F002', name: 'Factory Unit B', location: 'Sircilla, Telangana', machines: 3, healthScore: 62 }
];

export const machines = [
  { id: 'M001', name: 'Ring Frame #1', factoryId: 'F001', spindles: 400, activeSensors: 5, healthScore: 92, status: 'healthy', lastAlert: null },
  { id: 'M002', name: 'Ring Frame #2', factoryId: 'F001', spindles: 400, activeSensors: 5, healthScore: 71, status: 'warning', lastAlert: '2 hours ago' },
  { id: 'M003', name: 'Ring Frame #3', factoryId: 'F001', spindles: 320, activeSensors: 4, healthScore: 45, status: 'critical', lastAlert: '14 minutes ago' },
  { id: 'M004', name: 'Ring Frame #4', factoryId: 'F001', spindles: 400, activeSensors: 5, healthScore: 95, status: 'healthy', lastAlert: null },
  { id: 'M005', name: 'Winding Machine #1', factoryId: 'F001', spindles: 120, activeSensors: 2, healthScore: 88, status: 'healthy', lastAlert: null },
  { id: 'M006', name: 'Ring Frame #5', factoryId: 'F002', spindles: 400, activeSensors: 5, healthScore: 58, status: 'warning', lastAlert: '1 day ago' },
];

export const sensorNodes = [
  { id: 'SN001', machineId: 'M001', location: 'Main Drive Bearing', healthScore: 95, anomalyScore: 0.05, vibrationRMS: 0.42, temperature: 38, voltage: 228, acousticLevel: 0.31, status: 'healthy' },
  { id: 'SN002', machineId: 'M001', location: 'Section 2 Drive Bearing', healthScore: 91, anomalyScore: 0.09, vibrationRMS: 0.51, temperature: 41, voltage: 231, acousticLevel: 0.38, status: 'healthy' },
  { id: 'SN003', machineId: 'M002', location: 'Main Drive Bearing', healthScore: 73, anomalyScore: 0.27, vibrationRMS: 1.84, temperature: 58, voltage: 219, acousticLevel: 0.71, status: 'warning' },
  { id: 'SN004', machineId: 'M003', location: 'Section 4 Drive Bearing', healthScore: 42, anomalyScore: 0.68, vibrationRMS: 3.91, temperature: 74, voltage: 215, acousticLevel: 1.42, status: 'critical' },
  { id: 'SN005', machineId: 'M003', location: 'Main Drive Bearing', healthScore: 48, anomalyScore: 0.55, vibrationRMS: 3.12, temperature: 71, voltage: 217, acousticLevel: 1.18, status: 'warning' },
  { id: 'SN006', machineId: 'M006', location: 'Main Drive Bearing', healthScore: 61, anomalyScore: 0.31, vibrationRMS: 1.52, temperature: 61, voltage: 222, acousticLevel: 0.68, status: 'warning' },
];

export const alerts = [
  { id: 'A001', nodeId: 'SN004', machineId: 'M003', machineName: 'Ring Frame #3', type: 'CRITICAL', message: 'BPFO frequency spike detected. Bearing failure imminent.', anomalyScore: 0.68, timestamp: '2024-01-15 14:32:00', status: 'active', estimatedTimeToFailure: '6–18 hours' },
  { id: 'A002', nodeId: 'SN003', machineId: 'M002', machineName: 'Ring Frame #2', type: 'WARNING', message: 'Vibration RMS elevated 2.3x above baseline. Monitor closely.', anomalyScore: 0.27, timestamp: '2024-01-15 12:18:00', status: 'active', estimatedTimeToFailure: '3–7 days' },
  { id: 'A003', nodeId: 'SN006', machineId: 'M006', machineName: 'Ring Frame #5', type: 'WARNING', message: 'Temperature anomaly: bearing housing at 61°C.', anomalyScore: 0.31, timestamp: '2024-01-14 09:44:00', status: 'acknowledged', estimatedTimeToFailure: '5–10 days' },
  { id: 'A004', nodeId: 'SN002', machineId: 'M001', machineName: 'Ring Frame #1', type: 'INFO', message: 'Voltage normalization active: supply at 218V (−5%). Readings adjusted.', anomalyScore: 0.08, timestamp: '2024-01-14 07:12:00', status: 'resolved', estimatedTimeToFailure: null },
];

export const stats = {
  totalMachines: 8, activeSensorNodes: 21, alertsLast30Days: 7,
  failuresPrevented: 3, estimatedDowntimePrevented: 18,
  estimatedCostSaved: 54000, averageFleetHealth: 77, uptimePercent: 94.2
};

// Generate time series data: 72 points = last 24 hours, every 20 min
function generateTimeSeries(baseValue: number, variance: number, trend: number = 0) {
  return Array.from({ length: 72 }, (_, i) => {
    const hour = Math.floor(i / 3);
    const min = (i % 3) * 20;
    const trendFactor = i * trend;
    const noise = (Math.random() - 0.5) * variance;
    return {
      time: `${hour.toString().padStart(2,'0')}:${min.toString().padStart(2,'0')}`,
      value: Math.max(0, baseValue + trendFactor + noise)
    };
  });
}

export const timeSeriesData = {
  M001: { vibration: generateTimeSeries(0.45, 0.15), temperature: generateTimeSeries(39, 3) },
  M002: { vibration: generateTimeSeries(1.5, 0.3, 0.005), temperature: generateTimeSeries(56, 4, 0.02) },
  M003: { vibration: generateTimeSeries(3.5, 0.5, 0.01), temperature: generateTimeSeries(71, 3, 0.03) },
  M004: { vibration: generateTimeSeries(0.38, 0.1), temperature: generateTimeSeries(37, 2) },
  M006: { vibration: generateTimeSeries(1.3, 0.25, 0.003), temperature: generateTimeSeries(59, 3) },
};

// FFT data for bearing analysis
export function generateFFTData(machineId: string) {
  const freqs = Array.from({ length: 40 }, (_, i) => (i + 1) * 50);
  return freqs.map(freq => {
    let amplitude = Math.random() * 0.2 + 0.05;
    if (machineId === 'M003') {
      // BPFO spike at ~180Hz, BPFI at ~290Hz
      if (Math.abs(freq - 200) < 50) amplitude = 0.8 + Math.random() * 0.4;
      if (Math.abs(freq - 300) < 50) amplitude = 0.5 + Math.random() * 0.2;
    }
    return { freq, amplitude };
  });
}

// Waveform data
export function generateWaveform(machineId: string) {
  return Array.from({ length: 100 }, (_, i) => {
    const t = i;
    let value = Math.sin(i * 0.3) * 0.3;
    if (machineId === 'M003') {
      value = Math.sin(i * 0.3) * 1.5 + (Math.random() > 0.85 ? (Math.random() - 0.5) * 4 : 0);
    }
    return { t, value };
  });
}

// Predictions / RUL curves (30 days)
export const rulCurves = {
  M003: Array.from({ length: 30 }, (_, i) => ({
    day: i, healthScore: Math.max(20, 45 - i * 0.8 - (i > 15 ? i * 0.5 : 0)),
    projected: i >= 0
  })),
  M002: Array.from({ length: 30 }, (_, i) => ({
    day: i, healthScore: Math.max(25, 71 - i * 0.5),
    projected: i >= 0
  })),
  M006: Array.from({ length: 30 }, (_, i) => ({
    day: i, healthScore: Math.max(30, 58 - i * 0.4),
    projected: i >= 0
  })),
};
