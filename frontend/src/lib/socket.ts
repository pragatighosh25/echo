import { io, Socket } from 'socket.io-client';
import { getTokens } from './api';

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (socket) return socket;

  const { accessToken } = getTokens();

  socket = io(process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000', {
    auth: {
      token: accessToken,
    },
    autoConnect: false,
  });

  socket.on('connect', () => {
    console.log('Socket.IO Client connected successfully');
  });

  socket.on('disconnect', () => {
    console.log('Socket.IO Client disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket.IO Connection Error:', error);
  });

  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  if (!s.connected) {
    // Refresh token in handshake in case it changed
    const { accessToken } = getTokens();
    s.auth = { token: accessToken };
    s.connect();
  }
  return s;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
