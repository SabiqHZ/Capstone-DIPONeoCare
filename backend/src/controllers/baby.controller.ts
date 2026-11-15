import { Response } from "express";
import { babyService } from "../services/baby.service";
import { AuthRequest, ApiResponse } from "../types";

export const babyController = {
  async getBabies(req: AuthRequest, res: Response): Promise<void> {
    try {
      const unitId = req.user?.unitId;
      if (!unitId) {
        res
          .status(400)
          .json({ success: false, error: "Unit ID tidak ditemukan" });
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
      const { name, bedNumber, dateOfBirth, parentName, deviceId } = req.body;
      const unitId = req.user?.unitId;

      if (!name || !bedNumber || !dateOfBirth || !parentName || !deviceId || !unitId) {
        res
          .status(400)
          .json({ success: false, error: "Semua field wajib diisi" });
        return;
      }

      const data = await babyService.registerBaby({
        name,
        bedNumber,
        dateOfBirth,
        parentName,
        deviceId,
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
  async updateBaby(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { name, bedNumber, dateOfBirth, parentName } = req.body;
      const unitId = req.user?.unitId;
      if (!unitId || ![name, bedNumber, dateOfBirth, parentName].every((value) => typeof value === "string" && value.trim())) {
        res.status(400).json({ success: false, error: "Data bayi wajib diisi" });
        return;
      }
      const data = await babyService.updateBaby(req.params.id as string, unitId, { name, bedNumber, dateOfBirth, parentName });
      res.json({ success: true, data });
    } catch (err: any) {
      const status = err.message.includes("tidak ditemukan") ? 404 : 500;
      res.status(status).json({ success: false, error: err.message });
    }
  },
  async dischargeBaby(req: AuthRequest, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const unitId = req.user?.unitId;

      if (!unitId) {
        res.status(400).json({
          success: false,
          error: "Unit ID tidak ditemukan",
        });
        return;
      }

      const data = await babyService.dischargeBaby(id as string, unitId);

      const response: ApiResponse = {
        success: true,
        data,
      };

      res.json(response);
    } catch (err: any) {
      let status = 500;

      if (err.message === "Bayi tidak ditemukan") {
        status = 404;
      } else if (err.message === "Bayi bukan bagian dari unit pengasuh") {
        status = 403;
      }

      const response: ApiResponse = {
        success: false,
        error: err.message,
      };

      res.status(status).json(response);
    }
  },
};
