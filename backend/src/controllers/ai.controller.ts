import { Request, Response } from 'express';
import { deviceService } from '../services/device.service';
import { alertService } from '../services/alert.service';
import { broadcastBabyStatus, broadcastAlert } from '../socket/socket.handler';
import { supabaseAdmin } from '../config/supabase';
import { ApiResponse } from '../types';
import { io } from '../app';

export const aiController = {
  // Terima hasil klasifikasi posisi tidur dari AI server
  async receiveSleepResult(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, position, confidence, nightVision = false, timestamp } = req.body;

      if (!macAddress || !position || confidence === undefined) {
        res.status(400).json({ success: false, error: 'Field tidak lengkap' });
        return;
      }

      const babyId = await deviceService.getBabyIdByMac(macAddress);
      if (!babyId) {
        res.status(404).json({ success: false, error: 'Device belum dipair' });
        return;
      }

      const config = await deviceService.getDeviceConfig(macAddress);
      const minConfidence = config?.yolo_confidence_min ?? 0.85;

      if (confidence < minConfidence) {
        res.json({ success: true, data: { skipped: true } });
        return;
      }

      const alertLevel = alertService.determineAlertLevel(
        position,
        36.8,
        config?.temp_min ?? 36.5,
        config?.temp_max ?? 37.5
      );

      await deviceService.upsertBabyStatus(babyId, {
        sleepPosition: position,
        positionConfidence: confidence,
        temperature: 36.8,
        isCrying: false,
        cryingDurationSec: 0,
        alertLevel,
        nightVisionActive: nightVision,
      });

      broadcastBabyStatus(io, {
        babyId,
        sleepPosition: position,
        positionConfidence: confidence,
        temperature: 36.8,
        isCrying: false,
        cryingDurationSec: 0,
        alertLevel,
        nightVisionActive: nightVision,
        deviceOnline: true,
        lastUpdated: timestamp ?? new Date().toISOString(),
      });

      if (position === 'prone') {
        const alert = await alertService.createAlert({
          babyId,
          type: 'PRONE_POSITION',
          message: 'Bayi terdeteksi posisi telungkup!',
          severity: 'critical',
        });

        if (alert) {
          broadcastAlert(io, {
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

      res.json({ success: true, data: { babyId, position, alertLevel } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  // Terima hasil klasifikasi audio/tangisan dari AI server
  async receiveCryingResult(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, isCrying, durationSec = 0, confidence, timestamp } = req.body;

      if (!macAddress || isCrying === undefined) {
        res.status(400).json({ success: false, error: 'Field tidak lengkap' });
        return;
      }

      const babyId = await deviceService.getBabyIdByMac(macAddress);
      if (!babyId) {
        res.status(404).json({ success: false, error: 'Device belum dipair' });
        return;
      }

      const config = await deviceService.getDeviceConfig(macAddress);
      if (isCrying && durationSec < (config?.crying_min_duration_sec ?? 10)) {
        res.json({ success: true, data: { skipped: true } });
        return;
      }

      broadcastBabyStatus(io, {
        babyId,
        isCrying,
        cryingDurationSec: durationSec,
        alertLevel: isCrying ? 'warning' : 'normal',
        deviceOnline: true,
        lastUpdated: timestamp ?? new Date().toISOString(),
      });

      if (isCrying) {
        const alert = await alertService.createAlert({
          babyId,
          type: 'CRYING_DETECTED',
          message: `Bayi menangis selama ${durationSec} detik`,
          severity: 'warning',
        });

        if (alert) {
          broadcastAlert(io, {
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

      res.json({ success: true, data: { babyId, isCrying, durationSec } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};