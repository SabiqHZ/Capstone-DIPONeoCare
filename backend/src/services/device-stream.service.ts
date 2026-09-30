type FrameListener = (frame: Buffer) => void;

const latestFrames = new Map<string, Buffer>();
const listeners = new Map<string, Set<FrameListener>>();

export const deviceStreamService = {
  publishFrame(deviceId: string, frame: Buffer): void {
    latestFrames.set(deviceId, frame);
    for (const listener of listeners.get(deviceId) ?? []) listener(frame);
  },

  getLatestFrame(deviceId: string): Buffer | undefined {
    return latestFrames.get(deviceId);
  },

  subscribe(deviceId: string, listener: FrameListener): () => void {
    const deviceListeners = listeners.get(deviceId) ?? new Set<FrameListener>();
    deviceListeners.add(listener);
    listeners.set(deviceId, deviceListeners);

    return () => {
      deviceListeners.delete(listener);
      if (deviceListeners.size === 0) listeners.delete(deviceId);
    };
  },
};
