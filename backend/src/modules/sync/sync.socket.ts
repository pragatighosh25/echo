import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { processDocumentOperation, BlockOperation } from './sync.service';
import {
  updateCursorPresence,
  updateTypingPresence,
  getDocumentPresence,
  removePresence,
} from '../../services/redis';

const JWT_SECRET = process.env.JWT_SECRET || 'echo_jwt_access_secret_token_12984719827';

interface SocketUser {
  id: string;
  email: string;
  name: string;
}

export const setupSyncSocket = (io: Server) => {
  // Middleware to authenticate socket connections
  io.use((socket: Socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization;

    if (!token) {
      return next(new Error('Authentication error: Token required'));
    }

    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;

    try {
      const decoded = jwt.verify(cleanToken, JWT_SECRET) as SocketUser;
      socket.data.user = decoded;
      next();
    } catch (err) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: Socket) => {
    const user = socket.data.user as SocketUser;
    console.log(`Socket connected: ${socket.id} (User: ${user.name})`);

    // Join user's private notification channel
    socket.join(`user:${user.id}`);

    // Handle joining a document room
    socket.on('join-document', async ({ documentId }: { documentId: string }) => {
      const roomName = `document:${documentId}`;
      socket.join(roomName);
      console.log(`Socket ${socket.id} joined room ${roomName}`);

      // Initialize user presence in Redis
      await updateCursorPresence(documentId, user.id, user.name, null, null);

      // Get all current active users' presence and broadcast
      const presenceList = await getDocumentPresence(documentId);
      io.to(roomName).emit('presence-broadcast', presenceList);
    });

    // Handle block operation submissions
    socket.on(
      'submit-operation',
      async ({
        documentId,
        operation,
      }: {
        documentId: string;
        operation: BlockOperation;
      }) => {
        const roomName = `document:${documentId}`;

        try {
          // Enforce clientId is matched to the authenticating user
          const sanitisedOp = {
            ...operation,
            clientId: user.id,
          };

          const result = await processDocumentOperation(documentId, sanitisedOp);

          if (result.success) {
            // Acknowledge operation to the sending client
            socket.emit('operation-acknowledged', {
              opId: operation.id,
              version: result.currentVersion,
            });

            // Broadcast the operation and the new version to everyone else in the document room
            socket.to(roomName).emit('operation-broadcast', {
              operation: sanitisedOp,
              version: result.currentVersion,
            });
          } else {
            // Version mismatch: client is lagging behind. Send operations to replay.
            socket.emit('operation-rejected', {
              opId: operation.id,
              currentVersion: result.currentVersion,
              operationsToReplay: result.operationsToReplay,
            });
          }
        } catch (error) {
          console.error(`Error processing socket operation:`, error);
          socket.emit('operation-error', {
            opId: operation.id,
            error: 'Failed to process document operation',
          });
        }
      }
    );

    // Handle cursor presence updates
    socket.on(
      'presence-update',
      async ({
        documentId,
        cursor,
        selection,
      }: {
        documentId: string;
        cursor: { line: number; ch: number } | null;
        selection: { anchor: number; head: number } | null;
      }) => {
        const roomName = `document:${documentId}`;
        await updateCursorPresence(documentId, user.id, user.name, cursor, selection);

        const presenceList = await getDocumentPresence(documentId);
        io.to(roomName).emit('presence-broadcast', presenceList);
      }
    );

    // Handle typing status updates
    socket.on(
      'typing-update',
      async ({ documentId, isTyping }: { documentId: string; isTyping: boolean }) => {
        const roomName = `document:${documentId}`;
        await updateTypingPresence(documentId, user.id, isTyping);

        const presenceList = await getDocumentPresence(documentId);
        io.to(roomName).emit('presence-broadcast', presenceList);
      }
    );

    // Handle client disconnect
    socket.on('disconnecting', async () => {
      // Find all document rooms the socket was in
      const documentRooms = Array.from(socket.rooms).filter((room) =>
        room.startsWith('document:')
      );

      for (const roomName of documentRooms) {
        const documentId = roomName.split(':')[1];
        await removePresence(documentId, user.id);

        const presenceList = await getDocumentPresence(documentId);
        // Broadcast updated presence list excluding the disconnected user
        socket.to(roomName).emit('presence-broadcast', presenceList);
      }
    });

    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });
};
