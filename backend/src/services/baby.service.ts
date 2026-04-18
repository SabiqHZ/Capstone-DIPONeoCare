import { supabaseAdmin } from '../config/supabase';
import { generateUniqueCode } from '../utils/code-generator';

export const babyService = {
  // Ambil semua bayi dalam satu unit
  async getBabiesByUnit(unitId: string) {
    const { data, error } = await supabaseAdmin
      .from('babies')
      .select(`
        id, name, bed_number, date_of_birth, parent_name,
        unique_code, unit_id, created_at,
        baby_statuses (
          sleep_position, position_confidence, temperature,
          is_crying, crying_duration_sec, alert_level,
          night_vision_active, updated_at
        ),
        devices (
          id, mac_address, is_online, last_heartbeat
        )
      `)
      .eq('unit_id', unitId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    return data;
  },

  // Ambil satu bayi berdasarkan ID
  async getBabyById(babyId: string) {
    const { data, error } = await supabaseAdmin
      .from('babies')
      .select(`
        id, name, bed_number, date_of_birth, parent_name,
        unique_code, unit_id, created_at,
        baby_statuses (*),
        devices (*)
      `)
      .eq('id', babyId)
      .single();

    if (error) throw new Error(error.message);
    return data;
  },

  // Daftarkan bayi baru
  async registerBaby(payload: {
    name: string;
    bedNumber: string;
    dateOfBirth: string;
    parentName: string;
    unitId: string;
  }) {
    // Generate kode unik, pastikan tidak duplikat
    let uniqueCode = generateUniqueCode();
    let isUnique = false;

    while (!isUnique) {
      const { data } = await supabaseAdmin
        .from('babies')
        .select('id')
        .eq('unique_code', uniqueCode)
        .single();

      if (!data) {
        isUnique = true;
      } else {
        uniqueCode = generateUniqueCode();
      }
    }

    const { data, error } = await supabaseAdmin
      .from('babies')
      .insert({
        name: payload.name,
        bed_number: payload.bedNumber,
        date_of_birth: payload.dateOfBirth,
        parent_name: payload.parentName,
        unit_id: payload.unitId,
        unique_code: uniqueCode,
      })
      .select()
      .single();

    if (error) throw new Error(error.message);
      return {
    id: data.id,
    name: data.name,
    bedNumber: data.bed_number,        // ← penting
    dateOfBirth: data.date_of_birth,
    parentName: data.parent_name,
    uniqueCode: data.unique_code,
    deviceId: null,
    unitId: data.unit_id,
    createdAt: data.created_at,
  };
},

  // Pairing device ke bayi
  async pairDevice(babyId: string, deviceId: string) {
    const { error } = await supabaseAdmin
      .from('devices')
      .update({ baby_id: babyId })
      .eq('id', deviceId);

    if (error) throw new Error(error.message);
    return { success: true };
    
  },
};