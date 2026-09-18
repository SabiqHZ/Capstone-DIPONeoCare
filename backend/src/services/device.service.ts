import { supabaseAdmin } from '../config/supabase';
import { ActivityFlags, BabyActivity } from '../types';

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
    activity: BabyActivity;
    flags: ActivityFlags;
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
        activity: status.activity,
        is_sleeping: status.flags.sleeping,
        is_awake: status.flags.awake,
        temperature: status.temperature,
        is_crying: status.flags.crying,
        crying_duration_sec: status.cryingDurationSec,
        alert_level: status.alertLevel,
        night_vision_active: status.nightVisionActive,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'baby_id',
      });

    if (error) console.error('[Device] Upsert status error:', error.message);
  },

  // Satu kiriman AI mewakili satu detik aktivitas bayi.
  async recordActivitySample(babyId: string, flags: ActivityFlags, recordedAt: string) {
    const { error } = await supabaseAdmin
      .from('baby_activity_samples')
      .upsert({
        baby_id: babyId,
        sleeping: flags.sleeping,
        awake: flags.awake,
        crying: flags.crying,
        recorded_at: recordedAt,
      }, {
        onConflict: 'baby_id,recorded_at',
        ignoreDuplicates: true,
      });

    if (error) throw new Error(error.message);
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

export function registerOrGetDevice(macAddress: any, unitId: any, deviceName: any) {
  throw new Error('Function not implemented.');
}


export function getAvailableDevices(unitId: string) {
  throw new Error('Function not implemented.');
}


export function updateHeartbeat(macAddress: any) {
  throw new Error('Function not implemented.');
}
