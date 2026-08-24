import mongoose, { Schema, Document } from 'mongoose';

export interface IFactoryProfile extends Document {
  unitName: string;
  location: string;
  shiftTimings: string;
  description?: string;
  updatedAt: Date;
}

const FactoryProfileSchema: Schema = new Schema({
  unitName: { type: String, default: 'Factory Unit A' },
  location: { type: String, default: 'Sircilla, Telangana' },
  shiftTimings: { type: String, default: '24x7 (3 Shifts)' },
  description: { type: String },
  updatedAt: { type: Date, default: Date.now },
});

export const FactoryProfile = mongoose.model<IFactoryProfile>('FactoryProfile', FactoryProfileSchema);
