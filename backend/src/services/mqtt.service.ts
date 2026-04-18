import mqtt, { MqttClient } from 'mqtt';
import { Server } from 'socket.io';
import { env } from '../config/env';
import { deviceService } from './device.service';
import { alertService } from './alert.service';
import { broadcastBabyStatus, broadcastAlert } from '../socket/socket.handler';
import {
  MqttSleepPayload,
  MqttTemperaturePayload,
  MqttCryingPayload,
  MqttHeartbeatPayload,
  MqttDeviceRegisterPayload,
} from '../types';

// State in-memory untuk track status tiap device
// Key: macAddress
const deviceStateMap: Record<string, {
  temperature: number;
  sleepPosition: string;
  positionConfidence: number;
  isCrying: boolean;
  cryingDurationSec: number;
  nightVisionActive: boolean;
  lastHeartbeat: number;
}> = {};

// Heartbeat checker — jalankan tiap 30 detik
// Jika device tidak heartbeat > 90 detik → tandai offline
let heartbeatInterval: NodeJS.Timeout;

// Topics
const TOPICS = {
  DEVICE_REGISTER: 'sv/device/register',
  SLEEP: 'sv/+/sleep',
  TEMPERATURE: 'sv/+/temperature',
  CRYING: 'sv/+/crying',
  HEARTBEAT: 'sv/+/heartbeat',
};

let mqttClient: MqttClient | null = null;
let ioInstance: Server | null = null;

export function initMqtt(io: Server): void {
  ioInstance = io;

  mqttClient = mqtt.connect(env.MQTT_BROKER_URL, {
    username: env.MQTT_USERNAME || undefined,
    password: env.MQTT_PASSWORD || undefined,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
    clientId: `smart-vision-backend-${Date.now()}`,
  });

  mqttClient.on('connect', () => {
    console.log('[MQTT] Connected to broker');

    // Subscribe ke semua topics
    const topics = Object.values(TOPICS);
    mqttClient!.subscribe(topics, (err) => {
      if (err) {
        console.error('[MQTT] Subscribe error:', err.message);
      } else {
        console.log('[MQTT] Subscribed to:', topics.join(', '));
      }
    });
  });

  mqttClient.on('message', async (topic, message) => {
    try {
      const payload = JSON.parse(message.toString());
      await handleMessage(topic, payload);
    } catch (err) {
      console.error('[MQTT] Parse error on topic:', topic, err);
    }
  });

  mqttClient.on('error', (err) => {
    console.error('[MQTT] Error:', err.message);
  });

  mqttClient.on('reconnect', () => {
    console.log('[MQTT] Reconnecting...');
  });

  mqttClient.on('offline', () => {
    console.log('[MQTT] Client offline');
  });

  // Start heartbeat checker
  startHeartbeatChecker();
}

async function handleMessage(topic: string, payload: any): Promise<void> {
  // Device register
  if (topic === TOPICS.DEVICE_REGISTER) {
    await handleDeviceRegister(payload as MqttDeviceRegisterPayload);
    return;
  }

  // Extract macAddress dari topic (format: sv/{mac}/action)
  const parts = topic.split('/');
  if (parts.length < 3) return;

  const macAddress = parts[1];

  if (topic.endsWith('/sleep')) {
    await handleSleep(macAddress, payload as MqttSleepPayload);
  } else if (topic.endsWith('/temperature')) {
    await handleTemperature(macAddress, payload as MqttTemperaturePayload);
  } else if (topic.endsWith('/crying')) {
    await handleCrying(macAddress, payload as MqttCryingPayload);
  } else if (topic.endsWith('/heartbeat')) {
    await handleHeartbeat(macAddress, payload as MqttHeartbeatPayload);
  }
}

async function handleDeviceRegister(payload: MqttDeviceRegisterPayload): Promise<void> {
  console.log('[MQTT] Device register:', payload.macAddress);
  await deviceService.registerOrGetDevice(payload.macAddress);
}

async function handleHeartbeat(macAddress: string, payload: MqttHeartbeatPayload): Promise<void> {
  await deviceService.updateHeartbeat(macAddress);

  // Update state
  if (!deviceStateMap[macAddress]) {
    deviceStateMap[macAddress] = {
      temperature: 36.5,
      sleepPosition: 'unknown',
      positionConfidence: 0,
      isCrying: false,
      cryingDurationSec: 0,
      nightVisionActive: false,
      lastHeartbeat: Date.now(),
    };
  } else {
    deviceStateMap[macAddress].lastHeartbeat = Date.now();
  }

  console.log(`[MQTT] Heartbeat from ${macAddress}`);
}

