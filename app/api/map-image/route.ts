import { jsonError, readBody, requireUser } from "@/lib/http";
import { renderRouteMapPng, resolveMapPolyline } from "@/lib/map-image";
import type { MapMarkerInput } from "@/lib/map-view";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await readBody(request)) as {
    markers?: unknown;
    polyline?: unknown;
  } | null;
  const markers = readMarkers(body?.markers);
  if (!markers || markers.length < 2) {
    return jsonError("צריך לפחות נקודת יציאה ונקודת סיום כדי ליצור תמונת מפה.");
  }
  if (markers.length > 80) return jsonError("אפשר לצייר עד 80 נקודות על תמונת המפה.");
  const provided = readPolyline(body?.polyline);
  if (provided && provided.length > 8000) return jsonError("קו המסלול ארוך מדי לתמונה.");

  try {
    const polyline = await resolveMapPolyline(markers, provided);
    const png = await renderRouteMapPng({ markers, polyline });
    return new Response(new Uint8Array(png), {
      headers: {
        "content-type": "image/png",
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    console.error("map image failed", error instanceof Error ? error.message : error);
    return jsonError("לא הצלחנו ליצור את תמונת המפה. נסו שוב.", 500);
  }
}

function readMarkers(value: unknown): MapMarkerInput[] | null {
  if (!Array.isArray(value)) return null;
  const markers: MapMarkerInput[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") return null;
    const marker = item as { lat?: unknown; lng?: unknown; kind?: unknown; label?: unknown };
    if (typeof marker.lat !== "number" || typeof marker.lng !== "number") return null;
    const kind = marker.kind === "start" || marker.kind === "end" || marker.kind === "stop" ? marker.kind : "stop";
    markers.push({
      lat: marker.lat,
      lng: marker.lng,
      kind,
      label: typeof marker.label === "string" ? marker.label.slice(0, 4) : "",
    });
  }
  return markers;
}

function readPolyline(value: unknown): [number, number][] | undefined {
  if (!Array.isArray(value)) return undefined;
  const points: [number, number][] = [];
  for (const item of value) {
    if (Array.isArray(item) && typeof item[0] === "number" && typeof item[1] === "number") {
      points.push([item[0], item[1]]);
    }
  }
  return points.length > 1 ? points : undefined;
}
