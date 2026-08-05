import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { MaintenanceLog } from '../models/MaintenanceLog.js';
import { computeFFTBins } from '../lib/fft.js';
import { getPreventionTips } from '../lib/prevention.js';
import { defectFrequencies } from '../simulator/SensorSimulator.js';

dotenv.config();

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbearing';

async function seed(): Promise<void> {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    await User.deleteMany({});
    await Machine.deleteMany({});
    await SpindleReading.deleteMany({});
    await Alert.deleteMany({});
    await MaintenanceLog.deleteMany({});

    console.log('Cleared collections');

    const salt = await bcrypt.genSalt(10);
    const adminHash = await bcrypt.hash('Admin@123', salt);
    const operatorHash = await bcrypt.hash('Operator@123', salt);

    await User.create([
      { name: 'Admin User', email: 'admin@smartbearing.com', passwordHash: adminHash, role: 'admin' },
      { name: 'Operator User', email: 'operator@smartbearing.com', passwordHash: operatorHash, role: 'operator' }
    ]);
    console.log('Seeded users');

    const machinesData = [
      { machineId: 'M001', name: 'Ring Frame #1', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 400, status: 'healthy', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M002', name: 'Ring Frame #2', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 400, status: 'warning', faultProfile: 'Imbalance', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M003', name: 'Ring Frame #3', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 320, status: 'critical', faultProfile: 'Outer Race', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M004', name: 'Ring Frame #4', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 400, status: 'healthy', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M005', name: 'Winding Machine #1', location: 'Sircilla, Telangana', section: 'Winding', totalSpindles: 120, status: 'warning', faultProfile: 'Ball', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M006', name: 'Ring Frame #5', location: 'Factory Unit B', section: 'Main', totalSpindles: 400, status: 'warning', faultProfile: 'Misalignment', installedAt: new Date(), lastMaintenance: new Date() }
    ];

    await Machine.insertMany(machinesData);
    console.log('Seeded machines');

    // Deterministic bootstrap readings — no Math.random, real FFT computed from
    // a fixed signal via the same DSP used by the live pipeline. The sensor
    // simulator replaces these with real ML-processed readings within seconds.
    const signal = (amp: number, faultAmp: number) => {
      const s = new Array<number>(2048);
      for (let k = 0; k < 2048; k++) {
        let v = Math.sin(k * 0.1) * amp;
        if (faultAmp > 0 && k % 100 < 5) v += faultAmp * 2;
        s[k] = v;
      }
      return s;
    };

    for (const machine of machinesData) {
      const amp = machine.status === 'critical' ? 2.4 : machine.status === 'warning' ? 1.3 : 0.45;
      const faultAmp = machine.status === 'critical' ? 4 : machine.status === 'warning' ? 1.5 : 0;
      const tempBase = machine.status === 'critical' ? 74 : machine.status === 'warning' ? 56 : 39;
      const healthBase = machine.status === 'critical' ? 34 : machine.status === 'warning' ? 66 : 92;
      const sig = signal(amp, faultAmp);
      const fft = computeFFTBins(sig, 1000, 128);
      const anomaly = machine.status === 'critical';
      for (let i = 1; i <= 5; i++) {
        await SpindleReading.create({
          machineId: machine.machineId,
          spindleId: `SN00${i}`,
          accel_x: +(amp * 0.4).toFixed(3),
          accel_y: +(amp * 0.6).toFixed(3),
          accel_z: +amp.toFixed(3),
          rpm: 14200,
          vibrationFFT: fft,
          acousticRMS: +amp.toFixed(3),
          temperature: tempBase,
          voltageNormalized: 220,
          bpfoScore: machine.status === 'critical' ? 0.8 : machine.status === 'warning' ? 0.4 : 0.1,
          healthScore: healthBase,
          anomalyFlag: anomaly,
          // Labels match the 6-class model (Healthy / Imbalance / Misalignment /
          // Ball / Inner Race / Outer Race). Critical -> Outer Race defect.
          mlLabel: machine.status === 'critical' ? 'Outer Race' : machine.status === 'warning' ? (machine.machineId === 'M002' ? 'Imbalance' : machine.machineId === 'M006' ? 'Misalignment' : 'Ball') : 'Healthy',
          mlConfidence: anomaly ? 0.9 : 0.98,
          waveform: sig.filter((_, k) => k % 8 === 0),
          source: 'simulator'
        });
      }
    }
    console.log('Seeded initial spindle readings');

    const df = defectFrequencies(14200);

    await Alert.create([
      {
        machineId: 'M003', spindleId: 'SN001', severity: 'critical', type: 'CRITICAL',
        message: 'Outer Race detected with 90.0% confidence.', status: 'active',
        technicianSummary: 'High spectral energy at BPFO (~847 Hz) with 90.0% probability of Outer Race wear. Recommended Action: Schedule bearing replacement within 18 hours.',
        prevention: getPreventionTips('Outer Race'),
        anomalyScore: 0.8,
        evidence: {
          label: 'Outer Race', confidence: 0.9, dominantFreq: 847.0, rpm: 14200,
          peaks: [{ freq: 847.0, amplitude: 1.2 }, { freq: 1694.0, amplitude: 0.6 }, { freq: 254.0, amplitude: 0.35 }, { freq: 508.0, amplitude: 0.2 }, { freq: 1185.0, amplitude: 0.18 }],
          features: { rms: 3.1, kurtosis: 4.2, crestFactor: 4.8 },
          defectFrequencies: df
        }
      },
      {
        machineId: 'M002', spindleId: 'SN002', severity: 'warning', type: 'WARNING',
        message: 'Imbalance detected with 85.0% confidence.', status: 'active',
        technicianSummary: 'Dominant spectral peak at 1x RPM indicates rotor imbalance. Recommended Action: Schedule rotor balancing.',
        prevention: getPreventionTips('Imbalance'),
        anomalyScore: 0.4,
        evidence: {
          label: 'Imbalance', confidence: 0.85, dominantFreq: 236.7, rpm: 14200,
          peaks: [{ freq: 236.7, amplitude: 1.0 }, { freq: 473.3, amplitude: 0.15 }, { freq: 710.0, amplitude: 0.1 }, { freq: 94.0, amplitude: 0.08 }, { freq: 1185.0, amplitude: 0.06 }],
          features: { rms: 1.9, kurtosis: 3.1, crestFactor: 3.2 },
          defectFrequencies: df
        }
      },
      {
        machineId: 'M006', spindleId: 'SN003', severity: 'warning', type: 'WARNING',
        message: 'Misalignment detected with 82.0% confidence.', status: 'active',
        technicianSummary: 'Strong spectral peak at 2x RPM (473 Hz) indicates shaft misalignment. Recommended Action: Realign coupling and verify shaft straightness.',
        prevention: getPreventionTips('Misalignment'),
        anomalyScore: 0.42,
        evidence: {
          label: 'Misalignment', confidence: 0.82, dominantFreq: 473.3, rpm: 14200,
          peaks: [{ freq: 473.3, amplitude: 1.1 }, { freq: 236.7, amplitude: 0.5 }, { freq: 946.7, amplitude: 0.3 }, { freq: 118.3, amplitude: 0.15 }, { freq: 700.0, amplitude: 0.1 }],
          features: { rms: 2.1, kurtosis: 3.3, crestFactor: 3.6 },
          defectFrequencies: df
        }
      }
    ]);
    console.log('Seeded alerts');

    await MaintenanceLog.create([
      { machineId: 'M001', type: 'Routine', technicianName: 'John Doe', notes: 'All clear', bearingReplaced: false, cost: 50 },
      { machineId: 'M002', type: 'Inspection', technicianName: 'Jane Smith', notes: 'Found slight wear', bearingReplaced: false, cost: 100 },
      { machineId: 'M003', type: 'Emergency', technicianName: 'John Doe', notes: 'Replaced main drive bearing', bearingReplaced: true, cost: 450 },
      { machineId: 'M004', type: 'Routine', technicianName: 'Jane Smith', notes: 'Lubrication', bearingReplaced: false, cost: 40 },
      { machineId: 'M006', type: 'Inspection', technicianName: 'John Doe', notes: 'Scheduled replacement next month', bearingReplaced: false, cost: 120 }
    ]);
    console.log('Seeded maintenance logs');

    console.log('Seeding completed successfully');
    process.exit(0);
  } catch (err) {
    console.error('Seeding error:', err);
    process.exit(1);
  }
}

seed();
