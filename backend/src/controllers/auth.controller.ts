import { Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../types';

export const authController = {
  async loginNurse(req: Request, res: Response): Promise<void> {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        const response: ApiResponse = { success: false, error: 'Username dan password wajib diisi' };
        res.status(400).json(response);
        return;
      }

      const data = await authService.loginNurse(username, password);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(401).json(response);
    }
  },

  async loginWithCode(req: Request, res: Response): Promise<void> {
    try {
      const { uniqueCode } = req.body;

      if (!uniqueCode) {
        const response: ApiResponse = { success: false, error: 'Kode unik wajib diisi' };
        res.status(400).json(response);
        return;
      }

      const data = await authService.loginWithCode(uniqueCode);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(401).json(response);
    }
  },
};