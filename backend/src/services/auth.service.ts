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

  async updateNurseProfile(
    nurseId: string,
    changes: {
      name?: string;
      username?: string;
      currentPassword?: string;
      newPassword?: string;
    },
  ) {
    const { data: nurse, error } = await supabaseAdmin
      .from('nurses')
      .select('id, password_hash')
      .eq('id', nurseId)
      .single();

    if (error || !nurse) throw new Error('Profil pengasuh tidak ditemukan');

    const updates: {
      name?: string;
      username?: string;
      password_hash?: string;
    } = {};
    if (changes.name !== undefined) updates.name = changes.name.trim();
    if (changes.username !== undefined) {
      const username = changes.username.trim();
      const { data: existingNurse, error: usernameError } = await supabaseAdmin
        .from('nurses')
        .select('id')
        .eq('username', username)
        .neq('id', nurseId)
        .maybeSingle();

      if (usernameError) throw new Error('Username gagal diperiksa');
      if (existingNurse) throw new Error('Username sudah digunakan');
      updates.username = username;
    }

    if (changes.newPassword !== undefined) {
      const currentPasswordMatches = changes.currentPassword
        ? await bcrypt.compare(changes.currentPassword, nurse.password_hash)
        : false;
      if (!currentPasswordMatches) {
        throw new Error('Sandi saat ini tidak sesuai');
      }
      if (await bcrypt.compare(changes.newPassword, nurse.password_hash)) {
        throw new Error('Sandi baru harus berbeda dari sandi saat ini');
      }
      updates.password_hash = await bcrypt.hash(changes.newPassword, 10);
    }

    const { data: updatedNurse, error: updateError } = await supabaseAdmin
      .from('nurses')
      .update(updates)
      .eq('id', nurseId)
      .select('id, username, name, unit_id')
      .single();

    if (updateError || !updatedNurse) {
      if (updateError?.code === '23505') throw new Error('Username sudah digunakan');
      throw new Error('Perubahan profil gagal disimpan');
    }

    return {
      id: updatedNurse.id,
      username: updatedNurse.username,
      name: updatedNurse.name,
      unitId: updatedNurse.unit_id,
    };
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
