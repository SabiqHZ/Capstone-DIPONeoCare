import { CONFIG } from "../constants/config";

const STREAM_API_URL =
  process.env.EXPO_PUBLIC_STREAM_API_URL?.trim() || CONFIG.API_URL;

export const deviceService = {
  async getStreamUrl(deviceId: string): Promise<string> {
    const encodedDeviceId = encodeURIComponent(deviceId);
    return `${STREAM_API_URL.replace(/\/+$/, "")}/api/devices/${encodedDeviceId}/stream`;
  },
};
