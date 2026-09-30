import { Response } from "express";
import { AuthRequest, ApiResponse } from "../types";
import { alertService } from "../services/alert.service";

export const alertController = {
  async getAll(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        res.status(401).json({
          success: false,
          error: "Unauthorized",
        });
        return;
      }

      const rawLimit = Number(req.query.limit ?? 50);

      const limit = Number.isFinite(rawLimit)
        ? Math.min(Math.max(Math.floor(rawLimit), 1), 50)
        : 50;

      const data = await alertService.getAlertsForUser(user, limit);

      const response: ApiResponse = {
        success: true,
        data,
      };

      res.json(response);
    } catch (err: any) {
      const response: ApiResponse = {
        success: false,
        error: err.message,
      };

      res.status(500).json(response);
    }
  },

  async acknowledge(req: AuthRequest, res: Response): Promise<void> {
    try {
      const user = req.user;

      if (!user) {
        const response: ApiResponse = {
          success: false,
          error: "Unauthorized",
        };

        res.status(401).json(response);
        return;
      }

      const alertId = req.params.id as string;

      if (!alertId) {
        const response: ApiResponse = {
          success: false,
          error: "Alert ID wajib diisi",
        };

        res.status(400).json(response);
        return;
      }

      const data = await alertService.acknowledgeAlert(alertId, user);

      const response: ApiResponse = {
        success: true,
        data,
      };

      res.json(response);
    } catch (err: any) {
      let status = 500;

      if (err.message === "Alert tidak ditemukan") {
        status = 404;
      } else if (err.message === "Akses alert ditolak") {
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
