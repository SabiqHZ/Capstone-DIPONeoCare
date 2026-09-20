import { Request } from 'express';

export type UserRole = 'nurse' | 'parent';

export interface JwtPayload {
  sub: string;         // user id
  role: UserRole;
  unitId?: string;     // untuk nurse
  babyId?: string;     // untuk parent
  iat?: number;
  exp?: number;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

export type BabyActivity = 'sleeping' | 'awake' | 'crying';
export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface ActivityFlags {
  sleeping: boolean;
  awake: boolean;
  crying: boolean;
}

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
export interface DeviceContext {
  id: string;
  mac_address: string;
  baby_id: string | null;
  unit_id: string | null;
  is_online: boolean;
  crying_min_duration_sec: number | null;
  notification_cooldown_sec: number | null;
}

export interface VisionResultPayload {
  macAddress: string;
  captureId: string;
  timestamp: string;
  activity: {
    sleeping: boolean;
    awake: boolean;
    confidence?: number;
  };
  visualCrying: {
    detected: boolean;
    confidence?: number;
  };
  anomaly: {
    detected: boolean;
    type: 'pillow' | 'bolster' | 'toy' | null;
    confidence?: number;
  };
  nightVision?: boolean;
}

export interface AudioSecondResult {
  captureId: string;
  timestamp: string;
  isCrying: boolean;
  confidence?: number;
}
