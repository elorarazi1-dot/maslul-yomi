export const TILE_SIZE = 256;
export const MAP_WIDTH = 960;
export const MAP_HEIGHT = 1200;
export const MAP_PADDING = 72;

export interface MapPoint {
  lat: number;
  lng: number;
}

export interface MapMarkerInput extends MapPoint {
  kind: "start" | "stop" | "end";
  label: string;
}

export interface MapView {
  zoom: number;
  width: number;
  height: number;
  originX: number;
  originY: number;
}

export interface TileRef {
  z: number;
  x: number;
  y: number;
  left: number;
  top: number;
}

export function worldPixel(lat: number, lng: number, zoom: number): { x: number; y: number } {
  const scale = TILE_SIZE * 2 ** zoom;
  const x = ((lng + 180) / 360) * scale;
  const latRad = (lat * Math.PI) / 180;
  const sin = Math.sin(latRad);
  const y = (0.5 - Math.log((1 + sin) / (1 - sin)) / (4 * Math.PI)) * scale;
  return { x, y };
}

export function fitMapView(
  points: MapPoint[],
  width = MAP_WIDTH,
  height = MAP_HEIGHT,
  padding = MAP_PADDING,
): MapView {
  if (points.length === 0) {
    const center = worldPixel(32.08, 34.9, 8);
    return { zoom: 8, width, height, originX: center.x - width / 2, originY: center.y - height / 2 };
  }

  let minLat = Infinity;
  let maxLat = -Infinity;
  let minLng = Infinity;
  let maxLng = -Infinity;
  for (const point of points) {
    minLat = Math.min(minLat, point.lat);
    maxLat = Math.max(maxLat, point.lat);
    minLng = Math.min(minLng, point.lng);
    maxLng = Math.max(maxLng, point.lng);
  }
  const latPad = Math.max((maxLat - minLat) * 0.14, 0.01);
  const lngPad = Math.max((maxLng - minLng) * 0.14, 0.01);
  minLat -= latPad;
  maxLat += latPad;
  minLng -= lngPad;
  maxLng += lngPad;

  let zoom = 6;
  for (let candidate = 16; candidate >= 6; candidate -= 1) {
    const northWest = worldPixel(maxLat, minLng, candidate);
    const southEast = worldPixel(minLat, maxLng, candidate);
    const fits =
      southEast.x - northWest.x <= width - padding * 2 &&
      southEast.y - northWest.y <= height - padding * 2;
    if (fits) {
      zoom = candidate;
      break;
    }
  }

  const northWest = worldPixel(maxLat, minLng, zoom);
  const southEast = worldPixel(minLat, maxLng, zoom);
  return {
    zoom,
    width,
    height,
    originX: (northWest.x + southEast.x) / 2 - width / 2,
    originY: (northWest.y + southEast.y) / 2 - height / 2,
  };
}

export function project(point: MapPoint, view: MapView): { x: number; y: number } {
  const world = worldPixel(point.lat, point.lng, view.zoom);
  return { x: world.x - view.originX, y: world.y - view.originY };
}

export function tilesForView(view: MapView): TileRef[] {
  const x0 = Math.floor(view.originX / TILE_SIZE);
  const y0 = Math.floor(view.originY / TILE_SIZE);
  const x1 = Math.floor((view.originX + view.width - 1) / TILE_SIZE);
  const y1 = Math.floor((view.originY + view.height - 1) / TILE_SIZE);
  const limit = 2 ** view.zoom;
  const tiles: TileRef[] = [];
  for (let x = x0; x <= x1; x += 1) {
    for (let y = y0; y <= y1; y += 1) {
      if (x < 0 || y < 0 || x >= limit || y >= limit) continue;
      tiles.push({
        z: view.zoom,
        x,
        y,
        left: x * TILE_SIZE - view.originX,
        top: y * TILE_SIZE - view.originY,
      });
    }
  }
  return tiles;
}

export function markerCaption(marker: MapMarkerInput): string {
  if (marker.kind === "start") return "S";
  if (marker.kind === "end") return "E";
  return marker.label;
}

export function routeOverlaySvg(
  view: MapView,
  polyline: MapPoint[],
  markers: MapMarkerInput[],
  options?: { tilesAvailable?: boolean },
): string {
  const line = polyline
    .map((point) => project(point, view))
    .map((point) => `${point.x.toFixed(1)},${point.y.toFixed(1)}`)
    .join(" ");
  const placed: { x: number; y: number }[] = [];
  const pins = markers
    .map((marker) => {
      const point = separatePin(project(marker, view), placed);
      placed.push(point);
      const fill = marker.kind === "end" ? "#c4232a" : marker.kind === "start" ? "#0f6e56" : "#1c1915";
      const caption = escapeXml(markerCaption(marker));
      return `<g>
        <circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="18" fill="${fill}" stroke="#ffffff" stroke-width="3"/>
        <text x="${point.x.toFixed(1)}" y="${(point.y + 5).toFixed(1)}" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" font-weight="700" fill="#ffffff">${caption}</text>
      </g>`;
    })
    .join("");
  const notice = options?.tilesAvailable
    ? ""
    : `<text x="16" y="28" font-family="Arial, sans-serif" font-size="16" font-weight="700" fill="#1c1915">אריחי המפה לא זמינים. מוצג תוואי המסלול.</text>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${view.width}" height="${view.height}">
    ${line ? `<polyline points="${line}" fill="none" stroke="#ffffff" stroke-width="10" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${line ? `<polyline points="${line}" fill="none" stroke="#0f6e56" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"/>` : ""}
    ${pins}
    ${notice}
    <text x="16" y="${view.height - 16}" font-family="Arial, sans-serif" font-size="13" fill="#1c1915">© OpenStreetMap · S יציאה · E סיום</text>
  </svg>`;
}

function separatePin(point: { x: number; y: number }, placed: { x: number; y: number }[]): { x: number; y: number } {
  let next = point;
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const crowded = placed.some((other) => Math.hypot(other.x - next.x, other.y - next.y) < 40);
    if (!crowded) return next;
    const angle = attempt * 0.9;
    next = { x: point.x + Math.cos(angle) * (42 + attempt * 4), y: point.y + Math.sin(angle) * (42 + attempt * 4) };
  }
  return next;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
