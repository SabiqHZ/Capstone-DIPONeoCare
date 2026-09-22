const mqtt = require('mqtt');

const MAC_ADDRESS = 'AA:BB:CC:DD:EE:FF';
const BROKER_URL = 'mqtt://localhost:1883';

const client = mqtt.connect(BROKER_URL, {
  clientId: `esp32-simulator-${Date.now()}`,
  reconnectPeriod: 3000,
});

let state = {
  activity: 'sleeping',
  confidence: 0.94,
  temperature: 36.8,
  cryingDuration: 0,
  nightVision: false,
  tick: 0,
};

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

function registerDevice() {
  client.publish('sv/device/register', JSON.stringify({
    macAddress: MAC_ADDRESS,
    firmwareVersion: '1.0.0-sim',
    timestamp: new Date().toISOString(),
  }), { qos: 1 });
}

const scenarios = [
  () => {
    state.activity = 'sleeping';
    state.confidence = 0.94 + Math.random() * 0.04;
    state.temperature = 36.5 + Math.random() * 0.8;
    state.cryingDuration = 0;
    state.nightVision = false;
    console.log('\n[SIM] === Aktivitas: TIDUR ===');
  },
  () => {
    state.activity = 'awake';
    state.confidence = 0.91;
    state.temperature = 36.9;
    state.cryingDuration = 0;
    state.nightVision = false;
    console.log('\n[SIM] === Aktivitas: BANGUN ===');
  },
  () => {
    state.activity = 'crying';
    state.confidence = 0.92;
    state.temperature = 36.7;
    state.cryingDuration = 15;
    state.nightVision = false;
    console.log('\n[SIM] === Aktivitas: MENANGIS ===');
  },
  () => {
    state.activity = 'awake';
    state.confidence = 0.88;
    state.temperature = 38.2;
    state.cryingDuration = 0;
    state.nightVision = false;
    console.log('\n[SIM] === Aktivitas: BANGUN, SUHU TINGGI ===');
  },
  () => {
    state.activity = 'sleeping';
    state.confidence = 0.9;
    state.temperature = 36.6;
    state.cryingDuration = 0;
    state.nightVision = true;
    console.log('\n[SIM] === Aktivitas: TIDUR + NIGHT VISION ===');
  },
];

let scenarioIndex = 0;

function runSimulation() {
  state.tick += 1;

  if (state.tick % 5 === 1) {
    scenarios[scenarioIndex % scenarios.length]();
    scenarioIndex += 1;
  }

  publish('heartbeat', {});
  publish('activity', {
    sleeping: state.activity === 'sleeping' ? 1 : 0,
    awake: state.activity === 'awake' ? 1 : 0,
    crying: state.activity === 'crying' ? 1 : 0,
    confidence: Number(state.confidence.toFixed(3)),
    durationSec: state.cryingDuration,
    nightVision: state.nightVision,
  });

  if (state.tick % 2 === 0) {
    const temperature = state.temperature + (Math.random() * 0.2 - 0.1);
    publish('temperature', { temperature: Number(temperature.toFixed(1)) });
  }
}

client.on('connect', () => {
  console.log('[SIM] Connected to MQTT broker');
  console.log('[SIM] MAC Address:', MAC_ADDRESS);
  setTimeout(() => {
    registerDevice();
    runSimulation();
    setInterval(runSimulation, 10_000);
  }, 2000);
});

client.on('error', (err) => console.error('[SIM] MQTT Error:', err.message));
client.on('disconnect', () => console.log('[SIM] Disconnected from broker'));

const readline = require('readline');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

console.log('\n=== ESP32 Simulator Smart Vision ===');
console.log('Perintah manual:');
console.log('  1 = Kirim aktivitas TIDUR');
console.log('  2 = Kirim aktivitas BANGUN');
console.log('  3 = Kirim aktivitas MENANGIS');
console.log('  4 = Kirim SUHU TINGGI (38.5°C)');
console.log('  5 = Kirim SUHU RENDAH (35.5°C)');
console.log('  6 = Toggle NIGHT VISION on/off');
console.log('  h = Kirim HEARTBEAT manual');
console.log('  q = Keluar\n');

function publishActivity() {
  publish('activity', {
    sleeping: state.activity === 'sleeping' ? 1 : 0,
    awake: state.activity === 'awake' ? 1 : 0,
    crying: state.activity === 'crying' ? 1 : 0,
    confidence: state.confidence,
    durationSec: state.cryingDuration,
    nightVision: state.nightVision,
  });
}

rl.on('line', (input) => {
  switch (input.trim()) {
    case '1':
      state.activity = 'sleeping';
      state.confidence = 0.95;
      state.cryingDuration = 0;
      publishActivity();
      break;
    case '2':
      state.activity = 'awake';
      state.confidence = 0.91;
      state.cryingDuration = 0;
      publishActivity();
      break;
    case '3':
      state.activity = 'crying';
      state.confidence = 0.92;
      state.cryingDuration = 15;
      publishActivity();
      break;
    case '4':
      state.temperature = 38.5;
      publish('temperature', { temperature: state.temperature });
      break;
    case '5':
      state.temperature = 35.5;
      publish('temperature', { temperature: state.temperature });
      break;
    case '6':
      state.nightVision = !state.nightVision;
      publishActivity();
      break;
    case 'h':
      publish('heartbeat', {});
      break;
    case 'q':
      client.end();
      process.exit(0);
      break;
    default:
      console.log('[SIM] Perintah tidak dikenal:', input.trim());
  }
});
