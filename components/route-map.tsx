"use client";

import { useEffect, useRef, useState } from "react";
import { useTheme } from "next-themes";
import type { Map as LeafletMap, TileLayer } from "leaflet";
import "leaflet/dist/leaflet.css";
import type { LatLng } from "@/lib/types";

export interface MapMarker {
  lat: number;
  lng: number;
  kind: "start" | "stop" | "end";
  label: string;
  title: string;
}

const LIGHT = "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";
const DARK = "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";
const ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; CARTO';

export function RouteMap({
  markers,
  polyline,
  className,
}: {
  markers: MapMarker[];
  polyline: [number, number][];
  className?: string;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "dark" : "light";
  const host = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const tilesRef = useRef<TileLayer | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const hostNode = host.current;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostNode || mapRef.current) return;
      const map = L.map(hostNode, { zoomControl: true, attributionControl: true });
      mapRef.current = map;
      map.setView([32.08, 34.9], 9);
      setReady(true);
      window.setTimeout(() => map.invalidateSize(), 60);
    })();
    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      tilesRef.current = null;
      setReady(false);
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      const L = await import("leaflet");
      const map = mapRef.current;
      if (cancelled || !map) return;
      tilesRef.current?.remove();
      tilesRef.current = L.tileLayer(theme === "dark" ? DARK : LIGHT, {
        attribution: ATTRIBUTION,
        maxZoom: 19,
      }).addTo(map);
      map.eachLayer((layer) => {
        if (layer !== tilesRef.current) map.removeLayer(layer);
      });
      if (polyline.length > 1) {
        L.polyline(polyline, {
          color: theme === "dark" ? "#3dba9a" : "#0f6e56",
          weight: 5,
          opacity: 0.92,
        }).addTo(map);
      }
      for (const marker of markers) {
        const icon = L.divIcon({
          className: "route-pin",
          html: pinHtml(marker),
          iconSize: [36, 36],
          iconAnchor: [18, 18],
        });
        L.marker([marker.lat, marker.lng], { icon, title: marker.title, keyboard: true }).addTo(map);
      }
      if (markers.length) {
        const bounds = L.latLngBounds(markers.map((marker) => [marker.lat, marker.lng] as [number, number]));
        map.fitBounds(bounds.pad(0.25), { animate: false });
      }
      window.setTimeout(() => map.invalidateSize(), 80);
    })();
    return () => {
      cancelled = true;
    };
  }, [markers, polyline, ready, theme]);

  return (
    <div className={className} dir="ltr">
      <div ref={host} className="h-full min-h-72 overflow-hidden rounded-2xl border border-line" />
    </div>
  );
}

export function PinMap({
  center,
  value,
  onPick,
}: {
  center: LatLng;
  value: LatLng | null;
  onPick: (point: LatLng) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const onPickRef = useRef(onPick);
  const initial = useRef(value);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    let map: LeafletMap | null = null;
    let cancelled = false;
    const hostNode = host.current;
    (async () => {
      const L = await import("leaflet");
      if (cancelled || !hostNode) return;
      const start = initial.current;
      map = L.map(hostNode, { zoomControl: true }).setView([center.lat, center.lng], start ? 14 : 10);
      L.tileLayer(LIGHT, { attribution: ATTRIBUTION, maxZoom: 19 }).addTo(map);
      let marker = start ? L.marker([start.lat, start.lng]).addTo(map) : null;
      map.on("click", (event) => {
        const point = { lat: event.latlng.lat, lng: event.latlng.lng };
        marker?.remove();
        marker = L.marker([point.lat, point.lng]).addTo(map!);
        onPickRef.current(point);
      });
      window.setTimeout(() => map?.invalidateSize(), 180);
    })();
    return () => {
      cancelled = true;
      map?.remove();
    };
  }, [center.lat, center.lng]);

  return (
    <div dir="ltr" className="h-72 overflow-hidden rounded-2xl border border-line">
      <div ref={host} className="h-full" />
    </div>
  );
}

function pinHtml(marker: MapMarker): string {
  const background = marker.kind === "end" ? "#c4232a" : marker.kind === "start" ? "#0f6e56" : "#1c1915";
  const label = marker.kind === "start" ? "S" : marker.kind === "end" ? "E" : marker.label;
  return `<div style="display:grid;place-items:center;width:36px;height:36px;border-radius:999px;background:${background};color:white;font-weight:700;border:2px solid white;box-shadow:0 2px 8px rgba(0,0,0,.3)">${label}</div>`;
}
