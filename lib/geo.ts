import type { LatLng } from "@/lib/types";

export const ISRAEL_BBOX = {
  minLat: 29.45,
  maxLat: 33.4,
  minLng: 34.15,
  maxLng: 35.95,
};

export function inIsrael(point: LatLng): boolean {
  return (
    point.lat >= ISRAEL_BBOX.minLat &&
    point.lat <= ISRAEL_BBOX.maxLat &&
    point.lng >= ISRAEL_BBOX.minLng &&
    point.lng <= ISRAEL_BBOX.maxLng
  );
}

export function haversineKm(a: LatLng, b: LatLng): number {
  const earth = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function toRad(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

/**
 * Road distance is the straight-line distance times 1.35.
 * Speed uses that road distance: 30 km/h up to 10 km, 45 up to 30 km, 70 beyond.
 */
export function estimateLeg(straightKm: number): { km: number; minutes: number } {
  const km = Math.max(0, straightKm) * 1.35;
  const speed = km <= 10 ? 30 : km <= 30 ? 45 : 70;
  return { km, minutes: (km / speed) * 60 };
}

export function estimateMatrix(points: LatLng[]): {
  durationsMin: number[][];
  distancesKm: number[][];
} {
  const size = points.length;
  const durationsMin = Array.from({ length: size }, () => Array<number>(size).fill(0));
  const distancesKm = Array.from({ length: size }, () => Array<number>(size).fill(0));
  for (let i = 0; i < size; i += 1) {
    for (let j = 0; j < size; j += 1) {
      if (i === j) continue;
      const estimate = estimateLeg(haversineKm(points[i], points[j]));
      durationsMin[i][j] = estimate.minutes;
      distancesKm[i][j] = estimate.km;
    }
  }
  return { durationsMin, distancesKm };
}

export function straightPolyline(points: LatLng[]): [number, number][] {
  return points.map((point) => [point.lat, point.lng]);
}
