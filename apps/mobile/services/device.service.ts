import { CONFIG } from "../constants/config";
import { api } from "./api";

const STREAM_API_URL =
  process.env.EXPO_PUBLIC_STREAM_API_URL?.trim() || CONFIG.API_URL;

export const deviceService = {
  async getManagedDevices(): Promise<ManagedDevice[]> {
    const response = await api.get("/devices");
    return response.data.data ?? [];
  },
  async deleteDevice(deviceId: string): Promise<void> {
    await api.delete(`/devices/${encodeURIComponent(deviceId)}`);
  },
  async getStreamUrl(deviceId: string): Promise<string> {
    const encodedDeviceId = encodeURIComponent(deviceId);
    return `${STREAM_API_URL.replace(/\/+$/, "")}/api/devices/${encodedDeviceId}/stream`;
  },
};

export interface ManagedDevice {
  id: string;
  mac_address: string;
  name: string | null;
  baby_id: string | null;
  unit_id: string | null;
  is_online: boolean;
  last_heartbeat: string | null;
  baby: { id: string; name: string; bed_number: string } | null;
}
