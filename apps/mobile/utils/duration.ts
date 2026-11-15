export function formatDurationMinutes(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return "0m";

  const totalSeconds = Math.round(value * 60);
  if (totalSeconds < 60) return `${totalSeconds}s`;

  const totalMinutes = Math.floor(totalSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  return minutes === 0 ? `${hours}j` : `${hours}j ${minutes}m`;
}
