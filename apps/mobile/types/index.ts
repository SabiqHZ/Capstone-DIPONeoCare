export type UserRole = "caregiver" | "parent";

export interface CaregiverUser {
  role: "caregiver";
  id: string;
  name: string;
  unitId: string;
  token: string;
}

export interface ParentUser {
  role: "parent";
  babyId: string;
  babyName: string;
  uniqueCode: string;
  token: string;
}

export type AuthUser = CaregiverUser | ParentUser;

export type BabyActivity = "awake" | "sleeping" | "crying";
export type SoundClass = "crying" | "not_crying";
export type AlertLevel = "normal" | "warning";
export type FaceAnomaly = "bantal" | "guling" | "mainan" | "none";

export interface BabyStatus {
  babyId: string;
  babyName: string;
  bedNumber: string;
  isCrying: boolean | null;
  cryingDurationSec: number | null;
  alertLevel: AlertLevel | null;
  deviceOnline: boolean;
  lastUpdated: string | null;
  activity: BabyActivity | null;
  soundClass: SoundClass | null;
  soundConfidence: number | null;

  faceAnomaly?: FaceAnomaly | null;
  faceDetected?: boolean | null;
  bodyDetected?: boolean | null;
}

export interface Baby {
  id: string;
  name: string;
  bed_number: string;
  dateOfBirth: string;
  parentName: string;
  uniqueCode: string;
  deviceId: string | null;
  unitId: string;
  createdAt: string;
}
export interface RegisteredBaby {
  id: string;
  name: string;
  bedNumber: string;
  dateOfBirth: string;
  parentName: string;
  uniqueCode: string;
  deviceId: string | null;
  unitId: string;
  createdAt: string;
}

export interface DeviceConfig {
  deviceId: string;
  cryingMinDurationSec: number;
  notificationCooldownSec: number;
}

export type NotificationType =
  | "CRYING_DETECTED"
  | "DEVICE_OFFLINE"
  | "FACE_COVERED"
  | "ANOMALY_DETECTED";

export interface AlertNotification {
  id: string;
  babyId: string;
  babyName: string;
  type: NotificationType;
  message: string;
  severity: "warning" | "critical";
  timestamp: string;
  acknowledged: boolean;
}

export interface HourlyActivityData {
  hour: number;
  sleepSeconds: number;
  awakeSeconds: number;
  cryingSeconds: number;
  awakeMinutes: number;
  sleepMinutes: number;
  cryingMinutes: number;
}

export interface DailyReport {
  babyId: string;
  date: string;
  totalAwakeMinutes: number;
  totalSleepMinutes: number;
  totalAwakeSeconds: number;
  totalSleepSeconds: number;
  totalCryingMinutes: number;
  totalCryingSeconds: number;
  totalCryingEvents: number;
  hourlyActivities: HourlyActivityData[];
}
export interface ReportHistoryItem {
  date: string;
  total_sleep_minutes: number;
  total_awake_minutes: number;
  total_crying_events: number;
}
