import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import { globalSearch } from './search.controller';

const router = Router();

router.get('/', authenticateJWT, globalSearch);

export default router;
