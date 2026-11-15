import React, {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
} from "react";
import { io, Socket } from "socket.io-client";
import { CONFIG } from "../constants/config";
import { BabyStatus, AlertNotification } from "../types";
import { useAuthStore } from "../stores/auth.store";
import { notificationService } from "../services/notification.service";
import api from "../services/api"; // WAJIB DI-IMPORT UNTUK INITIAL FETCH
import { alertService } from "../services/alert.service";

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
  | {
      type: "SET_STATUS";
      payload: Partial<BabyStatus> & Pick<BabyStatus, "babyId">;
    }
  | { type: "ADD_ALERT"; payload: AlertNotification }
  | { type: "ACK_ALERT"; payload: string }
  | { type: "SET_ALERTS"; payload: AlertNotification[] }
  | { type: "SET_FOCUSED"; payload: string }
  | { type: "CLEAR" };

function babyReducer(state: BabyState, action: BabyAction): BabyState {
  switch (action.type) {
    case "SET_STATUS":
      return {
        ...state,
        statuses: {
          ...state.statuses,
          [action.payload.babyId]: {
            ...state.statuses[action.payload.babyId],
            ...action.payload,
          } as BabyStatus,
        },
      };
    case "ADD_ALERT": {
      const existingAlerts = state.alerts.filter(
        (alert) => alert.id !== action.payload.id,
      );

      return {
        ...state,
        alerts: [action.payload, ...existingAlerts].slice(0, 50),
      };
    }

    case "SET_ALERTS":
      return {
        ...state,
        alerts: action.payload.slice(0, 50),
      };

    case "ACK_ALERT":
      return {
        ...state,
        alerts: state.alerts.map((a) =>
          a.id === action.payload ? { ...a, acknowledged: true } : a,
        ),
      };
    case "SET_FOCUSED":
      return { ...state, focusedBabyId: action.payload };
    case "CLEAR":
      return initialState;
    default:
      return state;
  }
}

function normalizeStatusPayload(payload: any): Partial<BabyStatus> & Pick<BabyStatus, "babyId"> {
  const activity = payload.activity ?? payload.current_activity ?? null;
  const isCrying = payload.isCrying ?? payload.is_crying ??
    (activity === "crying" ? true : null);
  const updatedAt = payload.lastUpdated ?? payload.updatedAt ?? payload.updated_at ?? null;

  return {
    ...payload,
    babyId: payload.babyId ?? payload.baby_id,
    activity: activity ?? (isCrying === true ? "crying" : null),
    isCrying,
    cryingDurationSec: payload.cryingDurationSec ?? payload.crying_duration_sec ?? null,
    alertLevel: payload.alertLevel ?? payload.alert_level ?? null,
    deviceOnline: payload.deviceOnline ?? payload.device_online ?? null,
    deviceLastSeenAt: payload.deviceLastSeenAt ?? payload.device_last_seen_at ?? null,
    lastUpdated: updatedAt,
    soundClass: payload.soundClass ?? payload.sound_class ?? null,
    soundConfidence: payload.soundConfidence ?? payload.sound_confidence ?? null,
    faceAnomaly: payload.faceAnomaly ?? payload.face_anomaly ?? "none",
  };
}

// ── Context ───────────────────────────────────────────────────────────
interface BabyContextValue {
  state: BabyState;
  statusNow: number;
  setFocused: (babyId: string) => void;
  acknowledgeAlert: (alertId: string) => Promise<void>;
}

const BabyContext = createContext<BabyContextValue | null>(null);

const BABY_STATUS_MAX_AGE_MS = 6 * 60 * 60 * 1000;

export function isBabyDetectionExpired(
  lastUpdated: string | null | undefined,
  now = Date.now(),
): boolean {
  if (!lastUpdated) return false;
  const updatedAt = Date.parse(lastUpdated);
  return (
    Number.isFinite(updatedAt) && now - updatedAt > BABY_STATUS_MAX_AGE_MS
  );
}

