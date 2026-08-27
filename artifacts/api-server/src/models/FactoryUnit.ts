import mongoose, { Schema, Document } from 'mongoose';

export interface IFactoryUnit extends Document {
  unitId: string;
  name: string;
  location: string;
  description?: string;
  machineIds: string[];
  isActive: boolean;
  createdAt: Date;
}

const FactoryUnitSchema: Schema = new Schema({
  unitId: { type: String, required: true, unique: true },
  name: { type: String, required: true },
  location: { type: String, required: true },
  description: { type: String },
  machineIds: { type: [String], default: [] },
  isActive: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
});

export const FactoryUnit = mongoose.model<IFactoryUnit>('FactoryUnit', FactoryUnitSchema);
