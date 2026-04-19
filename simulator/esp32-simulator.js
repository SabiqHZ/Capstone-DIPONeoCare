const mqtt = require('mqtt');

// ── Konfigurasi ───────────────────────────────────────────────────
const MAC_ADDRESS = 'AA:BB:CC:DD:EE:FF'; // harus sama dengan yang di Supabase
const BROKER_URL = 'mqtt://localhost:1883';

const client = mqtt.connect(BROKER_URL, {
  clientId: `esp32-simulator-${Date.now()}`,
  reconnectPeriod: 3000,
});

// ── State simulasi ────────────────────────────────────────────────
let state = {
  position: 'supine',
  confidence: 0.94,
  temperature: 36.8,
  isCrying: false,
  cryingDuration: 0,
  nightVision: false,
  tick: 0,
};

// ── Helper publish ────────────────────────────────────────────────
function publish(topic, payload) {
  const fullTopic = `sv/${MAC_ADDRESS}/${topic}`;
  const message = JSON.stringify({
    ...payload,
    macAddress: MAC_ADDRESS,
    deviceId: `device-${MAC_ADDRESS}`,
    timestamp: new Date().toISOString(),
  });
  client.publish(fullTopic, message, { qos: 1 });
  console.log(`[PUB] ${fullTopic}:`, JSON.parse(message));
}

// ── Register device saat pertama connect ──────────────────────────
function registerDevice() {
  const topic = 'sv/device/register';
  const payload = JSON.stringify({
    macAddress: MAC_ADDRESS,
    firmwareVersion: '1.0.0-sim',
    timestamp: new Date().toISOString(),
  });
  client.publish(topic, payload, { qos: 1 });
  console.log('[SIM] Device registered:', MAC_ADDRESS);
}

// ── Simulasi skenario berbeda ─────────────────────────────────────
const scenarios = [
  // Skenario 1: Normal — terlentang, suhu normal
  () => {
    state.position = 'supine';
    state.confidence = 0.94 + (Math.random() * 0.04);
    state.temperature = 36.5 + (Math.random() * 0.8);
    state.isCrying = false;
    state.cryingDuration = 0;
    state.nightVision = false;
    console.log('\n[SIM] === Skenario: NORMAL ===');
  },
  // Skenario 2: BAHAYA — telungkup
  () => {
    state.position = 'prone';
    state.confidence = 0.91;
    state.temperature = 36.9;
    state.isCrying = true;
    state.cryingDuration = 15;
    state.nightVision = false;
    console.log('\n[SIM] === Skenario: BAHAYA - TELUNGKUP ===');
  },
  // Skenario 3: Suhu tinggi
  () => {
    state.position = 'supine';
    state.confidence = 0.88;
    state.temperature = 38.2;
    state.isCrying = false;
    state.cryingDuration = 0;
    state.nightVision = false;
    console.log('\n[SIM] === Skenario: SUHU TINGGI ===');
  },
  // Skenario 4: Miring + malam hari
  () => {
    state.position = 'lateral';
    state.confidence = 0.87;
    state.temperature = 36.6;
    state.isCrying = false;
    state.cryingDuration = 0;
    state.nightVision = true;
    console.log('\n[SIM] === Skenario: MIRING + NIGHT VISION ===');
  },
  // Skenario 5: Menangis lama
  () => {
    state.position = 'supine';
    state.confidence = 0.92;
    state.temperature = 36.7;
    state.isCrying = true;
    state.cryingDuration = 25;
    state.nightVision = false;
    console.log('\n[SIM] === Skenario: MENANGIS ===');
  },
];

let scenarioIndex = 0;

// ── Loop utama simulasi ───────────────────────────────────────────
function runSimulation() {
  state.tick++;

  // Ganti skenario setiap 5 tick (50 detik)
  if (state.tick % 5 === 1) {
    scenarios[scenarioIndex % scenarios.length]();
    scenarioIndex++;
  }

  // 1. Kirim heartbeat setiap tick
  publish('heartbeat', {});

  // 2. Kirim data posisi tidur setiap tick
  publish('sleep', {
    position: state.position,
    confidence: parseFloat(state.confidence.toFixed(3)),
    nightVision: state.nightVision,
  });

  // 3. Kirim suhu setiap 2 tick
  if (state.tick % 2 === 0) {
    // Tambah sedikit noise pada suhu
    const tempWithNoise = state.temperature + (Math.random() * 0.2 - 0.1);
    publish('temperature', {
      temperature: parseFloat(tempWithNoise.toFixed(1)),
    });
  }

  // 4. Kirim status tangisan setiap tick
  publish('crying', {
    isCrying: state.isCrying,
    durationSec: state.cryingDuration,
  });
}

