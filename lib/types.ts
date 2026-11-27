export type WhenHint = "early" | "late" | "";

export interface TimeWindow {
  from?: string;
  to?: string;
}

export interface LatLng {
  lat: number;
  lng: number;
}

export interface StopDraft {
  id: string;
  name: string;
  address: string;
  note: string;
  when: WhenHint;
  window?: TimeWindow;
  contact: string;
  phone: string;
}

export type GeoStatus = "ok" | "ambiguous" | "missing";

export interface GeoCandidate extends LatLng {
  label: string;
}

export interface StopLocation extends StopDraft {
  lat: number | null;
  lng: number | null;
  geoStatus: GeoStatus;
  geoLabel?: string;
  candidates: GeoCandidate[];
}

export interface PlaceFix {
  label: string;
  lat: number | null;
  lng: number | null;
  geoStatus: GeoStatus;
  resolvedLabel?: string;
  candidates: GeoCandidate[];
}

export interface ReviewPayload {
  stops: StopLocation[];
  start: PlaceFix;
  end: PlaceFix;
  warnings: string[];
  extractor: "heuristic" | "llm";
}

export interface LegView {
  minutes: number;
  km: number;
  eta: string;
  /** Minutes spent waiting because the driver arrived before the note window opened. */
  waitMinutes: number;
}

export interface Evaluation {
  legs: LegView[];
  totalMinutes: number;
  totalKm: number;
  finishEta: string;
  finishMinutes: number;
  arrivals: number[];
  warnings: string[];
}

export interface Endpoint extends LatLng {
  label: string;
  resolvedLabel?: string;
}

export type DistanceSource = "openrouteservice" | "estimate";
export type GeometrySource = "openrouteservice" | "straight";
export type SolverName = "exact" | "heuristic";

export interface RouteStop extends StopDraft {
  lat: number;
  lng: number;
}

export interface RouteRecord {
  id: string;
  createdAt: string;
  updatedAt: string;
  departureTime: string;
  dwellMinutes: number;
  start: Endpoint;
  end: Endpoint;
  stops: RouteStop[];
  order: number[];
  legs: LegView[];
  totalMinutes: number;
  totalKm: number;
  finishEta: string;
  warnings: string[];
  explanation: string;
  distanceSource: DistanceSource;
  geometrySource: GeometrySource;
  solver: SolverName;
  manual: boolean;
  polyline: [number, number][];
  durationsMin: number[][];
  distancesKm: number[][];
}

export interface RouteSummary {
  id: string;
  createdAt: string;
  updatedAt: string;
  departureTime: string;
  startLabel: string;
  endLabel: string;
  stopCount: number;
  totalKm: number;
  totalMinutes: number;
  finishEta: string;
}
