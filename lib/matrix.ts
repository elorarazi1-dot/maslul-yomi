import { estimateMatrix, straightPolyline } from "@/lib/geo";
import type { DistanceSource, GeometrySource, LatLng } from "@/lib/types";

export async function buildMatrix(points: LatLng[]): Promise<{
  durationsMin: number[][];
  distancesKm: number[][];
  source: DistanceSource;
}> {
  const key = process.env.ORS_API_KEY?.trim();
  if (key && points.length >= 2) {
    try {
      return await orsMatrix(points, key);
    } catch (error) {
      console.error("ORS matrix failed", error instanceof Error ? error.message : error);
    }
  }
  return { ...estimateMatrix(points), source: "estimate" };
}

export async function routeGeometry(points: LatLng[]): Promise<{
  polyline: [number, number][];
  source: GeometrySource;
}> {
  const straight = straightPolyline(points);
  const key = process.env.ORS_API_KEY?.trim();
  if (!key || points.length < 2) return { polyline: straight, source: "straight" };
  try {
    const response = await fetch("https://api.heigit.org/openrouteservice/v2/directions/driving-car/geojson", {
      method: "POST",
      headers: {
        Authorization: key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        coordinates: points.map((point) => [point.lng, point.lat]),
      }),
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`ORS directions ${response.status}`);
    const data = (await response.json()) as {
      features?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const coordinates = data.features?.[0]?.geometry?.coordinates;
    if (!coordinates?.length) throw new Error("ORS directions returned no geometry");
    return {
      polyline: coordinates.map(([lng, lat]) => [lat, lng]),
      source: "openrouteservice",
    };
  } catch (error) {
    console.error("ORS directions failed", error instanceof Error ? error.message : error);
    return { polyline: straight, source: "straight" };
  }
}

async function orsMatrix(points: LatLng[], key: string) {
  const response = await fetch("https://api.heigit.org/openrouteservice/v2/matrix/driving-car", {
    method: "POST",
    headers: {
      Authorization: key,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      locations: points.map((point) => [point.lng, point.lat]),
      metrics: ["duration", "distance"],
      units: "km",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`ORS matrix ${response.status}`);
  const data = (await response.json()) as {
    durations?: (number | null)[][];
    distances?: (number | null)[][];
  };
  const size = points.length;
  const durationsMin: number[][] = [];
  const distancesKm: number[][] = [];
  for (let row = 0; row < size; row += 1) {
    const durationRow: number[] = [];
    const distanceRow: number[] = [];
    for (let column = 0; column < size; column += 1) {
      const seconds = data.durations?.[row]?.[column];
      const kilometers = data.distances?.[row]?.[column];
      if (row !== column && (seconds == null || kilometers == null)) {
        throw new Error("ORS matrix was incomplete");
      }
      durationRow.push((seconds ?? 0) / 60);
      distanceRow.push(kilometers ?? 0);
    }
    durationsMin.push(durationRow);
    distancesKm.push(distanceRow);
  }
  return { durationsMin, distancesKm, source: "openrouteservice" as const };
}
