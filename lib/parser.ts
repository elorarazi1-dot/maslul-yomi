import { containsCity } from "@/lib/cities";
import { extractPhones } from "@/lib/phone";
import type { StopDraft, TimeWindow, WhenHint } from "@/lib/types";
import { parseHHMM } from "@/lib/time";

const NOTE_HINT =
  /אחרי|לפני|בבוקר|בערב|בלילה|בצהר|אחה["״']?צ|אחר הצהריים|בסוף|מוקדם|מאוחר|להיכנס|להתקשר|לבקש|להביא|להמתין|לחכות|נא |בבקשה|קומה|מחסן|חני|הערה|החל|משעה|בשעה|פתוח|סגור|דקות/;

const CLOCK_LINE = /^\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?$/;

export function isNoteText(value: string): boolean {
  if (NOTE_HINT.test(value)) return true;
  if (/(?:^|\s)עד\s+\d/.test(value)) return true;
  if (/(?:^|\s)בין\s+\d/.test(value)) return true;
  return false;
}

export function stripMarginTimes(line: string): string {
  let text = line.trim();
  text = text.replace(/^\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?\s+/, "");
  if (!/(אחרי|לפני|עד\s+\d|בין\s+\d|בשעה|משעה|החל)/.test(text)) {
    text = text.replace(/(?:\s{2,}|\t+)\d{1,2}[:.]\d{2}(\s*[-–]\s*\d{1,2}[:.]\d{2})?\s*$/, "");
    text = text.replace(/\s+\d{1,2}[:.]\d{2}\s*$/, "");
  }
  return text.trim();
}

export function interpretNote(note: string): { when: WhenHint; window?: TimeWindow } {
  const window: TimeWindow = {};
  const between = note.match(
    /בין\s+(\d{1,2})[:.](\d{2})\s*(?:ל|עד|ו|-)\s*[-–]?\s*(\d{1,2})[:.](\d{2})/,
  );
  if (between) {
    window.from = clockToken(between[1], between[2]);
    window.to = clockToken(between[3], between[4]);
  } else {
    const after = note.match(/(?:רק\s+)?אחרי(?:\s+השעה)?\s*[:\-]?\s*(\d{1,2})[:.](\d{2})/);
    const before = note.match(/(?:עד|לפני)(?:\s+השעה)?\s*[:\-]?\s*(\d{1,2})[:.](\d{2})/);
    if (after) window.from = clockToken(after[1], after[2]);
    if (before) window.to = clockToken(before[1], before[2]);
  }

  let when: WhenHint = "";
  if (/בבוקר|מוקדם/.test(note)) when = "early";
  if (/בסוף היום|בסוף יום|בערב|בלילה|אחה["״']?צ|אחר הצהריים|מאוחר/.test(note)) when = "late";

  if (window.to && !window.from) {
    const mins = parseHHMM(window.to);
    if (mins != null && mins <= 12 * 60) when = "early";
  }
  if (window.from && !window.to) {
    const mins = parseHHMM(window.from);
    if (mins != null && mins >= 12 * 60) when = "late";
  }

  const hasWindow = Boolean(window.from || window.to);
  return { when, window: hasWindow ? window : undefined };
}

export function parseStopSheet(text: string): StopDraft[] {
  const blocks = splitBlocks(text);
  const stops: StopDraft[] = [];
  for (const block of blocks) {
    const stop = parseBlock(block);
    if (stop && (stop.address || stop.name)) stops.push(stop);
  }
  return stops.map((stop, index) => ({ ...stop, id: `parsed-${index + 1}` }));
}

function splitBlocks(text: string): string[] {
  const normalized = text
    .replace(/^\uFEFF/, "")
    .replace(/\r\n/g, "\n")
    .replace(/\u00a0/g, " ")
    .trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n[ \t]*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
  if (blocks.length > 1) return blocks;

  const lines = normalized
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const numbered = lines
    .map((line, index) => (/^\d{1,2}\s*[\.\)\-–]\s+\S/.test(line) ? index : -1))
    .filter((index) => index >= 0);
  if (numbered.length >= 2) {
    return numbered.map((start, index) => {
      const end = index + 1 < numbered.length ? numbered[index + 1] : lines.length;
      return lines.slice(start, end).join("\n");
    });
  }

  const cityLines = lines.filter((line) => containsCity(stripMarginTimes(line)));
  if (lines.length >= 2 && cityLines.length === lines.length) return lines;
  return [normalized];
}

function parseBlock(block: string): StopDraft | null {
  const phones = extractPhones(block);
  let text = block;
  for (const phone of [...phones].sort((a, b) => b.length - a.length)) {
    text = text.split(phone).join(" ");
  }

  let contact = "";
  text = text.replace(/איש\s*קשר\s*[:\-]?\s*([^\n,،]+)/g, (_full, name: string) => {
    const cleaned = cleanContact(name);
    if (cleaned && !contact) contact = cleaned;
    return " ";
  });
  text = text.replace(/טלפון\s*[:\-]?\s*/g, " ");

  const names: string[] = [];
  const addresses: string[] = [];
  const notes: string[] = [];

  for (const line of prepareLines(text)) {
    const parts = line.split(/\s+[—–]\s+|\s+-\s+/).map((part) => part.trim()).filter(Boolean);
    const segments = parts.length > 1 ? parts : [line];
    for (const segment of segments) consume(segment, names, addresses, notes);
  }

  const note = unique(notes).join("\n").trim();
  const bareTime = CLOCK_LINE.test(note);
  const cleanNote = bareTime ? "" : note;
  const interpreted = interpretNote(cleanNote);
  const name = names.join(" ").replace(/\s+/g, " ").trim();
  const address = addresses.join(", ").replace(/\s+/g, " ").trim();

  if (!name && !address) return null;

  return {
    id: "",
    name,
    address,
    note: cleanNote,
    when: interpreted.when,
    window: interpreted.window,
    contact,
    phone: phones.join(", "),
  };
}

function prepareLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .map((line) => line.replace(/^\d{1,2}\s*[\.\)\-–]\s+/, ""))
    .map((line) => stripMarginTimes(line))
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !CLOCK_LINE.test(line));
}

