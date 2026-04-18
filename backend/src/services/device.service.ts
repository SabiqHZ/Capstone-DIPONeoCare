import { supabaseAdmin } from '../config/supabase';

export const deviceService = {
  // Registrasi device baru saat pertama connect
  async registerOrGetDevice(macAddress: string) {
    // Cek apakah device sudah ada
    const { data: existing } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('mac_address', macAddress)
      .single();

    if (existing) return existing;

    // Buat device baru
    const { data, error } = await supabaseAdmin
      .from('devices')
      .insert({ mac_address: macAddress })
      .select()
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Update heartbeat
  async updateHeartbeat(macAddress: string) {
    const { error } = await supabaseAdmin
      .from('devices')
      .update({
        is_online: true,
        last_heartbeat: new Date().toISOString(),
      })
      .eq('mac_address', macAddress);

    if (error) console.error('[Device] Heartbeat update error:', error.message);
  },

  // Tandai device offline
  async markOffline(macAddress: string) {
    const { error } = await supabaseAdmin
      .from('devices')
      .update({ is_online: false })
      .eq('mac_address', macAddress);

    if (error) console.error('[Device] Mark offline error:', error.message);
  },

  // Ambil config device
  async getDeviceConfig(macAddress: string) {
    const { data, error } = await supabaseAdmin
      .from('devices')
      .select('*')
      .eq('mac_address', macAddress)
      .single();

    if (error) return null;
    return data;
  },

  // Update baby status di database
  async upsertBabyStatus(babyId: string, status: {
    sleepPosition: string;
    positionConfidence: number;
    temperature: number;
    isCrying: boolean;
    cryingDurationSec: number;
    alertLevel: string;
    nightVisionActive: boolean;
  }) {
    const { error } = await supabaseAdmin
      .from('baby_statuses')
      .upsert({
        baby_id: babyId,
        sleep_position: status.sleepPosition,
        position_confidence: status.positionConfidence,
        temperature: status.temperature,
        is_crying: status.isCrying,
        crying_duration_sec: status.cryingDurationSec,
        alert_level: status.alertLevel,
        night_vision_active: status.nightVisionActive,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'baby_id',
      });

    if (error) console.error('[Device] Upsert status error:', error.message);
  },

  // Ambil baby_id dari device
  async getBabyIdByMac(macAddress: string): Promise<string | null> {
    const { data } = await supabaseAdmin
      .from('devices')
      .select('baby_id')
      .eq('mac_address', macAddress)
      .single();

    return data?.baby_id || null;
  },
};