import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import {
  createDocument,
  getProjectDocuments,
  getDocumentById,
  updateDocument,
  deleteDocument,
} from './documents.controller';

const router = Router();

// Protect all document endpoints with JWT authentication
router.use(authenticateJWT);

// Project-level document routes
router.post('/projects/:projectId/documents', createDocument);
router.get('/projects/:projectId/documents', getProjectDocuments);

// Direct document routes
router.get('/documents/:documentId', getDocumentById);
router.patch('/documents/:documentId', updateDocument);
router.delete('/documents/:documentId', deleteDocument);

export default router;
