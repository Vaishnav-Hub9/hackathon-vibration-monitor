import mongoose, { Schema, Document } from 'mongoose';

export interface IMaintenanceLog extends Document {
  machineId: string;
  type: string;
  performedAt: Date;
  technicianName: string;
  notes: string;
  bearingReplaced: boolean;
  cost: number;
}

const MaintenanceLogSchema: Schema = new Schema({
  machineId: { type: String, required: true, index: true },
  type: { type: String, required: true },
  performedAt: { type: Date, required: true, default: Date.now, index: true },
  technicianName: { type: String, required: true },
  notes: { type: String, required: true },
  bearingReplaced: { type: Boolean, required: true, default: false },
  cost: { type: Number, required: true }
});

export const MaintenanceLog = mongoose.model<IMaintenanceLog>('MaintenanceLog', MaintenanceLogSchema);
