import { Router } from 'express';
import { authenticateJWT, requireWorkspaceRole } from '../auth/auth.middleware';
import {
  createProject,
  getProjects,
  updateProject,
  deleteProject,
} from './projects.controller';

const router = Router();

// Require JWT for all project operations
router.use(authenticateJWT);

// Projects are child routes under workspaces for creation/listing
router.post(
  '/workspaces/:workspaceId/projects',
  requireWorkspaceRole(['OWNER', 'ADMIN', 'EDITOR']),
  createProject
);

router.get(
  '/workspaces/:workspaceId/projects',
  requireWorkspaceRole(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']),
  getProjects
);

// Direct project updates & deletes are authorized inside the controller
router.patch('/projects/:projectId', updateProject);
router.delete('/projects/:projectId', deleteProject);

export default router;
