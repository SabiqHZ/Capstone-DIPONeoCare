import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { JwtPayload } from '../types';

export const authService = {
  async getNurseProfile(nurseId: string) {
    const { data: nurse, error } = await supabaseAdmin
      .from('nurses')
      .select('id, username, name, unit_id')
      .eq('id', nurseId)
      .single();

    if (error || !nurse) throw new Error('Profil pengasuh tidak ditemukan');
    return { id: nurse.id, username: nurse.username, name: nurse.name, unitId: nurse.unit_id };
  },

  async changeNursePassword(nurseId: string, currentPassword: string, newPassword: string) {
    const { data: nurse, error } = await supabaseAdmin
      .from('nurses')
      .select('password_hash')
      .eq('id', nurseId)
      .single();

    if (error || !nurse) throw new Error('Akun pengasuh tidak ditemukan');
    const matches = await bcrypt.compare(currentPassword, nurse.password_hash);
    if (!matches) throw new Error('Sandi saat ini tidak sesuai');
    if (newPassword.length < 8) throw new Error('Sandi baru minimal 8 karakter');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    const { error: updateError } = await supabaseAdmin
      .from('nurses')
      .update({ password_hash: passwordHash })
      .eq('id', nurseId);

    if (updateError) throw new Error('Sandi gagal diperbarui');
  },

  // Login tenaga medis
  async loginNurse(username: string, password: string) {
    const { data: nurse, error } = await supabaseAdmin
      .from('nurses')
      .select('id, username, password_hash, name, unit_id')
      .eq('username', username)
      .single();

    if (error || !nurse) {
      throw new Error('Username atau password salah');
    }

    const isValid = await bcrypt.compare(password, nurse.password_hash);
    if (!isValid) {
      throw new Error('Username atau password salah');
    }

    const payload: JwtPayload = {
      sub: nurse.id,
      role: 'nurse',
      unitId: nurse.unit_id,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return {
      role: 'nurse' as const,
      id: nurse.id,
      name: nurse.name,
      unitId: nurse.unit_id,
      token,
    };
  },

  // Login orang tua dengan kode unik
  async loginWithCode(uniqueCode: string) {
    const { data: baby, error } = await supabaseAdmin
      .from('babies')
      .select('id, name, unique_code')
      .eq('unique_code', uniqueCode.trim().toUpperCase())
      .single();

    if (error || !baby) {
      throw new Error('Kode tidak valid atau tidak ditemukan');
    }

    const payload: JwtPayload = {
      sub: baby.id,
      role: 'parent',
      babyId: baby.id,
    };

    const token = jwt.sign(payload, env.JWT_SECRET, {
      expiresIn: env.JWT_EXPIRES_IN,
    } as jwt.SignOptions);

    return {
      role: 'parent' as const,
      babyId: baby.id,
      babyName: baby.name,
      uniqueCode: baby.unique_code,
      token,
    };
  },
};
