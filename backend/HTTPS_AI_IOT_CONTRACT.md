# Kontrak integrasi HTTPS: perangkat, backend, dan AI

Ganti `<BACKEND_IP>` dengan alamat IPv4 laptop/server backend pada jaringan Wi-Fi yang sama. Semua waktu memakai ISO-8601 UTC dan semua `captureId` harus unik.

## 1. Registrasi dan heartbeat perangkat

Saat boot (atau setelah firmware di-flash), perangkat mengirim `POST http://<BACKEND_IP>:3000/api/devices/register` dengan JSON:

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "localIp": "192.168.1.35",
  "firmwareVersion": "1.0.0",
  "name": "Kamera Bed A-01"
}
```

Simpan `data.deviceToken` yang diterima ke flash perangkat. Token ini dikirim sebagai header `x-device-token` bersama header `x-device-mac` pada heartbeat dan unggahan. Kirim heartbeat setiap 30 detik ke `POST /api/devices/heartbeat` dengan JSON `{"macAddress":"AA:BB:CC:DD:EE:FF","localIp":"192.168.1.35"}`.

Registrasikan perangkat dulu, lalu pair melalui aplikasi pengasuh dengan `POST /api/babies/pair` (JWT pengasuh), body `{"babyId":"<uuid>","deviceId":"<uuid perangkat>"}`.

## 2. Frame visual setiap detik

Kirim multipart `POST /api/devices/upload/frame` setiap 1 detik. Field yang wajib:

| Field | Nilai |
| --- | --- |
| `image` | JPEG, maksimum 1 MB |
| `macAddress` | MAC yang terdaftar |
| `captureId` | ID unik untuk satu detik, mis. `AA-BB-20260920T031500Z` |
| `timestamp` | waktu capture ISO-8601 UTC |

Sertakan `x-device-token`. Respons `202` hanya berarti backend menerima berkas; perangkat tidak perlu menunggu inferensi.

## 3. Audio setiap 5 detik

Kirim multipart `POST /api/devices/upload/audio` tiap 5 detik. Field wajib:

| Field | Nilai |
| --- | --- |
| `audio` | WAV/format audio yang disepakati dengan server AI, maksimum 1 MB |
| `macAddress` | MAC yang terdaftar |
| `audioWindowId` | ID unik window audio |
| `startedAt` | waktu awal window ISO-8601 UTC |
| `durationSeconds` | selalu `5` |
| `captureIds` | string JSON array berisi **tepat lima** `captureId` frame pada detik yang sama |

Contoh `captureIds`: `["frame-001","frame-002","frame-003","frame-004","frame-005"]`. Urutkan dari detik paling awal ke paling akhir. Field ini yang membuat backend dapat menggabungkan satu hasil audio per detik dengan hasil visual yang tepat.

## 4. Forward ke AI dan callback

Backend meneruskan berkas ke `${AI_SERVER_URL}/infer/vision` atau `${AI_SERVER_URL}/infer/audio`, menggunakan header `x-api-key: AI_SERVER_API_KEY` dan field multipart yang sama. AI mengirim callback dengan header API key yang sama:

`POST /api/ai/results/vision`

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "captureId": "frame-001",
  "timestamp": "2026-09-20T03:15:00.000Z",
  "activity": { "sleeping": true, "awake": false, "confidence": 0.94 },
  "visualCrying": { "detected": false, "confidence": 0.12 },
  "anomaly": { "detected": false, "type": null, "confidence": 0.98 },
  "nightVision": false
}
```

`POST /api/ai/results/audio`

```json
{
  "macAddress": "AA:BB:CC:DD:EE:FF",
  "results": [
    { "captureId": "frame-001", "timestamp": "2026-09-20T03:15:00.000Z", "isCrying": false, "confidence": 0.91 },
    { "captureId": "frame-002", "timestamp": "2026-09-20T03:15:01.000Z", "isCrying": false, "confidence": 0.90 },
    { "captureId": "frame-003", "timestamp": "2026-09-20T03:15:02.000Z", "isCrying": false, "confidence": 0.93 },
    { "captureId": "frame-004", "timestamp": "2026-09-20T03:15:03.000Z", "isCrying": false, "confidence": 0.92 },
    { "captureId": "frame-005", "timestamp": "2026-09-20T03:15:04.000Z", "isCrying": false, "confidence": 0.91 }
  ]
}
```

Backend hanya menetapkan `crying=true` bila `visualCrying.detected` **dan** `isCrying` keduanya true. Selain itu status mengikuti salah satu dari `sleeping` atau `awake`. Anomali `pillow`, `bolster`, atau `toy` dihitung terpisah dan memicu alert setelah kontinu 15 detik.
