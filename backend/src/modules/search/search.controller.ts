import { Response } from 'express';
import { AuthenticatedRequest } from '../auth/auth.middleware';
import { db } from '../../services/db';

export const globalSearch = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { workspaceId, query } = req.query;

  if (!userId) return res.status(401).json({ error: 'Unauthorized' });
  if (!workspaceId || typeof workspaceId !== 'string') {
    return res.status(400).json({ error: 'workspaceId query parameter is required' });
  }

  const searchTerm = typeof query === 'string' ? query.trim() : '';
  if (!searchTerm) {
    return res.json({ documents: [], projects: [], tasks: [], comments: [], users: [] });
  }

  try {
    // 1. Verify workspace membership
    const membership = await db.workspaceMember.findUnique({
      where: {
        workspaceId_userId: {
          workspaceId,
          userId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({ error: 'Forbidden: You are not a member of this workspace' });
    }

    // 2. Fetch Projects matching name or description
    const projects = await db.project.findMany({
      where: {
        workspaceId,
        OR: [
          { name: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, description: true },
      take: 10,
    });

    const projectIds = projects.map((p) => p.id);

    // Fetch all project IDs in this workspace to scope other searches
    const allWorkspaceProjects = await db.project.findMany({
      where: { workspaceId },
      select: { id: true },
    });
    const allProjectIds = allWorkspaceProjects.map((p) => p.id);

    // 3. Fetch Documents matching title or content
    const documents = await db.document.findMany({
      where: {
        projectId: { in: allProjectIds },
        title: { contains: searchTerm, mode: 'insensitive' },
      },
      select: { id: true, title: true, projectId: true, updatedAt: true },
      take: 10,
    });

    // 4. Fetch Tasks matching title or description
    const tasks = await db.task.findMany({
      where: {
        projectId: { in: allProjectIds },
        OR: [
          { title: { contains: searchTerm, mode: 'insensitive' } },
          { description: { contains: searchTerm, mode: 'insensitive' } },
        ],
      },
      include: {
        assignee: { select: { id: true, name: true } },
      },
      take: 10,
    });

    // 5. Fetch Comments matching text
    const comments = await db.comment.findMany({
      where: {
        document: { projectId: { in: allProjectIds } },
        content: { contains: searchTerm, mode: 'insensitive' },
      },
      include: {
        user: { select: { id: true, name: true } },
      },
      take: 10,
    });

    // 6. Fetch Users (workspace members) matching name or email
    const members = await db.workspaceMember.findMany({
      where: {
        workspaceId,
        user: {
          OR: [
            { name: { contains: searchTerm, mode: 'insensitive' } },
            { email: { contains: searchTerm, mode: 'insensitive' } },
          ],
        },
      },
      include: {
        user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      },
      take: 10,
    });

    const users = members.map((m) => m.user);

    res.json({
      projects,
      documents,
      tasks,
      comments,
      users,
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
