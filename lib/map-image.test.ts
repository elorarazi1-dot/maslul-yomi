import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { renderRouteMapPng, resolveMapPolyline } from "@/lib/map-image";
import type { MapMarkerInput } from "@/lib/map-view";

const markers: MapMarkerInput[] = [
  { lat: 32.177, lng: 34.907, kind: "start", label: "S" },
  { lat: 32.184, lng: 34.87, kind: "stop", label: "1" },
  { lat: 32.166, lng: 34.843, kind: "stop", label: "2" },
  { lat: 32.177, lng: 34.907, kind: "end", label: "E" },
];

const polyline: [number, number][] = markers.map((marker) => [marker.lat, marker.lng]);

async function tinyTile(color: { r: number; g: number; b: number }): Promise<Buffer> {
  return sharp({
    create: { width: 256, height: 256, channels: 3, background: color },
  })
    .png()
    .toBuffer();
}

describe("map image", () => {
  it("returns a PNG with numbered stops when tiles are available", async () => {
    const png = await renderRouteMapPng(
      { markers, polyline },
      { fetchTile: async () => tinyTile({ r: 214, g: 226, b: 214 }) },
    );
    expect(png.subarray(0, 8)).toEqual(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(960);
    expect(metadata.height).toBe(1200);
  });

  it("still returns a PNG when every tile request fails", async () => {
    const png = await renderRouteMapPng(
      { markers, polyline },
      { fetchTile: async () => null },
    );
    expect(png.subarray(0, 4)).toEqual(Buffer.from([137, 80, 78, 71]));
    const metadata = await sharp(png).metadata();
    expect(metadata.format).toBe("png");
    expect(metadata.width).toBe(960);
  });

  it("uses the supplied polyline when OpenRouteService is not configured", async () => {
    const previous = process.env.ORS_API_KEY;
    delete process.env.ORS_API_KEY;
    const provided: [number, number][] = [
      [32.1, 34.8],
      [32.2, 34.85],
      [32.3, 34.9],
    ];
    await expect(resolveMapPolyline(markers, provided)).resolves.toEqual(provided);
    await expect(resolveMapPolyline(markers)).resolves.toEqual([
      [32.177, 34.907],
      [32.184, 34.87],
      [32.166, 34.843],
      [32.177, 34.907],
    ]);
    if (previous == null) delete process.env.ORS_API_KEY;
    else process.env.ORS_API_KEY = previous;
  });
});