async function handleSleep(macAddress: string, payload: MqttSleepPayload): Promise<void> {
  const babyId = await deviceService.getBabyIdByMac(macAddress);
  if (!babyId) {
    console.warn('[MQTT] Sleep data from unregistered device:', macAddress);
    return;
  }

  // Ambil config threshold
  const config = await deviceService.getDeviceConfig(macAddress);
  const minConfidence = config?.yolo_confidence_min || 0.85;

  // Skip jika confidence di bawah threshold
  if (payload.confidence < minConfidence) return;

  // Update state
  if (!deviceStateMap[macAddress]) {
    deviceStateMap[macAddress] = {
      temperature: 36.5,
      sleepPosition: payload.position,
      positionConfidence: payload.confidence,
      isCrying: false,
      cryingDurationSec: 0,
      nightVisionActive: payload.nightVision,
      lastHeartbeat: Date.now(),
    };
  } else {
    deviceStateMap[macAddress].sleepPosition = payload.position;
    deviceStateMap[macAddress].positionConfidence = payload.confidence;
    deviceStateMap[macAddress].nightVisionActive = payload.nightVision;
  }

  const state = deviceStateMap[macAddress];

  // Tentukan alert level
  const alertLevel = alertService.determineAlertLevel(
    payload.position,
    state.temperature,
    config?.temp_min || 36.5,
    config?.temp_max || 37.5
  );

  // Simpan ke database
  await deviceService.upsertBabyStatus(babyId, {
    sleepPosition: payload.position,
    positionConfidence: payload.confidence,
    temperature: state.temperature,
    isCrying: state.isCrying,
    cryingDurationSec: state.cryingDurationSec,
    alertLevel,
    nightVisionActive: payload.nightVision,
  });

  // Broadcast ke socket
  if (ioInstance) {
    broadcastBabyStatus(ioInstance, {
      babyId,
      sleepPosition: payload.position,
      positionConfidence: payload.confidence,
      temperature: state.temperature,
      isCrying: state.isCrying,
      cryingDurationSec: state.cryingDurationSec,
      alertLevel,
      nightVisionActive: payload.nightVision,
      deviceOnline: true,
      lastUpdated: payload.timestamp,
    });
  }

  // Buat alert jika posisi bahaya
  if (payload.position === 'prone') {
    const alert = await alertService.createAlert({
      babyId,
      type: 'PRONE_POSITION',
      message: 'Bayi terdeteksi posisi telungkup! Segera periksa.',
      severity: 'critical',
    });

    if (alert && ioInstance) {
      broadcastAlert(ioInstance, {
        id: alert.id,
        babyId,
        type: 'PRONE_POSITION',
        message: alert.message,
        severity: 'critical',
        timestamp: alert.created_at,
        acknowledged: false,
      });
    }
  }
}

async function handleTemperature(
  macAddress: string,
  payload: MqttTemperaturePayload
): Promise<void> {
  const babyId = await deviceService.getBabyIdByMac(macAddress);
  if (!babyId) return;

  const config = await deviceService.getDeviceConfig(macAddress);
  const tempMin = config?.temp_min || 36.5;
  const tempMax = config?.temp_max || 37.5;

  // Update state
  if (!deviceStateMap[macAddress]) {
    deviceStateMap[macAddress] = {
      temperature: payload.temperature,
      sleepPosition: 'unknown',
      positionConfidence: 0,
      isCrying: false,
      cryingDurationSec: 0,
      nightVisionActive: false,
      lastHeartbeat: Date.now(),
    };
  } else {
    deviceStateMap[macAddress].temperature = payload.temperature;
  }

  const state = deviceStateMap[macAddress];
  const alertLevel = alertService.determineAlertLevel(
    state.sleepPosition,
    payload.temperature,
    tempMin,
    tempMax
  );

  await deviceService.upsertBabyStatus(babyId, {
    sleepPosition: state.sleepPosition,
    positionConfidence: state.positionConfidence,
    temperature: payload.temperature,
    isCrying: state.isCrying,
    cryingDurationSec: state.cryingDurationSec,
    alertLevel,
    nightVisionActive: state.nightVisionActive,
  });

  if (ioInstance) {
    broadcastBabyStatus(ioInstance, {
      babyId,
      sleepPosition: state.sleepPosition,
      positionConfidence: state.positionConfidence,
      temperature: payload.temperature,
      isCrying: state.isCrying,
      cryingDurationSec: state.cryingDurationSec,
      alertLevel,
      nightVisionActive: state.nightVisionActive,
      deviceOnline: true,
      lastUpdated: payload.timestamp,
    });
  }

  // Alert suhu abnormal
  if (payload.temperature > tempMax || payload.temperature < tempMin) {
    const isHigh = payload.temperature > tempMax;
    const alert = await alertService.createAlert({
      babyId,
      type: isHigh ? 'HIGH_TEMPERATURE' : 'LOW_TEMPERATURE',
      message: isHigh
        ? `Suhu ruangan terlalu tinggi: ${payload.temperature}°C`
        : `Suhu ruangan terlalu rendah: ${payload.temperature}°C`,
      severity: 'warning',
    });

    if (alert && ioInstance) {
      broadcastAlert(ioInstance, {
        id: alert.id,
        babyId,
        type: alert.type,
        message: alert.message,
        severity: 'warning',
        timestamp: alert.created_at,
        acknowledged: false,
      });
    }
  }
}

