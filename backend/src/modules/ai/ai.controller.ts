import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { aiQueue } from '../../services/queue';
import { z } from 'zod';

const aiRequestSchema = z.object({
  feature: z.enum([
    'summarize',
    'improve_writing',
    'rewrite_paragraph',
    'continue_writing',
    'meeting_summary',
    'extract_tasks',
    'explain_text',
    'generate_title',
    'executive_summary',
  ]),
  documentId: z.string(),
  text: z.string().min(5),
});

export const triggerAIPendingJob = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = aiRequestSchema.parse(req.body);

    // Queue the AI job in BullMQ
    const job = await aiQueue.add(
      'ai-processing',
      {
        userId,
        documentId: validated.documentId,
        feature: validated.feature,
        text: validated.text,
      },
      {
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    res.status(202).json({
      jobId: job.id,
      status: 'active',
      message: 'AI task has been queued for background processing.',
    });
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Trigger AI Job error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getAIJobStatus = async (req: AuthenticatedRequest, res: Response) => {
  const { jobId } = req.params;

  try {
    const job = await aiQueue.getJob(jobId);

    if (!job) {
      return res.status(404).json({ error: 'AI Job not found or completed' });
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
    console.error('Get AI Job status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
