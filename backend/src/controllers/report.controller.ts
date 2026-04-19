import { Response } from 'express';
import { reportService } from '../services/report.service';
import { AuthRequest, ApiResponse } from '../types';

export const reportController = {
  async getDailyReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rawBabyId = req.params.babyId;
      const babyId = Array.isArray(rawBabyId) ? rawBabyId[0] : rawBabyId;

      // Fix: pastikan date adalah string tunggal, bukan array
      const rawDate = req.query.date;
      const date =
        typeof rawDate === 'string'
          ? rawDate
          : new Date().toISOString().split('T')[0];

      if (req.user?.role === 'parent' && req.user.babyId !== babyId) {
        res.status(403).json({ success: false, error: 'Akses ditolak' });
        return;
      }

      const data = await reportService.getDailyReport(babyId as string, date);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },

  async getReportList(req: AuthRequest, res: Response): Promise<void> {
    try {
      const rawBabyId = req.params.babyId;
      const babyId = Array.isArray(rawBabyId) ? rawBabyId[0] : rawBabyId;

      if (req.user?.role === 'parent' && req.user.babyId !== babyId) {
        res.status(403).json({ success: false, error: 'Akses ditolak' });
        return;
      }

      const data = await reportService.getReportList(babyId as string);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },
};