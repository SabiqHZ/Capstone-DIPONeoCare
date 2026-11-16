import { api } from "./api";
import { Baby, RegisteredBaby } from "../types";

export const babyService = {
  getBabies: async (): Promise<any[]> => {
    const res = await api.get("/babies");
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
    deviceId?: string;
  }): Promise<RegisteredBaby> => {
    const res = await api.post("/babies", payload);
    return res.data.data;
  },

  pairDevice: async (babyId: string, deviceId: string): Promise<void> => {
    await api.post("/babies/pair", { babyId, deviceId });
  },
  getAvailableDevices: async (): Promise<Array<{ id: string; name: string | null; mac_address: string; is_online: boolean }>> => {
    const res = await api.get("/devices/available");
    return res.data.data ?? [];
  },
  updateBaby: async (babyId: string, payload: { name: string; bedNumber: string; dateOfBirth: string; parentName: string }) => {
    const response = await api.patch(`/babies/${babyId}`, payload);
    return response.data.data;
  },
  dischargeBaby: async (babyId: string): Promise<void> => {
    await api.delete(`/babies/${babyId}`);
  },
};
