export function formatMinutes(minutes) {
  const m = Number(minutes);
  if (!Number.isFinite(m) || m <= 0) return "";
  if (m === 1440) return "1 day";
  if (m % 60 === 0) return `${m / 60}h`;
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h}h`;
  }
  return `${m}m`;
}

export function formatDurationSeconds(totalSeconds) {
  const s = Number(totalSeconds);
  if (!Number.isFinite(s) || s <= 0) return "";

  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = Math.floor(s % 60);

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

