import { describe, expect, it } from "vitest";
import {
  fitMapView,
  markerCaption,
  project,
  routeOverlaySvg,
  tilesForView,
  type MapMarkerInput,
} from "@/lib/map-view";

const markers: MapMarkerInput[] = [
  { lat: 32.177, lng: 34.907, kind: "start", label: "S" },
  { lat: 32.176, lng: 34.908, kind: "stop", label: "1" },
  { lat: 32.183, lng: 34.866, kind: "stop", label: "2" },
  { lat: 32.167, lng: 34.841, kind: "stop", label: "3" },
  { lat: 32.093, lng: 34.866, kind: "stop", label: "4" },
  { lat: 32.327, lng: 34.861, kind: "stop", label: "5" },
  { lat: 32.177, lng: 34.907, kind: "end", label: "E" },
];

describe("map view", () => {
  it("fits the route inside the image with padding", () => {
    const view = fitMapView(markers);
    for (const marker of markers) {
      const point = project(marker, view);
      expect(point.x).toBeGreaterThan(24);
      expect(point.x).toBeLessThan(view.width - 24);
      expect(point.y).toBeGreaterThan(24);
      expect(point.y).toBeLessThan(view.height - 24);
    }
  });

  it("covers the image with a modest set of tiles", () => {
    const view = fitMapView(markers);
    const tiles = tilesForView(view);
    expect(tiles.length).toBeGreaterThan(0);
    expect(tiles.length).toBeLessThan(40);
    expect(tiles.every((tile) => tile.z === view.zoom)).toBe(true);
  });

  it("labels start, numbered stops, and end in the overlay", () => {
    const view = fitMapView(markers);
    const svg = routeOverlaySvg(view, markers, markers, { tilesAvailable: true });
    expect(markerCaption(markers[0])).toBe("S");
    expect(markerCaption(markers[6])).toBe("E");
    for (const number of ["1", "2", "3", "4", "5"]) {
      expect(svg).toContain(`>${number}<`);
    }
    expect(svg).toContain(">S<");
    expect(svg).toContain(">E<");
    expect(svg).toContain("יציאה");
    expect(svg).toContain("סיום");
  });

  it("separates markers that share the same place so every number stays visible", () => {
    const stacked: MapMarkerInput[] = [
      { lat: 32.17, lng: 34.9, kind: "start", label: "S" },
      { lat: 32.17, lng: 34.9, kind: "stop", label: "1" },
      { lat: 32.17, lng: 34.9, kind: "end", label: "E" },
    ];
    const view = fitMapView(stacked);
    const svg = routeOverlaySvg(view, stacked, stacked, { tilesAvailable: true });
    const circles = [...svg.matchAll(/cx="([0-9.]+)" cy="([0-9.]+)"/g)].map((match) => ({
      x: Number(match[1]),
      y: Number(match[2]),
    }));
    expect(circles).toHaveLength(3);
    for (let i = 0; i < circles.length; i += 1) {
      for (let j = i + 1; j < circles.length; j += 1) {
        const distance = Math.hypot(circles[i].x - circles[j].x, circles[i].y - circles[j].y);
        expect(distance).toBeGreaterThan(30);
      }
    }
  });
});
