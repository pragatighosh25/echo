import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { db } from '../../services/db';

const JWT_SECRET = process.env.JWT_SECRET || 'echo_jwt_access_secret_token_12984719827';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    name: string;
  };
}

export const authenticateJWT = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Access token missing or invalid' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET) as {
      id: string;
      email: string;
      name: string;
    };
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired access token' });
  }
};

// Workspace RBAC authorization middleware
export const requireWorkspaceRole = (roles: string[]) => {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const userId = req.user?.id;
    const workspaceId = req.params.workspaceId || req.body.workspaceId;

    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!workspaceId) {
      return res.status(400).json({ error: 'Workspace ID is required for this action' });
    }

    try {
      const membership = await db.workspaceMember.findUnique({
        where: {
          workspaceId_userId: {
            workspaceId,
            userId,
          },
        },
      });

      if (!membership || !roles.includes(membership.role)) {
        return res
          .status(403)
          .json({ error: 'Forbidden: Insufficient workspace permissions' });
      }

      next();
    } catch (error) {
      console.error('Error verifying workspace role:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
};
