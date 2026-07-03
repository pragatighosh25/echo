import { Router } from 'express';
import { authenticateJWT, requireWorkspaceRole } from '../auth/auth.middleware';
import {
  createWorkspace,
  getWorkspaces,
  inviteMember,
  removeMember,
  transferOwnership,
  archiveWorkspace,
  deleteWorkspace,
  updateWorkspace,
  getWorkspaceActivity,
} from './workspaces.controller';

const router = Router();

// Protect all workspace routes with JWT authentication
router.use(authenticateJWT);

router.post('/', createWorkspace);
router.get('/', getWorkspaces);

router.get(
  '/:workspaceId/activity',
  requireWorkspaceRole(['OWNER', 'ADMIN', 'EDITOR', 'VIEWER']),
  getWorkspaceActivity
);

router.patch(
  '/:workspaceId',
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  updateWorkspace
);

router.post(
  '/:workspaceId/invite',
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  inviteMember
);

router.delete(
  '/:workspaceId/members/:memberUserId',
  requireWorkspaceRole(['OWNER', 'ADMIN']),
  removeMember
);

router.post(
  '/:workspaceId/transfer-owner',
  requireWorkspaceRole(['OWNER']),
  transferOwnership
);

router.post(
  '/:workspaceId/archive',
  requireWorkspaceRole(['OWNER']),
  archiveWorkspace
);

router.delete(
  '/:workspaceId',
  requireWorkspaceRole(['OWNER']),
  deleteWorkspace
);

export default router;
