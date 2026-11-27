export interface KnownPlace {
  lat: number;
  lng: number;
  label: string;
}

const RAW_KNOWN: Record<string, KnownPlace> = {
  "כפר סבא": { lat: 32.1773471, lng: 34.907459, label: "כפר סבא" },
  "רחוב ויצמן 52, כפר סבא": {
    lat: 32.1755487,
    lng: 34.9071512,
    label: "ויצמן, כפר סבא",
  },
  "רחוב אחוזה 126, רעננה": {
    lat: 32.1825932,
    lng: 34.8655222,
    label: "אחוזה, רעננה",
  },
  "רחוב סוקולוב 18, הרצליה": {
    lat: 32.1670612,
    lng: 34.8412099,
    label: "סוקולוב 18, הרצליה",
  },
  "ז'בוטינסקי 72, פתח תקווה": {
    lat: 32.0933199,
    lng: 34.8655119,
    label: "ז'בוטינסקי 72, פתח תקווה",
  },
  "רחוב הרצל 48, נתניה": {
    lat: 32.3274681,
    lng: 34.8606353,
    label: "הרצל, נתניה",
  },
};

const KNOWN = new Map<string, KnownPlace>(
  Object.entries(RAW_KNOWN).map(([address, place]) => [normalizeAddress(address), place]),
);

export function normalizeAddress(input: string): string {
  return input
    .replace(/[\u05F3\u2019\u2018\u02BC]/g, "'")
    .replace(/[\u05F4\u201C\u201D]/g, '"')
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .trim()
    .toLowerCase();
}

export function lookupKnown(address: string): KnownPlace | null {
  return KNOWN.get(normalizeAddress(address)) ?? null;
}

export function addressQueries(address: string): string[] {
  const full = address.replace(/\s+/g, " ").trim();
  const noPrefix = full.replace(/(^|,\s*)(?:רחוב|שדרות|דרך)\s+/g, "$1").trim();
  const noNumber = noPrefix.replace(/(\D)\s+\d{1,4}[א-ת]?(?=\s*,|\s*$)/g, "$1").trim();
  const queries: string[] = [];
  for (const query of [full, noPrefix, noNumber]) {
    const cleaned = query.replace(/\s+,/g, ",").replace(/\s+/g, " ").trim();
    if (cleaned && !queries.includes(cleaned)) queries.push(cleaned);
  }
  return queries;
}

export interface ClassifiedGeo {
  status: "ok" | "ambiguous" | "missing";
  lat: number | null;
  lng: number | null;
  label: string;
  candidates: { lat: number; lng: number; label: string }[];
}

export function classifyResults(
  results: { lat: number; lng: number; label: string; importance?: number }[],
  inIsrael: (point: { lat: number; lng: number }) => boolean,
  distanceKm: (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => number,
): ClassifiedGeo {
  const inside = results.filter((result) => inIsrael(result));
  if (inside.length === 0) {
    return { status: "missing", lat: null, lng: null, label: "", candidates: [] };
  }
  const candidates = inside.slice(0, 5).map(({ lat, lng, label }) => ({ lat, lng, label }));
  if (inside.length === 1) {
    return { status: "ok", lat: inside[0].lat, lng: inside[0].lng, label: inside[0].label, candidates };
  }
  const gap = (inside[0].importance ?? 0.5) - (inside[1].importance ?? 0.5);
  const apart = distanceKm(inside[0], inside[1]) > 2;
  if (apart && gap < 0.2) {
    return { status: "ambiguous", lat: null, lng: null, label: "", candidates };
  }
  return {
    status: "ok",
    lat: inside[0].lat,
    lng: inside[0].lng,
    label: inside[0].label,
    candidates,
  };
}
