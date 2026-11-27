import type { RouteRecord, RouteSummary } from "@/lib/types";

export const HISTORY_STORAGE_KEY = "maslul-history-v1";
export const HISTORY_RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

export interface KeyValueStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function browserHistoryStore(): KeyValueStore {
  if (typeof window === "undefined") {
    return {
      getItem: () => null,
      setItem: () => undefined,
    };
  }
  return window.localStorage;
}

export function summarizeHistory(record: RouteRecord): RouteSummary {
  return {
    id: record.id,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    departureTime: record.departureTime,
    startLabel: record.start.label,
    endLabel: record.end.label,
    stopCount: record.stops.length,
    totalKm: record.totalKm,
    totalMinutes: record.totalMinutes,
    finishEta: record.finishEta,
  };
}

export function readHistory(store: KeyValueStore, now = Date.now()): RouteRecord[] {
  const raw = store.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) return [];
  const records = parsed.filter(isRouteRecord);
  const kept = purgeHistory(records, now).sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  if (kept.length !== parsed.length) store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(kept));
  return kept;
}

export function saveHistoryRecord(store: KeyValueStore, record: RouteRecord, now = Date.now()): RouteRecord[] {
  const without = readHistory(store, now).filter((item) => item.id !== record.id);
  without.push(record);
  const kept = without.sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
  store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(kept));
  return kept;
}

export function deleteHistoryRecord(store: KeyValueStore, id: string, now = Date.now()): boolean {
  const all = readHistory(store, now);
  const next = all.filter((item) => item.id !== id);
  store.setItem(HISTORY_STORAGE_KEY, JSON.stringify(next));
  return next.length !== all.length;
}

export function getHistoryRecord(store: KeyValueStore, id: string, now = Date.now()): RouteRecord | null {
  return readHistory(store, now).find((item) => item.id === id) ?? null;
}

export function purgeHistory(records: RouteRecord[], now = Date.now()): RouteRecord[] {
  return records.filter((record) => {
    const created = Date.parse(record.createdAt);
    return Number.isFinite(created) && now - created <= HISTORY_RETENTION_MS;
  });
}

function isRouteRecord(value: unknown): value is RouteRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<RouteRecord>;
  return typeof record.id === "string" && typeof record.createdAt === "string" && Array.isArray(record.stops);
}
