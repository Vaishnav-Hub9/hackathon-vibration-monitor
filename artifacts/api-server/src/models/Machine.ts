import mongoose, { Schema, Document } from 'mongoose';

export interface IMachine extends Document {
  machineId: string;
  name: string;
  location: string;
  section: string;
  totalSpindles: number;
  status: 'healthy' | 'warning' | 'critical' | 'degrading';
  installedAt: Date;
  lastMaintenance: Date;
}

const MachineSchema: Schema = new Schema({
  machineId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  section: { type: String, required: true },
  totalSpindles: { type: Number, required: true },
  status: { type: String, enum: ['healthy', 'warning', 'critical', 'degrading'], required: true },
  installedAt: { type: Date, required: true },
  lastMaintenance: { type: Date, required: true }
});

export const Machine = mongoose.model<IMachine>('Machine', MachineSchema);
