"use client";

import { Copy, Navigation } from "lucide-react";
import dynamic from "next/dynamic";
import { useMemo } from "react";
import { toast } from "sonner";
import { ErrorBanner } from "@/components/error-banner";
import { MapImageCard } from "@/components/map-image-card";
import type { MapMarker } from "@/components/route-map";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatAddressList, googleMapsLinks, wazeLink } from "@/lib/links";
import { phoneToTel, splitPhones } from "@/lib/phone";
import { orderedStops } from "@/lib/route-model";
import { formatDuration } from "@/lib/time";
import type { RouteRecord } from "@/lib/types";

const RouteMap = dynamic(() => import("@/components/route-map").then((mod) => mod.RouteMap), {
  ssr: false,
  loading: () => <div className="h-72 animate-pulse rounded-2xl bg-line" />,
});

export function ResultsView({
  record,
  onSwap,
  onDwell,
  saving,
  saveError,
  onRetrySave,
}: {
  record: RouteRecord;
  onSwap: (index: number, direction: -1 | 1) => void;
  onDwell: (minutes: number) => void;
  saving: boolean;
  saveError: string;
  onRetrySave: () => void;
}) {
  const stops = orderedStops(record);
  const points = [record.start, ...stops, record.end];
  const links = googleMapsLinks(points);
  const markers = useMemo<MapMarker[]>(() => {
    const ordered = orderedStops(record);
    return [
      { ...record.start, kind: "start", label: "S", title: `יציאה: ${record.start.label}` },
      ...ordered.map((stop, index) => ({
        lat: stop.lat,
        lng: stop.lng,
        kind: "stop" as const,
        label: String(index + 1),
        title: stop.name || stop.address,
      })),
      { ...record.end, kind: "end", label: "E", title: `סיום: ${record.end.label}` },
    ];
  }, [record]);

  return (
    <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
      <div className="contents lg:flex lg:flex-col lg:gap-4">
        <section className="order-1 rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow)]">
          <p className="text-sm text-muted">סיכום היום</p>
          <h2 className="mt-1 text-2xl font-semibold">
            {stops.length} תחנות · {record.totalKm.toFixed(1)} ק״מ · {formatDuration(record.totalMinutes)}
          </h2>
          <p className="mt-1 text-lg">
            יציאה {record.departureTime} · סיום <span dir="ltr">{record.finishEta}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            {record.distanceSource === "estimate"
              ? "מרחקים משוערים (אין מפתח OpenRouteService)"
              : "זמני נסיעה לפי כבישים"}
            {record.manual ? " · הסדר עודכן ידנית" : ""}
            {saving ? " · שומרים להיסטוריה…" : ""}
          </p>
          <div className="mt-4 flex items-end gap-3">
            <div>
              <Label htmlFor="dwell-result">זמן עצירה בכל תחנה (דקות)</Label>
              <Input
                id="dwell-result"
                className="mt-1 w-28"
                inputMode="numeric"
                value={String(record.dwellMinutes)}
                onChange={(event) => onDwell(clampDwell(event.target.value))}
              />
            </div>
          </div>
        </section>

        <section className="order-2 rounded-3xl border border-line bg-paper p-4">
          <h3 className="font-semibold">למה הסדר הזה</h3>
          <p className="mt-2 whitespace-pre-wrap text-base leading-7">{record.explanation}</p>
          {record.warnings.length ? (
            <ul className="mt-3 space-y-2">
              {record.warnings.map((warning) => (
                <li key={warning} className="rounded-xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn">
                  {warning}
                </li>
              ))}
            </ul>
          ) : null}
          {saveError ? (
            <div className="mt-3">
              <ErrorBanner message={saveError} onRetry={onRetrySave} />
            </div>
          ) : null}
        </section>

        <div className="order-4 space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" onClick={() => copy(formatAddressList(stops), "כל הכתובות הועתקו")}>
              <Copy className="h-4 w-4" />
              העתק את כל הכתובות
            </Button>
            {links.map((href, index) => (
              <Button key={href} asChild>
                <a href={href} target="_blank" rel="noreferrer">
                  <Navigation className="h-4 w-4" />
                  {links.length > 1 ? `גוגל מפות, חלק ${index + 1}` : "פתח בגוגל מפות"}
                </a>
              </Button>
            ))}
          </div>
          {stops.map((stop, index) => {
            const leg = record.legs[index];
            const phones = splitPhones(stop.phone);
            return (
              <article key={stop.id} className="rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow)]">
                <div className="flex items-start gap-3">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">
                    {index + 1}
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-xl font-semibold">{stop.name || "בלי שם"}</h3>
                    <p>{stop.address}</p>
                    {stop.note ? <p className="mt-1 font-bold whitespace-pre-wrap text-danger">{stop.note}</p> : null}
                    {leg ? (
                      <p className="mt-2 text-sm text-muted">
                        {leg.km.toFixed(1)} ק״מ · {leg.minutes === 0 ? "פחות מדקה" : `${leg.minutes} דק׳`}{" "}
                        {index === 0 ? "מהמוצא" : "מהתחנה הקודמת"}
                        {leg.waitMinutes > 0 ? ` · המתנה ${leg.waitMinutes} דק׳` : ""} · הגעה{" "}
                        <span dir="ltr">{leg.eta}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button asChild variant="outline">
                    <a href={wazeLink(stop)} target="_blank" rel="noreferrer">
                      פתח בוויז
                    </a>
                  </Button>
                  <Button type="button" variant="outline" onClick={() => copy(stop.address, "הכתובת הועתקה")}>
                    העתק כתובת
                  </Button>
                  {phones.length ? (
                    <Button asChild variant="outline">
                      <a href={`tel:${phoneToTel(phones[0])}`} target="_blank" rel="noreferrer">
                        {stop.contact ? `התקשר ${stop.contact}` : "התקשר"}
                      </a>
                    </Button>
                  ) : null}
                  {phones.length ? (
                    <Button type="button" variant="outline" onClick={() => copy(stop.phone, "המספר הועתק")}>
                      העתק מספר
                    </Button>
                  ) : null}
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="הקדמת התחנה"
                    disabled={index === 0}
                    onClick={() => onSwap(index, -1)}
                  >
                    ▲
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="outline"
                    aria-label="דחיית התחנה"
                    disabled={index === stops.length - 1}
                    onClick={() => onSwap(index, 1)}
                  >
                    ▼
                  </Button>
                </div>
              </article>
            );
          })}
        </div>
      </div>

      <aside className="order-3 lg:sticky lg:top-20">
        <RouteMap markers={markers} polyline={record.polyline} className="h-80 lg:h-[32rem]" />
        <MapImageCard markers={markers} polyline={record.polyline} />
        <p className="mt-2 text-sm text-muted">
          S יציאה · המספרים הם סדר הנסיעה · E סיום.{" "}
          {record.geometrySource === "openrouteservice"
            ? "הקו על המפה עובר על כבישים."
            : "הקו על המפה הוא חיבור ישיר בין הנקודות."}
        </p>
      </aside>
    </div>
  );
}

function clampDwell(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(180, Math.max(0, Math.round(parsed)));
}

async function copy(value: string, success: string) {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(success);
  } catch {
    toast.error("לא הצלחנו להעתיק. נסו שוב.");
  }
}
