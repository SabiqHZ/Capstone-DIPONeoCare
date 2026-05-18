import { api } from './api';
import { AuthUser } from '../types';

export const authService = {
  loginWithCode: async (code: string): Promise<AuthUser> => {
    try {
      const res = await api.post('/auth/parent', { uniqueCode: code });
      return res.data.data as AuthUser;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Kode tidak valid';
      throw new Error(message);
    }
  },

  loginCaregiver: async (username: string, password: string): Promise<AuthUser> => {
    try {
      const res = await api.post('/auth/caregiver', { username, password });
      return res.data.data as AuthUser;
    } catch (error: any) {
      const message = error.response?.data?.error || 'Username atau password salah';
      throw new Error(message);
    }
  },
};