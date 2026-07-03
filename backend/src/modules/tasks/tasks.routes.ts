import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import {
  createTask,
  getProjectTasks,
  updateTask,
  deleteTask,
} from './tasks.controller';

const router = Router();

// Protect all task endpoints with JWT authentication
router.use(authenticateJWT);

// Project-level task routes
router.post('/projects/:projectId/tasks', createTask);
router.get('/projects/:projectId/tasks', getProjectTasks);

// Direct task routes
router.patch('/tasks/:taskId', updateTask);
router.delete('/tasks/:taskId', deleteTask);

export default router;
