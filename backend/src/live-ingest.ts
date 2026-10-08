import { IncomingMessage } from "http";
import { Server as HttpServer } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { deviceService } from "./services/device.service";
import { deviceStreamService } from "./services/device-stream.service";

type LiveIngestDependencies = {
  verifyDeviceToken: (macAddress: string, token: string) => Promise<boolean>;
  getDevice: (deviceId: string) => Promise<{
    id: string;
    mac_address: string;
    baby_id: string | null;
    device_token_hash?: string;
  } | null>;
};

const DEFAULT_HEARTBEAT_MS = 30_000;

function getRequestDeviceId(request: IncomingMessage): string | null {
  const match = request.url?.match(
    /^\/api\/devices\/([^/]+)\/live\/ingest(?:\?|$)/,
  );
  return match?.[1] ?? null;
}

function rejectUpgrade(
  socket: import("stream").Duplex,
  code: number,
  message: string,
): void {
  socket.write(`HTTP/1.1 ${code} ${message}\r\nConnection: close\r\n\r\n`);
  socket.destroy();
}

export function createLiveIngestServer(
  httpServer: HttpServer,
  dependencies: LiveIngestDependencies = {
    verifyDeviceToken: deviceService.verifyDeviceToken,
    getDevice: deviceService.getDeviceById,
  },
): WebSocketServer {
  const wss = new WebSocketServer({
    noServer: true,
    perMessageDeflate: false,
    skipUTF8Validation: false,
    clientTracking: true,
  });

  httpServer.on("upgrade", (request, socket, head) => {
    const deviceId = getRequestDeviceId(request);
    const macAddress = request.headers["x-device-mac"];
    const token = request.headers["x-device-token"];

    if (!deviceId || !macAddress || !token) {
      console.warn(
        "[LIVE-INGEST] Rejected upgrade: missing connection metadata",
      );
      socket.write("HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n");
      socket.destroy();
      return;
    }

    const mac = Array.isArray(macAddress) ? macAddress[0] : macAddress;
    const deviceToken = Array.isArray(token) ? token[0] : token;

    void (async () => {
      try {
        const device = await dependencies.getDevice(deviceId);
        if (!device) {
          console.warn("[LIVE-INGEST] Rejected: unknown device", { deviceId });
          rejectUpgrade(socket, 404, "Unknown device");
          return;
        }

        if (!device.baby_id) {
          console.warn("[LIVE-INGEST] Rejected: unpaired device", { deviceId });
          socket.write("HTTP/1.1 409 Conflict\r\nConnection: close\r\n\r\n");
          socket.destroy();
          return;
        }

        if (device.mac_address !== mac) {
          console.warn("[LIVE-INGEST] Rejected: mac address mismatch", {
            deviceId,
            expectedMac: device.mac_address,
          });
          rejectUpgrade(socket, 401, "Device authentication failed");
          return;
        }

        const authenticated = await dependencies.verifyDeviceToken(
          mac,
          deviceToken,
        );
        if (!authenticated) {
          console.warn("[LIVE-INGEST] Rejected: invalid device token", {
            deviceId,
          });
          socket.write(
            "HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n",
          );
          socket.destroy();
          return;
        }

        wss.handleUpgrade(request, socket, head, (ws) => {
          const deviceConnection = {
            id: device.id,
            macAddress: device.mac_address,
            babyId: device.baby_id,
            connectedAt: Date.now(),
            frameCount: 0,
            byteCount: 0,
            lastFrameAt: Date.now(),
          };

          ws.on("error", (error) => {
            console.error("[LIVE-INGEST] WebSocket error:", {
              deviceId: deviceConnection.id,
              error: error.message,
            });
          });

          ws.on("open", () => {
            console.log("[LIVE-INGEST] Device connected:", deviceId);
          });

          ws.on("unexpected-response", (_request, response) => {
            console.warn("[LIVE-INGEST] Unexpected upgrade response:", {
              deviceId,
              status: response.statusCode,
            });
          });

          ws.on("message", (data, isBinary) => {
            if (!isBinary) {
              console.warn("[LIVE-INGEST] Ignored text frame:", { deviceId });
              return;
            }

            const frame = Buffer.isBuffer(data)
              ? data
              : Buffer.from(data as ArrayBufferLike);

            deviceStreamService.publishLiveFrame(deviceConnection.id, frame);
            deviceConnection.frameCount += 1;
            deviceConnection.byteCount += frame.length;
            deviceConnection.lastFrameAt = Date.now();

            console.log(
              "[LIVE-INGEST] Frame #" +
                deviceConnection.frameCount +
                ": " +
                frame.length +
                " bytes",
            );
          });

          ws.on("ping", () => ws.pong());
          ws.on("pong", () => undefined);
          ws.on("close", (code, reason) => {
            const elapsedMs = Date.now() - deviceConnection.connectedAt;
            const elapsedSeconds = Math.max(elapsedMs / 1000, 0.001);
            const fps = deviceConnection.frameCount / elapsedSeconds;

            console.log("[LIVE-INGEST] Device disconnected:", {
              deviceId,
              frameCount: deviceConnection.frameCount,
              totalBytes: deviceConnection.byteCount,
              fps: Number(fps.toFixed(2)),
              closeCode: code,
              closeReason: reason.toString(),
            });
          });

          console.log("[LIVE-INGEST] Authenticated:", deviceId);
          ws.send("ready");
          deviceConnection.frameCount = 0;
          deviceConnection.byteCount = 0;
          const heartbeat = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.ping();
            } else {
              clearInterval(heartbeat);
            }
          }, DEFAULT_HEARTBEAT_MS);

          ws.on("close", () => clearInterval(heartbeat));
        });
      } catch (error) {
        console.error("[LIVE-INGEST] Authentication failed:", {
          deviceId,
          error: error instanceof Error ? error.message : String(error),
        });
        socket.write(
          "HTTP/1.1 500 Internal Server Error\r\nConnection: close\r\n\r\n",
        );
        socket.destroy();
      }
    })();
  });

  return wss;
}
