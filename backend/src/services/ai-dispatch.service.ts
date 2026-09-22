import axios from "axios";
import FormData from "form-data";
import { env } from "../config/env";

export const aiDispatchService = {
  async dispatch(
    kind: "vision" | "audio",
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

    const form = new FormData();

    // Metadata umum
    form.append("macAddress", payload.macAddress);

    // Metadata vision
    if (payload.captureId) {
      form.append("captureId", payload.captureId);
    }

    // Metadata audio
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

    // File
    form.append(kind === "vision" ? "file" : "audio", payload.file.buffer, {
      filename: payload.file.originalname,
      contentType: payload.file.mimetype,
    });

    // Hilangkan trailing slash dari AI_SERVER_URL
    const baseUrl = env.AI_SERVER_URL.replace(/\/+$/, "");

    // Endpoint AI terbaru
    const endpoint = kind === "vision" ? "/predict/visual" : "/predict/audio";

    const requestUrl = `${baseUrl}${endpoint}`;

    // Header multipart
    const headers: Record<string, string> = {
      ...form.getHeaders(),
    };

    // API key hanya dikirim kalau memang dikonfigurasi.
    // Saat ini kita sedang testing tanpa API key.
    if (env.AI_SERVER_API_KEY) {
      headers["x-api-key"] = env.AI_SERVER_API_KEY;
    }

    try {
      console.log(`[AI] dispatching ${kind} → ${requestUrl}`);

      const response = await axios.post(requestUrl, form, {
        headers,
        timeout: 10_000,
      });

      console.log(`[AI] ${kind} dispatch success:`, response.status);

      return response.data;
    } catch (error: any) {
      console.error(`[AI] ${kind} dispatch failed:`, error.message);

      if (error.response) {
        console.error("[AI] status:", error.response.status);

        console.error(
          "[AI] response:",
          JSON.stringify(error.response.data, null, 2),
        );

        console.error("[AI] request URL:", requestUrl);
      }

      throw error;
    }
  },
};
