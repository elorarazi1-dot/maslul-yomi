const PHONE_RE = /(?:\+972[\s\-]?|0)(?:[\s\-]?\d){8,9}/g;

export function extractPhones(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(PHONE_RE)) {
    const raw = match[0].trim();
    const digits = raw.replace(/\D/g, "");
    if (/^0\d{8,9}$/.test(digits) || /^972\d{8,9}$/.test(digits)) found.push(raw);
  }
  return [...new Set(found)];
}

export function phoneToTel(phone: string): string {
  const trimmed = phone.trim();
  const first = trimmed.split(/[,،]/)[0] ?? trimmed;
  return first.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

export function splitPhones(phone: string): string[] {
  return phone
    .split(/[,،]/)
    .map((part) => part.trim())
    .filter(Boolean);
}
