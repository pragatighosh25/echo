import { Router, Response } from 'express';
import multer from 'multer';
import { authenticateJWT, AuthenticatedRequest } from '../auth/auth.middleware';
import { uploadFile } from '../../services/s3';

const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // Limit to 10MB
  },
});

router.post(
  '/',
  authenticateJWT,
  upload.single('file'),
  async (req: AuthenticatedRequest, res: Response) => {
    const file = req.file;

    if (!file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
      const fileUrl = await uploadFile(file.buffer, file.originalname, file.mimetype);
      res.status(201).json({ url: fileUrl });
    } catch (error) {
      console.error('File upload error:', error);
      res.status(500).json({ error: 'Failed to upload file' });
    }
  }
);

export default router;
