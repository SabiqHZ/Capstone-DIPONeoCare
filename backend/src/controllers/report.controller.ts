import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest, ApiResponse } from '../types';

export const reportController = {
  async getDailyReport(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { babyId } = req.params;
      const { date } = req.query;

      // Validasi akses: parent hanya bisa akses bayi miliknya
      if (req.user?.role === 'parent' && req.user.babyId !== babyId) {
        res.status(403).json({ success: false, error: 'Akses ditolak' });
        return;
      }

      const targetDate = date as string || new Date().toISOString().split('T')[0];

      const { data, error } = await supabaseAdmin
        .from('daily_reports')
        .select('*')
        .eq('baby_id', babyId)
        .eq('date', targetDate)
        .single();

      if (error || !data) {
        // Return empty report jika belum ada data
        const response: ApiResponse = {
          success: true,
          data: {
            babyId,
            date: targetDate,
            totalProneEvents: 0,
            avgTemperature: 0,
            maxTemperature: 0,
            minTemperature: 0,
            totalCryingEvents: 0,
            hourlyPositions: [],
            temperatureTimeline: [],
          },
        };
        res.json(response);
        return;
      }

      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },
};