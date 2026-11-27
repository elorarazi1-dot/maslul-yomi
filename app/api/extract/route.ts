import { extractStops } from "@/lib/extract";
import { jsonError, readBody, requireUser } from "@/lib/http";
import { locateStops } from "@/lib/pipeline";

export async function POST(request: Request) {
  const denied = await requireUser();
  if (denied) return denied;
  const body = (await readBody(request)) as {
    text?: unknown;
    imageBase64?: unknown;
    mediaType?: unknown;
    startLabel?: unknown;
    endLabel?: unknown;
  } | null;
  if (!body) return jsonError("הבקשה לא תקינה. נסו שוב.");

  try {
    const extracted = await extractStops({
      text: typeof body.text === "string" ? body.text : "",
      imageBase64: typeof body.imageBase64 === "string" ? body.imageBase64 : undefined,
      mediaType: typeof body.mediaType === "string" ? body.mediaType : undefined,
    });
    const located = await locateStops(
      extracted.stops,
      typeof body.startLabel === "string" && body.startLabel.trim() ? body.startLabel.trim() : "כפר סבא",
      typeof body.endLabel === "string" && body.endLabel.trim() ? body.endLabel.trim() : "כפר סבא",
    );
    return Response.json({
      ...located,
      warnings: extracted.warnings,
      extractor: extracted.extractor,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "פענוח התחנות נכשל. נסו שוב.";
    return jsonError(message, 422);
  }
}
