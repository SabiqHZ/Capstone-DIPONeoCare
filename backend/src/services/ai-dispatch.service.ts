import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env";

type DispatchKind = "vision" | "audio";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableError(error: any): boolean {
  // Tidak ada response berarti biasanya network/timeout/connection error.
  if (!error?.response) {
    return true;
  }

  const status = Number(error.response.status);

  // Retry untuk timeout, rate limit, dan server-side error.
  return status === 408 || status === 429 || status >= 500;
}

function getRetryDelay(baseDelayMs: number, attempt: number): number {
  // Exponential backoff:
  // attempt 1 -> 1x
  // attempt 2 -> 2x
  // attempt 3 -> 4x
  return baseDelayMs * 2 ** (attempt - 1);
}

function buildForm(
  kind: DispatchKind,
  payload: {
    macAddress: string;
    captureId?: string;
    audioWindowId?: string;
    timestamp?: string;
    startedAt?: string;
    durationSeconds?: number;
    captureIds?: string[];
    file: Express.Multer.File;
  },
) {
  const form = new FormData();

  // Metadata umum
  form.append("macAddress", payload.macAddress);

  // Vision
  if (payload.captureId) {
    form.append("captureId", payload.captureId);
  }

  // Audio
  if (payload.audioWindowId) {
    form.append("audioWindowId", payload.audioWindowId);
  }

  if (payload.timestamp) {
    form.append("timestamp", payload.timestamp);
  }

  if (payload.startedAt) {
    form.append("startedAt", payload.startedAt);
  }

  if (payload.durationSeconds !== undefined) {
    form.append("durationSeconds", String(payload.durationSeconds));
  }

  if (payload.captureIds) {
    form.append("captureIds", JSON.stringify(payload.captureIds));
  }

  // IMPORTANT:
  // FormData harus dibuat ulang setiap retry karena
  // stream request sebelumnya sudah digunakan.
  form.append(kind === "vision" ? "file" : "audio", payload.file.buffer, {
    filename: payload.file.originalname,
    contentType: payload.file.mimetype,
  });

  return form;
}

export const aiDispatchService = {
  async dispatch(
    kind: DispatchKind,
    payload: {
      macAddress: string;
      captureId?: string;
      audioWindowId?: string;
      timestamp?: string;
      startedAt?: string;
      durationSeconds?: number;
      captureIds?: string[];
      file: Express.Multer.File;
    },
  ) {
    if (!env.AI_SERVER_URL) {
      throw new Error("AI_SERVER_URL belum dikonfigurasi");
    }

    const baseUrl = env.AI_SERVER_URL.replace(/\/+$/, "");

    const endpoint = kind === "vision" ? "/predict/visual" : "/predict/audio";

    const requestUrl = `${baseUrl}${endpoint}`;

    const maxAttempts = env.AI_RETRY_MAX_ATTEMPTS;
    const baseDelayMs = env.AI_RETRY_DELAY_MS;

    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      const form = buildForm(kind, payload);

      const headers: Record<string, string> = {
        ...form.getHeaders(),
      };

      try {
        console.log(
          `[AI] ${kind} dispatch attempt ${attempt}/${maxAttempts} → ${requestUrl}`,
        );

        const response = await axios.post(requestUrl, form, {
          headers,
          timeout: 10_000,
          maxBodyLength: Infinity,
        });

        console.log(
          `[AI] ${kind} dispatch success on attempt ${attempt}:`,
          response.status,
        );

        return response.data;
      } catch (error: any) {
        lastError = error;

        const retryable = isRetryableError(error);
        const hasNextAttempt = attempt < maxAttempts;

        console.error(
          `[AI] ${kind} dispatch failed on attempt ${attempt}/${maxAttempts}:`,
          error.message,
        );

        if (error.response) {
          console.error("[AI] status:", error.response.status);

          console.error(
            "[AI] response:",
            JSON.stringify(error.response.data, null, 2),
          );
        }

        if (!retryable || !hasNextAttempt) {
          break;
        }

        const delay = getRetryDelay(baseDelayMs, attempt);

        console.log(`[AI] ${kind} retrying in ${delay} ms...`);

        await sleep(delay);
      }
    }

    throw lastError instanceof Error
      ? lastError
      : new Error(`AI ${kind} dispatch gagal`);
  },
};
