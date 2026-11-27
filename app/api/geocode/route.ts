import { geocodeAddress } from "@/lib/geocode";
import { jsonError, readBody, requireUser } from "@/lib/http";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await readBody(request)) as {
    address?: unknown;
    refresh?: unknown;
    hint?: { lat?: unknown; lng?: unknown };
  } | null;
  const address = typeof body?.address === "string" ? body.address.trim() : "";
  if (!address) return jsonError("חסרה כתובת לחיפוש.");
  const hint =
    typeof body?.hint?.lat === "number" && typeof body.hint.lng === "number"
      ? { lat: body.hint.lat, lng: body.hint.lng }
      : undefined;
  try {
    const result = await geocodeAddress(address, { refresh: body?.refresh === true, hint });
    return Response.json(result);
  } catch (error) {
    console.error("geocode route failed", error instanceof Error ? error.message : error);
    return jsonError("חיפוש הכתובת נכשל. נסו שוב.", 502);
  }
}
