import { MISSING_VISION_MESSAGE } from "@/lib/camera-capture";
import { parseModelStops } from "@/lib/model-json";
import { parseStopSheet } from "@/lib/parser";
import { configuredVision, geminiKey, type VisionName } from "@/lib/providers";
import type { StopDraft } from "@/lib/types";

const PROMPT = `You extract delivery or visit stops from a photographed printed sheet used by an Israeli business, or from pasted Hebrew text.

Return ONLY JSON:
{"stops":[{"name":"","address":"","note":"","contact":"","phone":""}]}

Rules:
- A side column or margin of printed clock times is a schedule. IGNORE those times completely. Do not copy them into any field.
- Any free-text or handwritten note about a stop goes into "note" VERBATIM, in the original Hebrew.
- Keep time words inside the note when they were written as a note, for example "רק אחרי 12:00", "עד 10:00", "בבוקר", "בסוף היום". Do not invent a separate time field.
- "address" is a full navigable Israeli address: street, number when visible, and city. Hebrew.
- "name" is the customer or business. "contact" is a person to call, when one is written. "phone" is the phone as written.
- Do not invent stops. Skip unreadable lines.`;

export async function extractStops(input: {
  text?: string;
  imageBase64?: string;
  mediaType?: string;
}): Promise<{ stops: StopDraft[]; extractor: "heuristic" | "llm"; warnings: string[] }> {
  const warnings: string[] = [];
  const text = input.text?.trim() ?? "";
  const hasImage = Boolean(input.imageBase64);
  if (!text && !hasImage) {
    throw new Error("הדביקו רשימת תחנות או צרפו תמונה של הדף.");
  }

  if (hasImage) {
    const provider = configuredVision();
    if (!provider) {
      if (text) {
        warnings.push(MISSING_VISION_MESSAGE);
        return { ...heuristic(text), warnings };
      }
      throw new Error(MISSING_VISION_MESSAGE);
    }
    if ((input.imageBase64?.length ?? 0) > 12_000_000) {
      throw new Error("התמונה גדולה מדי. בחרו תמונה קטנה יותר או הדביקו את הרשימה כטקסט.");
    }
    const image = await normalizeImage(input.imageBase64 ?? "", input.mediaType || "image/jpeg");
    try {
      const raw = await callVision(provider, image, text);
      const stops = parseModelStops(raw);
      if (stops.length === 0) {
        throw new Error("לא זיהינו תחנות בתמונה. צלמו שוב מקרוב, או הדביקו את הרשימה כטקסט.");
      }
      return { stops, extractor: "llm", warnings };
    } catch (error) {
      if (text) {
        warnings.push("זיהוי התמונה נכשל, ולכן השתמשנו בטקסט שהודבק.");
        return { ...heuristic(text), warnings };
      }
      throw error instanceof Error
        ? error
        : new Error("זיהוי התמונה נכשל. נסו שוב, או הדביקו את הרשימה כטקסט.");
    }
  }

  return { ...heuristic(text), warnings };
}

function heuristic(text: string): { stops: StopDraft[]; extractor: "heuristic" } {
  const stops = parseStopSheet(text);
  if (stops.length === 0) {
    throw new Error("לא נמצאו תחנות בטקסט. כתבו כל עצירה בשורה או בפסקה, עם כתובת ועיר.");
  }
  return { stops, extractor: "heuristic" };
}

async function normalizeImage(base64: string, mediaType: string): Promise<{ base64: string; mediaType: string }> {
  const type = mediaType.toLowerCase();
  if (type.includes("heic") || type.includes("heif")) {
    try {
      const convert = (await import("heic-convert")).default;
      const output = await convert({
        buffer: Buffer.from(base64, "base64"),
        format: "JPEG",
        quality: 0.85,
      });
      return { base64: Buffer.from(output).toString("base64"), mediaType: "image/jpeg" };
    } catch (error) {
      console.error("HEIC conversion failed", error instanceof Error ? error.message : error);
      throw new Error("לא הצלחנו לקרוא קובץ HEIC. שמרו את התמונה כ-JPG או PNG ונסו שוב.");
    }
  }
  if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(type)) {
    throw new Error("אפשר להעלות JPG, PNG, WEBP או HEIC. נסו קובץ אחר.");
  }
  return { base64, mediaType: type };
}

async function callVision(
  provider: VisionName,
  image: { base64: string; mediaType: string },
  text: string,
): Promise<string> {
  const instruction = text ? `${PROMPT}\n\nטקסט נוסף מהמשתמש:\n${text}` : PROMPT;
  if (provider === "anthropic") return anthropic(image, instruction);
  if (provider === "openai") return openai(image, instruction);
  return gemini(image, instruction);
}

async function anthropic(image: { base64: string; mediaType: string }, instruction: string): Promise<string> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": process.env.ANTHROPIC_API_KEY ?? "",
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-5",
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: image.mediaType, data: image.base64 },
            },
            { type: "text", text: instruction },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw await visionFailure(response);
  const data = (await response.json()) as { content?: { type: string; text?: string }[] };
  const text = data.content?.filter((block) => block.type === "text").map((block) => block.text ?? "").join("\n");
  if (!text) throw new Error("שירות הזיהוי החזיר תשובה ריקה. נסו שוב.");
  return text;
}

async function openai(image: { base64: string; mediaType: string }, instruction: string): Promise<string> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL?.trim() || "gpt-4o",
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: instruction },
            { type: "image_url", image_url: { url: `data:${image.mediaType};base64,${image.base64}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!response.ok) throw await visionFailure(response);
  const data = (await response.json()) as { choices?: { message?: { content?: string } }[] };
  const text = data.choices?.[0]?.message?.content;
  if (!text) throw new Error("שירות הזיהוי החזיר תשובה ריקה. נסו שוב.");
  return text;
}

async function gemini(image: { base64: string; mediaType: string }, instruction: string): Promise<string> {
  const model = process.env.GEMINI_MODEL?.trim() || "gemini-3.5-flash-lite";
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${geminiKey()}`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: instruction },
              { inline_data: { mime_type: image.mediaType, data: image.base64 } },
            ],
          },
        ],
        generationConfig: { responseMimeType: "application/json" },
      }),
      signal: AbortSignal.timeout(45_000),
    },
  );
  if (!response.ok) throw await visionFailure(response);
  const data = (await response.json()) as {
    candidates?: { content?: { parts?: { text?: string }[] } }[];
  };
  const text = data.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("\n");
  if (!text) throw new Error("שירות הזיהוי החזיר תשובה ריקה. נסו שוב.");
  return text;
}

async function visionFailure(response: Response): Promise<Error> {
  const body = await response.text();
  console.error("vision provider error", response.status, body.slice(0, 400).replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]"));
  return new Error("שירות הזיהוי החזיר שגיאה. נסו שוב בעוד רגע, או הדביקו את הרשימה כטקסט.");
}
