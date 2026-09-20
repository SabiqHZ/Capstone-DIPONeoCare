import { Request, Response } from 'express';
import { AuthRequest } from '../types';
import { aiDispatchService } from '../services/ai-dispatch.service';
import { deviceService } from '../services/device.service';
import { broadcastBabyStatus } from '../socket/socket.handler';
import { io } from '../app';

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

export const deviceController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, localIp, firmwareVersion, name } = req.body;
      if (typeof macAddress !== 'string' || !macAddress.trim()) {
        res.status(400).json({ success: false, error: 'macAddress wajib diisi' });
        return;
      }
      const { device, deviceToken } = await deviceService.registerOrGetDevice({
        macAddress: macAddress.trim(), localIp, firmwareVersion, name,
      });
      res.status(201).json({ success: true, data: {
        deviceId: device.id, deviceToken, paired: Boolean(device.baby_id),
      } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const device = await deviceService.updateHeartbeat(req.body.macAddress, req.body.localIp);
      if (!device) {
        res.status(404).json({ success: false, error: 'Perangkat tidak ditemukan' });
        return;
      }
      if (device.baby_id) {
        broadcastBabyStatus(io, {
          babyId: device.baby_id,
          unitId: device.unit_id,
          deviceOnline: true,
          lastUpdated: new Date().toISOString(),
        });
      }
      res.json({ success: true, data: { deviceId: device.id, paired: Boolean(device.baby_id) } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async uploadFrame(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, captureId, timestamp } = req.body;
      if (!req.file || !macAddress || !captureId || !isIsoTimestamp(timestamp)) {
        res.status(400).json({ success: false, error: 'image, macAddress, captureId, dan timestamp ISO wajib diisi' });
        return;
      }
      const device = await deviceService.getDeviceByMac(macAddress);
      if (!device?.baby_id) {
        res.status(409).json({ success: false, error: 'Perangkat belum dipair ke bayi' });
        return;
      }

      // The device gets an acknowledgement immediately; inference happens independently.
      void aiDispatchService.dispatch('vision', { macAddress, captureId, timestamp, file: req.file })
        .catch((error) => console.error('[AI] vision dispatch failed:', error.message));
      res.status(202).json({ success: true, data: { accepted: true, captureId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async uploadAudio(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, audioWindowId, startedAt, durationSeconds } = req.body;
      let captureIds: unknown;
      try {
        captureIds = typeof req.body.captureIds === 'string' ? JSON.parse(req.body.captureIds) : req.body.captureIds;
      } catch {
        captureIds = null;
      }
      const duration = Number(durationSeconds);
      if (!req.file || !macAddress || !audioWindowId || !isIsoTimestamp(startedAt) || duration !== 5 ||
          !Array.isArray(captureIds) || captureIds.length !== 5 || captureIds.some((id) => typeof id !== 'string' || !id)) {
        res.status(400).json({ success: false, error: 'audio, macAddress, audioWindowId, startedAt, durationSeconds=5, dan lima captureIds wajib valid' });
        return;
      }
      const device = await deviceService.getDeviceByMac(macAddress);
      if (!device?.baby_id) {
        res.status(409).json({ success: false, error: 'Perangkat belum dipair ke bayi' });
        return;
      }

      void aiDispatchService.dispatch('audio', {
        macAddress, audioWindowId, startedAt, durationSeconds: duration,
        captureIds: captureIds as string[], file: req.file,
      })
        .catch((error) => console.error('[AI] audio dispatch failed:', error.message));
      res.status(202).json({ success: true, data: { accepted: true, audioWindowId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async available(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.unitId) {
        res.status(400).json({ success: false, error: 'Unit pengasuh tidak ditemukan' });
        return;
      }
      res.json({ success: true, data: await deviceService.getAvailableDevices(req.user.unitId) });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async updateConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cryingMinDurationSec = req.body.cryingMinDurationSec;
      const notificationCooldownSec = req.body.notificationCooldownSec;
      if ((cryingMinDurationSec !== undefined && (!Number.isInteger(cryingMinDurationSec) || cryingMinDurationSec < 5 || cryingMinDurationSec > 60)) ||
          (notificationCooldownSec !== undefined && (!Number.isInteger(notificationCooldownSec) || notificationCooldownSec < 30 || notificationCooldownSec > 300))) {
        res.status(400).json({ success: false, error: 'Nilai konfigurasi perangkat tidak valid' });
        return;
      }
      const data = await deviceService.updateConfig(req.params.id as string, { cryingMinDurationSec, notificationCooldownSec });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
