import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole, ApiResponse } from '../types';

export function requireRole(...roles: UserRole[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      const response: ApiResponse = { success: false, error: 'Akses ditolak' };
      res.status(403).json(response);
      return;
    }
    next();
  };
}