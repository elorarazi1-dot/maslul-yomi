"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { GeocodeOutcome } from "@/lib/geocode";
import { api } from "@/lib/client-api";
import { inIsrael } from "@/lib/geo";
import { interpretNote } from "@/lib/parser";
import type { GeoCandidate, LatLng, PlaceFix, ReviewPayload, StopLocation, WhenHint } from "@/lib/types";

const PinMap = dynamic(() => import("@/components/route-map").then((mod) => mod.PinMap), { ssr: false });

export function ReviewPanel({
  review,
  onChange,
  onBack,
  onCompute,
}: {
  review: ReviewPayload;
  onChange: (next: ReviewPayload) => void;
  onBack: () => void;
  onCompute: () => void;
}) {
  const [pinFor, setPinFor] = useState<string | null>(null);
  const [pin, setPin] = useState<LatLng | null>(null);
  const [pinError, setPinError] = useState("");
  const problems = review.stops.filter((stop) => stop.geoStatus !== "ok").length;

  function updateStop(id: string, patch: Partial<StopLocation>) {
    onChange({
      ...review,
      stops: review.stops.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)),
    });
  }

  async function geocodeStop(stop: StopLocation) {
    updateStop(stop.id, { geoStatus: "missing", geoLabel: "מחפשים…" });
    const hint =
      review.start.lat != null && review.start.lng != null
        ? { lat: review.start.lat, lng: review.start.lng }
        : undefined;
    const result = await api<GeocodeOutcome>("/api/geocode", {
      method: "POST",
      body: JSON.stringify({ address: stop.address, refresh: true, hint }),
    });
    if (!result.ok) {
      updateStop(stop.id, { geoStatus: "missing", geoLabel: result.error, lat: null, lng: null, candidates: [] });
      return;
    }
    updateStop(stop.id, {
      lat: result.data.lat,
      lng: result.data.lng,
      geoStatus: result.data.status,
      geoLabel: result.data.label,
      candidates: result.data.candidates,
    });
  }

  async function geocodePlace(which: "start" | "end", label: string) {
    const result = await api<GeocodeOutcome>("/api/geocode", {
      method: "POST",
      body: JSON.stringify({ address: label, refresh: true }),
    });
    const current = review[which];
    const next: PlaceFix = result.ok
      ? {
          label,
          lat: result.data.lat,
          lng: result.data.lng,
          geoStatus: result.data.status,
          resolvedLabel: result.data.label,
          candidates: result.data.candidates,
        }
      : { ...current, label, lat: null, lng: null, geoStatus: "missing", resolvedLabel: result.error, candidates: [] };
    onChange({ ...review, [which]: next });
  }

  function choose(id: string, candidate: GeoCandidate) {
    if (id === "start" || id === "end") {
      onChange({
        ...review,
        [id]: {
          ...review[id],
          lat: candidate.lat,
          lng: candidate.lng,
          geoStatus: "ok",
          resolvedLabel: candidate.label,
        },
      });
      return;
    }
    updateStop(id, { lat: candidate.lat, lng: candidate.lng, geoStatus: "ok", geoLabel: candidate.label });
  }

  function applyPin() {
    if (!pinFor || !pin) return;
    if (!inIsrael(pin)) {
      setPinError("הנקודה מחוץ לישראל. סמנו נקודה בתוך הארץ.");
      return;
    }
    choose(pinFor, { ...pin, label: "נקודה שסומנה על המפה" });
    setPinFor(null);
    setPin(null);
    setPinError("");
  }

  return (
    <div className="mx-auto max-w-3xl pb-28">
      <p className="text-sm text-muted">
        {review.extractor === "llm"
          ? "התחנות פוענחו מהתמונה. בדקו כל שורה לפני החישוב."
          : "התחנות פוענחו מהטקסט. בדקו כל שורה לפני החישוב."}
      </p>
      <h2 className="mt-1 text-2xl font-semibold">בדיקת התחנות</h2>
      {review.warnings.map((warning) => (
        <p key={warning} className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn">
          {warning}
        </p>
      ))}
      {problems > 0 ? (
        <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn">
          {problems === 1 ? "תחנה אחת בלי מיקום ודאי." : `${problems} תחנות בלי מיקום ודאי.`} תקנו את הכתובת, בחרו מועמד, או סמנו על המפה.
        </p>
      ) : null}

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <PlaceCard title="נקודת יציאה" place={review.start} onLabel={(label) => onChange({ ...review, start: { ...review.start, label } })} onBlur={() => geocodePlace("start", review.start.label)} onPick={(candidate) => choose("start", candidate)} onPin={() => openPin("start")} />
        <PlaceCard title="נקודת סיום" place={review.end} onLabel={(label) => onChange({ ...review, end: { ...review.end, label } })} onBlur={() => geocodePlace("end", review.end.label)} onPick={(candidate) => choose("end", candidate)} onPin={() => openPin("end")} />
      </div>

      <div className="mt-4 space-y-3">
        {review.stops.map((stop, index) => (
          <article key={stop.id} className="rounded-3xl border border-line bg-paper p-4">
            <div className="mb-3 flex items-center justify-between gap-2">
              <h3 className="font-semibold">תחנה {index + 1}</h3>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onChange({ ...review, stops: review.stops.filter((item) => item.id !== stop.id) })}
              >
                מחיקה
              </Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="שם" value={stop.name} onChange={(name) => updateStop(stop.id, { name })} />
              <Field label="טלפון" value={stop.phone} onChange={(phone) => updateStop(stop.id, { phone })} dir="ltr" />
              <div className="sm:col-span-2">
                <Field
                  label="כתובת"
                  value={stop.address}
                  onChange={(address) => updateStop(stop.id, { address })}
                  onBlur={() => geocodeStop({ ...stop })}
                />
              </div>
              <Field label="איש קשר" value={stop.contact} onChange={(contact) => updateStop(stop.id, { contact })} />
              <div>
                <Label>אילוץ מההערה</Label>
                <select
                  className="mt-1 h-12 w-full rounded-xl border border-line bg-paper px-3"
                  value={stop.when}
                  onChange={(event) => updateStop(stop.id, { when: event.target.value as WhenHint })}
                >
                  <option value="">ללא אילוץ</option>
                  <option value="early">מוקדם — לפני שאר התחנות</option>
                  <option value="late">מאוחר — אחרי שאר התחנות</option>
                </select>
              </div>
              <div>
                <Label htmlFor={`${stop.id}-from`}>לא לפני</Label>
                <Input
                  id={`${stop.id}-from`}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="06:00"
                  className="mt-1"
                  value={stop.window?.from ?? ""}
                  onChange={(event) => updateStop(stop.id, { window: cleanWindow(event.target.value, stop.window?.to) })}
                />
              </div>
              <div>
                <Label htmlFor={`${stop.id}-to`}>לא אחרי</Label>
                <Input
                  id={`${stop.id}-to`}
                  dir="ltr"
                  inputMode="numeric"
                  placeholder="10:00"
                  className="mt-1"
                  value={stop.window?.to ?? ""}
                  onChange={(event) => updateStop(stop.id, { window: cleanWindow(stop.window?.from, event.target.value) })}
                />
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor={`${stop.id}-note`}>הערה</Label>
                <Textarea
                  id={`${stop.id}-note`}
                  className="mt-1 min-h-20 font-bold text-danger"
                  value={stop.note}
                  onChange={(event) => updateStop(stop.id, { note: event.target.value })}
                  onBlur={(event) => {
                    const interpreted = interpretNote(event.target.value);
                    updateStop(stop.id, { note: event.target.value, when: interpreted.when, window: interpreted.window });
                  }}
                />
              </div>
            </div>
            <GeoStatus stop={stop} onPick={(candidate) => choose(stop.id, candidate)} onPin={() => openPin(stop.id)} onRetry={() => geocodeStop(stop)} />
          </article>
        ))}
      </div>

      <Button
        type="button"
        variant="outline"
        className="mt-4 w-full"
        onClick={() =>
          onChange({
            ...review,
            stops: [
              ...review.stops,
              {
                id: crypto.randomUUID(),
                name: "",
                address: "",
                note: "",
                when: "",
                contact: "",
                phone: "",
                lat: null,
                lng: null,
                geoStatus: "missing",
                candidates: [],
              },
            ],
          })
        }
      >
        הוספת תחנה
      </Button>

      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-line bg-canvas/95 p-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl gap-2">
          <Button type="button" variant="outline" onClick={onBack}>
            חזרה
          </Button>
          <Button type="button" size="lg" className="flex-1" onClick={onCompute}>
            חשב מסלול
          </Button>
        </div>
      </div>

      <Dialog open={pinFor != null} onOpenChange={(open) => !open && setPinFor(null)}>
        <DialogContent>
          <DialogTitle>סימון על המפה</DialogTitle>
          <DialogDescription>לחצו על המפה כדי לקבוע את המיקום בתוך ישראל.</DialogDescription>
          <div className="mt-3">
            <PinMap
              center={
                review.start.lat != null && review.start.lng != null
                  ? { lat: review.start.lat, lng: review.start.lng }
                  : { lat: 32.08, lng: 34.9 }
              }
              value={pin}
              onPick={(point) => {
                setPin(point);
                setPinError("");
              }}
            />
          </div>
          {pinError ? (
            <div className="mt-3">
              <ErrorBanner message={pinError} />
            </div>
          ) : null}
          <Button type="button" className="mt-3 w-full" onClick={applyPin} disabled={!pin}>
            שימוש בנקודה הזו
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  );

  function openPin(id: string) {
    setPin(null);
    setPinError("");
    setPinFor(id);
  }
}

