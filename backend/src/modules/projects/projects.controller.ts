import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';
import { z } from 'zod';

const createProjectSchema = z.object({
  name: z.string().min(2),
  description: z.string().optional(),
});

const updateProjectSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
});

export const createProject = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = createProjectSchema.parse(req.body);

    const project = await db.project.create({
      data: {
        workspaceId,
        name: validated.name,
        description: validated.description,
      },
    });

    // Kafka and Activity log
    const details = { workspaceId, projectId: project.id, name: project.name, createdBy: userId };
    await publishEvent('workspace.events', 'PROJECT_CREATED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'PROJECT_CREATED',
        details,
      },
    });

    res.status(201).json(project);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjects = async (req: AuthenticatedRequest, res: Response) => {
  const { workspaceId } = req.params;

  try {
    const projects = await db.project.findMany({
      where: { workspaceId },
      include: {
        documents: {
          select: { id: true, title: true, version: true, updatedAt: true },
        },
        tasks: {
          select: { id: true, title: true, status: true, priority: true },
        },
      },
    });

    res.json(projects);
  } catch (error) {
    console.error('Get projects error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateProject = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = updateProjectSchema.parse(req.body);

    const project = await db.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

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

    const updated = await db.project.update({
      where: { id: projectId },
      data: validated,
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteProject = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const project = await db.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Only owners and admins can delete projects' });
    }

    await db.project.delete({
      where: { id: projectId },
    });

    // Kafka event
    const details = { workspaceId: project.workspaceId, projectId: project.id, deletedBy: userId };
    await publishEvent('workspace.events', 'PROJECT_DELETED', details);

    res.json({ message: 'Project successfully deleted' });
  } catch (error) {
    console.error('Delete project error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
