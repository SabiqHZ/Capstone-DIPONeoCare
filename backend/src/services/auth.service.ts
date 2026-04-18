import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { supabaseAdmin } from '../config/supabase';
import { env } from '../config/env';
import { JwtPayload } from '../types';

export const authService = {
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
      .eq('unique_code', uniqueCode.toUpperCase())
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