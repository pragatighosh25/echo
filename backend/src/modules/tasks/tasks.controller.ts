import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';
import { z } from 'zod';

const createTaskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']).default('TODO'),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labels: z.array(z.string()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().min(1).optional(),
  description: z.string().nullable().optional(),
  status: z.enum(['TODO', 'IN_PROGRESS', 'REVIEW', 'COMPLETED']).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  assigneeId: z.string().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  labels: z.array(z.string()).optional(),
});

export const createTask = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = createTaskSchema.parse(req.body);

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

    const task = await db.task.create({
      data: {
        projectId,
        title: validated.title,
        description: validated.description,
        status: validated.status,
        priority: validated.priority,
        assigneeId: validated.assigneeId,
        dueDate: validated.dueDate ? new Date(validated.dueDate) : null,
        labels: validated.labels,
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Kafka and activity log
    const details = { workspaceId: project.workspaceId, projectId, taskId: task.id, title: task.title, createdBy: userId };
    await publishEvent('task.events', 'TASK_CREATED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'TASK_CREATED',
        details,
      },
    });

    // If assignee was added, trigger notifications
    if (task.assigneeId) {
      await publishEvent('notification.events', 'TASK_ASSIGNED', {
        type: 'TASK_ASSIGNED',
        userId: task.assigneeId,
        title: 'New Task Assigned',
        body: `You have been assigned the task: "${task.title}"`,
        metadata: { taskId: task.id },
      });
    }

    res.status(201).json(task);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getProjectTasks = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { projectId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
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
    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this workspace' });
    }

    const tasks = await db.task.findMany({
      where: { projectId },
      include: {
        assignee: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json(tasks);
  } catch (error) {
    console.error('Get project tasks error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateTask = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { taskId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = updateTaskSchema.parse(req.body);

    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Validate workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    const originalAssignee = task.assigneeId;

    const dataToUpdate: any = { ...validated };
    if (validated.dueDate !== undefined) {
      dataToUpdate.dueDate = validated.dueDate ? new Date(validated.dueDate) : null;
    }

    const updatedTask = await db.task.update({
      where: { id: taskId },
      data: dataToUpdate,
      include: {
        assignee: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify new assignee if changed
    if (updatedTask.assigneeId && updatedTask.assigneeId !== originalAssignee) {
      await publishEvent('notification.events', 'TASK_ASSIGNED', {
        type: 'TASK_ASSIGNED',
        userId: updatedTask.assigneeId,
        title: 'New Task Assigned',
        body: `You have been assigned the task: "${updatedTask.title}"`,
        metadata: { taskId: updatedTask.id },
      });
    }

    // Kafka and activity log for status change
    if (validated.status && validated.status !== task.status) {
      const details = { workspaceId: task.project.workspaceId, projectId: task.projectId, taskId: task.id, title: task.title, oldStatus: task.status, newStatus: validated.status, updatedBy: userId };
      await publishEvent('task.events', 'TASK_STATUS_CHANGED', details);
      await db.activityLog.create({
        data: {
          userId,
          action: 'TASK_STATUS_CHANGED',
          details,
        },
      });
    }

    res.json(updatedTask);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteTask = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { taskId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const task = await db.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    // Validate workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId: task.project.workspaceId,
          userId,
        },
      },
    });
    if (!membership || !['OWNER', 'ADMIN', 'EDITOR'].includes(membership.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient permissions' });
    }

    await db.task.delete({
      where: { id: taskId },
    });

    const details = { workspaceId: task.project.workspaceId, projectId: task.projectId, taskId, deletedBy: userId };
    await publishEvent('task.events', 'TASK_DELETED', details);

    res.json({ message: 'Task successfully deleted' });
  } catch (error) {
    console.error('Delete task error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
