import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';
import { z } from 'zod';
import { v4 as uuidv4 } from 'uuid';

const createDocumentSchema = z.object({
  title: z.string().min(1),
});

const updateDocumentSchema = z.object({
  title: z.string().min(1).optional(),
});

export const createDocument = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = createDocumentSchema.parse(req.body);

    const project = await db.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Validate workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    // Default structure: One empty paragraph block
    const initialContent = [
      {
        id: uuidv4(),
        type: 'paragraph',
        content: '',
      },
    ];

    const document = await db.document.create({
      data: {
        projectId,
        title: validated.title,
        content: initialContent,
        version: 0,
      },
    });

    // Kafka and activity log
    const details = { workspaceId: project.workspaceId, projectId, documentId: document.id, title: document.title, createdBy: userId };
    await publishEvent('workspace.events', 'DOCUMENT_CREATED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'DOCUMENT_CREATED',
        details,
      },
    });

    res.status(201).json(document);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectDocuments = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    // Verify workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId,
        },
      },
    });
    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this workspace' });
    }

    const documents = await db.document.findMany({
      where: { projectId },
      select: {
        id: true,
        projectId: true,
        title: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { updatedAt: 'desc' },
    });

    res.json(documents);
  } catch (error) {
    console.error('Get project documents error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getDocumentById = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const document = await db.document.findUnique({
      where: { id: documentId },
      include: {
        project: true,
      },
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

    res.json({
      id: document.id,
      projectId: document.projectId,
      title: document.title,
      content: document.content,
      version: document.version,
      createdAt: document.createdAt,
      updatedAt: document.updatedAt,
      workspaceId: document.project.workspaceId,
      role: membership.role,
    });
  } catch (error) {
    console.error('Get document by ID error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateDocument = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = updateDocumentSchema.parse(req.body);

    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: document.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    const updated = await db.document.update({
      where: { id: documentId },
      data: validated,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteDocument = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { documentId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const document = await db.document.findUnique({
      where: { id: documentId },
      include: { project: true },
    });
    if (!document) return res.status(404).json({ error: 'Document not found' });

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: document.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Only owners and admins can delete documents' });
    }

    await db.document.delete({
      where: { id: documentId },
    });

    const details = { workspaceId: document.project.workspaceId, projectId: document.projectId, documentId, deletedBy: userId };
    await publishEvent('workspace.events', 'DOCUMENT_DELETED', details);

    res.json({ message: 'Document successfully deleted' });
  } catch (error) {
    console.error('Delete document error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
