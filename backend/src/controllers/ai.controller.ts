import { Request, Response } from 'express';
import { deviceService } from '../services/device.service';
import { alertService } from '../services/alert.service';
import { broadcastBabyStatus, broadcastAlert } from '../socket/socket.handler';
import { ActivityFlags, BabyActivity } from '../types';
import { io } from '../app';

function parseFlag(value: unknown): boolean | null {
  if (value === true || value === 1) return true;
  if (value === false || value === 0) return false;
  return null;
}

function parseActivityFlags(body: Record<string, unknown>): ActivityFlags | null {
  // Alias Indonesia diterima supaya integrasi AI dapat memakai nama lokal.
  const sleeping = parseFlag(body.sleeping ?? body.tidur);
  const awake = parseFlag(body.awake ?? body.bangun);
  const crying = parseFlag(body.crying ?? body.menangis ?? body.nangis);

  if (sleeping === null || awake === null || crying === null) return null;
  if (Number(sleeping) + Number(awake) + Number(crying) !== 1) return null;

  return { sleeping, awake, crying };
}

function getActivity(flags: ActivityFlags): BabyActivity {
  if (flags.sleeping) return 'sleeping';
  if (flags.awake) return 'awake';
  return 'crying';
}

export const aiController = {
  // Terima hasil klasifikasi aktivitas bayi dari AI server.
  async receiveActivityResult(req: Request, res: Response): Promise<void> {
    try {
      const {
        macAddress,
        confidence,
        durationSec = 0,
        nightVision = false,
        timestamp,
      } = req.body;

      const flags = parseActivityFlags(req.body ?? {});
      if (!macAddress || !flags) {
        res.status(400).json({
          success: false,
          error: 'Kirim sleeping, awake, dan crying sebagai 0/1; tepat satu harus bernilai 1',
        });
        return;
      }

      if (confidence !== undefined && (typeof confidence !== 'number' || confidence < 0 || confidence > 1)) {
        res.status(400).json({ success: false, error: 'Confidence harus bernilai 0 sampai 1' });
        return;
      }

      if (typeof durationSec !== 'number' || durationSec < 0) {
        res.status(400).json({ success: false, error: 'durationSec harus berupa angka positif' });
        return;
      }

      const babyId = await deviceService.getBabyIdByMac(macAddress);
      if (!babyId) {
        res.status(404).json({ success: false, error: 'Device belum dipair' });
        return;
      }

      const config = await deviceService.getDeviceConfig(macAddress);
      const minConfidence = config?.yolo_confidence_min ?? 0.85;

      if (confidence !== undefined && confidence < minConfidence) {
        res.json({ success: true, data: { skipped: true } });
        return;
      }

      const activity = getActivity(flags);
      const isCrying = flags.crying;
      const cryingDurationSec = isCrying ? durationSec : 0;
      const alertLevel = isCrying ? 'warning' : 'normal';
      const recordedAt = typeof timestamp === 'string' && !Number.isNaN(Date.parse(timestamp))
        ? timestamp
        : new Date().toISOString();

      await deviceService.recordActivitySample(babyId, flags, recordedAt);

      await deviceService.upsertBabyStatus(babyId, {
        activity,
        flags,
        temperature: 36.8,
        isCrying,
        cryingDurationSec,
        alertLevel,
        nightVisionActive: nightVision,
      });

      broadcastBabyStatus(io, {
        babyId,
        activity,
        sleeping: flags.sleeping,
        awake: flags.awake,
        crying: flags.crying,
        soundClass: isCrying ? 'crying' : 'not_crying',
        soundConfidence: confidence ?? 1,
        temperature: 36.8,
        isCrying,
        cryingDurationSec,
        alertLevel,
        nightVisionActive: nightVision,
        deviceOnline: true,
        lastUpdated: timestamp ?? new Date().toISOString(),
      });

      if (isCrying && cryingDurationSec >= (config?.crying_min_duration_sec ?? 10)) {
        const alert = await alertService.createAlert({
          babyId,
          type: 'CRYING_DETECTED',
          message: `Bayi menangis selama ${cryingDurationSec} detik`,
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

      res.json({ success: true, data: { babyId, activity, alertLevel } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
