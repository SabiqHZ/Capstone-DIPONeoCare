import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { authService } from '../services/auth.service';
import { ApiResponse } from '../types';

export const authController = {
  async getNurseProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await authService.getNurseProfile(req.user!.sub);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(404).json(response);
    }
  },

  async updateNurseProfile(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, username, currentPassword, newPassword } = req.body;
      const fields = { name, username, currentPassword, newPassword };
      for (const [field, value] of Object.entries(fields)) {
        if (value !== undefined && typeof value !== 'string') {
          res.status(400).json({ success: false, error: `${field} harus berupa teks` });
          return;
        }
      }

      if (typeof name === 'string' && !name.trim()) {
        res.status(400).json({ success: false, error: 'Nama wajib diisi' });
        return;
      }
      if (typeof username === 'string' && !username.trim()) {
        res.status(400).json({ success: false, error: 'Username wajib diisi' });
        return;
      }
      if (newPassword !== undefined && typeof currentPassword !== 'string') {
        res.status(400).json({ success: false, error: 'Sandi saat ini wajib diisi' });
        return;
      }
      if (currentPassword !== undefined && newPassword === undefined) {
        res.status(400).json({ success: false, error: 'Sandi baru wajib diisi' });
        return;
      }
      if (typeof newPassword === 'string' && newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'Sandi baru minimal 8 karakter' });
        return;
      }
      if (name === undefined && username === undefined && newPassword === undefined) {
        res.status(400).json({ success: false, error: 'Tidak ada perubahan untuk disimpan' });
        return;
      }

      const data = await authService.updateNurseProfile(req.user!.sub, {
        name,
        username,
        currentPassword,
        newPassword,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(400).json(response);
    }
  },

  async changeNursePassword(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body;
      if (typeof currentPassword !== 'string' || typeof newPassword !== 'string') {
        res.status(400).json({ success: false, error: 'Sandi saat ini dan sandi baru wajib diisi' });
        return;
      }
      if (newPassword.length < 8) {
        res.status(400).json({ success: false, error: 'Sandi baru minimal 8 karakter' });
        return;
      }
      await authService.changeNursePassword(req.user!.sub, currentPassword, newPassword);
      res.json({ success: true, message: 'Sandi berhasil diperbarui' });
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(400).json(response);
    }
  },

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
