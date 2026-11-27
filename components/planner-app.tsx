"use client";

import { Camera, ClipboardPaste, ImagePlus } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState, type ClipboardEvent } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { ResultsView } from "@/components/results-view";
import { ReviewPanel } from "@/components/review-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useRouteEditor } from "@/components/use-route-editor";
import {
  MISSING_VISION_MESSAGE,
  imageFileFromClipboard,
  isMobileCaptureDevice,
  photoExtractRequest,
  selectCaptureStrategy,
} from "@/lib/camera-capture";
import { api } from "@/lib/client-api";
import { browserHistoryStore, readHistory, saveHistoryRecord, summarizeHistory } from "@/lib/history-store";
import { fileToPayload } from "@/lib/image-file";
import { SAMPLE_SHEET } from "@/lib/sample";
import { formatDuration, formatWhen } from "@/lib/time";
import type { ReviewPayload, RouteRecord, RouteSummary } from "@/lib/types";

type Phase = "input" | "working" | "review" | "results";

export function PlannerApp() {
  const [phase, setPhase] = useState<Phase>("input");
  const [workLabel, setWorkLabel] = useState("עובדים על המסלול…");
  const [error, setError] = useState("");
  const retryRef = useRef<(() => void) | null>(null);
  const [startLabel, setStartLabel] = useState("כפר סבא");
  const [endLabel, setEndLabel] = useState("כפר סבא");
  const [departure, setDeparture] = useState("06:00");
  const [dwell, setDwell] = useState("0");
  const [text, setText] = useState("");
  const [image, setImage] = useState<{ name: string; base64: string; mediaType: string; previewUrl: string } | null>(null);
  const [visionReady, setVisionReady] = useState<boolean | null>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [review, setReview] = useState<ReviewPayload | null>(null);
  const [record, setRecord] = useState<RouteRecord | null>(null);
  const [recent, setRecent] = useState<RouteSummary[]>([]);
  const [recentError, setRecentError] = useState("");
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const editor = useRouteEditor(record, setRecord);

  useEffect(() => {
    const timer = window.setTimeout(() => void loadRecent(), 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      fetch("/api/status")
        .then(async (response) => {
          const data = (await response.json()) as { vision?: boolean };
          setVisionReady(Boolean(data.vision));
        })
        .catch(() => setVisionReady(null));
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (image?.previewUrl) URL.revokeObjectURL(image.previewUrl);
    };
  }, [image?.previewUrl]);

  useEffect(() => {
    const video = videoRef.current;
    const stream = streamRef.current;
    if (!liveOpen || !video || !stream) return;
    video.srcObject = stream;
    void video.play().catch(() => undefined);
  }, [liveOpen]);

  function loadRecent() {
    try {
      setRecent(readHistory(browserHistoryStore()).slice(0, 5).map(summarizeHistory));
      setRecentError("");
    } catch {
      setRecentError("לא הצלחנו לקרוא את ההיסטוריה בדפדפן. נסו שוב.");
    }
  }

  function rememberPhoto(file: File, payload: { base64: string; mediaType: string }) {
    const previewUrl = URL.createObjectURL(file);
    setImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return { name: file.name || "צילום הדף", previewUrl, ...payload };
    });
    setError("");
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    try {
      rememberPhoto(file, await fileToPayload(file));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "לא הצלחנו לקרוא את התמונה. נסו שוב.");
      retryRef.current = null;
    }
  }

  function stopLiveCamera() {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
  }

  async function openCamera() {
    const mobile = isMobileCaptureDevice(
      navigator.userAgent,
      window.matchMedia("(pointer: coarse)").matches,
    );
    const liveCameraAvailable = Boolean(navigator.mediaDevices?.getUserMedia);
    const strategy = selectCaptureStrategy({ mobile, liveCameraAvailable });
    if (strategy === "environment-file") {
      cameraRef.current?.click();
      return;
    }
    if (strategy === "file-picker") {
      fileRef.current?.click();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false,
      });
      streamRef.current = stream;
      setLiveOpen(true);
    } catch {
      fileRef.current?.click();
    }
  }

  async function shootFrame() {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")?.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
    stopLiveCamera();
    setLiveOpen(false);
    if (!blob) {
      setError("לא הצלחנו לשמור את הצילום. נסו שוב.");
      return;
    }
    await onFile(new File([blob], "sheet-camera.jpg", { type: "image/jpeg" }));
  }

  function clearPhoto() {
    setImage((current) => {
      if (current?.previewUrl) URL.revokeObjectURL(current.previewUrl);
      return null;
    });
  }

  function onPaste(event: ClipboardEvent<HTMLFormElement>) {
    const file = imageFileFromClipboard(Array.from(event.clipboardData.items));
    if (!file) return;
    event.preventDefault();
    void onFile(file);
  }

  async function build() {
    setError("");
    setPhase("working");
    setWorkLabel(image ? "קוראים את הדף ומאתרים כתובות…" : "קוראים את הרשימה ומאתרים כתובות…");
    const result = await api<ReviewPayload>("/api/extract", {
      method: "POST",
      body: JSON.stringify(
        photoExtractRequest({
          text,
          photo: image ? { base64: image.base64, mediaType: image.mediaType } : null,
          startLabel,
          endLabel,
        }),
      ),
    });
    if (!result.ok) {
      setPhase("input");
      setError(result.error);
      retryRef.current = () => void build();
      return;
    }
    setReview(result.data);
    setPhase("review");
  }

  async function compute() {
    if (!review) return;
    if (review.start.lat == null || review.end.lat == null || review.stops.some((stop) => stop.lat == null || stop.lng == null)) {
      setError("יש כתובת בלי מיקום. תקנו אותה, בחרו מועמד, או סמנו נקודה על המפה.");
      retryRef.current = null;
      return;
    }
    if (review.stops.length === 0) {
      setError("אין תחנות לחישוב. הוסיפו לפחות תחנה אחת.");
      return;
    }
    setError("");
    setPhase("working");
    setWorkLabel("מחשבים את המסלול…");
    const result = await api<{ record: RouteRecord }>("/api/plan", {
      method: "POST",
      body: JSON.stringify({
        departureTime: departure,
        dwellMinutes: clampDwell(dwell),
        start: { label: review.start.label, lat: review.start.lat, lng: review.start.lng },
        end: { label: review.end.label, lat: review.end.lat, lng: review.end.lng },
        stops: review.stops.map((stop) => ({
          ...stop,
          lat: stop.lat,
          lng: stop.lng,
        })),
      }),
    });
    if (!result.ok) {
      setPhase("review");
      setError(result.error);
      retryRef.current = () => void compute();
      return;
    }
    setRecord(result.data.record);
    try {
      saveHistoryRecord(browserHistoryStore(), result.data.record);
    } catch {
      setError("המסלול חושב, אבל השמירה בדפדפן נכשלה. נסו שוב.");
      retryRef.current = () => void compute();
    }
    setPhase("results");
    loadRecent();
  }

  return (
    <div>
      <Steps phase={phase} />
      {error && phase !== "working" ? (
        <div className="mb-4">
          <ErrorBanner message={error} onRetry={retryRef.current ?? undefined} />
        </div>
      ) : null}

      {phase === "working" ? (
        <div role="status" className="rounded-3xl border border-line bg-paper p-8 text-center">
          <p className="text-xl font-semibold">{workLabel}</p>
          <p className="mt-2 text-muted">זה יכול לקחת כמה שניות, במיוחד בחיפוש כתובות.</p>
        </div>
      ) : null}

      {phase === "input" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <form
            className="rounded-3xl border border-line bg-paper p-4 shadow-[var(--shadow)] sm:p-6"
            onSubmit={(event) => {
              event.preventDefault();
              void build();
            }}
            onPaste={onPaste}
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="start">נקודת יציאה</Label>
                <Input id="start" className="mt-1" placeholder="כפר סבא" value={startLabel} onChange={(event) => setStartLabel(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="end">נקודת סיום</Label>
                <Input id="end" className="mt-1" placeholder="כפר סבא" value={endLabel} onChange={(event) => setEndLabel(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="departure">שעת יציאה</Label>
                <Input id="departure" className="mt-1" dir="ltr" inputMode="numeric" placeholder="06:00" value={departure} onChange={(event) => setDeparture(event.target.value)} />
              </div>
              <div>
                <Label htmlFor="dwell">זמן עצירה בכל תחנה (דקות)</Label>
                <Input id="dwell" className="mt-1" inputMode="numeric" value={dwell} onChange={(event) => setDwell(event.target.value)} />
              </div>
            </div>

            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <Button type="button" size="lg" className="sm:col-span-2" onClick={() => void openCamera()}>
                <Camera className="h-5 w-5" />
                צלם דף
              </Button>
              <Button type="button" variant="outline" onClick={() => document.getElementById("sheet")?.focus()}>
                <ClipboardPaste className="h-4 w-4" />
                הדבק טקסט
              </Button>
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4" />
                העלה תמונה
              </Button>
            </div>
            <p className="mt-2 text-sm text-muted">אפשר גם להדביק תמונה מהלוח עם Ctrl+V או לחיצה ארוכה.</p>
            {visionReady === false ? (
              <p className="mt-3 rounded-xl bg-warn-bg px-3 py-2 text-sm font-medium text-warn">{MISSING_VISION_MESSAGE}</p>
            ) : null}
            <input
              ref={cameraRef}
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              aria-label="צילום הדף במצלמה"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={fileRef}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              aria-label="העלאת תמונה של הדף"
              onChange={(event) => {
                void onFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />

            <Label htmlFor="sheet" className="mt-4 block">
              רשימת התחנות
            </Label>
            <Textarea
              id="sheet"
              className="mt-1"
              placeholder="כל עצירה בפסקה: שם, כתובת ועיר, טלפון, והערה אם יש."
              value={text}
              onChange={(event) => setText(event.target.value)}
            />
            {image ? (
              <div className="mt-3 rounded-2xl border border-line p-3">
                {/* Local preview of a camera or clipboard photo. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image.previewUrl} alt="תצוגה של הדף שצולם" className="max-h-64 w-full rounded-xl object-contain" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button type="button" variant="outline" onClick={() => void openCamera()}>
                    צלם שוב
                  </Button>
                  <Button type="button" variant="ghost" onClick={clearPhoto}>
                    הסר
                  </Button>
                </div>
              </div>
            ) : null}
            <div className="mt-4 flex flex-col gap-2 sm:flex-row">
              <Button type="button" variant="outline" onClick={() => setText(SAMPLE_SHEET)}>
                טען דוגמה
              </Button>
              <Button type="submit" size="lg" className="sm:flex-1">
                בנה לי מסלול
              </Button>
            </div>
            <Dialog
              open={liveOpen}
              onOpenChange={(open) => {
                if (!open) {
                  stopLiveCamera();
                  setLiveOpen(false);
                }
              }}
            >
              <DialogContent>
                <DialogTitle>צלם דף</DialogTitle>
                <DialogDescription>כוונו את המצלמה אל הדף המודפס ולחצו צילום.</DialogDescription>
                <video ref={videoRef} className="mt-3 w-full rounded-2xl bg-black" autoPlay playsInline muted />
                <div className="mt-3 flex gap-2">
                  <Button type="button" className="flex-1" onClick={() => void shootFrame()}>
                    צילום
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      stopLiveCamera();
                      setLiveOpen(false);
                    }}
                  >
                    ביטול
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </form>

          <aside className="space-y-4">
            <section className="rounded-3xl border border-line bg-paper p-4">
              <h2 className="font-semibold">איך בונים יום</h2>
              <ol className="mt-2 space-y-2 text-sm text-muted">
                <li>1. מעלים את דף התחנות או מדביקים אותו.</li>
                <li>2. מתקנים שמות, כתובות והערות.</li>
                <li>3. המסלול מסודר לפי זמן נהיגה, לא לפי השעות שבצד הדף.</li>
              </ol>
            </section>
            <section className="rounded-3xl border border-line bg-paper p-4">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">מסלולים אחרונים</h2>
                <Link href="/history" className="text-sm font-semibold text-accent">
                  הכל
                </Link>
              </div>
              {recentError ? (
                <div className="mt-3">
                  <ErrorBanner message={recentError} onRetry={() => void loadRecent()} />
                </div>
              ) : recent.length === 0 ? (
                <p className="mt-2 text-sm text-muted">עוד אין מסלולים שמורים בדפדפן הזה. אחרי החישוב הראשון הם יופיעו כאן.</p>
              ) : (
                <ul className="mt-2 space-y-2">
                  {recent.map((item) => (
                    <li key={item.id}>
                      <Link href={`/history/${item.id}`} className="block rounded-xl px-2 py-2 hover:bg-canvas">
                        <span className="block font-medium">{formatWhen(item.createdAt)}</span>
                        <span className="text-sm text-muted">
                          {item.stopCount} תחנות · {item.totalKm.toFixed(1)} ק״מ · {formatDuration(item.totalMinutes)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </aside>
        </div>
      ) : null}

      {phase === "review" && review ? (
        <ReviewPanel
          review={review}
          onChange={setReview}
          onBack={() => {
            setError("");
            setPhase("input");
          }}
          onCompute={() => void compute()}
        />
      ) : null}

      {phase === "results" && record ? (
        <div>
          <Button
            type="button"
            variant="outline"
            className="mb-4"
            onClick={() => {
              setPhase("review");
            }}
          >
            חזרה לבדיקה
          </Button>
          <ResultsView
            record={record}
            onSwap={editor.swap}
            onDwell={editor.setDwell}
            saving={editor.saving}
            saveError={editor.saveError}
            onRetrySave={editor.retrySave}
          />
        </div>
      ) : null}
    </div>
  );
}

function Steps({ phase }: { phase: Phase }) {
  const current = phase === "results" ? 3 : phase === "review" ? 2 : 1;
  const steps = ["קלט", "בדיקה", "מסלול"];
  return (
    <ol className="mb-4 flex gap-2 text-sm">
      {steps.map((label, index) => (
        <li
          key={label}
          className={`rounded-full px-3 py-1 font-semibold ${index + 1 === current ? "bg-accent text-accent-ink" : "bg-paper text-muted"}`}
        >
          {index + 1}. {label}
        </li>
      ))}
    </ol>
  );
}

function clampDwell(value: string): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.min(180, Math.max(0, Math.round(parsed)));
}