function PlaceCard({
  title,
  place,
  onLabel,
  onBlur,
  onPick,
  onPin,
}: {
  title: string;
  place: PlaceFix;
  onLabel: (label: string) => void;
  onBlur: () => void;
  onPick: (candidate: GeoCandidate) => void;
  onPin: () => void;
}) {
  return (
    <div className="rounded-3xl border border-line bg-paper p-4">
      <Label>{title}</Label>
      <Input className="mt-1" value={place.label} onChange={(event) => onLabel(event.target.value)} onBlur={onBlur} />
      <StatusLine status={place.geoStatus} label={place.resolvedLabel} />
      <CandidateList candidates={place.candidates} onPick={onPick} />
      {place.geoStatus !== "ok" ? (
        <Button type="button" variant="outline" className="mt-2" onClick={onPin}>
          סמן על המפה
        </Button>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  onBlur,
  dir,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  dir?: "ltr";
}) {
  return (
    <div>
      <Label>{label}</Label>
      <Input className="mt-1" dir={dir} value={value} onChange={(event) => onChange(event.target.value)} onBlur={onBlur} />
    </div>
  );
}

function GeoStatus({
  stop,
  onPick,
  onPin,
  onRetry,
}: {
  stop: StopLocation;
  onPick: (candidate: GeoCandidate) => void;
  onPin: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="mt-3">
      <StatusLine status={stop.geoStatus} label={stop.geoLabel} />
      <CandidateList candidates={stop.candidates} onPick={onPick} />
      {stop.geoStatus !== "ok" ? (
        <div className="mt-2 flex flex-wrap gap-2">
          <Button type="button" variant="outline" onClick={onRetry}>
            חפשו שוב
          </Button>
          <Button type="button" variant="outline" onClick={onPin}>
            סמן על המפה
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function StatusLine({ status, label }: { status: string; label?: string }) {
  if (status === "ok") return <p className="mt-2 text-sm text-ok">נמצא במפה{label ? `: ${label}` : ""}</p>;
  if (label === "מחפשים…") return <p className="mt-2 text-sm text-muted">מחפשים את הכתובת…</p>;
  if (status === "ambiguous") return <p className="mt-2 text-sm font-medium text-warn">יש כמה התאמות. בחרו את הנכונה.</p>;
  return <p className="mt-2 text-sm font-medium text-warn">הכתובת לא נמצאה בוודאות. תקנו אותה או סמנו נקודה.</p>;
}

function CandidateList({
  candidates,
  onPick,
}: {
  candidates: GeoCandidate[];
  onPick: (candidate: GeoCandidate) => void;
}) {
  if (candidates.length < 2) return null;
  return (
    <div className="mt-2 flex flex-col gap-2">
      {candidates.map((candidate) => (
        <Button key={`${candidate.lat},${candidate.lng},${candidate.label}`} type="button" variant="outline" onClick={() => onPick(candidate)}>
          {candidate.label}
        </Button>
      ))}
    </div>
  );
}

function cleanWindow(from?: string, to?: string) {
  const window = { from: from || undefined, to: to || undefined };
  return window.from || window.to ? window : undefined;
}
