import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import { triggerAIPendingJob, getAIJobStatus } from './ai.controller';

const router = Router();

// Secure AI endpoints with JWT
router.use(authenticateJWT);

router.post('/process', triggerAIPendingJob);
router.get('/jobs/:jobId', getAIJobStatus);

export default router;
