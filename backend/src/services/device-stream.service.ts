type LiveFrameListener = (frame: Buffer) => void;

const latestLiveFrames = new Map<string, Buffer>();
const liveListeners = new Map<string, Set<LiveFrameListener>>();

export const deviceStreamService = {
  publishLiveFrame(deviceId: string, frame: Buffer): void {
    latestLiveFrames.set(deviceId, frame);
    for (const listener of liveListeners.get(deviceId) ?? []) listener(frame);
  },

  getLatestLiveFrame(deviceId: string): Buffer | undefined {
    return latestLiveFrames.get(deviceId);
  },

  subscribeLive(deviceId: string, listener: LiveFrameListener): () => void {
    const deviceListeners =
      liveListeners.get(deviceId) ?? new Set<LiveFrameListener>();
    deviceListeners.add(listener);
    liveListeners.set(deviceId, deviceListeners);

    return () => {
      deviceListeners.delete(listener);
      if (deviceListeners.size === 0) liveListeners.delete(deviceId);
    };
  },
};
