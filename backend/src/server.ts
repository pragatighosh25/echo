import http from 'http';
import { Server } from 'socket.io';
import app from './app';
import { connectDB, db } from './services/db';
import { connectRedis } from './services/redis';
import { connectKafka, subscribeToEvents } from './services/kafka';
import { setupSyncSocket } from './modules/sync/sync.socket';

const PORT = process.env.PORT || 4000;
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: '*', // Adjust in production
    methods: ['GET', 'POST'],
  },
});

// Setup sync socket events
setupSyncSocket(io);

// Boot server and connect infrastructure
const bootServer = async () => {
  try {
    // Connect database & cache
    await connectDB();
    await connectRedis();

    // Connect Kafka & setup consumers
    await connectKafka();

    // Start Kafka consumer to listen for notification events
    await subscribeToEvents('notification.events', async (_key, payload) => {
      if (!payload || !payload.userId || !payload.title || !payload.body) {
        console.warn('Received invalid notification event payload:', payload);
        return;
      }

      try {
        // 1. Persist notification in database
        const notification = await db.notification.create({
          data: {
            userId: payload.userId,
            title: payload.title,
            body: payload.body,
            metadata: payload.metadata || null,
          },
        });

        // 2. Broadcast in real time via Socket.IO to the user's private channel
        io.to(`user:${payload.userId}`).emit('notification-alert', notification);
        console.log(`[Notification Consumer] Recorded & pushed alert to user:${payload.userId}`);
      } catch (err) {
        console.error('Error handling notification event:', err);
      }
    });

    server.listen(PORT, () => {
      console.log(`Echo REST and WebSocket Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start Echo Server:', error);
    process.exit(1);
  }
};

bootServer();

// Handle graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM signal received. Closing HTTP server...');
  server.close(() => {
    console.log('HTTP server closed.');
    process.exit(0);
  });
});
