import { Router } from 'express';
import { signup, login, refresh, forgotPassword } from './auth.controller';

const router = Router();

router.post('/signup', signup);
router.post('/login', login);
router.post('/refresh', refresh);
router.post('/forgot-password', forgotPassword);

export default router;
