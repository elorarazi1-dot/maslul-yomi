import { jsonError, readBody, requireUser } from "@/lib/http";
import { buildRoute } from "@/lib/pipeline";
import type { RouteStop, WhenHint } from "@/lib/types";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await readBody(request)) as {
    departureTime?: unknown;
    dwellMinutes?: unknown;
    start?: { label?: unknown; lat?: unknown; lng?: unknown };
    end?: { label?: unknown; lat?: unknown; lng?: unknown };
    stops?: unknown;
  } | null;
  if (!body) return jsonError("הבקשה לא תקינה. נסו שוב.");

  const departureTime = typeof body.departureTime === "string" ? body.departureTime : "";
  const dwell = Number(body.dwellMinutes ?? 0);
  if (!Number.isFinite(dwell) || dwell < 0 || dwell > 180) {
    return jsonError("זמן העצירה צריך להיות בין 0 ל-180 דקות.");
  }
  const start = readEndpoint(body.start);
  const end = readEndpoint(body.end);
  if (!start || !end) return jsonError("בחרו מוצא ויעד עם מיקום על המפה.");
  if (!Array.isArray(body.stops) || body.stops.length === 0) {
    return jsonError("אין תחנות לחישוב. הוסיפו לפחות תחנה אחת.");
  }
  if (body.stops.length > 60) return jsonError("אפשר לתכנן עד 60 תחנות בבת אחת.");

  const stops: RouteStop[] = [];
  for (const item of body.stops) {
    const stop = readStop(item);
    if (!stop) return jsonError("יש תחנה בלי מיקום. תקנו אותה במסך הבדיקה ונסו שוב.");
    stops.push(stop);
  }

  try {
    const result = await buildRoute({
      departureTime,
      dwellMinutes: dwell,
      start,
      end,
      stops,
    });
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "חישוב המסלול נכשל. נסו שוב.";
    return jsonError(message, 422);
  }
}

function readEndpoint(value: { label?: unknown; lat?: unknown; lng?: unknown } | undefined) {
  if (!value || typeof value.lat !== "number" || typeof value.lng !== "number") return null;
  if (!Number.isFinite(value.lat) || !Number.isFinite(value.lng)) return null;
  const label = typeof value.label === "string" ? value.label.trim() : "";
  if (!label) return null;
  return { label, lat: value.lat, lng: value.lng };
}

function readStop(value: unknown): RouteStop | null {
  if (!value || typeof value !== "object") return null;
  const stop = value as Record<string, unknown>;
  if (typeof stop.lat !== "number" || typeof stop.lng !== "number") return null;
  if (!Number.isFinite(stop.lat) || !Number.isFinite(stop.lng)) return null;
  const when: WhenHint = stop.when === "early" || stop.when === "late" ? stop.when : "";
  const window = readWindow(stop.window);
  return {
    id: typeof stop.id === "string" && stop.id ? stop.id : crypto.randomUUID(),
    name: text(stop.name),
    address: text(stop.address),
    note: text(stop.note),
    when,
    window,
    contact: text(stop.contact),
    phone: text(stop.phone),
    lat: stop.lat,
    lng: stop.lng,
  };
}

function readWindow(value: unknown): { from?: string; to?: string } | undefined {
  if (!value || typeof value !== "object") return undefined;
  const window = value as { from?: unknown; to?: unknown };
  const from = clock(window.from);
  const to = clock(window.to);
  if (!from && !to) return undefined;
  return { from, to };
}

function clock(value: unknown): string | undefined {
  return typeof value === "string" && /^\d{2}:\d{2}$/.test(value) ? value : undefined;
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
