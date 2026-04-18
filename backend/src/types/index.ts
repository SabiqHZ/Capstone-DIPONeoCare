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

export type SleepPosition = 'supine' | 'prone' | 'lateral' | 'unknown';
export type AlertLevel = 'normal' | 'warning' | 'critical';

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
}
// ── MQTT Payloads dari ESP32 ──────────────────────────────────────

export interface MqttSleepPayload {
  deviceId: string;
  macAddress: string;
  position: SleepPosition;
  confidence: number;
  nightVision: boolean;
  timestamp: string;
}

export interface MqttTemperaturePayload {
  deviceId: string;
  macAddress: string;
  temperature: number;
  timestamp: string;
}

export interface MqttCryingPayload {
  deviceId: string;
  macAddress: string;
  isCrying: boolean;
  durationSec: number;
  timestamp: string;
}

export interface MqttHeartbeatPayload {
  deviceId: string;
  macAddress: string;
  timestamp: string;
}

export interface MqttDeviceRegisterPayload {
  macAddress: string;
  firmwareVersion: string;
  timestamp: string;
}