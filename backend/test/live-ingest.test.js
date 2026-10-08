const test = require("node:test");
const assert = require("node:assert/strict");
const http = require("node:http");
const WebSocket = require("ws");
const { createLiveIngestServer } = require("../dist/live-ingest");
const {
  deviceStreamService,
} = require("../dist/services/device-stream.service");

function startServer({ isValidToken = true, device = null } = {}) {
  const server = http.createServer();
  createLiveIngestServer(server, {
    verifyDeviceToken: async (macAddress, token) => {
      if (macAddress !== "AA:BB:CC:DD:EE:FF") return false;
      if (token !== "secret-token") return false;
      return isValidToken;
    },
    getDevice: async (deviceId) => {
      if (deviceId !== "device-1") return null;
      return device;
    },
  });

  return new Promise((resolve) => {
    server.listen(0, "127.0.0.1", () => resolve(server));
  });
}

test("accepts a binary JPEG frame through the live ingest endpoint", async (t) => {
  const server = await startServer({
    device: {
      id: "device-1",
      mac_address: "AA:BB:CC:DD:EE:FF",
      baby_id: "baby-1",
    },
  });
  const address = server.address();
  const client = new WebSocket(
    `ws://127.0.0.1:${address.port}/api/devices/device-1/live/ingest`,
    {
      headers: {
        "x-device-mac": "AA:BB:CC:DD:EE:FF",
        "x-device-token": "secret-token",
      },
    },
  );

  t.after(() => new Promise((resolve) => server.close(resolve)));
  t.after(() => client.terminate());

  await new Promise((resolve, reject) => {
    client.once("open", resolve);
    client.once("error", reject);
  });

  const frame = Buffer.from("fake-jpeg-data");
  const received = new Promise((resolve, reject) => {
    const unsubscribe = deviceStreamService.subscribeLive(
      "device-1",
      (next) => {
        if (next.equals(frame)) {
          unsubscribe();
          resolve(next);
        }
      },
    );
    client.once("error", reject);
    client.send(frame);
  });

  const result = await received;
  assert.equal(result.toString("binary"), frame.toString("binary"));
  assert.equal(
    deviceStreamService.getLatestLiveFrame("device-1").equals(frame),
    true,
  );
  client.close();
});

test("rejects an invalid device token", async (t) => {
  const server = await startServer({
    isValidToken: false,
    device: {
      id: "device-1",
      mac_address: "AA:BB:CC:DD:EE:FF",
      baby_id: "baby-1",
    },
  });
  const address = server.address();
  const client = new WebSocket(
    `ws://127.0.0.1:${address.port}/api/devices/device-1/live/ingest`,
    {
      headers: {
        "x-device-mac": "AA:BB:CC:DD:EE:FF",
        "x-device-token": "wrong-token",
      },
    },
  );

  t.after(() => new Promise((resolve) => server.close(resolve)));

  await new Promise((resolve, reject) => {
    client.once("error", (error) => {
      assert.match(error.message, /401/);
      resolve();
    });
    client.once("open", () =>
      reject(new Error("Expected connection rejection")),
    );
    setTimeout(resolve, 200);
  });
  assert.equal(client.readyState, WebSocket.CLOSED);
});

test("upload frame processing does not publish the frame to the live stream", () => {
  const uploadSource = require("fs").readFileSync(
    "src/controllers/device.controller.ts",
    "utf8",
  );

  assert.ok(
    !uploadSource.includes("deviceStreamService.publishFrame"),
    "uploadFrame must not publish frames to the live stream",
  );
  assert.match(
    uploadSource,
    /aiDispatchService\s*\.\s*dispatch\(\s*["']vision["']/,
    "uploadFrame must dispatch the AI vision pipeline",
  );
});
