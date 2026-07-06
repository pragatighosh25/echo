import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import path from 'path';

// Import Route modules
import authRoutes from './modules/auth/auth.routes';
import workspaceRoutes from './modules/workspaces/workspaces.routes';
import projectRoutes from './modules/projects/projects.routes';
import documentRoutes from './modules/documents/documents.routes';
import taskRoutes from './modules/tasks/tasks.routes';
import notificationRoutes from './modules/notifications/notifications.routes';
import uploadRoutes from './modules/uploads/uploads.routes';
import exportRoutes from './modules/exports/exports.routes';

const app = express();

// Middlewares
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve local uploads folder statically for S3 simulator
const uploadsPath = path.join(__dirname, '../../uploads');
app.use('/uploads', express.static(uploadsPath));

// Health Check
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Register Module Routes
app.use('/auth', authRoutes);
app.use('/workspaces', workspaceRoutes);
app.use('/projects', projectRoutes);
app.use('/documents', documentRoutes);
app.use('/tasks', taskRoutes);
app.use('/notifications', notificationRoutes);
app.use('/uploads', uploadRoutes);
app.use('/exports', exportRoutes);

// Global Error Handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[Global Error]:', err);
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  res.status(status).json({ error: message });
});

export default app;
