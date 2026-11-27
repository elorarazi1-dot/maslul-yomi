import { buildExplanation } from "@/lib/explain";
import { confirmAddress, geocodeAddress, geocodeMany } from "@/lib/geocode";
import { inIsrael } from "@/lib/geo";
import { buildMatrix, routeGeometry } from "@/lib/matrix";
import { evaluateOrder, optimize } from "@/lib/optimizer";
import { parseHHMM } from "@/lib/time";
import type { PlaceFix, ReviewPayload, RouteRecord, RouteStop, StopDraft } from "@/lib/types";

/**
 * Stage 1 pipeline. A later morning job can call these functions directly:
 * extractStops -> locateStops -> buildRoute.
 */

export async function locateStops(
  drafts: StopDraft[],
  startLabel: string,
  endLabel: string,
): Promise<Pick<ReviewPayload, "stops" | "start" | "end">> {
  const [start, end] = await Promise.all([
    locatePlace(startLabel),
    locatePlace(endLabel),
  ]);
  const hint = start.lat != null && start.lng != null ? { lat: start.lat, lng: start.lng } : undefined;
  const located = await geocodeMany(
    drafts.map((stop) => stop.address),
    hint,
  );
  return {
    start,
    end,
    stops: drafts.map((draft, index) => {
      const geo = located[index];
      return {
        ...draft,
        lat: geo?.lat ?? null,
        lng: geo?.lng ?? null,
        geoStatus: geo?.status ?? "missing",
        geoLabel: geo?.label,
        candidates: geo?.candidates ?? [],
      };
    }),
  };
}

export async function locatePlace(label: string, refresh = false): Promise<PlaceFix> {
  const geo = await geocodeAddress(label, { refresh });
  return {
    label,
    lat: geo.lat,
    lng: geo.lng,
    geoStatus: geo.status,
    resolvedLabel: geo.label || undefined,
    candidates: geo.candidates,
  };
}

export async function buildRoute(input: {
  departureTime: string;
  dwellMinutes: number;
  start: { label: string; lat: number; lng: number };
  end: { label: string; lat: number; lng: number };
  stops: RouteStop[];
}): Promise<{ record: RouteRecord }> {
  const departureMinutes = parseHHMM(input.departureTime);
  if (departureMinutes == null) {
    throw new Error("שעת היציאה אינה תקינה. השתמשו בפורמט 06:00.");
  }
  if (!inIsrael(input.start) || !inIsrael(input.end)) {
    throw new Error("המוצא והיעד צריכים להיות בתוך ישראל.");
  }
  const outside = input.stops.find((stop) => !inIsrael(stop));
  if (outside) {
    throw new Error(`התחנה «${outside.name || outside.address}» מחוץ לישראל. תקנו את המיקום ונסו שוב.`);
  }

  const points = [input.start, ...input.stops, input.end];
  const matrix = await buildMatrix(points);
  const solved = optimize({
    durationsMin: matrix.durationsMin,
    distancesKm: matrix.distancesKm,
    stops: input.stops,
    departureMinutes,
    dwellMinutes: input.dwellMinutes,
  });
  const evaluation = evaluateOrder({
    stops: input.stops,
    order: solved.order,
    durationsMin: matrix.durationsMin,
    distancesKm: matrix.distancesKm,
    departureMinutes,
    dwellMinutes: input.dwellMinutes,
  });
  const visit = solved.order.map((index) => input.stops[index]);
  const geometry = await routeGeometry([input.start, ...visit, input.end]);
  const now = new Date().toISOString();
  const record: RouteRecord = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    departureTime: input.departureTime,
    dwellMinutes: input.dwellMinutes,
    start: input.start,
    end: input.end,
    stops: input.stops,
    order: solved.order,
    legs: evaluation.legs,
    totalMinutes: evaluation.totalMinutes,
    totalKm: evaluation.totalKm,
    finishEta: evaluation.finishEta,
    warnings: evaluation.warnings,
    explanation: buildExplanation({
      orderedStops: visit,
      distanceSource: matrix.source,
      solver: solved.solver,
      manual: false,
    }),
    distanceSource: matrix.source,
    geometrySource: geometry.source,
    solver: solved.solver,
    manual: false,
    polyline: geometry.polyline,
    durationsMin: matrix.durationsMin,
    distancesKm: matrix.distancesKm,
  };

  for (const place of [
    { address: input.start.label, point: input.start },
    { address: input.end.label, point: input.end },
    ...input.stops.filter((stop) => stop.address).map((stop) => ({ address: stop.address, point: stop })),
  ]) {
    try {
      confirmAddress(place.address, place.point);
    } catch (error) {
      console.error("confirm address failed", error instanceof Error ? error.message : error);
    }
  }

  return { record };
}
