import { addressQueries, classifyResults, lookupKnown, normalizeAddress } from "@/lib/address";
import { haversineKm, inIsrael } from "@/lib/geo";
import type { GeoCandidate, LatLng } from "@/lib/types";

interface StoredGeo {
  status: "ok" | "ambiguous" | "missing";
  lat: number | null;
  lng: number | null;
  label: string;
  candidates: { lat: number; lng: number; label: string }[];
}

export interface GeocodeOutcome extends StoredGeo {
  source: "confirmed" | "cache" | "known" | "nominatim" | "google" | "none";
}

const memoryCache = new Map<string, StoredGeo>();
const confirmedCache = new Map<string, StoredGeo>();

function getGeocodeCache(key: string): StoredGeo | null {
  return memoryCache.get(key) ?? null;
}

function setGeocodeCache(key: string, value: StoredGeo): void {
  memoryCache.set(key, value);
}

function getConfirmed(key: string): StoredGeo | null {
  return confirmedCache.get(key) ?? null;
}

function setConfirmed(key: string, value: StoredGeo): void {
  confirmedCache.set(key, value);
}

let nominatimChain: Promise<unknown> = Promise.resolve();

function nominatimSlot<T>(task: () => Promise<T>): Promise<T> {
  const run = nominatimChain.then(async () => {
    try {
      return await task();
    } finally {
      await delay(1100);
    }
  });
  nominatimChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export async function geocodeAddress(
  address: string,
  options?: { hint?: LatLng; refresh?: boolean },
): Promise<GeocodeOutcome> {
  const query = address.trim();
  if (!query) return empty("none");
  const key = normalizeAddress(query);

  const confirmed = getConfirmed(key);
  if (confirmed?.status === "ok" && confirmed.lat != null && confirmed.lng != null) {
    return { ...confirmed, source: "confirmed" };
  }
  if (!options?.refresh) {
    const cached = getGeocodeCache(key);
    if (cached) return { ...cached, source: "cache" };
  }

  const known = lookupKnown(query);
  if (known) {
    const outcome = outcomeFromKnown(known);
    setGeocodeCache(key, outcome);
    return outcome;
  }

  try {
    const live = process.env.GOOGLE_MAPS_API_KEY?.trim()
      ? await geocodeGoogle(query)
      : await geocodeNominatim(query, options?.hint);
    if (live.status !== "missing") {
      setGeocodeCache(key, live);
      return live;
    }
  } catch (error) {
    console.error("geocode failed", error instanceof Error ? error.message : error);
  }

  return empty("none");
}

export async function geocodeMany(addresses: string[], hint?: LatLng): Promise<GeocodeOutcome[]> {
  if (process.env.GOOGLE_MAPS_API_KEY?.trim()) {
    const results = new Array<GeocodeOutcome>(addresses.length);
    const queue = addresses.map((address, index) => ({ address, index }));
    const workers = Array.from({ length: Math.min(4, Math.max(1, addresses.length)) }, async () => {
      while (queue.length) {
        const item = queue.shift();
        if (!item) return;
        results[item.index] = await geocodeAddress(item.address, { hint });
      }
    });
    await Promise.all(workers);
    return results;
  }
  const results: GeocodeOutcome[] = [];
  for (const address of addresses) results.push(await geocodeAddress(address, { hint }));
  return results;
}

export async function confirmAddress(
  address: string,
  chosen: { lat: number; lng: number; label?: string },
): Promise<void> {
  const key = normalizeAddress(address);
  if (!key || !Number.isFinite(chosen.lat) || !Number.isFinite(chosen.lng)) return;
  const stored: StoredGeo = {
    status: "ok",
    lat: chosen.lat,
    lng: chosen.lng,
    label: chosen.label || address,
    candidates: [{ lat: chosen.lat, lng: chosen.lng, label: chosen.label || address }],
  };
  setConfirmed(key, stored);
  setGeocodeCache(key, stored);
}

async function geocodeNominatim(address: string, hint?: LatLng): Promise<GeocodeOutcome> {
  let last = empty("nominatim");
  for (const query of addressQueries(address)) {
    const results = await nominatimSlot(() => nominatimSearch(query, hint));
    const classified = classifyResults(results, inIsrael, haversineKm);
    const outcome: GeocodeOutcome = { ...classified, source: "nominatim" };
    if (classified.status !== "missing") return outcome;
    last = outcome;
  }
  return last;
}

async function nominatimSearch(query: string, hint?: LatLng) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("q", query);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("countrycodes", "il");
  url.searchParams.set("limit", "5");
  url.searchParams.set("accept-language", "he");
  if (hint) {
    const delta = 0.35;
    url.searchParams.set(
      "viewbox",
      `${hint.lng - delta},${hint.lat + delta},${hint.lng + delta},${hint.lat - delta}`,
    );
    url.searchParams.set("bounded", "0");
  }
  const response = await fetch(url, {
    headers: {
      "User-Agent": "MaslulYomi/1.0 (Hebrew daily route planner)",
      "Accept-Language": "he",
    },
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new Error(`Nominatim ${response.status}`);
  const data = (await response.json()) as {
    lat: string;
    lon: string;
    display_name?: string;
    importance?: number;
  }[];
  return data.map((item) => ({
    lat: Number(item.lat),
    lng: Number(item.lon),
    label: item.display_name || query,
    importance: item.importance,
  }));
}

async function geocodeGoogle(address: string): Promise<GeocodeOutcome> {
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim() ?? "";
  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", address);
  url.searchParams.set("components", "country:IL");
  url.searchParams.set("language", "he");
  url.searchParams.set("region", "il");
  url.searchParams.set("key", key);
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`Google geocoding ${response.status}`);
  const data = (await response.json()) as {
    status: string;
    results?: {
      formatted_address: string;
      geometry: { location: { lat: number; lng: number }; location_type?: string };
    }[];
  };
  if (data.status === "ZERO_RESULTS" || !data.results?.length) return empty("google");
  if (data.status !== "OK") throw new Error(`Google geocoding ${data.status}`);
  const results = data.results.map((result) => ({
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    label: result.formatted_address,
    importance:
      result.geometry.location_type === "ROOFTOP"
        ? 1
        : result.geometry.location_type === "RANGE_INTERPOLATED"
          ? 0.8
          : 0.4,
  }));
  return { ...classifyResults(results, inIsrael, haversineKm), source: "google" };
}

function outcomeFromKnown(known: { lat: number; lng: number; label: string }): GeocodeOutcome {
  const candidate: GeoCandidate = { lat: known.lat, lng: known.lng, label: known.label };
  return {
    status: "ok",
    lat: known.lat,
    lng: known.lng,
    label: known.label,
    candidates: [candidate],
    source: "known",
  };
}

function empty(source: GeocodeOutcome["source"]): GeocodeOutcome {
  return { status: "missing", lat: null, lng: null, label: "", candidates: [], source };
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
