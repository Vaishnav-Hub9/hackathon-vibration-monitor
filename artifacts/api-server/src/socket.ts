import { Server } from 'socket.io';

let io: Server | null = null;

export const setIo = (server: Server): void => {
  io = server;
};

export const getIo = (): Server | null => {
  return io;
};
