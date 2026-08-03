import mongoose, { Schema, Document } from 'mongoose';

export interface IFFTBin {
  freq: number;
  amplitude: number;
}

export interface ISpindleReading extends Document {
  machineId: string;
  spindleId: string;
  timestamp: Date;
  accel_x: number;
  accel_y: number;
  accel_z: number;
  rpm: number;
  vibrationFFT: IFFTBin[];
  acousticRMS: number;
  temperature: number;
  voltageNormalized: number;
  bpfoScore: number;
  healthScore: number;
  anomalyFlag: boolean;
  mlLabel?: string;
  mlConfidence?: number;
  waveform?: number[];
  source?: 'simulator' | 'edge';
}

const SpindleReadingSchema: Schema = new Schema({
  machineId: { type: String, required: true, index: true },
  spindleId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  accel_x: { type: Number, required: true },
  accel_y: { type: Number, required: true },
  accel_z: { type: Number, required: true },
  rpm: { type: Number, required: true },
  vibrationFFT: [{
    freq: { type: Number, required: true },
    amplitude: { type: Number, required: true }
  }],
  acousticRMS: { type: Number, required: true },
  temperature: { type: Number, required: true },
  voltageNormalized: { type: Number, required: true },
  bpfoScore: { type: Number, required: true },
  healthScore: { type: Number, required: true },
  anomalyFlag: { type: Boolean, required: true },
  mlLabel: { type: String },
  mlConfidence: { type: Number },
  waveform: [{ type: Number }],
  source: { type: String, enum: ['simulator', 'edge'], default: 'simulator' }
});

export const SpindleReading = mongoose.model<ISpindleReading>('SpindleReading', SpindleReadingSchema);
