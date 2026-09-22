const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const readline = require('readline');

const BACKEND_URL = (process.env.BACKEND_URL || 'http://localhost:3000').replace(/\/$/, '');
const MAC_ADDRESS = process.env.MAC_ADDRESS || 'AA:BB:CC:DD:EE:FF';
const DEVICE_NAME = process.env.DEVICE_NAME || 'Simulator Bed A-01';
const FIRMWARE_VERSION = process.env.FIRMWARE_VERSION || '1.0.0-sim';
const SIM_IMAGE_PATH = process.env.SIM_IMAGE_PATH || '';
const SIM_AUDIO_PATH = process.env.SIM_AUDIO_PATH || '';

const STATE_FILE = path.join(__dirname, '.device-state.json');
const SAMPLE_DIR = path.join(__dirname, '.samples');
const FALLBACK_IMAGE = path.join(SAMPLE_DIR, 'fallback.jpg');
const FALLBACK_AUDIO = path.join(SAMPLE_DIR, 'fallback-5s.wav');

const FRAME_INTERVAL_MS = 1_000;
const AUDIO_INTERVAL_MS = 5_000;
const HEARTBEAT_INTERVAL_MS = 30_000;
const AUDIO_FRAME_COUNT = 5;

let state = loadState();
let frameTimer = null;
let audioTimer = null;
let heartbeatTimer = null;
let running = false;
let frameSequence = 0;
const recentFrames = [];

function nowIso() {
  return new Date().toISOString();
}

function detectLocalIp() {
  const interfaces = os.networkInterfaces();
  for (const entries of Object.values(interfaces)) {
    for (const info of entries || []) {
      if (info.family === 'IPv4' && !info.internal) return info.address;
    }
  }
  return '127.0.0.1';
}

function loadState() {
  try {
    const raw = fs.readFileSync(STATE_FILE, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed.macAddress && parsed.deviceToken) return parsed;
  } catch (_) {
    // First run or invalid state: register on demand.
  }
  return { macAddress: MAC_ADDRESS, deviceId: null, deviceToken: null };
}

function saveState() {
  fs.writeFileSync(STATE_FILE, JSON.stringify({
    macAddress: MAC_ADDRESS,
    deviceId: state.deviceId || null,
    deviceToken: state.deviceToken || null,
    savedAt: nowIso(),
  }, null, 2));
}

function ensureSampleFiles() {
  fs.mkdirSync(SAMPLE_DIR, { recursive: true });

  if (!fs.existsSync(FALLBACK_IMAGE)) {
    // Valid 1x1 JPEG. Only for HTTP/multipart smoke testing; not meaningful AI input.
    const jpegBase64 =
      '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAX/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAH/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAEFAqf/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/AT//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/AT//2gAMAwEAAgADAAAAEP/EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQMBAT8QH//EABQRAQAAAAAAAAAAAAAAAAAAABD/2gAIAQIBAT8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEABj8QH//EABQQAQAAAAAAAAAAAAAAAAAAABD/2gAIAQEAAT8QH//Z';
    fs.writeFileSync(FALLBACK_IMAGE, Buffer.from(jpegBase64, 'base64'));
  }

  if (!fs.existsSync(FALLBACK_AUDIO)) {
    createSilentWav(FALLBACK_AUDIO, 5);
  }
}

function createSilentWav(filePath, durationSeconds) {
  const sampleRate = 16_000;
  const channels = 1;
  const bitsPerSample = 16;
  const bytesPerSample = bitsPerSample / 8;
  const dataSize = sampleRate * durationSeconds * channels * bytesPerSample;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16); // PCM chunk size
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(channels, 22);
  buffer.writeUInt32LE(sampleRate, 24);
  buffer.writeUInt32LE(sampleRate * channels * bytesPerSample, 28);
  buffer.writeUInt16LE(channels * bytesPerSample, 32);
  buffer.writeUInt16LE(bitsPerSample, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);
  // Buffer is already zero-filled => silence.

  fs.writeFileSync(filePath, buffer);
}

