import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { exportQueue } from '../../services/queue';
import { db } from '../../services/db';
import { z } from 'zod';

const triggerExportSchema = z.object({
  format: z.enum(['pdf']),
});

export const triggerDocumentExport = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = triggerExportSchema.parse(req.body);

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    // Verify workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: document.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this workspace' });
    }

    const job = await exportQueue.add(
      'document-export',
      {
        userId,
        documentId,
        format: validated.format,
      },
      {
        removeOnComplete: false,
        removeOnFail: false,
      }
    );

    res.status(202).json({
      jobId: job.id,
      status: 'active',
      message: 'Document export job queued successfully.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Trigger export error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getExportJobStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;

  try {
    const job = await exportQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'Export Job not found or completed' });
    }

    const state = await job.getState();
    const result = job.returnvalue;

    res.json({
      jobId: job.id,
      status: state,
      progress: job.progress,
      result: result || null,
      failedReason: job.failedReason || null,
    });
  } catch (error) {
    console.error('Get export job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
