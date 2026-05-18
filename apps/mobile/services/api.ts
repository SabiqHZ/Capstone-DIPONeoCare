import axios, { AxiosError } from 'axios';
import * as SecureStore from 'expo-secure-store';
import { CONFIG } from '../constants/config';
import { useAuthStore } from '../stores/auth.store'; 

const api = axios.create({
  baseURL: `${CONFIG.API_URL}/api`,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {

  const tokenString = await SecureStore.getItemAsync('sv_user');
  if (tokenString) {
    try {
      const user = JSON.parse(tokenString);
      if (user?.token) {
        config.headers.Authorization = `Bearer ${user.token}`;
      }
    } catch (e) {
      console.error('[API] Gagal parsing token dari storage');
    }
  }
  return config;
});


api.interceptors.response.use(
  (res) => res,
  async (error: AxiosError) => {
    if (error.response?.status === 401) {
      console.warn('[API] 401 Unauthorized terdeteksi. Membersihkan sesi...');
      
      await SecureStore.deleteItemAsync('sv_user');
      useAuthStore.getState().logout();
    }
    
    return Promise.reject(error);
  }
);

export { api };
export default api;