export function parseHHMM(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

export function formatHHMM(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const normalized = ((rounded % 1440) + 1440) % 1440;
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function formatClock(totalMinutes: number): string {
  const rounded = Math.round(totalMinutes);
  const days = Math.floor(rounded / 1440);
  const clock = formatHHMM(rounded);
  if (days > 0) return `${clock} (למחרת)`;
  return clock;
}

export function formatWhen(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("he-IL", {
    weekday: "short",
    day: "numeric",
    month: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatDuration(minutes: number): string {
  const rounded = Math.max(0, Math.round(minutes));
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  if (hours <= 0) return rest === 0 ? "פחות מדקה" : `${rest} דק׳`;
  const hourText = hours === 1 ? "שעה" : hours === 2 ? "שעתיים" : `${hours} שעות`;
  if (rest === 0) return hourText;
  return `${hourText} ו-${rest} דק׳`;
}

export function roundMinutes(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const rounded = Math.round(value);
  return rounded === 0 ? 1 : rounded;
}

export function roundKm(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.round(value * 10) / 10;
}
