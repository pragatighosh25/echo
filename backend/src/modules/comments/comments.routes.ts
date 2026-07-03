import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import {
  createComment,
  getDocumentComments,
  resolveComment,
  updateComment,
  deleteComment,
} from './comments.controller';

const router = Router();

// Protect all comment endpoints with JWT authentication
router.use(authenticateJWT);

// Document-level comments routes
router.post('/documents/:documentId/comments', createComment);
router.get('/documents/:documentId/comments', getDocumentComments);

// Direct comment actions
router.post('/comments/:commentId/resolve', resolveComment);
router.patch('/comments/:commentId', updateComment);
router.delete('/comments/:commentId', deleteComment);

export default router;
