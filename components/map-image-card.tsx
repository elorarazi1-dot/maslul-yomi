"use client";

import { Download, Share2 } from "lucide-react";
import { useEffect, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import type { MapMarker } from "@/components/route-map";
import { Button } from "@/components/ui/button";

export function MapImageCard({
  markers,
  polyline,
}: {
  markers: MapMarker[];
  polyline: [number, number][];
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const markerKey = markers.map((marker) => `${marker.kind}:${marker.label}:${marker.lat}:${marker.lng}`).join("|");
  const lineKey = polyline.map((point) => point.join(",")).join(";");

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      void loadImage(controller.signal);
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };

    async function loadImage(signal: AbortSignal) {
      setLoading(true);
      setError("");
      try {
        const response = await fetch("/api/map-image", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            markers: markers.map((marker) => ({
              lat: marker.lat,
              lng: marker.lng,
              kind: marker.kind,
              label: marker.label,
            })),
            polyline,
          }),
          signal,
        });
        if (response.status === 401) {
          window.dispatchEvent(new Event("maslul-unauthorized"));
          return;
        }
        if (!response.ok) {
          const data = (await response.json().catch(() => ({}))) as { error?: string };
          throw new Error(data.error || "לא הצלחנו ליצור את תמונת המפה. נסו שוב.");
        }
        const blob = await response.blob();
        const nextUrl = URL.createObjectURL(blob);
        setUrl((current) => {
          if (current) URL.revokeObjectURL(current);
          return nextUrl;
        });
      } catch (reason) {
        if (signal.aborted) return;
        setError(reason instanceof Error ? reason.message : "לא הצלחנו ליצור את תמונת המפה. נסו שוב.");
      } finally {
        if (!signal.aborted) setLoading(false);
      }
    }
  }, [attempt, lineKey, markerKey, markers, polyline]);

  useEffect(() => {
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [url]);

  async function share() {
    if (!url) return;
    const blob = await fetch(url).then((response) => response.blob());
    const file = new File([blob], "maslul-map.png", { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: "מפת המסלול" });
      return;
    }
    download();
  }

  function download() {
    if (!url) return;
    const link = document.createElement("a");
    link.href = url;
    link.download = "maslul-map.png";
    link.click();
  }

  return (
    <section className="mt-4 rounded-3xl border border-line bg-paper p-3">
      <h3 className="px-1 font-semibold">תמונת מפה</h3>
      {loading ? <p className="px-1 py-6 text-sm text-muted">יוצרים תמונת מפה…</p> : null}
      {error ? (
        <div className="mt-2">
          <ErrorBanner message={error} onRetry={() => setAttempt((value) => value + 1)} />
        </div>
      ) : null}
      {url ? (
        // Blob URLs cannot be passed through next/image.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="תמונת מפת המסלול עם מספרי התחנות" className="mt-2 w-full rounded-2xl border border-line" />
      ) : null}
      <div className="mt-3 flex flex-wrap gap-2">
        <Button type="button" onClick={download} disabled={!url}>
          <Download className="h-4 w-4" />
          הורד תמונת מפה
        </Button>
        <Button type="button" variant="outline" onClick={() => void share()} disabled={!url}>
          <Share2 className="h-4 w-4" />
          שיתוף
        </Button>
      </div>
    </section>
  );
}
