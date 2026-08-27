import { io, Socket } from 'socket.io-client';

const API_URL = import.meta.env.VITE_API_URL || ''; // same-origin; Vite dev proxy forwards /socket.io to the backend

let socketInstance: Socket | null = null;
let socketToken: string | null = null;

export const getSocket = (): Socket => {
  const token = localStorage.getItem('token');
  if (!socketInstance || socketToken !== token) {
    socketInstance?.disconnect();
    socketToken = token;
    socketInstance = io(API_URL, {
      auth: {
        token
      },
      transports: ['websocket', 'polling']
    });
  }
  return socketInstance;
};

export const disconnectSocket = (): void => {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
    socketToken = null;
  }
};
