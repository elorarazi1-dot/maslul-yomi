import { routeGeometry } from "@/lib/matrix";
import {
  MAP_HEIGHT,
  MAP_WIDTH,
  TILE_SIZE,
  fitMapView,
  routeOverlaySvg,
  tilesForView,
  type MapMarkerInput,
  type MapPoint,
  type TileRef,
} from "@/lib/map-view";

const TILE_CACHE_LIMIT = 160;
const tileCache = new Map<string, Buffer>();

export interface MapImageInput {
  markers: MapMarkerInput[];
  polyline?: Array<[number, number] | MapPoint>;
}

export async function resolveMapPolyline(
  markers: MapPoint[],
  provided?: [number, number][],
): Promise<[number, number][]> {
  if (markers.length >= 2 && process.env.ORS_API_KEY?.trim()) {
    const geometry = await routeGeometry(markers);
    if (geometry.source === "openrouteservice" && geometry.polyline.length > 1) return geometry.polyline;
  }
  if (provided && provided.length > 1) return provided;
  return markers.map((point) => [point.lat, point.lng]);
}

export async function renderRouteMapPng(
  input: MapImageInput,
  options?: { fetchTile?: (tile: TileRef) => Promise<Buffer | null> },
): Promise<Buffer> {
  const markers = input.markers.filter((marker) => Number.isFinite(marker.lat) && Number.isFinite(marker.lng));
  const provided = normalizePolyline(input.polyline);
  const polylinePoints = (provided ?? markers).map(asPoint);
  const view = fitMapView([...polylinePoints, ...markers], MAP_WIDTH, MAP_HEIGHT);
  const tiles = tilesForView(view);
  const fetchTile = options?.fetchTile ?? fetchCachedTile;
  const placed: { input: Buffer; left: number; top: number }[] = [];
  let tilesAvailable = false;

  await runPool(tiles, 4, async (tile) => {
    const buffer = await fetchTile(tile).catch(() => null);
    if (!buffer) return;
    const layer = await cropTile(buffer, tile.left, tile.top, view.width, view.height);
    if (!layer) return;
    tilesAvailable = true;
    placed.push(layer);
  });

  const sharp = (await import("sharp")).default;
  const svg = routeOverlaySvg(view, polylinePoints, markers, { tilesAvailable });
  return sharp({
    create: {
      width: view.width,
      height: view.height,
      channels: 3,
      background: tilesAvailable ? "#d5e3ef" : "#efe6d4",
    },
  })
    .composite([...placed, { input: Buffer.from(svg), left: 0, top: 0 }])
    .png()
    .toBuffer();
}

function asPoint(point: [number, number] | MapPoint): MapPoint {
  if (Array.isArray(point)) return { lat: point[0], lng: point[1] };
  return point;
}

export function normalizePolyline(value: MapImageInput["polyline"]): [number, number][] | undefined {
  if (!value?.length) return undefined;
  const points: [number, number][] = [];
  for (const item of value) {
    if (Array.isArray(item) && item.length >= 2 && Number.isFinite(item[0]) && Number.isFinite(item[1])) {
      points.push([item[0], item[1]]);
    } else if (!Array.isArray(item) && Number.isFinite(item.lat) && Number.isFinite(item.lng)) {
      points.push([item.lat, item.lng]);
    }
  }
  return points.length > 1 ? points : undefined;
}

async function cropTile(
  buffer: Buffer,
  left: number,
  top: number,
  width: number,
  height: number,
): Promise<{ input: Buffer; left: number; top: number } | null> {
  const sharp = (await import("sharp")).default;
  const metadata = await sharp(buffer).metadata();
  const tileWidth = metadata.width ?? TILE_SIZE;
  const tileHeight = metadata.height ?? TILE_SIZE;
  let sourceLeft = 0;
  let sourceTop = 0;
  let sourceWidth = tileWidth;
  let sourceHeight = tileHeight;
  let destLeft = left;
  let destTop = top;
  if (destLeft < 0) {
    sourceLeft = -destLeft;
    sourceWidth -= sourceLeft;
    destLeft = 0;
  }
  if (destTop < 0) {
    sourceTop = -destTop;
    sourceHeight -= sourceTop;
    destTop = 0;
  }
  if (destLeft + sourceWidth > width) sourceWidth = width - destLeft;
  if (destTop + sourceHeight > height) sourceHeight = height - destTop;
  sourceLeft = Math.round(sourceLeft);
  sourceTop = Math.round(sourceTop);
  sourceWidth = Math.round(sourceWidth);
  sourceHeight = Math.round(sourceHeight);
  destLeft = Math.round(destLeft);
  destTop = Math.round(destTop);
  if (sourceWidth <= 0 || sourceHeight <= 0) return null;
  if (sourceLeft === 0 && sourceTop === 0 && sourceWidth === tileWidth && sourceHeight === tileHeight) {
    return { input: buffer, left: destLeft, top: destTop };
  }
  const cropped = await sharp(buffer)
    .extract({ left: sourceLeft, top: sourceTop, width: sourceWidth, height: sourceHeight })
    .png()
    .toBuffer();
  return { input: cropped, left: destLeft, top: destTop };
}

async function fetchCachedTile(tile: TileRef): Promise<Buffer | null> {
  const key = `${tile.z}/${tile.x}/${tile.y}`;
  const cached = tileCache.get(key);
  if (cached) return cached;
  const urls = [
    `https://tile.openstreetmap.org/${tile.z}/${tile.x}/${tile.y}.png`,
    `https://basemaps.cartocdn.com/rastertiles/voyager/${tile.z}/${tile.x}/${tile.y}.png`,
  ];
  for (const url of urls) {
    try {
      const response = await fetch(url, {
        headers: { "User-Agent": "MaslulYomi/1.0 (Hebrew route planner; static map)", Accept: "image/png" },
        signal: AbortSignal.timeout(8000),
      });
      if (!response.ok) continue;
      const type = response.headers.get("content-type") ?? "";
      if (!type.includes("image")) continue;
      const buffer = Buffer.from(await response.arrayBuffer());
      // Carto serves a tiny watermark PNG when no API key is configured.
      if (buffer.length < 4096) continue;
      rememberTile(key, buffer);
      return buffer;
    } catch {
      continue;
    }
  }
  return null;
}

function rememberTile(key: string, buffer: Buffer) {
  if (tileCache.has(key)) tileCache.delete(key);
  tileCache.set(key, buffer);
  while (tileCache.size > TILE_CACHE_LIMIT) {
    const oldest = tileCache.keys().next().value;
    if (!oldest) break;
    tileCache.delete(oldest);
  }
}

async function runPool<T>(items: T[], size: number, task: (item: T) => Promise<void>) {
  const queue = items.slice();
  const workers = Array.from({ length: Math.min(size, Math.max(1, items.length)) }, async () => {
    while (queue.length) {
      const item = queue.shift();
      if (!item) return;
      await task(item);
    }
  });
  await Promise.all(workers);
}