function consume(segment: string, names: string[], addresses: string[], notes: string[]) {
  const cleaned = segment.replace(/^[\s,،:\-–—]+|[\s,،:\-–—]+$/g, "").trim();
  if (!cleaned) return;
  const parts = cleaned
    .split(/\s*[,،]\s*/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length > 1) {
    const addressIndexes = parts
      .map((part, index) => (isAddressText(part) ? index : -1))
      .filter((index) => index >= 0);
    if (addressIndexes.length > 0) {
      const firstNote = parts.findIndex((part) => isNoteText(part));
      if (firstNote === -1) {
        for (const part of parts) consumeLeaf(part, names, addresses, notes);
        return;
      }
      const tailOk = parts.slice(firstNote).every((part) => !isAddressText(part) || isNoteText(part));
      if (tailOk && firstNote > 0) {
        for (const part of parts.slice(0, firstNote)) consumeLeaf(part, names, addresses, notes);
        notes.push(parts.slice(firstNote).join(", "));
        return;
      }
      for (const part of parts) {
        if (isNoteText(part)) notes.push(part);
        else consumeLeaf(part, names, addresses, notes);
      }
      return;
    }
  }

  if (isNoteText(cleaned)) {
    notes.push(cleaned);
    return;
  }
  consumeLeaf(cleaned, names, addresses, notes);
}

function consumeLeaf(part: string, names: string[], addresses: string[], notes: string[]) {
  const cleaned = part.trim();
  if (!cleaned) return;
  if (isNoteText(cleaned)) {
    notes.push(cleaned);
    return;
  }
  if (isAddressText(cleaned)) {
    addresses.push(cleaned);
    return;
  }
  if (isNameText(cleaned)) {
    names.push(cleaned);
    return;
  }
  notes.push(cleaned);
}

function isAddressText(value: string): boolean {
  if (isNoteText(value)) return false;
  if (containsCity(value)) return true;
  if (/(רחוב|רח['׳]|שדרות|שד['׳]|דרך|סמטה|כיכר)/.test(value)) return true;
  if (/[א-ת][א-ת"'׳״\-]*\s+\d{1,4}/.test(value)) return true;
  return false;
}

function isNameText(value: string): boolean {
  if (/\d/.test(value) || value.length > 40) return false;
  const words = value.split(/\s+/).filter(Boolean);
  if (words.length === 0 || words.length > 4) return false;
  return words.every((word) => /^[א-ת][א-ת"'׳״\-]*$/.test(word));
}

function cleanContact(raw: string): string {
  const withoutDigits = raw.replace(/[0-9+]/g, " ").replace(/[-–]/g, " ");
  const cut = withoutDigits.split(/בבוקר|בערב|אחרי|עד|לפני/)[0] ?? withoutDigits;
  return cut
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => /^[א-ת][א-ת"'׳״\-]*$/.test(word))
    .slice(0, 3)
    .join(" ");
}

function clockToken(hours: string, minutes: string): string {
  const hh = Math.min(23, Number(hours));
  const mm = Math.min(59, Number(minutes));
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

function unique(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const key = value.trim();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(key);
  }
  return out;
}
