import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import { AuthUser,CaregiverUser, ParentUser } from '../types';

const MUTE_KEY = 'sv_notifications_muted';

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
    await SecureStore.setItemAsync('sv_user', JSON.stringify(user));
    set({ user });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('sv_user');
    set({ user: null, isMuted: false });
  },

  hydrate: async () => {
    try {
      const raw = await SecureStore.getItemAsync('sv_user');
      const muted = await SecureStore.getItemAsync(MUTE_KEY);
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
    await SecureStore.setItemAsync(MUTE_KEY, String(muted));
    set({ isMuted: muted });
  },
}));