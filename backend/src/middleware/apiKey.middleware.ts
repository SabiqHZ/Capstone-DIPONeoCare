import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';
import { ApiResponse } from '../types';

export function apiKeyMiddleware(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey || apiKey !== env.AI_SERVER_API_KEY) {
    const response: ApiResponse = { success: false, error: 'API key tidak valid atau tidak ditemukan' };
    res.status(401).json(response);
    return;
  }

  next();
}
