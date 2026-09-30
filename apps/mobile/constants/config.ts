const DEFAULT_REMOTE_API_URL =
  "https://capstone-diponeocare-production.up.railway.app";

const DEV_IP = process.env.EXPO_PUBLIC_DEV_IP?.trim() || "";

const LAN_BACKEND_URL = DEV_IP ? `http://${DEV_IP}:3000` : "";

const CONFIGURED_API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() || "";

const CONFIGURED_SOCKET_URL = process.env.EXPO_PUBLIC_SOCKET_URL?.trim() || "";

const API_URL = CONFIGURED_API_URL || LAN_BACKEND_URL || DEFAULT_REMOTE_API_URL;

const SOCKET_URL = CONFIGURED_SOCKET_URL || LAN_BACKEND_URL || API_URL;

export const CONFIG = {
  API_URL,
  SOCKET_URL,
  UNIQUE_CODE_LENGTH: 8,
} as const;
