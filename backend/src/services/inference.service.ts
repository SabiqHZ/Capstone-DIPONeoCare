import { alertService } from "./alert.service";
import { deviceService } from "./device.service";
import { supabaseAdmin } from "../config/supabase";
import {
  ActivityFlags,
  AudioSecondResult,
  DeviceContext,
  VisionResultPayload,
} from "../types";

type FinalizedStatus = {
  babyId: string;
  unitId: string | null;
  activity: "sleeping" | "awake" | "crying";
  flags: ActivityFlags;

  soundClass: "crying" | "not_crying";
  soundConfidence: number;

  cryingClass: "hungry" | "pain" | "discomfort" | null;
  cryingClassConfidence: number | null;

  cryingDurationSec: number;
  anomalyType: string | null;
  updatedAt: string;
};
const ANOMALY_CONTINUITY_GAP_MS = 1_500;

export const inferenceService = {
  async saveVisionResult(device: DeviceContext, payload: VisionResultPayload) {
    if (!device.baby_id) throw new Error("Perangkat belum dipair ke bayi");
    const { error } = await supabaseAdmin.from("ai_vision_results").upsert(
      {
        device_id: device.id,
        baby_id: device.baby_id,
        capture_id: payload.captureId,
        captured_at: payload.timestamp,
        sleeping: payload.activity.sleeping,
        awake: payload.activity.awake,
        visual_crying: payload.visualCrying.detected,
        visual_confidence: payload.activity.confidence ?? null,
        visual_crying_confidence: payload.visualCrying.confidence ?? null,
        anomaly_detected: payload.anomaly.detected,
        anomaly_type: payload.anomaly.type,
        anomaly_confidence: payload.anomaly.confidence ?? null,
      },
      { onConflict: "device_id,capture_id" },
    );
    if (error) throw new Error(error.message);
  },

  async saveAudioResults(device: DeviceContext, results: AudioSecondResult[]) {
    const rows = results.map((result) => ({
      device_id: device.id,
      capture_id: result.captureId,
      captured_at: result.timestamp,
      is_crying: result.isCrying,
      confidence: result.confidence ?? null,
      crying_class: result.isCrying ? result.cryingClass : null,
      crying_class_confidence: result.isCrying
        ? (result.cryingClassConfidence ?? null)
        : null,
    }));
    const { error } = await supabaseAdmin
      .from("ai_audio_results")
      .upsert(rows, {
        onConflict: "device_id,capture_id",
      });
    if (error) throw new Error(error.message);
  },

  async finalizeMatches(
    device: DeviceContext,
    captureIds: string[],
  ): Promise<FinalizedStatus[]> {
    if (!device.baby_id || captureIds.length === 0) return [];
    const [
      { data: visions, error: visionError },
      { data: audios, error: audioError },
    ] = await Promise.all([
      supabaseAdmin
        .from("ai_vision_results")
        .select("*")
        .eq("device_id", device.id)
        .in("capture_id", captureIds),
      supabaseAdmin
        .from("ai_audio_results")
        .select("*")
        .eq("device_id", device.id)
        .in("capture_id", captureIds),
    ]);
    if (visionError) throw new Error(visionError.message);
    if (audioError) throw new Error(audioError.message);

    const audioByCapture = new Map(
      (audios ?? []).map((audio: any) => [audio.capture_id, audio]),
    );
    const finalized: FinalizedStatus[] = [];

    for (const vision of visions ?? []) {
      const audio = audioByCapture.get(vision.capture_id) as any;
      if (!audio) continue;

      const crying = Boolean(vision.visual_crying) && Boolean(audio.is_crying);
      const cryingClass =
        crying && audio.crying_class ? audio.crying_class : null;

      const cryingClassConfidence =
        crying && audio.crying_class_confidence != null
          ? Number(audio.crying_class_confidence)
          : null;
      const flags: ActivityFlags = crying
        ? { sleeping: false, awake: false, crying: true }
        : {
            sleeping: Boolean(vision.sleeping),
            awake: Boolean(vision.awake),
            crying: false,
          };

      const activity = flags.crying
        ? "crying"
        : flags.sleeping
          ? "sleeping"
          : "awake";
      await deviceService.recordActivitySample({
        babyId: device.baby_id,
        deviceId: device.id,
        flags,
        recordedAt: vision.captured_at,
        visualCrying: Boolean(vision.visual_crying),
        audioCrying: Boolean(audio.is_crying),
        visualConfidence: vision.visual_confidence ?? undefined,
        audioConfidence: audio.confidence ?? undefined,
        cryingClass,
      });

      const cryingDurationSec = crying
        ? await this.getCurrentCryingDuration(
            device.baby_id,
            vision.captured_at,
          )
        : 0;
      await deviceService.upsertBabyStatus(device.baby_id, {
        activity,
        flags,
        cryingDurationSec,
        alertLevel: crying ? "warning" : "normal",
        soundClass: audio.is_crying ? "crying" : "not_crying",
        soundConfidence: Number(audio.confidence ?? 0),
        anomalyType: vision.anomaly_detected ? vision.anomaly_type : null,
        updatedAt: vision.captured_at,
        cryingClass,
      });

      finalized.push({
        babyId: device.baby_id,
        unitId: device.unit_id,
        activity,
        flags,
        soundClass: audio.is_crying ? "crying" : "not_crying",
        soundConfidence: Number(audio.confidence ?? 0),

        cryingDurationSec,
        anomalyType: vision.anomaly_detected ? vision.anomaly_type : null,
        updatedAt: vision.captured_at,
        cryingClass,
        cryingClassConfidence,
      });
    }
    return finalized;
  },

  async trackAnomaly(device: DeviceContext, payload: VisionResultPayload) {
    if (!device.baby_id) return null;

    const { data: active, error } = await supabaseAdmin
      .from("anomaly_events")
      .select("*")
      .eq("device_id", device.id)
      .is("resolved_at", null)
      .maybeSingle();

    if (error) {
      throw new Error(error.message);
    }

    /*
     * Tidak ada anomaly pada frame saat ini.
     * Kalau sebelumnya ada event aktif, event dianggap selesai.
     */
    if (!payload.anomaly.detected) {
      if (active) {
        const { error: resolveError } = await supabaseAdmin
          .from("anomaly_events")
          .update({
            resolved_at: payload.timestamp,
            last_detected_at: payload.timestamp,
          })
          .eq("id", active.id);

        if (resolveError) {
          throw new Error(resolveError.message);
        }
      }

      return null;
    }

    const currentDetectedAt = Date.parse(payload.timestamp);

    if (Number.isNaN(currentDetectedAt)) {
      throw new Error("Timestamp anomaly tidak valid");
    }

    let event = active;

    /*
     * Kalau event aktif ada dan jenis anomaly sama,
     * cek apakah detection masih kontinu.
     */
    if (event && event.anomaly_type === payload.anomaly.type) {
      const lastDetectedAt = Date.parse(event.last_detected_at);

      if (Number.isNaN(lastDetectedAt)) {
        throw new Error("last_detected_at anomaly tidak valid");
      }

      const gapMs = currentDetectedAt - lastDetectedAt;

      /*
       * Callback lama / out-of-order.
       * Jangan mengubah event menggunakan timestamp yang
       * lebih lama daripada detection terakhir.
       */
      if (gapMs < 0) {
        console.warn(
          `[Anomaly] Ignoring out-of-order detection for ${device.id}`,
        );

        return null;
      }

      /*
       * Gap terlalu besar:
       * event lama selesai dan detection sekarang menjadi
       * event baru.
       */
      if (gapMs > ANOMALY_CONTINUITY_GAP_MS) {
        const { error: resolveError } = await supabaseAdmin
          .from("anomaly_events")
          .update({
            resolved_at: new Date(
              lastDetectedAt + ANOMALY_CONTINUITY_GAP_MS,
            ).toISOString(),
          })
          .eq("id", event.id);

        if (resolveError) {
          throw new Error(resolveError.message);
        }

        event = null;
      }
    }

    /*
     * Tidak ada event aktif, jenis anomaly berubah,
     * atau event lama sudah diputus karena gap.
     * Buat event baru.
     */
    if (!event || event.anomaly_type !== payload.anomaly.type) {
      if (event && event.anomaly_type !== payload.anomaly.type) {
        const { error: resolveError } = await supabaseAdmin
          .from("anomaly_events")
          .update({
            resolved_at: payload.timestamp,
          })
          .eq("id", event.id);

        if (resolveError) {
          throw new Error(resolveError.message);
        }
      }

      const { data, error: insertError } = await supabaseAdmin
        .from("anomaly_events")
        .insert({
          baby_id: device.baby_id,
          device_id: device.id,
          anomaly_type: payload.anomaly.type,
          started_at: payload.timestamp,
          last_detected_at: payload.timestamp,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(insertError.message);
      }

      event = data;
    } else {
      /*
       * Detection masih kontinu.
       * Update last_detected_at.
       */
      const { data, error: updateError } = await supabaseAdmin
        .from("anomaly_events")
        .update({
          last_detected_at: payload.timestamp,
        })
        .eq("id", event.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(updateError.message);
      }

      event = data;
    }

    /*
     * Hitung durasi hanya dari event yang benar-benar
     * kontinu.
     */
    const durationSeconds =
      (Date.parse(event.last_detected_at) - Date.parse(event.started_at)) /
      1_000;

    /*
     * Alert hanya boleh dibuat setelah anomaly kontinu
     * mencapai 15 detik.
     */
    if (durationSeconds >= 15 && !event.alert_sent_at) {
      const alert = await alertService.createAlert({
        babyId: device.baby_id,
        type: "ANOMALY_DETECTED",
        message:
          `${event.anomaly_type} terdeteksi di area bayi ` +
          `selama ${Math.floor(durationSeconds)} detik`,
        severity: "critical",
      });

      if (alert) {
        const { error: alertUpdateError } = await supabaseAdmin
          .from("anomaly_events")
          .update({
            alert_sent_at: new Date().toISOString(),
          })
          .eq("id", event.id);

        if (alertUpdateError) {
          throw new Error(alertUpdateError.message);
        }

        return alert;
      }
    }

    return null;
  },

  async getCurrentCryingDuration(
    babyId: string,
    recordedAt: string,
  ): Promise<number> {
    const { data, error } = await supabaseAdmin
      .from("baby_activity_samples")
      .select("crying, recorded_at")
      .eq("baby_id", babyId)
      .lte("recorded_at", recordedAt)
      .order("recorded_at", { ascending: false })
      .limit(600);
    if (error) throw new Error(error.message);
    let seconds = 0;
    let previous: number | null = null;
    for (const sample of data ?? []) {
      const time = Date.parse(sample.recorded_at);
      if (!sample.crying || (previous !== null && previous - time > 1_500))
        break;
      seconds += 1;
      previous = time;
    }
    return seconds;
  },

  async createCryingAlertIfDue(device: DeviceContext, durationSeconds: number) {
    if (!device.baby_id) return null;
    const cooldownStart = new Date(
      Date.now() - (device.notification_cooldown_sec ?? 120) * 1_000,
    ).toISOString();
    const { data: recent, error } = await supabaseAdmin
      .from("alert_logs")
      .select("id")
      .eq("baby_id", device.baby_id)
      .eq("type", "CRYING_DETECTED")
      .gte("created_at", cooldownStart)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (recent) return null;
    return alertService.createAlert({
      babyId: device.baby_id,
      type: "CRYING_DETECTED",
      message: `Bayi menangis selama ${durationSeconds} detik`,
      severity: "warning",
    });
  },
};
