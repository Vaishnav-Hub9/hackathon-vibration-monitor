import { Request, Response, NextFunction, type RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { UserRole } from '../models/User.js';

const JWT_SECRET = process.env.JWT_SECRET || 'smartbearing_jwt_secret_change_in_production';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
  factoryUnits?: string[];
  customerName?: string;
}

export interface AuthRequest extends Request {
  user: AuthUser;
}

export const authenticateJWT = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1];

    jwt.verify(token, JWT_SECRET, (err, user) => {
      if (err) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }
      if (!user || typeof user === 'string' || typeof user !== 'object' || typeof user.id !== 'string') {
        res.status(403).json({ success: false, error: 'Invalid session' });
        return;
      }
      req.user = user as AuthUser;
      next();
    });
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};

export const requireRoles = (...allowedRoles: UserRole[]): RequestHandler => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const role = (req as AuthRequest).user?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ success: false, error: 'This action is not available for your role' });
      return;
    }
    next();
  };
};

export const hasGlobalFactoryAccess = (user: AuthUser): boolean =>
  user.role === 'maintenance_engineer' || user.role === 'admin';

export const factoryScope = (user: AuthUser, requestedUnit?: string): Record<string, unknown> | null => {
  if (hasGlobalFactoryAccess(user)) {
    return requestedUnit ? { factoryUnit: requestedUnit } : {};
  }

  const allowedUnits = user.factoryUnits ?? [];
  if (requestedUnit && !allowedUnits.includes(requestedUnit)) return null;
  return allowedUnits.length > 0 ? { factoryUnit: { $in: allowedUnits } } : { factoryUnit: '__no_access__' };
};
