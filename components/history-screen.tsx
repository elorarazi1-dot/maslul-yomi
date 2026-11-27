"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ErrorBanner } from "@/components/error-banner";
import { ResultsView } from "@/components/results-view";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useRouteEditor } from "@/components/use-route-editor";
import {
  browserHistoryStore,
  deleteHistoryRecord,
  getHistoryRecord,
  readHistory,
  summarizeHistory,
} from "@/lib/history-store";
import { formatDuration, formatWhen } from "@/lib/time";
import type { RouteRecord, RouteSummary } from "@/lib/types";

export function HistoryScreen() {
  const [routes, setRoutes] = useState<RouteSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<RouteSummary | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    try {
      setRoutes(readHistory(browserHistoryStore()).map(summarizeHistory));
      setError("");
    } catch {
      setError("לא הצלחנו לקרוא את ההיסטוריה בדפדפן. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  function remove(id: string) {
    try {
      deleteHistoryRecord(browserHistoryStore(), id);
      setRoutes((current) => current.filter((item) => item.id !== id));
      setPendingDelete(null);
    } catch {
      setError("מחיקת המסלול נכשלה. נסו שוב.");
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-semibold">היסטוריית מסלולים</h1>
      <p className="mt-1 text-muted">המסלולים נשמרים רק בדפדפן הזה, לא בשרת. הם נשארים 30 יום, ואפשר למחוק כל רשומה.</p>
      {error ? (
        <div className="mt-4">
          <ErrorBanner message={error} onRetry={() => void load()} />
        </div>
      ) : null}
      {loading ? <p className="mt-6 text-muted">טוענים את ההיסטוריה…</p> : null}
      {!loading && !error && routes.length === 0 ? (
        <p className="mt-6 rounded-3xl border border-line bg-paper p-6">
          אין עדיין מסלולים.{" "}
          <Link href="/" className="font-semibold text-accent">
            בנו מסלול חדש
          </Link>
        </p>
      ) : null}
      <ul className="mt-4 space-y-3">
        {routes.map((route) => (
          <li key={route.id} className="rounded-3xl border border-line bg-paper p-4">
            <Link href={`/history/${route.id}`} className="block">
              <span className="block text-lg font-semibold">{formatWhen(route.createdAt)}</span>
              <span className="mt-1 block text-sm text-muted">
                יציאה {route.departureTime} · {route.stopCount} תחנות · {route.totalKm.toFixed(1)} ק״מ ·{" "}
                {formatDuration(route.totalMinutes)} · סיום {route.finishEta}
              </span>
              <span className="mt-1 block text-sm">
                {route.startLabel} ← {route.endLabel}
              </span>
            </Link>
            <Button type="button" variant="ghost" className="mt-2 text-danger" onClick={() => setPendingDelete(route)}>
              מחיקה
            </Button>
          </li>
        ))}
      </ul>
      <Dialog open={pendingDelete != null} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent>
          <DialogTitle>למחוק את המסלול?</DialogTitle>
          <DialogDescription>המחיקה מסירה את המסלול מהדפדפן הזה.</DialogDescription>
          <div className="mt-4 flex gap-2">
            <Button type="button" variant="outline" onClick={() => setPendingDelete(null)}>
              ביטול
            </Button>
            <Button type="button" variant="danger" onClick={() => pendingDelete && remove(pendingDelete.id)}>
              מחקו
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function HistoryDetail({ id }: { id: string }) {
  const [record, setRecord] = useState<RouteRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const editor = useRouteEditor(record, setRecord);

  const load = useCallback(() => {
    setLoading(true);
    try {
      const stored = getHistoryRecord(browserHistoryStore(), id);
      if (!stored) {
        setError("המסלול לא נמצא בדפדפן הזה. ייתכן שנמחק.");
        setRecord(null);
      } else {
        setError("");
        setRecord(stored);
      }
    } catch {
      setError("לא הצלחנו לקרוא את המסלול. נסו שוב.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (loading) return <p className="text-muted">טוענים את המסלול…</p>;
  if (error || !record) {
    return <ErrorBanner message={error || "המסלול לא נמצא."} onRetry={() => void load()} />;
  }
  return (
    <div>
      <Link href="/history" className="mb-4 inline-flex font-semibold text-accent">
        חזרה להיסטוריה
      </Link>
      <ResultsView
        record={record}
        onSwap={editor.swap}
        onDwell={editor.setDwell}
        saving={editor.saving}
        saveError={editor.saveError}
        onRetrySave={editor.retrySave}
      />
    </div>
  );
}
