"use client";

import { useEffect, useRef, useState } from "react";
import { browserHistoryStore, saveHistoryRecord } from "@/lib/history-store";
import { swapNeighbor } from "@/lib/optimizer";
import { recomputeRecord } from "@/lib/route-model";
import type { RouteRecord } from "@/lib/types";

export function useRouteEditor(record: RouteRecord | null, setRecord: (record: RouteRecord) => void) {
  const recordRef = useRef(record);
  const ticket = useRef(0);
  useEffect(() => {
    recordRef.current = record;
  }, [record]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  function persist(next: RouteRecord) {
    recordRef.current = next;
    setRecord(next);
    const id = ++ticket.current;
    setSaving(false);
    try {
      saveHistoryRecord(browserHistoryStore(), next);
      if (id === ticket.current) setSaveError("");
    } catch {
      if (id === ticket.current) setSaveError("לא הצלחנו לשמור את המסלול בדפדפן. נסו שוב.");
    }
  }

  function swap(index: number, direction: -1 | 1) {
    const current = recordRef.current;
    if (!current) return;
    const order = swapNeighbor(current.order, index, direction);
    if (order.every((value, position) => value === current.order[position])) return;
    void persist(recomputeRecord(current, { order, manual: true }));
  }

  function setDwell(dwellMinutes: number) {
    const current = recordRef.current;
    if (!current) return;
    void persist(
      recomputeRecord(current, {
        dwellMinutes,
        order: current.order,
        manual: current.manual,
        geometrySource: current.geometrySource,
        polyline: current.polyline,
      }),
    );
  }

  return {
    swap,
    setDwell,
    saving,
    saveError,
    retrySave: () => {
      if (recordRef.current) void persist(recordRef.current);
    },
  };
}
