import { api } from "./api";

const STREAM_API_URL =
  process.env.EXPO_PUBLIC_STREAM_API_URL?.trim() ||
  "https://capstone-diponeocare-production.up.railway.app";

export const deviceService = {
  async getStreamUrl(deviceId: string): Promise<string> {
    const encodedDeviceId = encodeURIComponent(deviceId);
    const response = await api.get(`/devices/${encodedDeviceId}/stream-ticket`);
    const ticket = response.data.data?.ticket;
    if (typeof ticket !== "string") {
      throw new Error("Tiket stream tidak diterima dari server");
    }

    return `${STREAM_API_URL}/api/devices/${encodedDeviceId}/stream?ticket=${encodeURIComponent(ticket)}`;
  },
};
