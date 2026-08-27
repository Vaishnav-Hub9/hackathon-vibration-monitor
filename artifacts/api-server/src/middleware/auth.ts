import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'smartbearing_jwt_secret_change_in_production';

export interface AuthRequest extends Request {
  user?: any;
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
      req.user = user;
      next();
    });
  } else {
    res.status(401).json({ success: false, error: 'Unauthorized' });
  }
};
