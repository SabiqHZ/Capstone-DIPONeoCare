import { Response } from 'express';
import { supabaseAdmin } from '../config/supabase';
import { AuthRequest, ApiResponse } from '../types';

export const notificationController = {
  async saveToken(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { token, platform } = req.body;
      const user = req.user!;

      const { error } = await supabaseAdmin
        .from('push_tokens')
        .upsert({
          user_id: user.sub,
          role: user.role,
          baby_id: user.babyId ?? null,
          token,
          platform,
          updated_at: new Date().toISOString(),
        }, {
          onConflict: 'user_id, platform',
        });

      if (error) throw new Error(error.message);

      const response: ApiResponse = { success: true, data: { saved: true } };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },
};