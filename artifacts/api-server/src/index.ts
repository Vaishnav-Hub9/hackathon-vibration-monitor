import http from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import app from "./app.js";
import { logger } from "./lib/logger.js";
import { setIo } from './socket.js';
import { sensorSimulator } from './simulator/SensorSimulator.js';

dotenv.config();

const rawPort = process.env["PORT"] || "5000";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/smartbearing';

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE']
  }
});
setIo(io);

io.on('connection', (socket) => {
  logger.info({ socketId: socket.id }, 'New client connected');
  
  socket.on('subscribe:machine', ({ machineId }) => {
    socket.join(`machine:${machineId}`);
    logger.info({ socketId: socket.id, machineId }, 'Client subscribed to machine');
  });
  
  socket.on('unsubscribe:machine', ({ machineId }) => {
    socket.leave(`machine:${machineId}`);
  });
  
  socket.join('fleet');
  
  socket.on('disconnect', () => {
    logger.info({ socketId: socket.id }, 'Client disconnected');
  });
});

async function connectDB() {
  let attempts = 0;
  while (attempts < 3) {
    try {
      await mongoose.connect(MONGODB_URI);
      logger.info('Connected to MongoDB');
      return;
    } catch (err) {
      attempts++;
      logger.error({ err, attempt: attempts }, 'MongoDB connection failed');
      if (attempts >= 3) {
        process.exit(1);
      }
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
}

connectDB().then(() => {
  server.listen(port, () => {
    logger.info({ port }, "Server listening");
    
    if (process.env.SIMULATOR_AUTO_START === 'true') {
      sensorSimulator.start();
    }
  });
});
