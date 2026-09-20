import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { env } from "./config/env";
import routes from "./routes";
import { initSocket } from "./socket/socket.handler";
import { errorMiddleware } from "./middleware/error.middleware";
import { deviceService } from "./services/device.service";
import { alertService } from "./services/alert.service";
import { broadcastAlert, broadcastBabyStatus } from "./socket/socket.handler";

const app = express();
const httpServer = createServer(app);

// Socket.io
const io = new Server(httpServer, {
  cors: {
    origin: env.ALLOWED_ORIGINS,
    methods: ["GET", "POST"],
  },
});

initSocket(io);

// Middleware
app.use(helmet());
app.use(cors({ origin: env.ALLOWED_ORIGINS }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan("dev"));

// Attach io ke app supaya bisa diakses di controller nanti
app.set("io", io);

// Routes
app.use("/api", routes);

// Health check
app.get("/health", (req, res) => {
  res.json({ success: true, message: "Smart Vision API is running" });
});

// Error handler
app.use(errorMiddleware);

// Start server
const PORT = parseInt(env.PORT);
httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`Smart Vision API listening on http://0.0.0.0:${PORT}`);
  console.log(`Environment: ${env.NODE_ENV}`);
});

// Device online state is derived from the latest heartbeat.  This keeps the
// dashboard truthful even when a device loses power or Wi-Fi unexpectedly.
setInterval(() => {
  void (async () => {
    const offlineDevices = await deviceService.markStaleDevicesOffline(env.DEVICE_OFFLINE_AFTER_SEC);
    for (const device of offlineDevices) {
      if (!device.baby_id) continue;
      const timestamp = new Date().toISOString();
      broadcastBabyStatus(io, {
        babyId: device.baby_id,
        unitId: device.unit_id,
        deviceOnline: false,
        lastUpdated: timestamp,
      });
      const alert = await alertService.createAlert({
        babyId: device.baby_id,
        type: "DEVICE_OFFLINE",
        message: `Perangkat Smart Vision tidak mengirim heartbeat selama ${env.DEVICE_OFFLINE_AFTER_SEC} detik`,
        severity: "warning",
      });
      if (alert) {
        broadcastAlert(io, {
          id: alert.id,
          babyId: device.baby_id,
          unitId: device.unit_id,
          type: alert.type,
          message: alert.message,
          severity: alert.severity,
          timestamp: alert.created_at,
          acknowledged: false,
        });
      }
    }
  })();
}, 15_000);

export { io };