function clearExpiredBabyStatus(
  status: BabyStatus | null,
  now: number,
): BabyStatus | null {
  if (!status || !isBabyDetectionExpired(status.lastUpdated, now)) return status;

  return {
    ...status,
    isDetectionStale: true,
    isCrying: null,
    cryingDurationSec: null,
    alertLevel: null,
    activity: null,
    soundClass: null,
    soundConfidence: null,
    faceAnomaly: null,
    faceDetected: null,
    bodyDetected: null,
  };
}

// ── Provider ──────────────────────────────────────────────────────────
let socketInstance: Socket | null = null;

export function BabyProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(babyReducer, initialState);
  const [statusNow, setStatusNow] = useState(Date.now());
  const token = useAuthStore((s) => s.user?.token ?? null);
  const role = useAuthStore((s) => s.user?.role ?? null);
  const unitId = useAuthStore((s) =>
    s.user?.role === "caregiver" ? s.user.unitId : null,
  );
  const babyId = useAuthStore((s) =>
    s.user?.role === "parent" ? s.user.babyId : null,
  );

  const dispatchRef = useRef(dispatch);
  dispatchRef.current = dispatch;

  useEffect(() => {
    const interval = setInterval(() => setStatusNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadAlerts = useCallback(async () => {
    if (!token) return;

    try {
      console.log("[BabyContext] Memuat alert dari backend...");

      const alerts = await alertService.getAlerts(50);

      dispatchRef.current({
        type: "SET_ALERTS",
        payload: alerts,
      });

      console.log(`[BabyContext] ${alerts.length} alert berhasil dimuat`);
    } catch (error: any) {
      console.error(
        "[BabyContext] Gagal memuat alert:",
        error?.response?.data || error?.message || error,
      );
    }
  }, [token]);

  useEffect(() => {
    if (!token) {
      socketInstance?.disconnect();
      socketInstance = null;
      dispatchRef.current({ type: "CLEAR" });
      return;
    }

    void loadAlerts();

    if (socketInstance?.connected) return;
    socketInstance?.disconnect();

    socketInstance = io(CONFIG.SOCKET_URL, {
      auth: { token },
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 10000,
      timeout: 10000,
    });

    socketInstance.on("connect", () => {
      console.log("[Socket] Connected");

      if (role === "caregiver" && unitId) {
        socketInstance!.emit("subscribe:unit", unitId);
      } else if (role === "parent" && babyId) {
        socketInstance!.emit("subscribe:baby", babyId);
      }
      void loadAlerts();
    });

    socketInstance.on(
      "baby:status-update",
      (data: any) => {
        const normalized = normalizeStatusPayload(data);
        if (!normalized.babyId) return;
        dispatchRef.current({ type: "SET_STATUS", payload: normalized });
      },
    );

    socketInstance.on("baby:alert", (data: AlertNotification) => {
      dispatchRef.current({ type: "ADD_ALERT", payload: data });

      const isMuted = useAuthStore.getState().isMuted;
      if (!isMuted) {
        notificationService.showLocalNotification({
          title:
            data.severity === "critical" ? "Peringatan Darurat!" : "Perhatian",
          body: data.message,
          severity: data.severity,
          babyId: data.babyId,
        });
      }
    });

    socketInstance.on("disconnect", (reason) => {
      console.log("[Socket] Disconnected:", reason);
    });

    socketInstance.on("connect_error", (err) => {
      console.error("[Socket] Error:", err.message);
    });

    return () => {
      socketInstance?.disconnect();
      socketInstance = null;
    };
  }, [token, role, unitId, babyId]);

  // INJEKSI INITIAL FETCH DI SINI
  const setFocused = useCallback(async (id: string) => {
    dispatch({ type: "SET_FOCUSED", payload: id });

    try {
      console.log(
        `\n[BabyContext-DEBUG] 1. Memulai Fetch untuk bayi ID: ${id}`,
      );
      const response = await api.get(`/babies/${id}`);
      const babyData = response.data.data || response.data;

      if (!babyData) {
        console.error(`[BabyContext-DEBUG] ❌ FATAL: babyData kosong!`);
        return;
      }

      const statusData = babyData.baby_statuses ?? null;
      const deviceData = babyData.devices ?? null;

      if (!statusData) {
        console.warn("[BabyContext-DEBUG] Belum ada hasil AI untuk bayi ini.");
      }

      const rawSoundConfidence = statusData?.sound_confidence;

      const parsedSoundConfidence =
        rawSoundConfidence != null ? Number(rawSoundConfidence) : null;

      const soundConfidence =
        parsedSoundConfidence != null && Number.isFinite(parsedSoundConfidence)
          ? parsedSoundConfidence
          : null;

      const initialStatus = normalizeStatusPayload({
        babyId: id,
        babyName: babyData.name,
        bedNumber: babyData.bed_number || babyData.bedNumber || "-",

        // null = belum ada hasil AI
        isCrying: statusData?.is_crying ?? null,
        cryingDurationSec: statusData?.crying_duration_sec ?? null,
        alertLevel: statusData?.alert_level ?? null,

        // status hardware tetap boleh berasal dari device
        deviceOnline: deviceData?.is_online ?? null,

        // Jangan membuat timestamp palsu
        lastUpdated: statusData?.updated_at ?? null,

        // Jangan menganggap bayi tidur jika AI belum memberi hasil
        activity: statusData?.activity ?? null,

        // Jangan menganggap bayi tidak menangis jika AI belum memberi hasil
        soundClass: statusData?.sound_class ?? null,

        // 0 harus tetap 0
        soundConfidence,

        // null berarti belum ada hasil deteksi anomaly
        faceAnomaly: statusData?.face_anomaly ?? "none",
      }) as BabyStatus;

      dispatch({
        type: "SET_STATUS",
        payload: initialStatus,
      });

      dispatch({ type: "SET_STATUS", payload: initialStatus });
      console.log(
        `[BabyContext-DEBUG] ✅ 4. Status sukses di-dispatch ke UI! Layar loading HARUSNYA HILANG DETIK INI JUGA.`,
      );
    } catch (error: any) {
      console.error(`\n[BabyContext-DEBUG] 💥 CRASH PADA FETCH!`);
      console.error(`Pesan Error:`, error.response?.data || error.message);
    }
  }, []);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    try {
      await api.patch(`/alerts/${alertId}/acknowledge`);

      dispatch({
        type: "ACK_ALERT",
        payload: alertId,
      });

      console.log(`[BabyContext] Alert ${alertId} berhasil di-acknowledge`);
    } catch (error: any) {
      console.error(
        "[BabyContext] Gagal acknowledge alert:",
        error.response?.data || error,
      );

      throw error;
    }
  }, []);

  return (
    <BabyContext.Provider
      value={{ state, statusNow, setFocused, acknowledgeAlert }}
    >
      {children}
    </BabyContext.Provider>
  );
}

// ── Hooks ─────────────────────────────────────────────────────────────
export function useBabyContext() {
  const ctx = useContext(BabyContext);
  if (!ctx)
    throw new Error("useBabyContext harus dipakai di dalam BabyProvider");
  return ctx;
}

export function useFocusedBabyStatus(): BabyStatus | null {
  const { state, statusNow } = useBabyContext();
  if (!state.focusedBabyId) return null;
  return clearExpiredBabyStatus(
    state.statuses[state.focusedBabyId] ?? null,
    statusNow,
  );
}

export function useAllBabyStatuses(): Record<string, BabyStatus> {
  const { state, statusNow } = useBabyContext();
  return Object.fromEntries(
    Object.entries(state.statuses).map(([babyId, status]) => [
      babyId,
      clearExpiredBabyStatus(status, statusNow),
    ]),
  ) as Record<string, BabyStatus>;
}

export function useActiveAlerts(): AlertNotification[] {
  const { state } = useBabyContext();
  return state.alerts.filter((a) => !a.acknowledged);
}

export function useBabyStatusById(babyId: string): BabyStatus | null {
  const { state, statusNow } = useBabyContext();
  return clearExpiredBabyStatus(state.statuses[babyId] ?? null, statusNow);
}
