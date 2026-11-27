import { interpretNote } from "@/lib/parser";
import type { StopDraft } from "@/lib/types";

const BARE_TIME = /^\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?$/;

export function parseModelStops(raw: string): StopDraft[] {
  const cleaned = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/i, "").trim();
  const objectAt = cleaned.indexOf("{");
  const arrayAt = cleaned.indexOf("[");
  const start =
    objectAt === -1 ? arrayAt : arrayAt === -1 ? objectAt : Math.min(objectAt, arrayAt);
  if (start < 0) throw new Error("שירות הזיהוי לא החזיר רשימת תחנות. נסו שוב.");
  const slice = cleaned.slice(start);
  const end = Math.max(slice.lastIndexOf("}"), slice.lastIndexOf("]"));
  if (end < 0) throw new Error("שירות הזיהוי לא החזיר רשימת תחנות. נסו שוב.");
  let parsed: unknown;
  try {
    parsed = JSON.parse(slice.slice(0, end + 1));
  } catch {
    throw new Error("שירות הזיהוי החזיר תשובה לא קריאה. נסו שוב.");
  }
  const rows = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === "object" && Array.isArray((parsed as { stops?: unknown }).stops)
      ? (parsed as { stops: unknown[] }).stops
      : null;
  if (!rows) throw new Error("שירות הזיהוי לא החזיר רשימת תחנות. נסו שוב.");
  return rows
    .map((row, index) => normalizeModelStop(row, index))
    .filter((stop) => stop.address || stop.name);
}

function normalizeModelStop(row: unknown, index: number): StopDraft {
  const record = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
  const noteRaw = textField(record.note);
  const note = BARE_TIME.test(noteRaw) ? "" : noteRaw;
  const interpreted = interpretNote(note);
  return {
    id: `llm-${index + 1}`,
    name: textField(record.name),
    address: textField(record.address),
    note,
    when: interpreted.when,
    window: interpreted.window,
    contact: textField(record.contact),
    phone: textField(record.phone),
  };
}

function textField(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
