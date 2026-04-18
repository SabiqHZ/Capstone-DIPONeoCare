import { Response } from 'express';
import { babyService } from '../services/baby.service';
import { AuthRequest, ApiResponse } from '../types';

export const babyController = {
  async getBabies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const unitId = req.user?.unitId;
      if (!unitId) {
        res.status(400).json({ success: false, error: 'Unit ID tidak ditemukan' });
        return;
      }
      const data = await babyService.getBabiesByUnit(unitId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },

  async getBabyById(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const data = await babyService.getBabyById(id as string);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(404).json(response);
    }
  },

  async registerBaby(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, bedNumber, dateOfBirth, parentName } = req.body;
      const unitId = req.user?.unitId;

      if (!name || !bedNumber || !dateOfBirth || !parentName || !unitId) {
        res.status(400).json({ success: false, error: 'Semua field wajib diisi' });
        return;
      }

      const data = await babyService.registerBaby({
        name,
        bedNumber,
        dateOfBirth,
        parentName,
        unitId,
      });

      const response: ApiResponse = { success: true, data };
      res.status(201).json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },

  async pairDevice(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { babyId, deviceId } = req.body;
      const data = await babyService.pairDevice(babyId, deviceId);
      const response: ApiResponse = { success: true, data };
      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = { success: false, error: err.message };
      res.status(500).json(response);
    }
  },
};