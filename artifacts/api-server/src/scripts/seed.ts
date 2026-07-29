import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';
import { User } from '../models/User.js';
import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { MaintenanceLog } from '../models/MaintenanceLog.js';

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

    for (const machine of machinesData) {
      for (let i = 1; i <= 5; i++) {
        await SpindleReading.create({
          machineId: machine.machineId,
          spindleId: `SN00${i}`,
          vibrationRMS: 0.5,
          vibrationFFT: Array.from({ length: 128 }, (_, j) => ({ freq: j * (1000/128), amplitude: 0.05 })),
          acousticRMS: 0.3,
          temperature: 40,
          voltageNormalized: 220,
          bpfoScore: 0.1,
          healthScore: 95,
          anomalyFlag: false
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
