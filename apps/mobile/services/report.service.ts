import api from "./api";
import { DailyReport, ReportHistoryItem } from "../types";

export const reportService = {
  getDailyReport: async (
    babyId: string,
    date: string,
  ): Promise<DailyReport> => {
    const res = await api.get(`/report/${babyId}`, { params: { date } });
    return res.data.data;
  },

  getReportList: async (babyId: string): Promise<ReportHistoryItem[]> => {
    const res = await api.get(`/report/${babyId}/list`);
    return res.data.data;
  },
};
