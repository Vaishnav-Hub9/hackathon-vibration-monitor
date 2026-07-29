import mongoose, { Schema, Document } from 'mongoose';

export interface IAlert extends Document {
  machineId: string;
  spindleId: string;
  severity: 'critical' | 'warning' | 'info';
  type: string;
  message: string;
  detectedAt: Date;
  acknowledgedAt?: Date;
  resolvedAt?: Date;
  status: 'active' | 'acknowledged' | 'resolved';
}

const AlertSchema: Schema = new Schema({
  machineId: { type: String, required: true, index: true },
  spindleId: { type: String, required: true, index: true },
  severity: { type: String, enum: ['critical', 'warning', 'info'], required: true },
  type: { type: String, required: true },
  message: { type: String, required: true },
  detectedAt: { type: Date, required: true, default: Date.now, index: true },
  acknowledgedAt: { type: Date },
  resolvedAt: { type: Date },
  status: { type: String, enum: ['active', 'acknowledged', 'resolved'], required: true, default: 'active', index: true }
});

export const Alert = mongoose.model<IAlert>('Alert', AlertSchema);
