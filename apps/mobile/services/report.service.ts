import api from './api';
import { DailyReport } from '../types';

export const reportService = {
  getDailyReport: async (babyId: string, date: string): Promise<DailyReport> => {
    const res = await api.get(`/report/${babyId}`, { params: { date } });
    return res.data.data;
  },

  getReportList: async (babyId: string): Promise<any[]> => {
    const res = await api.get(`/report/${babyId}/list`);
    return res.data.data;
  },
};