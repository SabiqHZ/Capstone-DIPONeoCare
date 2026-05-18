import { create } from 'zustand';
import { BabyStatus, AlertNotification, AlertLevel } from '../types';

export interface BabyStore {
  babyStatuses: Record<string, BabyStatus>;
  activeAlerts: AlertNotification[];
  focusedBabyId: string | null;
  updateBabyStatus: (status: BabyStatus) => void;
  addAlert: (alert: AlertNotification) => void;
  acknowledgeAlert: (alertId: string) => void;
  setFocusedBaby: (babyId: string) => void;
  clearAll: () => void;
}

export const useBabyStore = create<BabyStore>((set) => ({
  babyStatuses: {},
  activeAlerts: [],
  focusedBabyId: null,

  updateBabyStatus: (status) =>
    set((state) => ({
      babyStatuses: {
        ...state.babyStatuses,
        [status.babyId]: status,
      },
    })),

  addAlert: (alert) =>
    set((state) => ({
      activeAlerts: [alert, ...state.activeAlerts].slice(0, 50),
    })),

  acknowledgeAlert: (alertId) =>
    set((state) => ({
      activeAlerts: state.activeAlerts.map((a) =>
        a.id === alertId ? { ...a, acknowledged: true } : a
      ),
    })),

  setFocusedBaby: (babyId) =>
    set((state) => {
      // Jangan update kalau nilai sama — cegah re-render
      if (state.focusedBabyId === babyId) return state;
      return { focusedBabyId: babyId };
    }),

  clearAll: () =>
    set({ babyStatuses: {}, activeAlerts: [], focusedBabyId: null }),
}));

// Selectors
export const selectFocusedBabyStatus = (state: BabyStore) =>
  state.focusedBabyId ? state.babyStatuses[state.focusedBabyId] : null;

export const selectUnacknowledgedAlerts = (state: BabyStore) =>
  state.activeAlerts.filter((a) => !a.acknowledged);

export const selectAlertLevel = (babyId: string) => (state: BabyStore): AlertLevel =>
  state.babyStatuses[babyId]?.alertLevel ?? 'normal';