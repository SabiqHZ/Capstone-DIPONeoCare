import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { AuthUser } from '../types';

const MUTE_KEY = 'sv_notifications_muted';

function getWebStorage(): Storage {
  if (typeof window === 'undefined') {
    throw new Error('Penyimpanan browser tidak tersedia.');
  }
  return window.localStorage;
}

export const authStorage = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') return getWebStorage().getItem(key);
    return SecureStore.getItemAsync(key);
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      getWebStorage().setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  },

  deleteItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      getWebStorage().removeItem(key);
      return;
    }
    await SecureStore.deleteItemAsync(key);
  },
};

interface AuthState {
  user: AuthUser | null;
  isHydrated: boolean;
  isMuted: boolean;
  setUser: (user: AuthUser) => Promise<void>;
  logout: () => Promise<void>;
  hydrate: () => Promise<void>;
  setMuted: (muted: boolean) => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isHydrated: false,
  isMuted: false,

  setUser: async (user) => {
    await authStorage.setItem('sv_user', JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await authStorage.deleteItem('sv_user');
    set({ user: null, isMuted: false });
  },

  hydrate: async () => {
    try {
      const raw = await authStorage.getItem('sv_user');
      const muted = await authStorage.getItem(MUTE_KEY);
      set({
        user: raw ? JSON.parse(raw) : null,
        isMuted: muted === 'true',
        isHydrated: true,
      });
    } catch {
      set({ isHydrated: true });
    }
  },

  setMuted: async (muted) => {
    await authStorage.setItem(MUTE_KEY, String(muted));
    set({ isMuted: muted });
  },
}));