// ── MQTT events ───────────────────────────────────────────────────
client.on('connect', () => {
  console.log('[SIM] Connected to MQTT broker');
  console.log('[SIM] MAC Address:', MAC_ADDRESS);
  console.log('[SIM] Mulai simulasi dalam 2 detik...\n');

  // Register device
  setTimeout(() => {
    registerDevice();

    // Mulai simulasi tiap 10 detik
    console.log('[SIM] Simulasi berjalan — interval 10 detik');
    runSimulation(); // langsung jalankan sekali
    setInterval(runSimulation, 10_000);
  }, 2000);
});

client.on('error', (err) => {
  console.error('[SIM] MQTT Error:', err.message);
});

client.on('disconnect', () => {
  console.log('[SIM] Disconnected from broker');
});

// ── Kontrol manual via keyboard ───────────────────────────────────
const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

console.log('\n=== ESP32 Simulator Smart Vision ===');
console.log('Perintah manual:');
console.log('  1 = Kirim posisi TERLENTANG (normal)');
console.log('  2 = Kirim posisi TELUNGKUP (bahaya)');
console.log('  3 = Kirim posisi MIRING');
console.log('  4 = Kirim SUHU TINGGI (38.5°C)');
console.log('  5 = Kirim SUHU RENDAH (35.5°C)');
console.log('  6 = Toggle TANGISAN on/off');
console.log('  7 = Toggle NIGHT VISION on/off');
console.log('  h = Kirim HEARTBEAT manual');
console.log('  q = Keluar\n');

rl.on('line', (input) => {
  const cmd = input.trim();
  switch (cmd) {
    case '1':
      state.position = 'supine';
      state.confidence = 0.95;
      state.isCrying = false;
      publish('sleep', { position: 'supine', confidence: 0.95, nightVision: state.nightVision });
      console.log('[MANUAL] Posisi: Terlentang');
      break;
    case '2':
      state.position = 'prone';
      state.confidence = 0.91;
      publish('sleep', { position: 'prone', confidence: 0.91, nightVision: state.nightVision });
      console.log('[MANUAL] Posisi: TELUNGKUP - Alert akan terpicu!');
      break;
    case '3':
      state.position = 'lateral';
      state.confidence = 0.88;
      publish('sleep', { position: 'lateral', confidence: 0.88, nightVision: state.nightVision });
      console.log('[MANUAL] Posisi: Miring');
      break;
    case '4':
      state.temperature = 38.5;
      publish('temperature', { temperature: 38.5 });
      console.log('[MANUAL] Suhu tinggi: 38.5°C - Alert akan terpicu!');
      break;
    case '5':
      state.temperature = 35.5;
      publish('temperature', { temperature: 35.5 });
      console.log('[MANUAL] Suhu rendah: 35.5°C - Alert akan terpicu!');
      break;
    case '6':
      state.isCrying = !state.isCrying;
      state.cryingDuration = state.isCrying ? 15 : 0;
      publish('crying', { isCrying: state.isCrying, durationSec: state.cryingDuration });
      console.log(`[MANUAL] Tangisan: ${state.isCrying ? 'ON (15 detik)' : 'OFF'}`);
      break;
    case '7':
      state.nightVision = !state.nightVision;
      publish('sleep', { position: state.position, confidence: state.confidence, nightVision: state.nightVision });
      console.log(`[MANUAL] Night Vision: ${state.nightVision ? 'ON' : 'OFF'}`);
      break;
    case 'h':
      publish('heartbeat', {});
      console.log('[MANUAL] Heartbeat dikirim');
      break;
    case 'q':
      console.log('[SIM] Keluar...');
      client.end();
      process.exit(0);
    default:
      console.log('[SIM] Perintah tidak dikenal:', cmd);
  }
});