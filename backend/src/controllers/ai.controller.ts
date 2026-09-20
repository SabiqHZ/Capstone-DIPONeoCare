import { Request, Response } from 'express';
import { broadcastAlert, broadcastBabyStatus } from '../socket/socket.handler';
import { io } from '../app';
import { AudioSecondResult, VisionResultPayload } from '../types';
import { deviceService } from '../services/device.service';
import { inferenceService } from '../services/inference.service';

function isFlag(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

function validConfidence(value: unknown): boolean {
  return value === undefined || (typeof value === 'number' && value >= 0 && value <= 1);
}

function parseVision(body: unknown): VisionResultPayload | null {
  const value = body as Partial<VisionResultPayload>;
  if (!value || typeof value.macAddress !== 'string' || typeof value.captureId !== 'string' ||
      typeof value.timestamp !== 'string' || Number.isNaN(Date.parse(value.timestamp)) ||
      !value.activity || !value.visualCrying || !value.anomaly) return null;
  if (!isFlag(value.activity.sleeping) || !isFlag(value.activity.awake) ||
      Number(value.activity.sleeping) + Number(value.activity.awake) !== 1 ||
      !isFlag(value.visualCrying.detected) || !isFlag(value.anomaly.detected) ||
      !validConfidence(value.activity.confidence) || !validConfidence(value.visualCrying.confidence) ||
      !validConfidence(value.anomaly.confidence)) return null;
  if (value.anomaly.detected && !['pillow', 'bolster', 'toy'].includes(value.anomaly.type ?? '')) return null;
  if (!value.anomaly.detected && value.anomaly.type !== null) return null;
  return value as VisionResultPayload;
}

function parseAudioResults(body: any): { macAddress: string; results: AudioSecondResult[] } | null {
  if (!body || typeof body.macAddress !== 'string' || !Array.isArray(body.results) || body.results.length !== 5) return null;
  const results = body.results as AudioSecondResult[];
  if (results.some((item) => typeof item.captureId !== 'string' || typeof item.timestamp !== 'string' ||
      Number.isNaN(Date.parse(item.timestamp)) || !isFlag(item.isCrying) || !validConfidence(item.confidence))) return null;
  return { macAddress: body.macAddress, results };
}

function emitFinalized(statuses: Awaited<ReturnType<typeof inferenceService.finalizeMatches>>) {
  for (const status of statuses) {
    broadcastBabyStatus(io, {
      babyId: status.babyId,
      unitId: status.unitId,
      activity: status.activity,
      sleeping: status.flags.sleeping,
      awake: status.flags.awake,
      crying: status.flags.crying,
      isCrying: status.flags.crying,
      soundClass: status.soundClass,
      soundConfidence: status.soundConfidence,
      cryingDurationSec: status.cryingDurationSec,
      alertLevel: status.flags.crying ? 'warning' : 'normal',
      faceAnomaly: status.anomalyType ?? 'none',
      nightVisionActive: status.nightVisionActive,
      deviceOnline: true,
      lastUpdated: status.updatedAt,
    });
  }
}

async function emitCryingAlerts(
  device: NonNullable<Awaited<ReturnType<typeof deviceService.getDeviceByMac>>>,
  statuses: Awaited<ReturnType<typeof inferenceService.finalizeMatches>>,
) {
  for (const status of statuses.filter(
    (item) => item.flags.crying && item.cryingDurationSec >= (device.crying_min_duration_sec ?? 10),
  )) {
    const alert = await inferenceService.createCryingAlertIfDue(device, status.cryingDurationSec);
    if (alert) {
      broadcastAlert(io, {
        id: alert.id, babyId: status.babyId, unitId: status.unitId, type: alert.type,
        message: alert.message, severity: alert.severity, timestamp: alert.created_at, acknowledged: false,
      });
    }
  }
}

export const aiController = {
  async receiveVisionResult(req: Request, res: Response): Promise<void> {
    try {
      const payload = parseVision(req.body);
      if (!payload) {
        res.status(400).json({ success: false, error: 'Payload vision tidak valid' });
        return;
      }
      const device = await deviceService.getDeviceByMac(payload.macAddress);
      if (!device?.baby_id) {
        res.status(404).json({ success: false, error: 'Perangkat belum dipair ke bayi' });
        return;
      }
      await inferenceService.saveVisionResult(device, payload);
      const anomalyAlert = await inferenceService.trackAnomaly(device, payload);
      const finalized = await inferenceService.finalizeMatches(device, [payload.captureId]);
      emitFinalized(finalized);
      await emitCryingAlerts(device, finalized);
      if (anomalyAlert) {
        broadcastAlert(io, {
          id: anomalyAlert.id, babyId: device.baby_id, unitId: device.unit_id,
          type: anomalyAlert.type, message: anomalyAlert.message, severity: anomalyAlert.severity,
          timestamp: anomalyAlert.created_at, acknowledged: false,
        });
      }
      res.json({ success: true, data: { captureId: payload.captureId, finalized: finalized.length === 1 } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async receiveAudioResults(req: Request, res: Response): Promise<void> {
    try {
      const payload = parseAudioResults(req.body);
      if (!payload) {
        res.status(400).json({ success: false, error: 'Audio harus berisi tepat lima hasil per detik yang valid' });
        return;
      }
      const device = await deviceService.getDeviceByMac(payload.macAddress);
      if (!device?.baby_id) {
        res.status(404).json({ success: false, error: 'Perangkat belum dipair ke bayi' });
        return;
      }
      await inferenceService.saveAudioResults(device, payload.results);
      const finalized = await inferenceService.finalizeMatches(device, payload.results.map((item) => item.captureId));
      emitFinalized(finalized);
      await emitCryingAlerts(device, finalized);
      res.json({ success: true, data: { finalized: finalized.length } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
