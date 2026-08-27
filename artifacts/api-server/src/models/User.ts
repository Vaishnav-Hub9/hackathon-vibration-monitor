import mongoose, { Schema, Document } from 'mongoose';

export type UserRole = 'maintenance_engineer' | 'admin' | 'factory_manager' | 'worker' | 'customer' | 'operator';

export interface IUser extends Document {
  email: string;
  /** Address that receives alert emails; falls back to `email` when empty. */
  alertEmail?: string;
  /** Phone number (E.164) that receives WhatsApp alerts; empty = disabled. */
  alertWhatsapp?: string;
  passwordHash: string;
  name: string;
  role: UserRole;
  /** Factory units this user can access. Empty means unassigned. */
  factoryUnits: string[];
  /** Customer-facing account or brand name, when the role is customer. */
  customerName?: string;
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  alertEmail: { type: String, default: '' },
  alertWhatsapp: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['maintenance_engineer', 'admin', 'factory_manager', 'worker', 'customer', 'operator'], required: true },
  factoryUnits: { type: [String], default: [] },
  customerName: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);
