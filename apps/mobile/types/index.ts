export type UserRole = 'caregiver' | 'parent';

export interface CaregiverUser {
  role: 'caregiver';
  id: string;
  name: string;
  unitId: string;
  token: string;
}

export interface ParentUser {
  role: 'parent';
  babyId: string;
  babyName: string;
  uniqueCode: string;
  token: string;
}

export type AuthUser = CaregiverUser | ParentUser;

export type BabyActivity = 'awake' | 'sleeping' | 'crying';
export type SoundClass = 'crying' | 'not_crying';
export type AlertLevel = 'normal' | 'warning';
export type FaceAnomaly = 'pillow' | 'bolster' | 'toy' | 'none';

export interface BabyStatus {
  babyId: string;
  babyName: string;
  bedNumber: string;
  isCrying: boolean;
  cryingDurationSec: number;
  alertLevel: AlertLevel;
  deviceOnline: boolean;
  lastUpdated: string;
  nightVisionActive: boolean;
  activity: BabyActivity;
  soundClass: SoundClass;
  soundConfidence: number;
    faceAnomaly?: FaceAnomaly;
  faceDetected?: boolean;
  bodyDetected?: boolean;
}

export interface Baby {
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
  | 'CRYING_DETECTED'
  | 'DEVICE_OFFLINE'
  | 'FACE_COVERED';

export interface AlertNotification {
  id: string;
  babyId: string;
  babyName: string;
  type: NotificationType;
  message: string;
  severity: 'warning' | 'critical';
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
