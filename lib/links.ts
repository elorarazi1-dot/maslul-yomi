import type { LatLng } from "@/lib/types";

const MAX_POINTS = 11;

function coord(point: LatLng): string {
  return `${round6(point.lat)},${round6(point.lng)}`;
}

function round6(value: number): string {
  return String(Math.round(value * 1e6) / 1e6);
}

export function googleMapsLinks(points: LatLng[]): string[] {
  if (points.length < 2) return [];
  const links: string[] = [];
  let start = 0;
  while (start < points.length - 1) {
    const end = Math.min(start + MAX_POINTS - 1, points.length - 1);
    links.push(buildGoogleLink(points.slice(start, end + 1)));
    if (end === points.length - 1) break;
    start = end;
  }
  return links;
}

function buildGoogleLink(points: LatLng[]): string {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("travelmode", "driving");
  url.searchParams.set("origin", coord(points[0]));
  url.searchParams.set("destination", coord(points[points.length - 1]));
  const waypoints = points.slice(1, -1).map(coord).join("|");
  if (waypoints) url.searchParams.set("waypoints", waypoints);
  return url.toString();
}

export function wazeLink(stop: {
  lat: number | null;
  lng: number | null;
  address: string;
  name?: string;
}): string {
  if (stop.lat != null && stop.lng != null) {
    return `https://waze.com/ul?ll=${round6(stop.lat)},${round6(stop.lng)}&navigate=yes`;
  }
  const query = stop.address || stop.name || "";
  return `https://waze.com/ul?q=${encodeURIComponent(query)}&navigate=yes`;
}

export function formatAddressList(stops: { address: string; name: string }[]): string {
  return stops.map((stop, index) => `${index + 1}. ${stop.address || stop.name}`).join("\n");
}
