import { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { AuthRequest, JwtPayload } from "../types";
import { env } from "../config/env";
import { aiDispatchService } from "../services/ai-dispatch.service";
import { deviceService } from "../services/device.service";
import { deviceStreamService } from "../services/device-stream.service";
import { broadcastBabyStatus } from "../socket/socket.handler";
import { io } from "../app";

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function canAccessDevice(
  user: JwtPayload | undefined,
  device: { baby_id: string | null; unit_id: string | null },
): boolean {
  if (user?.role === "parent") return device.baby_id === user.babyId;
  if (user?.role === "nurse") return device.unit_id === user.unitId;
  return false;
}

export const deviceController = {
  async register(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, localIp, firmwareVersion, name } = req.body;

      if (typeof macAddress !== "string" || !macAddress.trim()) {
        res.status(400).json({
          success: false,
          error: "macAddress wajib diisi",
        });
        return;
      }

      if (
        localIp !== undefined &&
        localIp !== null &&
        typeof localIp !== "string"
      ) {
        res.status(400).json({
          success: false,
          error: "localIp harus berupa string",
        });
        return;
      }

      if (
        firmwareVersion !== undefined &&
        firmwareVersion !== null &&
        typeof firmwareVersion !== "string"
      ) {
        res.status(400).json({
          success: false,
          error: "firmwareVersion harus berupa string",
        });
        return;
      }

      if (name !== undefined && name !== null && typeof name !== "string") {
        res.status(400).json({
          success: false,
          error: "name harus berupa string",
        });
        return;
      }

      const { device, deviceToken } = await deviceService.registerOrGetDevice({
        macAddress: macAddress.trim(),
        localIp: typeof localIp === "string" ? localIp.trim() : undefined,
        firmwareVersion:
          typeof firmwareVersion === "string"
            ? firmwareVersion.trim()
            : undefined,
        name: typeof name === "string" ? name.trim() : undefined,
      });

      res.status(201).json({
        success: true,
        data: {
          deviceId: device.id,
          deviceToken,
          paired: Boolean(device.baby_id),
        },
      });
    } catch (err: any) {
      console.error("[Device Register] failed:", err);

      res.status(500).json({
        success: false,
        error: err.message,
      });
    }
  },

  async heartbeat(req: Request, res: Response): Promise<void> {
    try {
      const device = await deviceService.updateHeartbeat(
        req.body.macAddress,
        req.body.localIp,
      );
      if (!device) {
        res
          .status(404)
          .json({ success: false, error: "Perangkat tidak ditemukan" });
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
      res.json({
        success: true,
        data: { deviceId: device.id, paired: Boolean(device.baby_id) },
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async uploadFrame(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, captureId, timestamp } = req.body;
      if (
        !req.file ||
        !macAddress ||
        !captureId ||
        !isIsoTimestamp(timestamp)
      ) {
        res.status(400).json({
          success: false,
          error: "image, macAddress, captureId, dan timestamp ISO wajib diisi",
        });
        return;
      }
      const device = await deviceService.getDeviceByMac(macAddress);
      if (!device?.baby_id) {
        res
          .status(409)
          .json({ success: false, error: "Perangkat belum dipair ke bayi" });
        return;
      }

      deviceStreamService.publishFrame(device.id, req.file.buffer);

      // The device gets an acknowledgement immediately; inference happens independently.
      void aiDispatchService
        .dispatch("vision", {
          macAddress,
          captureId,
          timestamp,
          file: req.file,
        })
        .catch((error) =>
          console.error("[AI] vision dispatch failed:", error.message),
        );
      res
        .status(202)
        .json({ success: true, data: { accepted: true, captureId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async uploadAudio(req: Request, res: Response): Promise<void> {
    try {
      const { macAddress, audioWindowId, startedAt, durationSeconds } =
        req.body;
      let captureIds: unknown;
      try {
        captureIds =
          typeof req.body.captureIds === "string"
            ? JSON.parse(req.body.captureIds)
            : req.body.captureIds;
      } catch {
        captureIds = null;
      }
      const duration = Number(durationSeconds);
      if (
        !req.file ||
        !macAddress ||
        !audioWindowId ||
        !isIsoTimestamp(startedAt) ||
        duration !== 5 ||
        !Array.isArray(captureIds) ||
        captureIds.length !== 5 ||
        captureIds.some((id) => typeof id !== "string" || !id)
      ) {
        res.status(400).json({
          success: false,
          error:
            "audio, macAddress, audioWindowId, startedAt, durationSeconds=5, dan lima captureIds wajib valid",
        });
        return;
      }
      const device = await deviceService.getDeviceByMac(macAddress);
      if (!device?.baby_id) {
        res
          .status(409)
          .json({ success: false, error: "Perangkat belum dipair ke bayi" });
        return;
      }

      void aiDispatchService
        .dispatch("audio", {
          macAddress,
          audioWindowId,
          startedAt,
          durationSeconds: duration,
          captureIds: captureIds as string[],
          file: req.file,
        })
        .catch((error) =>
          console.error("[AI] audio dispatch failed:", error.message),
        );
      res
        .status(202)
        .json({ success: true, data: { accepted: true, audioWindowId } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },

  async available(req: AuthRequest, res: Response): Promise<void> {
    try {
      if (!req.user?.unitId) {
        res
          .status(400)
          .json({ success: false, error: "Unit pengasuh tidak ditemukan" });
        return;
      }
      res.json({
        success: true,
        data: await deviceService.getAvailableDevices(req.user.unitId),
      });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async createStreamTicket(req: AuthRequest, res: Response): Promise<void> {
    try {
      const deviceId = req.params.id as string;
      const device = await deviceService.getDeviceStreamAccessById(deviceId);
      if (!device) {
        res.status(404).json({
          success: false,
          error: "Perangkat tidak ditemukan",
        });
        return;
      }
      if (!canAccessDevice(req.user, device)) {
        res.status(403).json({ success: false, error: "Akses ditolak" });
        return;
      }

      const ticket = jwt.sign(
        { sub: req.user!.sub, role: req.user!.role, streamDeviceId: deviceId },
        env.JWT_SECRET,
        { expiresIn: "1h" },
      );
      res.json({ success: true, data: { ticket } });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
  async stream(req: Request, res: Response): Promise<void> {
    const deviceId = req.params.id as string;
    const ticket = req.query.ticket;
    if (typeof ticket !== "string") {
      res
        .status(401)
        .json({ success: false, error: "Tiket stream wajib diisi" });
      return;
    }

    let user: JwtPayload;
    try {
      user = jwt.verify(ticket, env.JWT_SECRET) as JwtPayload;
    } catch {
      res
        .status(401)
        .json({ success: false, error: "Tiket stream tidak valid" });
      return;
    }
    if (user.streamDeviceId !== deviceId) {
      res.status(403).json({ success: false, error: "Akses ditolak" });
      return;
    }

    try {
      const device = await deviceService.getDeviceStreamAccessById(deviceId);
      if (!device) {
        res
          .status(404)
          .json({ success: false, error: "Perangkat tidak ditemukan" });
        return;
      }
      if (!canAccessDevice(user, device)) {
        res.status(403).json({ success: false, error: "Akses ditolak" });
        return;
      }

      res.writeHead(200, {
        "Content-Type": "multipart/x-mixed-replace; boundary=frame",
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
        "X-Accel-Buffering": "no",
      });

      const writeFrame = (frame: Buffer) => {
        if (res.destroyed) return;
        res.write(
          `--frame\r\nContent-Type: image/jpeg\r\nContent-Length: ${frame.length}\r\n\r\n`,
        );
        res.write(frame);
        res.write("\r\n");
      };
      const unsubscribe = deviceStreamService.subscribe(deviceId, writeFrame);
      const latestFrame = deviceStreamService.getLatestFrame(deviceId);
      if (latestFrame) writeFrame(latestFrame);

      res.on("close", unsubscribe);
    } catch (err: any) {
      if (!res.headersSent) {
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.end();
      }
    }
  },
  async getConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const data = await deviceService.getDeviceConfigById(
        req.params.id as string,
      );

      res.json({
        success: true,
        data,
      });
    } catch (err: any) {
      const status = err.message === "Perangkat tidak ditemukan" ? 404 : 500;

      res.status(status).json({
        success: false,
        error: err.message,
      });
    }
  },
  async updateConfig(req: AuthRequest, res: Response): Promise<void> {
    try {
      const cryingMinDurationSec = req.body.cryingMinDurationSec;
      const notificationCooldownSec = req.body.notificationCooldownSec;
      if (
        (cryingMinDurationSec !== undefined &&
          (!Number.isInteger(cryingMinDurationSec) ||
            cryingMinDurationSec < 5 ||
            cryingMinDurationSec > 60)) ||
        (notificationCooldownSec !== undefined &&
          (!Number.isInteger(notificationCooldownSec) ||
            notificationCooldownSec < 30 ||
            notificationCooldownSec > 300))
      ) {
        res.status(400).json({
          success: false,
          error: "Nilai konfigurasi perangkat tidak valid",
        });
        return;
      }
      const data = await deviceService.updateConfig(req.params.id as string, {
        cryingMinDurationSec,
        notificationCooldownSec,
      });
      res.json({ success: true, data });
    } catch (err: any) {
      res.status(500).json({ success: false, error: err.message });
    }
  },
};