function jsonHeaders() {
  return { 'content-type': 'application/json' };
}

function deviceHeaders() {
  return {
    'x-device-token': state.deviceToken || '',
    'x-device-mac': MAC_ADDRESS,
  };
}

async function requestJson(endpoint, options = {}) {
  const response = await fetch(`${BACKEND_URL}${endpoint}`, {
    ...options,
    headers: {
      ...jsonHeaders(),
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch (_) {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  return body;
}

async function registerDevice() {
  console.log('[SIM] Registering device...');

  const body = {
    macAddress: MAC_ADDRESS,
    localIp: detectLocalIp(),
    firmwareVersion: FIRMWARE_VERSION,
    name: DEVICE_NAME,
  };

  const result = await requestJson('/api/devices/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });

  const data = result?.data;
  if (!data?.deviceId || !data?.deviceToken) {
    throw new Error(`Register response tidak sesuai contract: ${JSON.stringify(result)}`);
  }

  state = {
    macAddress: MAC_ADDRESS,
    deviceId: data.deviceId,
    deviceToken: data.deviceToken,
  };
  saveState();

  console.log('[SIM] Register OK');
  console.log(`      deviceId : ${data.deviceId}`);
  console.log(`      paired   : ${data.paired}`);
  console.log('      token    : disimpan ke .device-state.json');

  return data;
}

async function ensureRegistered() {
  if (state.deviceId && state.deviceToken) return;
  await registerDevice();
}

async function sendHeartbeat() {
  await ensureRegistered();

  const body = {
    macAddress: MAC_ADDRESS,
    localIp: detectLocalIp(),
  };

  const result = await requestJson('/api/devices/heartbeat', {
    method: 'POST',
    headers: deviceHeaders(),
    body: JSON.stringify(body),
  });

  console.log(`[HEARTBEAT] ${nowIso()} paired=${result?.data?.paired}`);
  return result;
}

function nextCaptureId() {
  frameSequence += 1;
  return `capture-${String(frameSequence).padStart(6, '0')}`;
}

function resolveImagePath() {
  if (SIM_IMAGE_PATH) {
    return path.resolve(SIM_IMAGE_PATH);
  }
  ensureSampleFiles();
  return FALLBACK_IMAGE;
}

function resolveAudioPath() {
  if (SIM_AUDIO_PATH) {
    return path.resolve(SIM_AUDIO_PATH);
  }
  ensureSampleFiles();
  return FALLBACK_AUDIO;
}

async function uploadFrame() {
  await ensureRegistered();

  const filePath = resolveImagePath();
  if (!fs.existsSync(filePath)) throw new Error(`SIM_IMAGE_PATH tidak ditemukan: ${filePath}`);

  const captureId = nextCaptureId();
  const timestamp = nowIso();
  const buffer = fs.readFileSync(filePath);

  const form = new FormData();
  form.append('image', new Blob([buffer], { type: 'image/jpeg' }), path.basename(filePath));
  form.append('macAddress', MAC_ADDRESS);
  form.append('captureId', captureId);
  form.append('timestamp', timestamp);

  const response = await fetch(`${BACKEND_URL}/api/devices/upload/frame`, {
    method: 'POST',
    headers: deviceHeaders(),
    body: form,
  });

  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  recentFrames.push({ captureId, timestamp });
  while (recentFrames.length > AUDIO_FRAME_COUNT) recentFrames.shift();

  console.log(`[FRAME] ${captureId} ${response.status} accepted=${body?.data?.accepted}`);
  return { captureId, timestamp, body };
}

async function uploadAudio() {
  await ensureRegistered();

  if (recentFrames.length < AUDIO_FRAME_COUNT) {
    console.log(`[AUDIO] skipped: baru ada ${recentFrames.length}/${AUDIO_FRAME_COUNT} frame`);
    return;
  }

  const filePath = resolveAudioPath();
  if (!fs.existsSync(filePath)) throw new Error(`SIM_AUDIO_PATH tidak ditemukan: ${filePath}`);

  const windowFrames = recentFrames.slice(-AUDIO_FRAME_COUNT);
  const audioWindowId = `audio-${crypto.randomUUID()}`;
  const startedAt = windowFrames[0].timestamp;
  const captureIds = windowFrames.map((frame) => frame.captureId);
  const buffer = fs.readFileSync(filePath);

  const form = new FormData();
  form.append('audio', new Blob([buffer], { type: 'audio/wav' }), path.basename(filePath));
  form.append('macAddress', MAC_ADDRESS);
  form.append('audioWindowId', audioWindowId);
  form.append('startedAt', startedAt);
  form.append('durationSeconds', '5');
  form.append('captureIds', JSON.stringify(captureIds));

  const response = await fetch(`${BACKEND_URL}/api/devices/upload/audio`, {
    method: 'POST',
    headers: deviceHeaders(),
    body: form,
  });

  const text = await response.text();
  let body;
  try { body = text ? JSON.parse(text) : null; } catch (_) { body = text; }

  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${typeof body === 'string' ? body : JSON.stringify(body)}`);
  }

  console.log(`[AUDIO] ${audioWindowId} ${response.status} captureIds=${captureIds.join(',')}`);
  return { audioWindowId, captureIds, body };
}

function startSimulation() {
  if (running) {
    console.log('[SIM] Simulation sudah berjalan.');
    return;
  }

  running = true;
  console.log('[SIM] Starting: frame=1s, audio=5s, heartbeat=30s');

  void sendHeartbeat().catch((err) => console.error('[HEARTBEAT]', err.message));
  void uploadFrame().catch((err) => console.error('[FRAME]', err.message));

  frameTimer = setInterval(() => {
    void uploadFrame().catch((err) => console.error('[FRAME]', err.message));
  }, FRAME_INTERVAL_MS);

  audioTimer = setInterval(() => {
    void uploadAudio().catch((err) => console.error('[AUDIO]', err.message));
  }, AUDIO_INTERVAL_MS);

  heartbeatTimer = setInterval(() => {
    void sendHeartbeat().catch((err) => console.error('[HEARTBEAT]', err.message));
  }, HEARTBEAT_INTERVAL_MS);
}

function stopSimulation() {
  if (!running) {
    console.log('[SIM] Simulation sudah berhenti.');
    return;
  }

  clearInterval(frameTimer);
  clearInterval(audioTimer);
  clearInterval(heartbeatTimer);
  frameTimer = null;
  audioTimer = null;
  heartbeatTimer = null;
  running = false;
  console.log('[SIM] Simulation stopped.');
}

async function manualRegister() {
  stopSimulation();
  try {
    await registerDevice();
  } catch (err) {
    console.error('[REGISTER]', err.message);
  }
}

async function manualHeartbeat() {
  try {
    await sendHeartbeat();
  } catch (err) {
    console.error('[HEARTBEAT]', err.message);
  }
}

function printHelp() {
  console.log(`\n=== ESP32 HTTP Simulator — DIPONeoCare ===
Backend : ${BACKEND_URL}
MAC     : ${MAC_ADDRESS}
Image   : ${SIM_IMAGE_PATH || '(fallback multipart sample)'}
Audio   : ${SIM_AUDIO_PATH || '(fallback 5s WAV silence)'}

Perintah:
  r = register / refresh device token
  s = start simulation
  p = stop simulation
  h = manual heartbeat
  q = quit
`);
}

async function main() {
  printHelp();

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.on('line', (input) => {
    const cmd = input.trim().toLowerCase();
    if (cmd === 'r') void manualRegister();
    else if (cmd === 's') startSimulation();
    else if (cmd === 'p') stopSimulation();
    else if (cmd === 'h') void manualHeartbeat();
    else if (cmd === 'q') {
      stopSimulation();
      rl.close();
      process.exit(0);
    } else printHelp();
  });
}

main().catch((err) => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
