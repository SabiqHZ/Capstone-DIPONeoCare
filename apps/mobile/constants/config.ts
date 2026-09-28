const DEFAULT_DEV_IP = "192.168.0.7";
const DEV_IP = process.env.EXPO_PUBLIC_DEV_IP || DEFAULT_DEV_IP;

export const CONFIG = {
  API_URL:
    process.env.EXPO_PUBLIC_API_URL ||
    "https://capstone-diponeocare-production.up.railway.app",
  SOCKET_URL:
    process.env.EXPO_PUBLIC_SOCKET_URL ||
    "https://capstone-diponeocare-production.up.railway.app",
  UNIQUE_CODE_LENGTH: 8,
} as const;
