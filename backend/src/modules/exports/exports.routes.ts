import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import { triggerDocumentExport, getExportJobStatus } from './exports.controller';

const router = Router();

// Protect all export routes with JWT
router.use(authenticateJWT);

router.post('/documents/:documentId', triggerDocumentExport);
router.get('/jobs/:jobId', getExportJobStatus);

export default router;
