import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthUser {
  id: string;
  organization_id: string;
  role: string;
  email?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing or invalid authorization header' });
    }

    const token = authHeader.substring(7);
    const secret = process.env.JWT_SECRET ?? 'your-secret-key';
    
    const decoded = jwt.verify(token, secret) as AuthUser;
    
    if (!decoded.id || !decoded.organization_id || !decoded.role) {
      return res.status(401).json({ error: 'Invalid token: missing required fields' });
    }

    req.user = decoded;
    next();
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Token verification failed';
    res.status(401).json({ error: errorMessage });
  }
};

export const optionalAuthMiddleware = (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const secret = process.env.JWT_SECRET ?? 'your-secret-key';
      
      const decoded = jwt.verify(token, secret) as AuthUser;
      
      if (decoded.id && decoded.organization_id && decoded.role) {
        req.user = decoded;
      }
    }
    next();
  } catch (error) {
    next();
  }
};
