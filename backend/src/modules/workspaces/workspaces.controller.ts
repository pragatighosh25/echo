import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';
import { publishEvent } from '../../services/kafka';
import { z } from 'zod';

const createWorkspaceSchema = z.object({
  name: z.string().min(2),
  slug: z.string().min(2),
});

const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.enum(['ADMIN', 'EDITOR', 'VIEWER']),
});

const updateWorkspaceSchema = z.object({
  name: z.string().min(2).optional(),
  slug: z.string().min(2).optional(),
});

export const createWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = createWorkspaceSchema.parse(req.body);

    // Verify slug uniqueness
    const existing = await db.workspace.findUnique({
      where: { slug: validated.slug },
    });
    if (existing) {
      return res.status(400).json({ error: 'Workspace URL slug already in use' });
    }

    const workspace = await db.workspace.create({
      data: {
        name: validated.name,
        slug: validated.slug,
        members: {
          create: {
            userId,
            role: 'OWNER',
          },
        },
      },
      include: {
        members: true,
      },
    });

    // Publish to Kafka & Log Activity
    const details = { workspaceId: workspace.id, name: workspace.name, creatorId: userId };
    await publishEvent('workspace.events', 'WORKSPACE_CREATED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'WORKSPACE_CREATED',
        details,
      },
    });

    res.status(201).json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Create workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkspaces = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const workspaces = await db.workspace.findMany({
      where: {
        members: {
          some: { userId },
        },
        archived: false,
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
      },
    });

    res.json(workspaces);
  } catch (error) {
    console.error('Get workspaces error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const inviteMember = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = inviteMemberSchema.parse(req.body);

    const targetUser = await db.user.findUnique({
      where: { email: validated.email },
    });

    if (!targetUser) {
      return res.status(404).json({ error: 'User not found with this email' });
    }

    // Check if already member
    const existingMember = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: targetUser.id,
        },
      },
    });

    if (existingMember) {
      return res.status(400).json({ error: 'User is already a member of this workspace' });
    }

    const membership = await db.workspaceMember.create({
      data: {
        workspaceId,
        userId: targetUser.id,
        role: validated.role,
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
    });

    // Notify & Kafka log
    const details = { workspaceId, invitedUserId: targetUser.id, role: validated.role, invitedBy: userId };
    await publishEvent('workspace.events', 'MEMBER_INVITED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'MEMBER_INVITED',
        details,
      },
    });

    // Send Notification to consumer
    await publishEvent('notification.events', 'WORKSPACE_INVITE', {
      type: 'WORKSPACE_INVITE',
      userId: targetUser.id,
      title: 'Workspace Invitation',
      body: `You have been invited to join workspace ${workspaceId} as an ${validated.role}`,
      metadata: { workspaceId },
    });

    res.status(201).json(membership);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Invite member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const removeMember = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId, memberUserId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const member = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    });

    if (!member) {
      return res.status(404).json({ error: 'Member not found' });
    }

    if (member.role === 'OWNER') {
      return res.status(400).json({ error: 'Cannot remove the workspace owner. Transfer ownership first.' });
    }

    await db.workspaceMember.delete({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId: memberUserId,
        },
      },
    });

    // Publish events
    const details = { workspaceId, removedUserId: memberUserId, removedBy: userId };
    await publishEvent('workspace.events', 'MEMBER_REMOVED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'MEMBER_REMOVED',
        details,
      },
    });

    res.json({ message: 'Member successfully removed' });
  } catch (error) {
    console.error('Remove member error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const transferOwnership = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  const { newOwnerId } = req.body;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const currentMembership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });

    if (!currentMembership || currentMembership.role !== 'OWNER') {
      return res.status(403).json({ error: 'Only the Owner can transfer ownership' });
    }

    const newOwnerMembership = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
    });

    if (!newOwnerMembership) {
      return res.status(400).json({ error: 'New owner must be a member of the workspace' });
    }

    await db.$transaction([
      db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId } },
        data: { role: 'ADMIN' }, // Demote original owner to ADMIN
      }),
      db.workspaceMember.update({
        where: { workspaceId_userId: { workspaceId, userId: newOwnerId } },
        data: { role: 'OWNER' }, // Promote new owner
      }),
    ]);

    const details = { workspaceId, oldOwner: userId, newOwner: newOwnerId };
    await publishEvent('workspace.events', 'OWNER_TRANSFERRED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'OWNER_TRANSFERRED',
        details,
      },
    });

    res.json({ message: 'Workspace ownership successfully transferred' });
  } catch (error) {
    console.error('Transfer ownership error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const archiveWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: { archived: true },
    });

    const details = { workspaceId, archivedBy: userId };
    await publishEvent('workspace.events', 'WORKSPACE_ARCHIVED', details);
    await db.activityLog.create({
      data: {
        userId,
        action: 'WORKSPACE_ARCHIVED',
        details,
      },
    });

    res.json({ message: 'Workspace successfully archived', workspace });
  } catch (error) {
    console.error('Archive workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const deleteWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const workspace = await db.workspace.findUnique({
      where: { id: workspaceId },
    });
    if (!workspace) {
      return res.status(404).json({ error: 'Workspace not found' });
    }

    // Cascade delete workspace in database
    await db.workspace.delete({
      where: { id: workspaceId },
    });

    const details = { workspaceId, deletedBy: userId, name: workspace.name };
    await publishEvent('workspace.events', 'WORKSPACE_DELETED', details);

    res.json({ message: 'Workspace successfully deleted' });
  } catch (error) {
    console.error('Delete workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const updateWorkspace = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId } = req.params;
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const validated = updateWorkspaceSchema.parse(req.body);

    const workspace = await db.workspace.update({
      where: { id: workspaceId },
      data: validated,
    });

    const details = { workspaceId, updatedBy: userId, changes: validated };
    await publishEvent('workspace.events', 'WORKSPACE_UPDATED', details);

    res.json(workspace);
  } catch (error) {
    if (error instanceof z.ZodError) return res.status(400).json({ error: error.errors });
    console.error('Update workspace error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const getWorkspaceActivity = async (req: AuthenticatedRequest, res: Response) => {
  const { workspaceId } = req.params;
  try {
    const logs = await db.activityLog.findMany({
      where: {
        details: {
          path: ['workspaceId'],
          equals: workspaceId,
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    res.json(logs);
  } catch (error) {
    console.error('Get workspace activity error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
