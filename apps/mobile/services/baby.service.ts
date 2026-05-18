import { api } from './api';
import { Baby } from '../types';

export const babyService = {
  getBabies: async (): Promise<any[]> => {
    const res = await api.get('/babies');
    return res.data.data;
  },

  getBabyById: async (babyId: string): Promise<any> => {
    const res = await api.get(`/babies/${babyId}`);
    return res.data.data;
  },

  registerBaby: async (payload: {
    name: string;
    bedNumber: string;
    dateOfBirth: string;
    parentName: string;
  }): Promise<Baby> => {
    const res = await api.post('/babies', payload);
    return res.data.data;
  },

  pairDevice: async (babyId: string, deviceId: string): Promise<void> => {
    await api.post('/babies/pair', { babyId, deviceId });
  },
};