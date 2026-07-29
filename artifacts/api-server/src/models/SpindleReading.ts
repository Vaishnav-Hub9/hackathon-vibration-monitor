import mongoose, { Schema, Document } from 'mongoose';

export interface IFFTBin {
  freq: number;
  amplitude: number;
}

export interface ISpindleReading extends Document {
  machineId: string;
  spindleId: string;
  timestamp: Date;
  vibrationRMS: number;
  vibrationFFT: IFFTBin[];
  acousticRMS: number;
  temperature: number;
  voltageNormalized: number;
  bpfoScore: number;
  healthScore: number;
  anomalyFlag: boolean;
}

const SpindleReadingSchema: Schema = new Schema({
  machineId: { type: String, required: true, index: true },
  spindleId: { type: String, required: true, index: true },
  timestamp: { type: Date, required: true, default: Date.now, index: true },
  vibrationRMS: { type: Number, required: true },
  vibrationFFT: [{
    freq: { type: Number, required: true },
    amplitude: { type: Number, required: true }
  }],
  acousticRMS: { type: Number, required: true },
  temperature: { type: Number, required: true },
  voltageNormalized: { type: Number, required: true },
  bpfoScore: { type: Number, required: true },
  healthScore: { type: Number, required: true },
  anomalyFlag: { type: Boolean, required: true }
});

export const SpindleReading = mongoose.model<ISpindleReading>('SpindleReading', SpindleReadingSchema);
