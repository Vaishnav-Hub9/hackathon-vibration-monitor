import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
  email: string;
  /** Address that receives alert emails; falls back to `email` when empty. */
  alertEmail?: string;
  passwordHash: string;
  name: string;
  role: 'admin' | 'operator';
  createdAt: Date;
}

const UserSchema: Schema = new Schema({
  email: { type: String, required: true, unique: true },
  alertEmail: { type: String, default: '' },
  passwordHash: { type: String, required: true },
  name: { type: String, required: true },
  role: { type: String, enum: ['admin', 'operator'], required: true },
  createdAt: { type: Date, default: Date.now }
});

export const User = mongoose.model<IUser>('User', UserSchema);
