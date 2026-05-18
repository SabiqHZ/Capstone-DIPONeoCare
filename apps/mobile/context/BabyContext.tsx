import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
} from 'react';
import { io, Socket } from 'socket.io-client';
import { CONFIG } from '../constants/config';
import { BabyStatus, AlertNotification } from '../types';
import { useAuthStore } from '../stores/auth.store';
import { notificationService } from '../services/notification.service';
import api from '../services/api'; // WAJIB DI-IMPORT UNTUK INITIAL FETCH

// ── State ─────────────────────────────────────────────────────────────
interface BabyState {
  statuses: Record<string, BabyStatus>;
  alerts: AlertNotification[];
  focusedBabyId: string | null;
}

const initialState: BabyState = {
  statuses: {},
  alerts: [],
  focusedBabyId: null,
};

// ── Actions ───────────────────────────────────────────────────────────
type BabyAction =
  | { type: 'SET_STATUS'; payload: BabyStatus }
  | { type: 'ADD_ALERT'; payload: AlertNotification }
  | { type: 'ACK_ALERT'; payload: string }
  | { type: 'SET_FOCUSED'; payload: string }
  | { type: 'CLEAR' };

function babyReducer(state: BabyState, action: BabyAction): BabyState {
  switch (action.type) {
    case 'SET_STATUS':
      return {
        ...state,
        statuses: {
          ...state.statuses,
          [action.payload.babyId]: action.payload,
        },
      };
    case 'ADD_ALERT':
      return {
        ...state,
        alerts: [action.payload, ...state.alerts].slice(0, 50),
      };
    case 'ACK_ALERT':
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.payload ? { ...a, acknowledged: true } : a
        ),
      };
    case 'SET_FOCUSED':
      return { ...state, focusedBabyId: action.payload };
    case 'CLEAR':
      return initialState;
    default:
      return state;
  }
}

// ── Context ───────────────────────────────────────────────────────────
interface BabyContextValue {
  state: BabyState;
  setFocused: (babyId: string) => void;
  acknowledgeAlert: (alertId: string) => void;
}

