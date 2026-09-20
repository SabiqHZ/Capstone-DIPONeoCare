import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase';
import { ActivityFlags, BabyActivity, DeviceContext } from '../types';

export const deviceService = {
  async registerOrGetDevice(payload: { macAddress: string; localIp?: string; firmwareVersion?: string; name?: string }) {
    const { data: existing, error: findError } = await supabaseAdmin
      .from('devices').select('*').eq('mac_address', payload.macAddress).maybeSingle();
    if (findError) throw new Error(findError.message);

    if (existing) {
      // Registration is also the recovery path when a device has been reflashed
      // and no longer has its token in flash.
      const deviceToken = crypto.randomBytes(32).toString('hex');
      const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
      const { data, error } = await supabaseAdmin.from('devices').update({
        local_ip: payload.localIp ?? existing.local_ip,
        firmware_version: payload.firmwareVersion ?? existing.firmware_version,
        device_token_hash: deviceTokenHash,
        is_online: true,
        last_heartbeat: new Date().toISOString(),
      }).eq('id', existing.id).select().single();
      if (error) throw new Error(error.message);
      return { device: data, deviceToken };
    }

    const deviceToken = crypto.randomBytes(32).toString('hex');
    const deviceTokenHash = crypto.createHash('sha256').update(deviceToken).digest('hex');
    const { data, error } = await supabaseAdmin.from('devices').insert({
      mac_address: payload.macAddress,
      local_ip: payload.localIp ?? null,
      firmware_version: payload.firmwareVersion ?? null,
      name: payload.name ?? 'Kamera Baru',
      device_token_hash: deviceTokenHash,
      is_online: true,
      last_heartbeat: new Date().toISOString(),
    }).select().single();
    if (error) throw new Error(error.message);
    return { device: data, deviceToken };
  },

  async getDeviceByMac(macAddress: string): Promise<DeviceContext | null> {
    const { data, error } = await supabaseAdmin.from('devices')
      .select('id, mac_address, baby_id, unit_id, is_online, crying_min_duration_sec, notification_cooldown_sec')
      .eq('mac_address', macAddress).maybeSingle();
    if (error) throw new Error(error.message);
    return data as DeviceContext | null;
  },

  async verifyDeviceToken(macAddress: string, token: string): Promise<boolean> {
    const { data, error } = await supabaseAdmin.from('devices')
      .select('device_token_hash').eq('mac_address', macAddress).maybeSingle();
    if (error || !data?.device_token_hash) return false;
    const receivedHash = crypto.createHash('sha256').update(token).digest('hex');
    if (data.device_token_hash.length !== receivedHash.length) return false;
    return crypto.timingSafeEqual(Buffer.from(data.device_token_hash, 'hex'), Buffer.from(receivedHash, 'hex'));
  },

  async updateHeartbeat(macAddress: string, localIp?: string) {
    const { data, error } = await supabaseAdmin.from('devices').update({
      is_online: true,
      last_heartbeat: new Date().toISOString(),
      ...(localIp ? { local_ip: localIp } : {}),
    }).eq('mac_address', macAddress)
      .select('id, mac_address, baby_id, unit_id, is_online, crying_min_duration_sec, notification_cooldown_sec')
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data as DeviceContext | null;
  },

  async markStaleDevicesOffline(timeoutSeconds: number) {
    const cutoff = new Date(Date.now() - timeoutSeconds * 1_000).toISOString();
    const { data, error } = await supabaseAdmin.from('devices').update({ is_online: false })
      .eq('is_online', true).lt('last_heartbeat', cutoff)
      .select('id, mac_address, baby_id, unit_id, is_online, crying_min_duration_sec, notification_cooldown_sec');
    if (error) {
      console.error('[Device] stale-device check failed:', error.message);
      return [];
    }
    return (data ?? []) as DeviceContext[];
  },

  async getAvailableDevices(unitId: string) {
    const { data, error } = await supabaseAdmin.from('devices')
      .select('id, mac_address, name, is_online, last_heartbeat')
      .is('baby_id', null)
      .or(`unit_id.eq.${unitId},unit_id.is.null`)
      .order('created_at', { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  },

  async getDeviceConfig(macAddress: string) {
    const { data, error } = await supabaseAdmin.from('devices').select('*')
      .eq('mac_address', macAddress).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  },

  async updateConfig(deviceId: string, config: { cryingMinDurationSec?: number; notificationCooldownSec?: number }) {
    const { data, error } = await supabaseAdmin.from('devices').update({
      ...(config.cryingMinDurationSec !== undefined ? { crying_min_duration_sec: config.cryingMinDurationSec } : {}),
      ...(config.notificationCooldownSec !== undefined ? { notification_cooldown_sec: config.notificationCooldownSec } : {}),
    }).eq('id', deviceId).select().single();
    if (error) throw new Error(error.message);
    return data;
  },

  async upsertBabyStatus(babyId: string, status: {
    activity: BabyActivity; flags: ActivityFlags; cryingDurationSec: number; alertLevel: string;
    nightVisionActive: boolean; soundClass: 'crying' | 'not_crying'; soundConfidence: number;
    anomalyType: string | null; updatedAt: string;
  }) {
    // Results can arrive out of order because vision and audio are asynchronous.
    // Never let a delayed result replace the status from a newer capture.
    const { data: current, error: currentError } = await supabaseAdmin.from('baby_statuses')
      .select('updated_at').eq('baby_id', babyId).maybeSingle();
    if (currentError) throw new Error(currentError.message);
    if (current?.updated_at && Date.parse(current.updated_at) > Date.parse(status.updatedAt)) return;

    const { error } = await supabaseAdmin.from('baby_statuses').upsert({
      baby_id: babyId, activity: status.activity, is_sleeping: status.flags.sleeping,
      is_awake: status.flags.awake, is_crying: status.flags.crying,
      crying_duration_sec: status.cryingDurationSec, alert_level: status.alertLevel,
      night_vision_active: status.nightVisionActive, sound_class: status.soundClass,
      sound_confidence: status.soundConfidence, face_anomaly: status.anomalyType,
      updated_at: status.updatedAt,
    }, { onConflict: 'baby_id' });
    if (error) throw new Error(error.message);
  },

  async recordActivitySample(payload: {
    babyId: string; deviceId: string; flags: ActivityFlags; recordedAt: string;
    visualCrying: boolean; audioCrying: boolean; visualConfidence?: number; audioConfidence?: number;
  }) {
    const { error } = await supabaseAdmin.from('baby_activity_samples').upsert({
      baby_id: payload.babyId, device_id: payload.deviceId, sleeping: payload.flags.sleeping,
      awake: payload.flags.awake, crying: payload.flags.crying, visual_crying: payload.visualCrying,
      audio_crying: payload.audioCrying, visual_confidence: payload.visualConfidence ?? null,
      audio_confidence: payload.audioConfidence ?? null, recorded_at: payload.recordedAt,
    }, { onConflict: 'baby_id,recorded_at', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  },
};
