import { buildExplanation } from "@/lib/explain";
import { straightPolyline } from "@/lib/geo";
import { evaluateOrder } from "@/lib/optimizer";
import { parseHHMM } from "@/lib/time";
import type { GeometrySource, RouteRecord, RouteStop } from "@/lib/types";

export function orderedStops(record: RouteRecord): RouteStop[] {
  return record.order.map((index) => record.stops[index]);
}

export function routePoints(record: RouteRecord) {
  return [record.start, ...orderedStops(record), record.end];
}

export function recomputeRecord(
  record: RouteRecord,
  patch: {
    order?: number[];
    dwellMinutes?: number;
    manual?: boolean;
    polyline?: [number, number][];
    geometrySource?: GeometrySource;
  },
): RouteRecord {
  const order = patch.order ?? record.order;
  const dwellMinutes = patch.dwellMinutes ?? record.dwellMinutes;
  const manual = patch.manual ?? record.manual;
  const departureMinutes = parseHHMM(record.departureTime) ?? 6 * 60;
  const evaluation = evaluateOrder({
    stops: record.stops,
    order,
    durationsMin: record.durationsMin,
    distancesKm: record.distancesKm,
    departureMinutes,
    dwellMinutes,
    manual,
  });
  const stopsInOrder = order.map((index) => record.stops[index]);
  const geometrySource = patch.geometrySource ?? (manual ? "straight" : record.geometrySource);
  const polyline =
    patch.polyline ??
    (geometrySource === "straight" ? straightPolyline([record.start, ...stopsInOrder, record.end]) : record.polyline);
  return {
    ...record,
    order,
    dwellMinutes,
    manual,
    legs: evaluation.legs,
    totalMinutes: evaluation.totalMinutes,
    totalKm: evaluation.totalKm,
    finishEta: evaluation.finishEta,
    warnings: evaluation.warnings,
    explanation: buildExplanation({
      orderedStops: stopsInOrder,
      distanceSource: record.distanceSource,
      solver: record.solver,
      manual,
    }),
    geometrySource,
    polyline,
    updatedAt: new Date().toISOString(),
  };
}
