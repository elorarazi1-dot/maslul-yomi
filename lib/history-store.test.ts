import { describe, expect, it } from "vitest";
import {
  deleteHistoryRecord,
  getHistoryRecord,
  readHistory,
  saveHistoryRecord,
  type KeyValueStore,
} from "@/lib/history-store";
import type { RouteRecord } from "@/lib/types";

function memoryStore(): KeyValueStore {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

function record(id: string, createdAt: string): RouteRecord {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    departureTime: "06:00",
    dwellMinutes: 0,
    start: { label: "כפר סבא", lat: 32.17, lng: 34.9 },
    end: { label: "נתניה", lat: 32.32, lng: 34.86 },
    stops: [
      {
        id: "s",
        name: "לקוח",
        address: "הרצל 1, נתניה",
        note: "",
        when: "",
        contact: "",
        phone: "",
        lat: 32.32,
        lng: 34.86,
      },
    ],
    order: [0],
    legs: [],
    totalMinutes: 40,
    totalKm: 28.2,
    finishEta: "07:10",
    warnings: [],
    explanation: "",
    distanceSource: "estimate",
    geometrySource: "straight",
    solver: "exact",
    manual: false,
    polyline: [],
    durationsMin: [
      [0, 1, 2],
      [1, 0, 1],
      [2, 1, 0],
    ],
    distancesKm: [
      [0, 1, 2],
      [1, 0, 1],
      [2, 1, 0],
    ],
  };
}

describe("client history", () => {
  it("lists, opens, replaces, and deletes routes on one device", () => {
    const store = memoryStore();
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    saveHistoryRecord(store, record("a", new Date(now - 60_000).toISOString()), now);
    saveHistoryRecord(store, record("b", new Date(now).toISOString()), now);
    const listed = readHistory(store, now);
    expect(listed.map((item) => item.id)).toEqual(["b", "a"]);
    expect(getHistoryRecord(store, "a", now)?.start.label).toBe("כפר סבא");

    const updated = record("a", new Date(now - 60_000).toISOString());
    updated.totalMinutes = 55;
    saveHistoryRecord(store, updated, now);
    expect(getHistoryRecord(store, "a", now)?.totalMinutes).toBe(55);
    expect(readHistory(store, now)).toHaveLength(2);

    expect(deleteHistoryRecord(store, "b", now)).toBe(true);
    expect(getHistoryRecord(store, "b", now)).toBeNull();
    expect(deleteHistoryRecord(store, "missing", now)).toBe(false);
  });

  it("keeps routes for 30 days and drops older ones", () => {
    const store = memoryStore();
    const now = Date.parse("2026-11-17T12:00:00.000Z");
    saveHistoryRecord(store, record("old", new Date(now - 31 * 24 * 60 * 60 * 1000).toISOString()), now - 31 * 24 * 60 * 60 * 1000);
    saveHistoryRecord(store, record("kept", new Date(now - 29 * 24 * 60 * 60 * 1000).toISOString()), now - 29 * 24 * 60 * 60 * 1000);
    const listed = readHistory(store, now);
    expect(listed.map((item) => item.id)).toEqual(["kept"]);
    expect(getHistoryRecord(store, "old", now)).toBeNull();
  });
});
