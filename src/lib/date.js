export function pad2(n) {
  return String(n).padStart(2, "0");
}

// Local "day key" (YYYY-MM-DD) used for timeline rows.
export function dayKeyFromLocalDate(date) {
  const y = date.getFullYear();
  const m = pad2(date.getMonth() + 1);
  const d = pad2(date.getDate());
  return `${y}-${m}-${d}`;
}

export function localDateFromDayKey(dayKey) {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDaysToDayKey(dayKey, deltaDays) {
  const d = localDateFromDayKey(dayKey);
  d.setDate(d.getDate() + deltaDays);
  return dayKeyFromLocalDate(d);
}

// Persisted scheduledDate (ISO) is always midnight UTC for the dayKey.
export function scheduledIsoFromDayKey(dayKey) {
  return `${dayKey}T00:00:00.000Z`;
}

// For stored tasks, scheduledDate is normalized to midnight UTC; derive the dayKey quickly.
export function dayKeyFromScheduledIso(iso) {
  return String(iso).slice(0, 10);
}

export function formatDayLabel(dayKey) {
  const d = new Date(scheduledIsoFromDayKey(dayKey));
  // Use UTC so the label doesn't shift by local timezone.
  const day = d.toLocaleString(undefined, {
    timeZone: "UTC",
    day: "2-digit",
  });
  const month = d.toLocaleString(undefined, {
    timeZone: "UTC",
    month: "short",
  });
  return `${day} ${month}`;
}

export function formatWeekdayLabel(dayKey) {
  const d = new Date(scheduledIsoFromDayKey(dayKey));
  return d.toLocaleString(undefined, {
    timeZone: "UTC",
    weekday: "short",
  });
}