const BabyContext = createContext<BabyContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────
let socketInstance: Socket | null = null;

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(babyReducer, initialState);
  const token = useAuthStore((s) => s.user?.token ?? null);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const unitId = useAuthStore((s) =>
    s.user?.role === 'caregiver' ? s.user.unitId : null
  );
  const babyId = useAuthStore((s) =>
    s.user?.role === 'parent' ? s.user.babyId : null
  );

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    if (!token) {
      socketInstance?.disconnect();
      socketInstance = null;
      dispatchRef.current({ type: 'CLEAR' });
      return;
    }

    if (socketInstance?.connected) return;
    socketInstance?.disconnect();

    // Pastikan CONFIG.SOCKET_URL menggunakan IP 192.168.0.12, BUKAN localhost!
    socketInstance = io(CONFIG.SOCKET_URL, {
      auth: { token },
      transports: ['websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketInstance.on('connect', () => {
      console.log('[Socket] Connected');
      if (role === 'caregiver' && unitId) {
        socketInstance!.emit('subscribe:unit', unitId);
      } else if (role === 'parent' && babyId) {
        socketInstance!.emit('subscribe:baby', babyId);
      }
    });

    socketInstance.on('baby:status-update', (data: BabyStatus) => {
      // Jika data dari backend berupa snake_case, backend harus memetakan ke camelCase
      // sebelum melakukan emit. Kita asumsikan data sudah berformat interface BabyStatus.
      dispatchRef.current({ type: 'SET_STATUS', payload: data });
    });

    socketInstance.on('baby:alert', (data: AlertNotification) => {
      dispatchRef.current({ type: 'ADD_ALERT', payload: data });

      const isMuted = useAuthStore.getState().isMuted;
      if (!isMuted) {
        notificationService.showLocalNotification({
          title: data.severity === 'critical' ? 'Peringatan Darurat!' : 'Perhatian',
          body: data.message,
          severity: data.severity,
          babyId: data.babyId,
        });
      }
    });

    socketInstance.on('disconnect', (reason) => {
      console.log('[Socket] Disconnected:', reason);
    });

    socketInstance.on('connect_error', (err) => {
      console.error('[Socket] Error:', err.message);
    });

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
    };
  }, [token, role, unitId, babyId]);

  // INJEKSI INITIAL FETCH DI SINI
  const setFocused = useCallback(async (id: string) => {
    dispatch({ type: 'SET_FOCUSED', payload: id });
    
    try {
      console.log(`\n[BabyContext-DEBUG] 1. Memulai Fetch untuk bayi ID: ${id}`);
      const response = await api.get(`/babies/${id}`);
      const babyData = response.data.data || response.data;
      
      if (!babyData) {
        console.error(`[BabyContext-DEBUG] ❌ FATAL: babyData kosong!`);
        return;
      }

      // ULTIMATE FALLBACK: Jika Supabase pelit dan mereturn null untuk relasi,
      // kita JANGAN membekukan layar. Kita buat status default buatan!
      const statusData = babyData.baby_statuses || {};
      const deviceData = babyData.devices || {};

      if (!babyData.baby_statuses) {
        console.warn(`[BabyContext-DEBUG] ⚠️ PERINGATAN: baby_statuses NULL dari backend (Mungkin kena blokir RLS Supabase). Menggunakan status default.`);
      }

      const initialStatus: BabyStatus = {
        babyId: id,
        babyName: babyData.name,
        bedNumber: babyData.bed_number || babyData.bedNumber || '-',
        
        // Gunakan data asli jika ada, jika null pakai default yang aman
        isCrying: statusData.is_crying ?? false,
        cryingDurationSec: statusData.crying_duration_sec ?? 0,
        alertLevel: statusData.alert_level ?? 'normal',
        deviceOnline: deviceData.is_online ?? false,
        lastUpdated: statusData.updated_at || new Date().toISOString(),
        nightVisionActive: statusData.night_vision_active ?? false,
        activity: statusData.activity ?? 'sleeping',
        soundClass: statusData.sound_class ?? 'not_crying',
        soundConfidence: Number(statusData.sound_confidence) || 1,
        faceAnomaly: statusData.face_anomaly ?? 'none',
      };
      
      dispatch({ type: 'SET_STATUS', payload: initialStatus });
      console.log(`[BabyContext-DEBUG] ✅ 4. Status sukses di-dispatch ke UI! Layar loading HARUSNYA HILANG DETIK INI JUGA.`);
      
    } catch (error: any) {
      console.error(`\n[BabyContext-DEBUG] 💥 CRASH PADA FETCH!`);
      console.error(`Pesan Error:`, error.response?.data || error.message);
    }
  }, []);

  const acknowledgeAlert = useCallback((alertId: string) => {
    dispatch({ type: 'ACK_ALERT', payload: alertId });
  }, []);

  return (
    <BabyContext.Provider value={{ state, setFocused, acknowledgeAlert }}>
      {children}
    </BabyContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────
export function useBabyContext() {
  const ctx = useContext(BabyContext);
  if (!ctx) throw new Error('useBabyContext harus dipakai di dalam BabyProvider');
  return ctx;
}

export function useFocusedBabyStatus(): BabyStatus | null {
  const { state } = useBabyContext();
  if (!state.focusedBabyId) return null;
  return state.statuses[state.focusedBabyId] ?? null;
}

export function useAllBabyStatuses(): Record<string, BabyStatus> {
  const { state } = useBabyContext();
  return state.statuses;
}

export function useActiveAlerts(): AlertNotification[] {
  const { state } = useBabyContext();
  return state.alerts.filter((a) => !a.acknowledged);
}

export function useBabyStatusById(babyId: string): BabyStatus | null {
  const { state } = useBabyContext();
  return state.statuses[babyId] ?? null;
}