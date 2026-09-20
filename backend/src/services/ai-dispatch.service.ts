import axios from 'axios';
import FormData from 'form-data';
import { env } from '../config/env';

export const aiDispatchService = {
  async dispatch(kind: 'vision' | 'audio', payload: {
    macAddress: string;
    captureId?: string;
    audioWindowId?: string;
    timestamp?: string;
    startedAt?: string;
    durationSeconds?: number;
    captureIds?: string[];
    file: Express.Multer.File;
  }) {
    if (!env.AI_SERVER_URL) {
      throw new Error('AI_SERVER_URL belum dikonfigurasi');
    }

    const form = new FormData();
    form.append('macAddress', payload.macAddress);
    if (payload.captureId) form.append('captureId', payload.captureId);
    if (payload.audioWindowId) form.append('audioWindowId', payload.audioWindowId);
    if (payload.timestamp) form.append('timestamp', payload.timestamp);
    if (payload.startedAt) form.append('startedAt', payload.startedAt);
    if (payload.durationSeconds !== undefined) form.append('durationSeconds', String(payload.durationSeconds));
    if (payload.captureIds) form.append('captureIds', JSON.stringify(payload.captureIds));
    form.append(kind === 'vision' ? 'image' : 'audio', payload.file.buffer, {
      filename: payload.file.originalname,
      contentType: payload.file.mimetype,
    });

    await axios.post(`${env.AI_SERVER_URL}/infer/${kind}`, form, {
      headers: { ...form.getHeaders(), 'x-api-key': env.AI_SERVER_API_KEY },
      timeout: 10_000,
    });
  },
};
