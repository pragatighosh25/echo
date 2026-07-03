import { Router } from 'express';
import { authenticateJWT } from '../auth/auth.middleware';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
} from './notifications.controller';

const router = Router();

// Protect all notification routes with JWT
router.use(authenticateJWT);

router.get('/', getNotifications);
router.post('/read-all', markAllAsRead);
router.post('/:notificationId/read', markAsRead);

export default router;
