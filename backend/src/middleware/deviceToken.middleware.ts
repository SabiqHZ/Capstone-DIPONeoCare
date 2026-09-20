import { NextFunction, Request, Response } from 'express';
import { deviceService } from '../services/device.service';

export async function deviceTokenMiddleware(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const macAddress = String(req.body?.macAddress ?? req.headers['x-device-mac'] ?? '');
    const token = String(req.headers['x-device-token'] ?? '');
    if (!macAddress || !token || !(await deviceService.verifyDeviceToken(macAddress, token))) {
      res.status(401).json({ success: false, error: 'Device token tidak valid atau tidak ditemukan' });
      return;
    }
    next();
  } catch (error) {
    next(error);
  }
}