async function handleCrying(
  macAddress: string,
  payload: MqttCryingPayload
): Promise<void> {
  const babyId = await deviceService.getBabyIdByMac(macAddress);
  if (!babyId) return;

  const config = await deviceService.getDeviceConfig(macAddress);
  const minDuration = config?.crying_min_duration_sec || 10;

  // Skip jika durasi di bawah threshold
  if (payload.isCrying && payload.durationSec < minDuration) return;

  if (!deviceStateMap[macAddress]) {
    deviceStateMap[macAddress] = {
      temperature: 36.5,
      sleepPosition: 'unknown',
      positionConfidence: 0,
      isCrying: payload.isCrying,
      cryingDurationSec: payload.durationSec,
      nightVisionActive: false,
      lastHeartbeat: Date.now(),
    };
  } else {
    deviceStateMap[macAddress].isCrying = payload.isCrying;
    deviceStateMap[macAddress].cryingDurationSec = payload.durationSec;
  }

  const state = deviceStateMap[macAddress];

  await deviceService.upsertBabyStatus(babyId, {
    sleepPosition: state.sleepPosition,
    positionConfidence: state.positionConfidence,
    temperature: state.temperature,
    isCrying: payload.isCrying,
    cryingDurationSec: payload.durationSec,
    alertLevel: alertService.determineAlertLevel(
      state.sleepPosition,
      state.temperature,
      config?.temp_min || 36.5,
      config?.temp_max || 37.5
    ),
    nightVisionActive: state.nightVisionActive,
  });

  if (ioInstance) {
    broadcastBabyStatus(ioInstance, {
      babyId,
      sleepPosition: state.sleepPosition,
      positionConfidence: state.positionConfidence,
      temperature: state.temperature,
      isCrying: payload.isCrying,
      cryingDurationSec: payload.durationSec,
      alertLevel: 'warning',
      nightVisionActive: state.nightVisionActive,
      deviceOnline: true,
      lastUpdated: payload.timestamp,
    });
  }

  // Alert tangisan
  if (payload.isCrying) {
    const alert = await alertService.createAlert({
      babyId,
      type: 'CRYING_DETECTED',
      message: `Bayi terdeteksi menangis selama ${payload.durationSec} detik`,
      severity: 'warning',
    });

    if (alert && ioInstance) {
      broadcastAlert(ioInstance, {
        id: alert.id,
        babyId,
        type: 'CRYING_DETECTED',
        message: alert.message,
        severity: 'warning',
        timestamp: alert.created_at,
        acknowledged: false,
      });
    }
  }
}

function startHeartbeatChecker(): void {
  heartbeatInterval = setInterval(async () => {
    const now = Date.now();
    const OFFLINE_THRESHOLD = 90 * 1000; // 90 detik

    for (const [macAddress, state] of Object.entries(deviceStateMap)) {
      if (now - state.lastHeartbeat > OFFLINE_THRESHOLD) {
        console.log(`[MQTT] Device offline: ${macAddress}`);
        await deviceService.markOffline(macAddress);

        const babyId = await deviceService.getBabyIdByMac(macAddress);
        if (babyId && ioInstance) {
          // Broadcast device offline
          broadcastBabyStatus(ioInstance, {
            babyId,
            deviceOnline: false,
            lastUpdated: new Date().toISOString(),
          });

          const alert = await alertService.createAlert({
            babyId,
            type: 'DEVICE_OFFLINE',
            message: 'Perangkat Smart Vision tidak merespons',
            severity: 'warning',
          });

          if (alert) {
            broadcastAlert(ioInstance, {
              id: alert.id,
              babyId,
              type: 'DEVICE_OFFLINE',
              message: alert.message,
              severity: 'warning',
              timestamp: alert.created_at,
              acknowledged: false,
            });
          }
        }
      }
    }
  }, 30 * 1000); // cek tiap 30 detik
}

// Publish ke device (untuk kontrol dari server)
export function publishToDevice(macAddress: string, topic: string, payload: object): void {
  if (!mqttClient?.connected) {
    console.error('[MQTT] Client tidak terhubung');
    return;
  }
  mqttClient.publish(
    `sv/${macAddress}/${topic}`,
    JSON.stringify(payload),
    { qos: 1 }
  );
}

export function getMqttClient(): MqttClient | null {
  return mqttClient;
}