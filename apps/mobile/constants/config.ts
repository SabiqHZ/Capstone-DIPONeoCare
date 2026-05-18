const DEV_IP = '192.168.0.12';

export const CONFIG = {
  API_URL: __DEV__ ? `http://${DEV_IP}:3000` : 'https://smart-vision-api.railway.app',
  SOCKET_URL: __DEV__ ? `http://${DEV_IP}:3000` : 'https://smart-vision-api.railway.app',
  UNIQUE_CODE_LENGTH: 8,
} as const;