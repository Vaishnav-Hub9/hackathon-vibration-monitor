import { Machine } from '../models/Machine.js';
import { SpindleReading } from '../models/SpindleReading.js';
import { Alert } from '../models/Alert.js';
import { getIo } from '../socket.js';

class SensorSimulator {
  private intervalId: NodeJS.Timeout | null = null;
  private intervalMs = 3500;
  
  public start(): void {
    if (this.intervalId) return;
    this.intervalId = setInterval(() => this.runSimulationCycle(), this.intervalMs);
    console.log('Sensor simulator started');
  }

  public stop(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
      console.log('Sensor simulator stopped');
    }
  }
  
  public async injectFault(machineId: string): Promise<void> {
    await Machine.updateOne({ machineId }, { $set: { status: 'critical' } });
  }

  private async runSimulationCycle(): Promise<void> {
    try {
      const machines = await Machine.find().lean();
      const io = getIo();
      
      for (const machine of machines) {
        for (let i = 1; i <= 5; i++) {
          const spindleId = `SN00${i}`;
          
          let baseVibration = 0.5;
          let baseTemp = 40;
          let healthScore = 95;
          
          if (machine.status === 'warning') {
            baseVibration = 1.2 + Math.random() * 0.5;
            baseTemp = 55 + Math.random() * 10;
            healthScore = 65 - Math.random() * 10;
          } else if (machine.status === 'critical') {
            baseVibration = 2.0 + Math.random() * 1.5;
            baseTemp = 70 + Math.random() * 15;
            healthScore = 35 - Math.random() * 15;
          } else if (machine.status === 'degrading') {
             baseVibration = 1.0 + Math.random() * 0.5;
             baseTemp = 50 + Math.random() * 10;
             healthScore = 75 - Math.random() * 5;
             
             if (Math.random() < 0.05) {
                await Machine.updateOne({ machineId: machine.machineId }, { $set: { status: 'warning' } });
             }
          } else {
             baseVibration = 0.3 + Math.random() * 0.5;
             baseTemp = 35 + Math.random() * 10;
             healthScore = 90 + Math.random() * 10;
          }
          
          const vibrationRMS = +(baseVibration + (Math.random() - 0.5) * 0.2).toFixed(3);
          const temperature = +(baseTemp + (Math.random() - 0.5) * 2).toFixed(1);
          
          // Generate 2048-point raw vibration signal to feed into ML model
          const signal = new Array(2048).fill(0);
          for (let s = 0; s < 2048; s++) {
            signal[s] = Math.sin(s * 0.1) * vibrationRMS + (Math.random() - 0.5) * 0.1;
            if (machine.status === 'critical') {
               if (s % 100 < 5) signal[s] += 4.0 * (Math.random() + 0.5); 
            } else if (machine.status === 'warning') {
               if (s % 100 < 5) signal[s] += 1.5 * (Math.random() + 0.5); 
            }
          }

          let mlLabel = "Healthy";
          let mlConfidence = 0.99;
          try {
             const res = await fetch("http://127.0.0.1:8000/predict", {
                 method: "POST",
                 headers: { "Content-Type": "application/json" },
                 body: JSON.stringify({ signal })
             });
             if (res.ok) {
                 const mlData = await res.json();
                 if (mlData.label) {
                     mlLabel = mlData.label;
                     mlConfidence = mlData.confidence;
                 }
             }
          } catch (e) {
             // Silently fallback if ML server is not running
          }

          const anomalyFlag = mlLabel !== "Healthy";
          const finalHealthScore = anomalyFlag ? Math.max(10, 100 - (mlConfidence * 100)) : Math.min(100, mlConfidence * 100);
          const bpfoScore = +(anomalyFlag ? mlConfidence : 0.1 + Math.random() * 0.2).toFixed(3);
          
          const vibrationFFT = [];
          for (let f = 0; f < 128; f++) {
             const freq = f * (1000 / 128);
             let amplitude = Math.random() * 0.1;
             
             if (anomalyFlag && Math.abs(freq - 157) < 10) {
               amplitude = 0.8 + Math.random() * 0.4;
             }
             vibrationFFT.push({ freq: +freq.toFixed(1), amplitude: +amplitude.toFixed(3) });
          }
          
          const reading = new SpindleReading({
            machineId: machine.machineId,
            spindleId,
            vibrationRMS,
            vibrationFFT,
            acousticRMS: +(0.3 + Math.random() * 0.2).toFixed(3),
            temperature,
            voltageNormalized: +(220 + (Math.random() - 0.5) * 5).toFixed(1),
            bpfoScore,
            healthScore: Math.round(finalHealthScore),
            anomalyFlag
          });
          
          await reading.save();
          
          if (finalHealthScore < 70) {
            const severity = finalHealthScore < 40 ? 'critical' : 'warning';
            const existingAlert = await Alert.findOne({ machineId: machine.machineId, spindleId, status: 'active' });
            
            if (!existingAlert || existingAlert.severity !== severity) {
               if (existingAlert) {
                  existingAlert.status = 'resolved';
                  existingAlert.resolvedAt = new Date();
                  await existingAlert.save();
               }
               
               const newAlert = new Alert({
                 machineId: machine.machineId,
                 spindleId,
                 severity,
                 type: severity.toUpperCase(),
                 message: anomalyFlag ? `${mlLabel} detected with ${(mlConfidence*100).toFixed(1)}% confidence.` : 'Vibration RMS elevated. Monitor closely.'
               });
               await newAlert.save();
               
               if (io) {
                 const newAlertObj = newAlert.toObject();
                 io.emit('alert:new', {
                   id: newAlertObj._id.toString(),
                   nodeId: spindleId,
                   machineId: machine.machineId,
                   machineName: machine.name,
                   type: severity.toUpperCase(),
                   message: newAlertObj.message,
                   anomalyScore: bpfoScore,
                   timestamp: newAlertObj.detectedAt.toISOString().replace('T', ' ').substring(0, 19),
                   status: newAlertObj.status,
                   estimatedTimeToFailure: severity === 'critical' ? '6-18 hours' : '3-7 days'
                 });
               }
            }
          }
          
          if (io) {
            io.to(`machine:${machine.machineId}`).emit('sensor:update', {
              machineId: machine.machineId,
              spindleId,
              healthScore: Math.round(finalHealthScore),
              vibrationRMS,
              temperature,
              bpfoScore,
              anomalyFlag,
              timestamp: reading.timestamp.toISOString()
            });
          }
        }
      }
      
      if (io) {
        const totalMachines = await Machine.countDocuments();
        const criticalCount = await Machine.countDocuments({ status: 'critical' });
        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const alertsToday = await Alert.countDocuments({ detectedAt: { $gte: startOfDay } });
        
        io.to('fleet').emit('fleet:summary', {
           totalMachines,
           criticalCount,
           avgHealthScore: 77,
           alertsToday
        });
      }
      
    } catch (err) {
      console.error('Simulator error:', err);
    }
  }
}

export const sensorSimulator = new SensorSimulator();
