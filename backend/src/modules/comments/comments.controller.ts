import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';
import { z } from 'zod';

const createCommentSchema = z.object({
  content: z.string().min(1),
  blockId: z.string().nullable().optional(),
  parentId: z.string().nullable().optional(),
});

const updateCommentSchema = z.object({
  content: z.string().min(1),
});

export const createComment = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = createCommentSchema.parse(req.body);

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

    const comment = await db.comment.create({
      data: {
        documentId,
        userId,
        content: validated.content,
        blockId: validated.blockId,
        parentId: validated.parentId,
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
    });

    // Kafka and activity log
    const details = { workspaceId: document.project.workspaceId, documentId, commentId: comment.id, blockId: comment.blockId, createdBy: userId };
    await publishEvent('comments.events', 'COMMENT_ADDED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'COMMENT_ADDED',
        details,
      },
    });

    // Check for @mentions in comment content (e.g. @JohnDoe)
    const mentionRegex = /@\[?([^\]\n]+)\]?/g;
    const matches = validated.content.match(mentionRegex);
    if (matches) {
      for (const match of matches) {
        const name = match.replace('@', '').trim();
        // Lookup user by name (case-insensitive)
        const userToNotify = await db.user.findFirst({
          where: {
            name: {
              equals: name,
              mode: 'insensitive',
            },
          },
        });

        if (userToNotify && userToNotify.id !== userId) {
          await publishEvent('notification.events', 'COMMENT_MENTION', {
            type: 'COMMENT_MENTION',
            userId: userToNotify.id,
            title: 'You were mentioned in a comment',
            body: `${req.user?.name} mentioned you: "${validated.content.substring(0, 50)}..."`,
            metadata: { documentId, commentId: comment.id },
          });
        }
      }
    }

    res.status(201).json(comment);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDocumentComments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
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

    const comments = await db.comment.findMany({
      where: { documentId, parentId: null }, // Fetch parent comments
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        replies: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(comments);
  } catch (error) {
    console.error('Get document comments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const resolveComment = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { commentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: { document: { include: { project: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // Verify workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: comment.document.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    const updated = await db.comment.update({
      where: { id: commentId },
      data: { resolved: true },
    });

    // Kafka and activity log
    const details = { workspaceId: comment.document.project.workspaceId, documentId: comment.documentId, commentId, resolvedBy: userId };
    await publishEvent('comments.events', 'COMMENT_RESOLVED', details);

    res.json(updated);
  } catch (error) {
    console.error('Resolve comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateComment = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { commentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = updateCommentSchema.parse(req.body);

    const comment = await db.comment.findUnique({
      where: { id: commentId },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    if (comment.userId !== userId) {
      return res.status(403).json({ error: 'Forbidden: You can only edit your own comments' });
    }

    const updated = await db.comment.update({
      where: { id: commentId },
      data: { content: validated.content },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteComment = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { commentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const comment = await db.comment.findUnique({
      where: { id: commentId },
      include: { document: { include: { project: true } } },
    });
    if (!comment) return res.status(404).json({ error: 'Comment not found' });

    // A user can delete their own comment. Owners & Admins can delete any comment.
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: comment.document.project.workspaceId,
          userId,
        },
      },
    });

    const isAuthor = comment.userId === userId;
    const isAdmin = membership && ['OWNER', 'ADMIN'].includes(membership.role);

    if (!isAuthor && !isAdmin) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this comment' });
    }

    await db.comment.delete({
      where: { id: commentId },
    });

    res.json({ message: 'Comment successfully deleted' });
  } catch (error) {
    console.error('Delete comment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
