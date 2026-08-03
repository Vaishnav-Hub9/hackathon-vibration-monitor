import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { MaintenanceLog } from '../models/MaintenanceLog.js';
import { computeFFTBins } from '../lib/fft.js';

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
      { machineId: 'M002', name: 'Ring Frame #2', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 400, status: 'warning', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M003', name: 'Ring Frame #3', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 320, status: 'critical', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M004', name: 'Ring Frame #4', location: 'Sircilla, Telangana', section: 'Main', totalSpindles: 400, status: 'healthy', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M005', name: 'Winding Machine #1', location: 'Sircilla, Telangana', section: 'Winding', totalSpindles: 120, status: 'healthy', installedAt: new Date(), lastMaintenance: new Date() },
      { machineId: 'M006', name: 'Ring Frame #5', location: 'Factory Unit B', section: 'Main', totalSpindles: 400, status: 'warning', installedAt: new Date(), lastMaintenance: new Date() }
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
          mlLabel: anomaly ? 'Outer Race Fault' : 'Healthy',
          mlConfidence: anomaly ? 0.9 : 0.98,
          waveform: sig.filter((_, k) => k % 8 === 0),
          source: 'simulator'
        });
      }
    }
    console.log('Seeded initial spindle readings');

    await Alert.create([
      { machineId: 'M003', spindleId: 'SN001', severity: 'critical', type: 'CRITICAL', message: 'BPFO frequency spike detected.', status: 'active' },
      { machineId: 'M002', spindleId: 'SN002', severity: 'warning', type: 'WARNING', message: 'Vibration RMS elevated.', status: 'active' },
      { machineId: 'M006', spindleId: 'SN003', severity: 'warning', type: 'WARNING', message: 'Temperature anomaly detected.', status: 'active' }
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
