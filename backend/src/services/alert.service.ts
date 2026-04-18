import { supabaseAdmin } from '../config/supabase';
import { AlertLevel } from '../types';

export const alertService = {
  async createAlert(payload: {
    babyId: string;
    type: string;
    message: string;
    severity: 'warning' | 'critical';
  }) {
    const { data, error } = await supabaseAdmin
      .from('alert_logs')
      .insert({
        baby_id: payload.babyId,
        type: payload.type,
        message: payload.message,
        severity: payload.severity,
        acknowledged: false,
      })
      .select()
      .single();

    if (error) {
      console.error('[Alert] Gagal menyimpan alert:', error.message);
      return null;
    }

    return data;
  },

  async getAlertsByBaby(babyId: string, limit = 50) {
    const { data, error } = await supabaseAdmin
      .from('alert_logs')
      .select('*')
      .eq('baby_id', babyId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw new Error(error.message);
    return data;
  },

  async acknowledgeAlert(alertId: string) {
    const { error } = await supabaseAdmin
      .from('alert_logs')
      .update({ acknowledged: true })
      .eq('id', alertId);

    if (error) throw new Error(error.message);
    return { success: true };
  },

  determineAlertLevel(
    position: string,
    temperature: number,
    tempMin: number,
    tempMax: number
  ): AlertLevel {
    if (position === 'prone') return 'critical';
    if (temperature > tempMax || temperature < tempMin) return 'warning';
    return 'normal';
  },
};